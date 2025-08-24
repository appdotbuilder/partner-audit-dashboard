import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  pgEnum,
  date,
  json
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const currencyEnum = pgEnum('currency', ['USD', 'PKR']);
export const accountTypeEnum = pgEnum('account_type', ['Asset', 'Liability', 'Equity', 'Income', 'Expense', 'Other']);
export const roleEnum = pgEnum('role', ['Admin', 'Finance', 'Auditor', 'Partner']);
export const journalStatusEnum = pgEnum('journal_status', ['Draft', 'Posted']);
export const periodStatusEnum = pgEnum('period_status', ['Open', 'Locked']);
export const capitalMovementTypeEnum = pgEnum('capital_movement_type', ['Contribution', 'Draw']);
export const importStatusEnum = pgEnum('import_status', ['Pending', 'Processing', 'Completed', 'Failed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  partner_id: integer('partner_id'), // References partners table
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Partners table
export const partnersTable = pgTable('partners', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  usd_account_id: integer('usd_account_id'), // References accounts table
  pkr_account_id: integer('pkr_account_id'), // References accounts table
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Accounts table
export const accountsTable = pgTable('accounts', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  account_type: accountTypeEnum('account_type').notNull(),
  currency: currencyEnum('currency').notNull(),
  is_bank: boolean('is_bank').default(false).notNull(),
  is_capital: boolean('is_capital').default(false).notNull(),
  is_payroll_source: boolean('is_payroll_source').default(false).notNull(),
  is_intercompany: boolean('is_intercompany').default(false).notNull(),
  parent_id: integer('parent_id'), // Self-reference for account hierarchy
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Employees table
export const employeesTable = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  payroll_currency: currencyEnum('payroll_currency').notNull(),
  payroll_account_id: integer('payroll_account_id').notNull(), // References accounts table
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// FX Rates table
export const fxRatesTable = pgTable('fx_rates', {
  id: serial('id').primaryKey(),
  from_currency: currencyEnum('from_currency').notNull(),
  to_currency: currencyEnum('to_currency').notNull(),
  rate: numeric('rate', { precision: 15, scale: 6 }).notNull(),
  effective_date: date('effective_date').notNull(),
  is_locked: boolean('is_locked').default(false).notNull(),
  created_by: integer('created_by').notNull(), // References users table
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Periods table
export const periodsTable = pgTable('periods', {
  id: serial('id').primaryKey(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  status: periodStatusEnum('status').default('Open').notNull(),
  fx_rate_locked: boolean('fx_rate_locked').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Import Batches table
export const importBatchesTable = pgTable('import_batches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: importStatusEnum('status').default('Pending').notNull(),
  total_records: integer('total_records').default(0).notNull(),
  processed_records: integer('processed_records').default(0).notNull(),
  error_records: integer('error_records').default(0).notNull(),
  import_date: date('import_date').notNull(),
  completed_at: timestamp('completed_at'),
  created_by: integer('created_by').notNull(), // References users table
  error_log: text('error_log'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Journals table
export const journalsTable = pgTable('journals', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull(),
  description: text('description').notNull(),
  journal_date: date('journal_date').notNull(),
  period_id: integer('period_id').notNull(), // References periods table
  status: journalStatusEnum('status').default('Draft').notNull(),
  total_debit: numeric('total_debit', { precision: 15, scale: 2 }).default('0').notNull(),
  total_credit: numeric('total_credit', { precision: 15, scale: 2 }).default('0').notNull(),
  fx_rate_id: integer('fx_rate_id'), // References fx_rates table
  created_by: integer('created_by').notNull(), // References users table
  posted_by: integer('posted_by'), // References users table
  posted_at: timestamp('posted_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Journal Lines table
export const journalLinesTable = pgTable('journal_lines', {
  id: serial('id').primaryKey(),
  journal_id: integer('journal_id').notNull(), // References journals table
  account_id: integer('account_id').notNull(), // References accounts table
  description: text('description').notNull(),
  debit_amount: numeric('debit_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  credit_amount: numeric('credit_amount', { precision: 15, scale: 2 }).default('0').notNull(),
  debit_amount_base: numeric('debit_amount_base', { precision: 15, scale: 2 }).default('0').notNull(),
  credit_amount_base: numeric('credit_amount_base', { precision: 15, scale: 2 }).default('0').notNull(),
  line_number: integer('line_number').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Capital Movements table
export const capitalMovementsTable = pgTable('capital_movements', {
  id: serial('id').primaryKey(),
  partner_id: integer('partner_id').notNull(), // References partners table
  movement_type: capitalMovementTypeEnum('movement_type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  amount_base: numeric('amount_base', { precision: 15, scale: 2 }).notNull(),
  journal_id: integer('journal_id').notNull(), // References journals table
  description: text('description').notNull(),
  movement_date: date('movement_date').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Attachments table
export const attachmentsTable = pgTable('attachments', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  original_filename: text('original_filename').notNull(),
  mime_type: text('mime_type').notNull(),
  file_size: integer('file_size').notNull(),
  file_path: text('file_path').notNull(),
  journal_id: integer('journal_id'), // References journals table
  import_batch_id: integer('import_batch_id'), // References import_batches table
  uploaded_by: integer('uploaded_by').notNull(), // References users table
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Audit Log table
export const auditLogTable = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  table_name: text('table_name').notNull(),
  record_id: integer('record_id').notNull(),
  action: text('action').notNull(),
  old_values: json('old_values'),
  new_values: json('new_values'),
  user_id: integer('user_id').notNull(), // References users table
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  ip_address: text('ip_address')
});

// Relations
export const usersRelations = relations(usersTable, ({ one, many }) => ({
  partner: one(partnersTable, {
    fields: [usersTable.partner_id],
    references: [partnersTable.id]
  }),
  createdJournals: many(journalsTable, { relationName: 'journalCreator' }),
  postedJournals: many(journalsTable, { relationName: 'journalPoster' }),
  createdFxRates: many(fxRatesTable),
  createdImportBatches: many(importBatchesTable),
  uploadedAttachments: many(attachmentsTable),
  auditLogs: many(auditLogTable)
}));

export const partnersRelations = relations(partnersTable, ({ one, many }) => ({
  usdAccount: one(accountsTable, {
    fields: [partnersTable.usd_account_id],
    references: [accountsTable.id],
    relationName: 'partnerUsdAccount'
  }),
  pkrAccount: one(accountsTable, {
    fields: [partnersTable.pkr_account_id],
    references: [accountsTable.id],
    relationName: 'partnerPkrAccount'
  }),
  users: many(usersTable),
  capitalMovements: many(capitalMovementsTable)
}));

export const accountsRelations = relations(accountsTable, ({ one, many }) => ({
  parent: one(accountsTable, {
    fields: [accountsTable.parent_id],
    references: [accountsTable.id],
    relationName: 'accountHierarchy'
  }),
  children: many(accountsTable, { relationName: 'accountHierarchy' }),
  journalLines: many(journalLinesTable),
  employees: many(employeesTable),
  partnerUsdAccounts: many(partnersTable, { relationName: 'partnerUsdAccount' }),
  partnerPkrAccounts: many(partnersTable, { relationName: 'partnerPkrAccount' })
}));

export const employeesRelations = relations(employeesTable, ({ one }) => ({
  payrollAccount: one(accountsTable, {
    fields: [employeesTable.payroll_account_id],
    references: [accountsTable.id]
  })
}));

export const fxRatesRelations = relations(fxRatesTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [fxRatesTable.created_by],
    references: [usersTable.id]
  }),
  journals: many(journalsTable)
}));

export const periodsRelations = relations(periodsTable, ({ many }) => ({
  journals: many(journalsTable)
}));

export const importBatchesRelations = relations(importBatchesTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [importBatchesTable.created_by],
    references: [usersTable.id]
  }),
  attachments: many(attachmentsTable)
}));

export const journalsRelations = relations(journalsTable, ({ one, many }) => ({
  period: one(periodsTable, {
    fields: [journalsTable.period_id],
    references: [periodsTable.id]
  }),
  fxRate: one(fxRatesTable, {
    fields: [journalsTable.fx_rate_id],
    references: [fxRatesTable.id]
  }),
  createdBy: one(usersTable, {
    fields: [journalsTable.created_by],
    references: [usersTable.id],
    relationName: 'journalCreator'
  }),
  postedBy: one(usersTable, {
    fields: [journalsTable.posted_by],
    references: [usersTable.id],
    relationName: 'journalPoster'
  }),
  journalLines: many(journalLinesTable),
  capitalMovements: many(capitalMovementsTable),
  attachments: many(attachmentsTable)
}));

export const journalLinesRelations = relations(journalLinesTable, ({ one }) => ({
  journal: one(journalsTable, {
    fields: [journalLinesTable.journal_id],
    references: [journalsTable.id]
  }),
  account: one(accountsTable, {
    fields: [journalLinesTable.account_id],
    references: [accountsTable.id]
  })
}));

export const capitalMovementsRelations = relations(capitalMovementsTable, ({ one }) => ({
  partner: one(partnersTable, {
    fields: [capitalMovementsTable.partner_id],
    references: [partnersTable.id]
  }),
  journal: one(journalsTable, {
    fields: [capitalMovementsTable.journal_id],
    references: [journalsTable.id]
  })
}));

export const attachmentsRelations = relations(attachmentsTable, ({ one }) => ({
  journal: one(journalsTable, {
    fields: [attachmentsTable.journal_id],
    references: [journalsTable.id]
  }),
  importBatch: one(importBatchesTable, {
    fields: [attachmentsTable.import_batch_id],
    references: [importBatchesTable.id]
  }),
  uploadedBy: one(usersTable, {
    fields: [attachmentsTable.uploaded_by],
    references: [usersTable.id]
  })
}));

export const auditLogRelations = relations(auditLogTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [auditLogTable.user_id],
    references: [usersTable.id]
  })
}));

// Export all tables for import in index.ts
export const tables = {
  users: usersTable,
  partners: partnersTable,
  accounts: accountsTable,
  employees: employeesTable,
  fxRates: fxRatesTable,
  periods: periodsTable,
  importBatches: importBatchesTable,
  journals: journalsTable,
  journalLines: journalLinesTable,
  capitalMovements: capitalMovementsTable,
  attachments: attachmentsTable,
  auditLog: auditLogTable
};