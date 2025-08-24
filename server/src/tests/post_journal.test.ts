import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  journalsTable, 
  journalLinesTable, 
  periodsTable, 
  usersTable, 
  accountsTable 
} from '../db/schema';
import { postJournal } from '../handlers/post_journal';
import { eq } from 'drizzle-orm';

describe('postJournal', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test helper to create prerequisites
  async function createTestData() {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Finance',
        partner_id: null
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test accounts
    const accountResults = await db.insert(accountsTable)
      .values([
        {
          code: 'CASH-001',
          name: 'Cash Account',
          account_type: 'Asset',
          currency: 'USD',
          is_active: true
        },
        {
          code: 'EXP-001',
          name: 'Office Expense',
          account_type: 'Expense',
          currency: 'USD',
          is_active: true
        }
      ])
      .returning()
      .execute();
    const cashAccountId = accountResults[0].id;
    const expenseAccountId = accountResults[1].id;

    // Create a test period
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();
    const periodId = periodResult[0].id;

    // Create a draft journal
    const journalResult = await db.insert(journalsTable)
      .values({
        reference: 'JE-001',
        description: 'Test Journal Entry',
        journal_date: '2024-01-15',
        period_id: periodId,
        status: 'Draft',
        total_debit: '0',
        total_credit: '0',
        fx_rate_id: null,
        created_by: userId,
        posted_by: null,
        posted_at: null
      })
      .returning()
      .execute();
    const journalId = journalResult[0].id;

    return {
      userId,
      journalId,
      periodId,
      cashAccountId,
      expenseAccountId
    };
  }

  it('should post a balanced journal successfully', async () => {
    const { userId, journalId, cashAccountId, expenseAccountId } = await createTestData();

    // Create balanced journal lines
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journalId,
          account_id: expenseAccountId,
          description: 'Office supplies',
          debit_amount: '100.00',
          credit_amount: '0.00',
          debit_amount_base: '100.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journalId,
          account_id: cashAccountId,
          description: 'Cash payment',
          debit_amount: '0.00',
          credit_amount: '100.00',
          debit_amount_base: '0.00',
          credit_amount_base: '100.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await postJournal(journalId, userId);

    // Verify journal was posted
    expect(result.id).toBe(journalId);
    expect(result.status).toBe('Posted');
    expect(result.posted_by).toBe(userId);
    expect(result.posted_at).toBeInstanceOf(Date);
    expect(result.total_debit).toBe(100);
    expect(result.total_credit).toBe(100);

    // Verify database was updated
    const journals = await db.select()
      .from(journalsTable)
      .where(eq(journalsTable.id, journalId))
      .execute();

    expect(journals[0].status).toBe('Posted');
    expect(journals[0].posted_by).toBe(userId);
    expect(journals[0].posted_at).toBeInstanceOf(Date);
    expect(parseFloat(journals[0].total_debit)).toBe(100);
    expect(parseFloat(journals[0].total_credit)).toBe(100);
  });

  it('should throw error for non-existent journal', async () => {
    const { userId } = await createTestData();

    await expect(postJournal(99999, userId))
      .rejects.toThrow(/Journal with id 99999 not found/i);
  });

  it('should throw error for already posted journal', async () => {
    const { userId, journalId, cashAccountId, expenseAccountId } = await createTestData();

    // Create journal lines
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journalId,
          account_id: expenseAccountId,
          description: 'Test debit',
          debit_amount: '50.00',
          credit_amount: '0.00',
          debit_amount_base: '50.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journalId,
          account_id: cashAccountId,
          description: 'Test credit',
          debit_amount: '0.00',
          credit_amount: '50.00',
          debit_amount_base: '0.00',
          credit_amount_base: '50.00',
          line_number: 2
        }
      ])
      .execute();

    // First post should succeed
    await postJournal(journalId, userId);

    // Second post should fail
    await expect(postJournal(journalId, userId))
      .rejects.toThrow(/Journal is already posted and cannot be modified/i);
  });

  it('should throw error for locked period', async () => {
    const { userId, journalId, periodId, cashAccountId, expenseAccountId } = await createTestData();

    // Lock the period
    await db.update(periodsTable)
      .set({ status: 'Locked' })
      .where(eq(periodsTable.id, periodId))
      .execute();

    // Create journal lines
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journalId,
          account_id: expenseAccountId,
          description: 'Test debit',
          debit_amount: '75.00',
          credit_amount: '0.00',
          debit_amount_base: '75.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journalId,
          account_id: cashAccountId,
          description: 'Test credit',
          debit_amount: '0.00',
          credit_amount: '75.00',
          debit_amount_base: '0.00',
          credit_amount_base: '75.00',
          line_number: 2
        }
      ])
      .execute();

    await expect(postJournal(journalId, userId))
      .rejects.toThrow(/Cannot post journal to locked period/i);
  });

  it('should throw error for journal without lines', async () => {
    const { userId, journalId } = await createTestData();

    await expect(postJournal(journalId, userId))
      .rejects.toThrow(/Journal must have at least one journal line/i);
  });

  it('should throw error for unbalanced journal', async () => {
    const { userId, journalId, cashAccountId, expenseAccountId } = await createTestData();

    // Create unbalanced journal lines
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journalId,
          account_id: expenseAccountId,
          description: 'Unbalanced debit',
          debit_amount: '100.00',
          credit_amount: '0.00',
          debit_amount_base: '100.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journalId,
          account_id: cashAccountId,
          description: 'Unbalanced credit',
          debit_amount: '0.00',
          credit_amount: '75.00',
          debit_amount_base: '0.00',
          credit_amount_base: '75.00',
          line_number: 2
        }
      ])
      .execute();

    await expect(postJournal(journalId, userId))
      .rejects.toThrow(/Journal is not balanced.*100.00.*75.00/i);
  });

  it('should throw error for unbalanced base currency amounts', async () => {
    const { userId, journalId, cashAccountId, expenseAccountId } = await createTestData();

    // Create journal lines balanced in transaction currency but not base currency
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journalId,
          account_id: expenseAccountId,
          description: 'Base currency unbalanced',
          debit_amount: '100.00',
          credit_amount: '0.00',
          debit_amount_base: '150.00', // Different base amount
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journalId,
          account_id: cashAccountId,
          description: 'Base currency unbalanced',
          debit_amount: '0.00',
          credit_amount: '100.00',
          debit_amount_base: '0.00',
          credit_amount_base: '100.00', // Different base amount
          line_number: 2
        }
      ])
      .execute();

    await expect(postJournal(journalId, userId))
      .rejects.toThrow(/Journal is not balanced in base currency.*150.00.*100.00/i);
  });

  it('should throw error for journal line with both debit and credit', async () => {
    const { userId, journalId, cashAccountId } = await createTestData();

    await db.insert(journalLinesTable)
      .values({
        journal_id: journalId,
        account_id: cashAccountId,
        description: 'Invalid line',
        debit_amount: '50.00',
        credit_amount: '25.00', // Both debit and credit
        debit_amount_base: '50.00',
        credit_amount_base: '25.00',
        line_number: 1
      })
      .execute();

    await expect(postJournal(journalId, userId))
      .rejects.toThrow(/Journal line 1 cannot have both debit and credit amounts/i);
  });

  it('should throw error for journal line with no amounts', async () => {
    const { userId, journalId, cashAccountId } = await createTestData();

    await db.insert(journalLinesTable)
      .values({
        journal_id: journalId,
        account_id: cashAccountId,
        description: 'Empty line',
        debit_amount: '0.00',
        credit_amount: '0.00',
        debit_amount_base: '0.00',
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    await expect(postJournal(journalId, userId))
      .rejects.toThrow(/Journal line 1 must have either debit or credit amount/i);
  });

  it('should throw error for missing base currency amounts', async () => {
    const { userId, journalId, cashAccountId } = await createTestData();

    await db.insert(journalLinesTable)
      .values({
        journal_id: journalId,
        account_id: cashAccountId,
        description: 'Missing base debit',
        debit_amount: '100.00',
        credit_amount: '0.00',
        debit_amount_base: '0.00', // Missing base amount
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    await expect(postJournal(journalId, userId))
      .rejects.toThrow(/Journal line 1 missing base currency debit amount/i);
  });

  it('should handle decimal precision correctly', async () => {
    const { userId, journalId, cashAccountId, expenseAccountId } = await createTestData();

    // Create journal lines with decimal amounts
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journalId,
          account_id: expenseAccountId,
          description: 'Decimal test',
          debit_amount: '123.45',
          credit_amount: '0.00',
          debit_amount_base: '123.45',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journalId,
          account_id: cashAccountId,
          description: 'Decimal test',
          debit_amount: '0.00',
          credit_amount: '123.45',
          debit_amount_base: '0.00',
          credit_amount_base: '123.45',
          line_number: 2
        }
      ])
      .execute();

    const result = await postJournal(journalId, userId);

    expect(result.total_debit).toBe(123.45);
    expect(result.total_credit).toBe(123.45);
  });
});