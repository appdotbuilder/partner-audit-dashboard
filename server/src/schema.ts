import { z } from 'zod';

// Enums
export const currencySchema = z.enum(['USD', 'PKR']);
export type Currency = z.infer<typeof currencySchema>;

export const accountTypeSchema = z.enum(['Asset', 'Liability', 'Equity', 'Income', 'Expense', 'Other']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const roleSchema = z.enum(['Admin', 'Finance', 'Auditor', 'Partner']);
export type Role = z.infer<typeof roleSchema>;

export const journalStatusSchema = z.enum(['Draft', 'Posted']);
export type JournalStatus = z.infer<typeof journalStatusSchema>;

export const periodStatusSchema = z.enum(['Open', 'Locked']);
export type PeriodStatus = z.infer<typeof periodStatusSchema>;

export const capitalMovementTypeSchema = z.enum(['Contribution', 'Draw']);
export type CapitalMovementType = z.infer<typeof capitalMovementTypeSchema>;

export const importStatusSchema = z.enum(['Pending', 'Processing', 'Completed', 'Failed']);
export type ImportStatus = z.infer<typeof importStatusSchema>;

// Partners schema
export const partnerSchema = z.object({
  id: z.number(),
  name: z.string(),
  usd_account_id: z.number().nullable(),
  pkr_account_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Partner = z.infer<typeof partnerSchema>;

export const createPartnerInputSchema = z.object({
  name: z.string().min(1),
  usd_account_id: z.number().nullable(),
  pkr_account_id: z.number().nullable()
});
export type CreatePartnerInput = z.infer<typeof createPartnerInputSchema>;

// Users schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  partner_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: roleSchema,
  partner_id: z.number().nullable()
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Employees schema
export const employeeSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  payroll_currency: currencySchema,
  payroll_account_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Employee = z.infer<typeof employeeSchema>;

export const createEmployeeInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable(),
  payroll_currency: currencySchema,
  payroll_account_id: z.number()
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeInputSchema>;

// Accounts schema
export const accountSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  account_type: accountTypeSchema,
  currency: currencySchema,
  is_bank: z.boolean(),
  is_capital: z.boolean(),
  is_payroll_source: z.boolean(),
  is_intercompany: z.boolean(),
  parent_id: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Account = z.infer<typeof accountSchema>;

export const createAccountInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  account_type: accountTypeSchema,
  currency: currencySchema,
  is_bank: z.boolean().default(false),
  is_capital: z.boolean().default(false),
  is_payroll_source: z.boolean().default(false),
  is_intercompany: z.boolean().default(false),
  parent_id: z.number().nullable(),
  is_active: z.boolean().default(true)
});
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

// FX Rates schema
export const fxRateSchema = z.object({
  id: z.number(),
  from_currency: currencySchema,
  to_currency: currencySchema,
  rate: z.number(),
  effective_date: z.coerce.date(),
  is_locked: z.boolean(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type FxRate = z.infer<typeof fxRateSchema>;

export const createFxRateInputSchema = z.object({
  from_currency: currencySchema,
  to_currency: currencySchema,
  rate: z.number().positive(),
  effective_date: z.coerce.date(),
  is_locked: z.boolean().default(false)
});
export type CreateFxRateInput = z.infer<typeof createFxRateInputSchema>;

// Periods schema
export const periodSchema = z.object({
  id: z.number(),
  year: z.number().int(),
  month: z.number().int(),
  status: periodStatusSchema,
  fx_rate_locked: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Period = z.infer<typeof periodSchema>;

export const createPeriodInputSchema = z.object({
  year: z.number().int().min(2000).max(3000),
  month: z.number().int().min(1).max(12),
  status: periodStatusSchema.default('Open'),
  fx_rate_locked: z.boolean().default(false)
});
export type CreatePeriodInput = z.infer<typeof createPeriodInputSchema>;

// Journals schema
export const journalSchema = z.object({
  id: z.number(),
  reference: z.string(),
  description: z.string(),
  journal_date: z.coerce.date(),
  period_id: z.number(),
  status: journalStatusSchema,
  total_debit: z.number(),
  total_credit: z.number(),
  fx_rate_id: z.number().nullable(),
  created_by: z.number(),
  posted_by: z.number().nullable(),
  posted_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Journal = z.infer<typeof journalSchema>;

export const createJournalInputSchema = z.object({
  reference: z.string().min(1),
  description: z.string().min(1),
  journal_date: z.coerce.date(),
  period_id: z.number(),
  fx_rate_id: z.number().nullable()
});
export type CreateJournalInput = z.infer<typeof createJournalInputSchema>;

// Journal Lines schema
export const journalLineSchema = z.object({
  id: z.number(),
  journal_id: z.number(),
  account_id: z.number(),
  description: z.string(),
  debit_amount: z.number(),
  credit_amount: z.number(),
  debit_amount_base: z.number(),
  credit_amount_base: z.number(),
  line_number: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type JournalLine = z.infer<typeof journalLineSchema>;

export const createJournalLineInputSchema = z.object({
  journal_id: z.number(),
  account_id: z.number(),
  description: z.string().min(1),
  debit_amount: z.number().nonnegative(),
  credit_amount: z.number().nonnegative(),
  debit_amount_base: z.number().nonnegative(),
  credit_amount_base: z.number().nonnegative(),
  line_number: z.number().int().positive()
});
export type CreateJournalLineInput = z.infer<typeof createJournalLineInputSchema>;

// Capital Movements schema
export const capitalMovementSchema = z.object({
  id: z.number(),
  partner_id: z.number(),
  movement_type: capitalMovementTypeSchema,
  amount: z.number(),
  currency: currencySchema,
  amount_base: z.number(),
  journal_id: z.number(),
  description: z.string(),
  movement_date: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type CapitalMovement = z.infer<typeof capitalMovementSchema>;

export const createCapitalMovementInputSchema = z.object({
  partner_id: z.number(),
  movement_type: capitalMovementTypeSchema,
  amount: z.number().positive(),
  currency: currencySchema,
  amount_base: z.number().positive(),
  journal_id: z.number(),
  description: z.string().min(1),
  movement_date: z.coerce.date()
});
export type CreateCapitalMovementInput = z.infer<typeof createCapitalMovementInputSchema>;

// Attachments schema
export const attachmentSchema = z.object({
  id: z.number(),
  filename: z.string(),
  original_filename: z.string(),
  mime_type: z.string(),
  file_size: z.number().int(),
  file_path: z.string(),
  journal_id: z.number().nullable(),
  import_batch_id: z.number().nullable(),
  uploaded_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const createAttachmentInputSchema = z.object({
  filename: z.string().min(1),
  original_filename: z.string().min(1),
  mime_type: z.string().min(1),
  file_size: z.number().int().positive(),
  file_path: z.string().min(1),
  journal_id: z.number().nullable(),
  import_batch_id: z.number().nullable()
});
export type CreateAttachmentInput = z.infer<typeof createAttachmentInputSchema>;

// Import Batches schema
export const importBatchSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  status: importStatusSchema,
  total_records: z.number().int(),
  processed_records: z.number().int(),
  error_records: z.number().int(),
  import_date: z.coerce.date(),
  completed_at: z.coerce.date().nullable(),
  created_by: z.number(),
  error_log: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

export const createImportBatchInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  total_records: z.number().int().nonnegative(),
  import_date: z.coerce.date()
});
export type CreateImportBatchInput = z.infer<typeof createImportBatchInputSchema>;

// Audit Log schema
export const auditLogSchema = z.object({
  id: z.number(),
  table_name: z.string(),
  record_id: z.number(),
  action: z.string(),
  old_values: z.string().nullable(),
  new_values: z.string().nullable(),
  user_id: z.number(),
  timestamp: z.coerce.date(),
  ip_address: z.string().nullable()
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const createAuditLogInputSchema = z.object({
  table_name: z.string().min(1),
  record_id: z.number(),
  action: z.string().min(1),
  old_values: z.string().nullable(),
  new_values: z.string().nullable(),
  ip_address: z.string().nullable()
});
export type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;

// Dashboard widgets schemas
export const dashboardBalanceSchema = z.object({
  currency: currencySchema,
  balance: z.number(),
  balance_pkr: z.number()
});
export type DashboardBalance = z.infer<typeof dashboardBalanceSchema>;

export const dashboardIncomeExpenseSchema = z.object({
  income_mtd: z.number(),
  expense_mtd: z.number(),
  income_ytd: z.number(),
  expense_ytd: z.number(),
  currency: currencySchema
});
export type DashboardIncomeExpense = z.infer<typeof dashboardIncomeExpenseSchema>;

export const dashboardSalarySplitSchema = z.object({
  usd_salaries: z.number(),
  pkr_salaries: z.number(),
  total_pkr: z.number()
});
export type DashboardSalarySplit = z.infer<typeof dashboardSalarySplitSchema>;

export const dashboardPartnerCapitalSchema = z.object({
  partner_id: z.number(),
  partner_name: z.string(),
  capital_usd: z.number(),
  capital_pkr: z.number(),
  pl_share_mtd: z.number(),
  pl_share_ytd: z.number()
});
export type DashboardPartnerCapital = z.infer<typeof dashboardPartnerCapitalSchema>;

// Report schemas
export const trialBalanceReportSchema = z.object({
  account_id: z.number(),
  account_code: z.string(),
  account_name: z.string(),
  account_type: accountTypeSchema,
  currency: currencySchema,
  debit_balance: z.number(),
  credit_balance: z.number(),
  debit_balance_base: z.number(),
  credit_balance_base: z.number()
});
export type TrialBalanceReport = z.infer<typeof trialBalanceReportSchema>;

export const generalLedgerReportSchema = z.object({
  account_id: z.number(),
  account_code: z.string(),
  account_name: z.string(),
  journal_date: z.coerce.date(),
  journal_reference: z.string(),
  description: z.string(),
  debit_amount: z.number(),
  credit_amount: z.number(),
  running_balance: z.number()
});
export type GeneralLedgerReport = z.infer<typeof generalLedgerReportSchema>;