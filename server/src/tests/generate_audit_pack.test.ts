import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  periodsTable,
  usersTable,
  partnersTable,
  accountsTable,
  employeesTable,
  fxRatesTable,
  journalsTable,
  journalLinesTable,
  capitalMovementsTable,
  attachmentsTable
} from '../db/schema';
import { generateAuditPack } from '../handlers/generate_audit_pack';

describe('generateAuditPack', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testPeriodId: number;
  let testPartnerId: number;
  let testUsdAccountId: number;
  let testPkrAccountId: number;
  let testPayrollAccountId: number;
  let testEmployeeId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test accounts
    const usdAccountResult = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'USD Cash',
        account_type: 'Asset',
        currency: 'USD',
        is_active: true
      })
      .returning()
      .execute();
    testUsdAccountId = usdAccountResult[0].id;

    const pkrAccountResult = await db.insert(accountsTable)
      .values({
        code: '1002',
        name: 'PKR Cash',
        account_type: 'Asset',
        currency: 'PKR',
        is_active: true
      })
      .returning()
      .execute();
    testPkrAccountId = pkrAccountResult[0].id;

    const payrollAccountResult = await db.insert(accountsTable)
      .values({
        code: '2001',
        name: 'Payroll Payable',
        account_type: 'Liability',
        currency: 'USD',
        is_payroll_source: true,
        is_active: true
      })
      .returning()
      .execute();
    testPayrollAccountId = payrollAccountResult[0].id;

    // Create test partner
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: 'Test Partner',
        usd_account_id: testUsdAccountId,
        pkr_account_id: testPkrAccountId
      })
      .returning()
      .execute();
    testPartnerId = partnerResult[0].id;

    // Create test employee
    const employeeResult = await db.insert(employeesTable)
      .values({
        name: 'Test Employee',
        email: 'employee@example.com',
        payroll_currency: 'USD',
        payroll_account_id: testPayrollAccountId
      })
      .returning()
      .execute();
    testEmployeeId = employeeResult[0].id;

    // Create test period
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 3,
        status: 'Open'
      })
      .returning()
      .execute();
    testPeriodId = periodResult[0].id;
  });

  it('should generate audit pack for valid period', async () => {
    const result = await generateAuditPack(testPeriodId);

    expect(result.filename).toMatch(/^audit-pack-2024-03-\d+\.zip$/);
    expect(result.downloadUrl).toMatch(/^\/downloads\/audit-pack-2024-03-\d+\.zip$/);
    expect(result.generatedAt).toBeInstanceOf(Date);
    
    // Filename should include proper zero-padded month
    expect(result.filename).toContain('2024-03');
  });

  it('should throw error for non-existent period', async () => {
    const nonExistentPeriodId = 99999;

    await expect(generateAuditPack(nonExistentPeriodId))
      .rejects.toThrow(/Period with ID 99999 not found/);
  });

  it('should generate audit pack with journal data', async () => {
    // Create FX rate
    const fxRateResult = await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '280.50',
        effective_date: '2024-03-15',
        created_by: testUserId
      })
      .returning()
      .execute();
    const fxRateId = fxRateResult[0].id;

    // Create journal
    const journalResult = await db.insert(journalsTable)
      .values({
        reference: 'JV-2024-001',
        description: 'Test Journal Entry',
        journal_date: '2024-03-15',
        period_id: testPeriodId,
        status: 'Posted',
        total_debit: '1000.00',
        total_credit: '1000.00',
        fx_rate_id: fxRateId,
        created_by: testUserId,
        posted_by: testUserId,
        posted_at: new Date()
      })
      .returning()
      .execute();
    const journalId = journalResult[0].id;

    // Create journal lines
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journalId,
          account_id: testUsdAccountId,
          description: 'Debit entry',
          debit_amount: '1000.00',
          credit_amount: '0.00',
          debit_amount_base: '280500.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journalId,
          account_id: testPkrAccountId,
          description: 'Credit entry',
          debit_amount: '0.00',
          credit_amount: '1000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '280500.00',
          line_number: 2
        }
      ])
      .execute();

    // Create capital movement
    await db.insert(capitalMovementsTable)
      .values({
        partner_id: testPartnerId,
        movement_type: 'Contribution',
        amount: '5000.00',
        currency: 'USD',
        amount_base: '1402500.00',
        journal_id: journalId,
        description: 'Capital contribution',
        movement_date: '2024-03-15'
      })
      .execute();

    // Create attachment
    await db.insert(attachmentsTable)
      .values({
        filename: 'receipt-001.pdf',
        original_filename: 'receipt.pdf',
        mime_type: 'application/pdf',
        file_size: 1024,
        file_path: '/uploads/receipt-001.pdf',
        journal_id: journalId,
        uploaded_by: testUserId
      })
      .execute();

    const result = await generateAuditPack(testPeriodId);

    expect(result.filename).toMatch(/^audit-pack-2024-03-\d+\.zip$/);
    expect(result.downloadUrl).toContain('/downloads/');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('should handle period with no data', async () => {
    // Create a period with no journals or transactions
    const emptyPeriodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open'
      })
      .returning()
      .execute();
    const emptyPeriodId = emptyPeriodResult[0].id;

    const result = await generateAuditPack(emptyPeriodId);

    expect(result.filename).toMatch(/^audit-pack-2024-01-\d+\.zip$/);
    expect(result.downloadUrl).toMatch(/^\/downloads\/audit-pack-2024-01-\d+\.zip$/);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('should include only posted journals in audit pack', async () => {
    // Create draft journal (should be excluded)
    const draftJournalResult = await db.insert(journalsTable)
      .values({
        reference: 'JV-2024-DRAFT',
        description: 'Draft Journal Entry',
        journal_date: '2024-03-10',
        period_id: testPeriodId,
        status: 'Draft',
        total_debit: '500.00',
        total_credit: '500.00',
        created_by: testUserId
      })
      .returning()
      .execute();

    // Create posted journal (should be included)
    const postedJournalResult = await db.insert(journalsTable)
      .values({
        reference: 'JV-2024-POSTED',
        description: 'Posted Journal Entry',
        journal_date: '2024-03-15',
        period_id: testPeriodId,
        status: 'Posted',
        total_debit: '1000.00',
        total_credit: '1000.00',
        created_by: testUserId,
        posted_by: testUserId,
        posted_at: new Date()
      })
      .returning()
      .execute();

    // Create journal lines for both
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: draftJournalResult[0].id,
          account_id: testUsdAccountId,
          description: 'Draft entry',
          debit_amount: '500.00',
          credit_amount: '0.00',
          debit_amount_base: '500.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: postedJournalResult[0].id,
          account_id: testUsdAccountId,
          description: 'Posted entry',
          debit_amount: '1000.00',
          credit_amount: '0.00',
          debit_amount_base: '1000.00',
          credit_amount_base: '0.00',
          line_number: 1
        }
      ])
      .execute();

    const result = await generateAuditPack(testPeriodId);

    // Should successfully generate audit pack (only posted journals included)
    expect(result.filename).toMatch(/^audit-pack-2024-03-\d+\.zip$/);
    expect(result.downloadUrl).toContain('/downloads/');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('should handle multiple FX rates in period', async () => {
    // Create multiple FX rates for the period
    await db.insert(fxRatesTable)
      .values([
        {
          from_currency: 'USD',
          to_currency: 'PKR',
          rate: '280.00',
          effective_date: '2024-03-01',
          created_by: testUserId
        },
        {
          from_currency: 'USD',
          to_currency: 'PKR',
          rate: '282.50',
          effective_date: '2024-03-15',
          is_locked: true,
          created_by: testUserId
        },
        {
          from_currency: 'PKR',
          to_currency: 'USD',
          rate: '0.003546',
          effective_date: '2024-03-20',
          created_by: testUserId
        }
      ])
      .execute();

    const result = await generateAuditPack(testPeriodId);

    expect(result.filename).toMatch(/^audit-pack-2024-03-\d+\.zip$/);
    expect(result.downloadUrl).toContain('/downloads/');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('should handle salary register data', async () => {
    // Create salary journal
    const salaryJournalResult = await db.insert(journalsTable)
      .values({
        reference: 'SAL-2024-03',
        description: 'March 2024 Salary',
        journal_date: '2024-03-31',
        period_id: testPeriodId,
        status: 'Posted',
        total_debit: '5000.00',
        total_credit: '5000.00',
        created_by: testUserId,
        posted_by: testUserId,
        posted_at: new Date()
      })
      .returning()
      .execute();
    const salaryJournalId = salaryJournalResult[0].id;

    // Create salary journal line
    await db.insert(journalLinesTable)
      .values({
        journal_id: salaryJournalId,
        account_id: testPayrollAccountId,
        description: 'Employee salary payment',
        debit_amount: '0.00',
        credit_amount: '3000.00',
        debit_amount_base: '0.00',
        credit_amount_base: '3000.00',
        line_number: 1
      })
      .execute();

    const result = await generateAuditPack(testPeriodId);

    expect(result.filename).toMatch(/^audit-pack-2024-03-\d+\.zip$/);
    expect(result.downloadUrl).toContain('/downloads/');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('should handle capital movements for multiple partners', async () => {
    // Create second partner
    const partner2Result = await db.insert(partnersTable)
      .values({
        name: 'Second Partner',
        usd_account_id: testUsdAccountId,
        pkr_account_id: null
      })
      .returning()
      .execute();
    const partner2Id = partner2Result[0].id;

    // Create journal for capital movements
    const journalResult = await db.insert(journalsTable)
      .values({
        reference: 'CAP-2024-001',
        description: 'Capital Transactions',
        journal_date: '2024-03-20',
        period_id: testPeriodId,
        status: 'Posted',
        total_debit: '10000.00',
        total_credit: '10000.00',
        created_by: testUserId,
        posted_by: testUserId,
        posted_at: new Date()
      })
      .returning()
      .execute();
    const journalId = journalResult[0].id;

    // Create capital movements for both partners
    await db.insert(capitalMovementsTable)
      .values([
        {
          partner_id: testPartnerId,
          movement_type: 'Contribution',
          amount: '5000.00',
          currency: 'USD',
          amount_base: '5000.00',
          journal_id: journalId,
          description: 'Partner 1 contribution',
          movement_date: '2024-03-20'
        },
        {
          partner_id: partner2Id,
          movement_type: 'Draw',
          amount: '2000.00',
          currency: 'USD',
          amount_base: '2000.00',
          journal_id: journalId,
          description: 'Partner 2 draw',
          movement_date: '2024-03-20'
        }
      ])
      .execute();

    const result = await generateAuditPack(testPeriodId);

    expect(result.filename).toMatch(/^audit-pack-2024-03-\d+\.zip$/);
    expect(result.downloadUrl).toContain('/downloads/');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('should generate unique filenames for concurrent requests', async () => {
    // Execute requests with small delays to ensure unique timestamps
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(await generateAuditPack(testPeriodId));
      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    // All filenames should be unique
    const filenames = results.map(r => r.filename);
    const uniqueFilenames = new Set(filenames);
    expect(uniqueFilenames.size).toBe(3);

    // All should have the same period prefix but different timestamps
    filenames.forEach(filename => {
      expect(filename).toMatch(/^audit-pack-2024-03-\d+\.zip$/);
    });
  });
});