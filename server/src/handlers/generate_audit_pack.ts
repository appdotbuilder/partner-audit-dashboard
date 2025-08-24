import { db } from '../db';
import { 
  periodsTable, 
  journalsTable, 
  journalLinesTable, 
  accountsTable, 
  fxRatesTable,
  capitalMovementsTable,
  partnersTable,
  employeesTable,
  attachmentsTable
} from '../db/schema';
import { eq, and, lte, gte, sql, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface AuditPackResult {
    filename: string;
    downloadUrl: string;
    generatedAt: Date;
}

interface TrialBalanceEntry {
  account_code: string;
  account_name: string;
  account_type: string;
  currency: string;
  debit_balance: number;
  credit_balance: number;
  debit_balance_base: number;
  credit_balance_base: number;
}

interface GeneralLedgerEntry {
  account_code: string;
  account_name: string;
  journal_date: Date;
  journal_reference: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
}

interface FXSummary {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: Date;
  is_locked: boolean;
}

interface CapitalMovementEntry {
  partner_name: string;
  movement_type: string;
  amount: number;
  currency: string;
  amount_base: number;
  description: string;
  movement_date: Date;
}

interface SalaryRegisterEntry {
  employee_name: string;
  payroll_currency: string;
  total_paid: number;
  total_paid_base: number;
}

export async function generateAuditPack(periodId: number): Promise<AuditPackResult> {
  try {
    // Validate period exists
    const periodResult = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.id, periodId))
      .execute();

    if (periodResult.length === 0) {
      throw new Error(`Period with ID ${periodId} not found`);
    }

    const period = periodResult[0];
    
    // Generate trial balance for the period
    const trialBalance = await generateTrialBalance(periodId);
    
    // Generate general ledger for the period
    const generalLedger = await generateGeneralLedger(periodId);
    
    // Generate FX summary for the period
    const fxSummary = await generateFXSummary(period.year, period.month);
    
    // Generate capital movements for the period
    const capitalMovements = await generateCapitalMovements(periodId);
    
    // Generate salary register for the period
    const salaryRegister = await generateSalaryRegister(periodId);
    
    // Get supporting documents count
    const documentsCount = await getSupportingDocumentsCount(periodId);

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `audit-pack-${period.year}-${String(period.month).padStart(2, '0')}-${timestamp}.zip`;
    const downloadUrl = `/downloads/${filename}`;

    // In a real implementation, this would:
    // 1. Generate PDF reports from the data above
    // 2. Create a ZIP file containing all reports and documents
    // 3. Store the file in a download directory
    // 4. Return the download URL
    
    // For now, we simulate the file generation process
    console.log(`Generated audit pack for period ${period.year}-${period.month}:`);
    console.log(`- Trial Balance entries: ${trialBalance.length}`);
    console.log(`- General Ledger entries: ${generalLedger.length}`);
    console.log(`- FX rates: ${fxSummary.length}`);
    console.log(`- Capital movements: ${capitalMovements.length}`);
    console.log(`- Salary entries: ${salaryRegister.length}`);
    console.log(`- Supporting documents: ${documentsCount}`);

    return {
      filename,
      downloadUrl,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Audit pack generation failed:', error);
    throw error;
  }
}

async function generateTrialBalance(periodId: number): Promise<TrialBalanceEntry[]> {
  const result = await db.select({
    account_code: accountsTable.code,
    account_name: accountsTable.name,
    account_type: accountsTable.account_type,
    currency: accountsTable.currency,
    total_debit: sql<string>`COALESCE(SUM(${journalLinesTable.debit_amount}), 0)`,
    total_credit: sql<string>`COALESCE(SUM(${journalLinesTable.credit_amount}), 0)`,
    total_debit_base: sql<string>`COALESCE(SUM(${journalLinesTable.debit_amount_base}), 0)`,
    total_credit_base: sql<string>`COALESCE(SUM(${journalLinesTable.credit_amount_base}), 0)`
  })
  .from(accountsTable)
  .leftJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
  .leftJoin(journalsTable, and(
    eq(journalLinesTable.journal_id, journalsTable.id),
    eq(journalsTable.period_id, periodId),
    eq(journalsTable.status, 'Posted')
  ))
  .where(eq(accountsTable.is_active, true))
  .groupBy(
    accountsTable.id,
    accountsTable.code,
    accountsTable.name,
    accountsTable.account_type,
    accountsTable.currency
  )
  .orderBy(accountsTable.code)
  .execute();

  return result.map(row => ({
    account_code: row.account_code,
    account_name: row.account_name,
    account_type: row.account_type,
    currency: row.currency,
    debit_balance: parseFloat(row.total_debit),
    credit_balance: parseFloat(row.total_credit),
    debit_balance_base: parseFloat(row.total_debit_base),
    credit_balance_base: parseFloat(row.total_credit_base)
  }));
}

async function generateGeneralLedger(periodId: number): Promise<GeneralLedgerEntry[]> {
  const result = await db.select({
    account_code: accountsTable.code,
    account_name: accountsTable.name,
    journal_date: journalsTable.journal_date,
    journal_reference: journalsTable.reference,
    description: journalLinesTable.description,
    debit_amount: journalLinesTable.debit_amount,
    credit_amount: journalLinesTable.credit_amount
  })
  .from(journalLinesTable)
  .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
  .innerJoin(accountsTable, eq(journalLinesTable.account_id, accountsTable.id))
  .where(and(
    eq(journalsTable.period_id, periodId),
    eq(journalsTable.status, 'Posted')
  ))
  .orderBy(accountsTable.code, journalsTable.journal_date, journalLinesTable.line_number)
  .execute();

  // Calculate running balances per account
  const accountBalances: { [key: string]: number } = {};
  
  return result.map(row => {
    const accountKey = row.account_code;
    const netAmount = parseFloat(row.debit_amount) - parseFloat(row.credit_amount);
    
    if (!accountBalances[accountKey]) {
      accountBalances[accountKey] = 0;
    }
    accountBalances[accountKey] += netAmount;

    return {
      account_code: row.account_code,
      account_name: row.account_name,
      journal_date: new Date(row.journal_date),
      journal_reference: row.journal_reference,
      description: row.description,
      debit_amount: parseFloat(row.debit_amount),
      credit_amount: parseFloat(row.credit_amount),
      running_balance: accountBalances[accountKey]
    };
  });
}

async function generateFXSummary(year: number, month: number): Promise<FXSummary[]> {
  // Get FX rates effective during the period
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month

  const result = await db.select({
    from_currency: fxRatesTable.from_currency,
    to_currency: fxRatesTable.to_currency,
    rate: fxRatesTable.rate,
    effective_date: fxRatesTable.effective_date,
    is_locked: fxRatesTable.is_locked
  })
  .from(fxRatesTable)
  .where(and(
    gte(fxRatesTable.effective_date, startDate.toISOString().split('T')[0]),
    lte(fxRatesTable.effective_date, endDate.toISOString().split('T')[0])
  ))
  .orderBy(fxRatesTable.effective_date, fxRatesTable.from_currency, fxRatesTable.to_currency)
  .execute();

  return result.map(row => ({
    from_currency: row.from_currency,
    to_currency: row.to_currency,
    rate: parseFloat(row.rate),
    effective_date: new Date(row.effective_date),
    is_locked: row.is_locked
  }));
}

async function generateCapitalMovements(periodId: number): Promise<CapitalMovementEntry[]> {
  const result = await db.select({
    partner_name: partnersTable.name,
    movement_type: capitalMovementsTable.movement_type,
    amount: capitalMovementsTable.amount,
    currency: capitalMovementsTable.currency,
    amount_base: capitalMovementsTable.amount_base,
    description: capitalMovementsTable.description,
    movement_date: capitalMovementsTable.movement_date
  })
  .from(capitalMovementsTable)
  .innerJoin(partnersTable, eq(capitalMovementsTable.partner_id, partnersTable.id))
  .innerJoin(journalsTable, eq(capitalMovementsTable.journal_id, journalsTable.id))
  .where(and(
    eq(journalsTable.period_id, periodId),
    eq(journalsTable.status, 'Posted')
  ))
  .orderBy(capitalMovementsTable.movement_date, partnersTable.name)
  .execute();

  return result.map(row => ({
    partner_name: row.partner_name,
    movement_type: row.movement_type,
    amount: parseFloat(row.amount),
    currency: row.currency,
    amount_base: parseFloat(row.amount_base),
    description: row.description,
    movement_date: new Date(row.movement_date)
  }));
}

async function generateSalaryRegister(periodId: number): Promise<SalaryRegisterEntry[]> {
  // Get salary payments from journal lines for payroll accounts
  const result = await db.select({
    employee_name: employeesTable.name,
    payroll_currency: employeesTable.payroll_currency,
    total_paid: sql<string>`SUM(${journalLinesTable.credit_amount})`,
    total_paid_base: sql<string>`SUM(${journalLinesTable.credit_amount_base})`
  })
  .from(journalLinesTable)
  .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
  .innerJoin(accountsTable, eq(journalLinesTable.account_id, accountsTable.id))
  .innerJoin(employeesTable, eq(accountsTable.id, employeesTable.payroll_account_id))
  .where(and(
    eq(journalsTable.period_id, periodId),
    eq(journalsTable.status, 'Posted'),
    eq(accountsTable.is_payroll_source, true)
  ))
  .groupBy(employeesTable.id, employeesTable.name, employeesTable.payroll_currency)
  .orderBy(employeesTable.name)
  .execute();

  return result.map(row => ({
    employee_name: row.employee_name,
    payroll_currency: row.payroll_currency,
    total_paid: parseFloat(row.total_paid),
    total_paid_base: parseFloat(row.total_paid_base)
  }));
}

async function getSupportingDocumentsCount(periodId: number): Promise<number> {
  const result = await db.select({
    count: sql<string>`COUNT(*)`
  })
  .from(attachmentsTable)
  .innerJoin(journalsTable, eq(attachmentsTable.journal_id, journalsTable.id))
  .where(eq(journalsTable.period_id, periodId))
  .execute();

  return parseInt(result[0].count);
}