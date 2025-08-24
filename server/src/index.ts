import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createPartnerInputSchema,
  createUserInputSchema,
  createAccountInputSchema,
  createEmployeeInputSchema,
  createFxRateInputSchema,
  createPeriodInputSchema,
  createJournalInputSchema,
  createJournalLineInputSchema,
  createCapitalMovementInputSchema,
  createImportBatchInputSchema,
  createAttachmentInputSchema,
  createAuditLogInputSchema
} from './schema';

// Import handlers
import { createPartner } from './handlers/create_partner';
import { getPartners } from './handlers/get_partners';
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { createAccount } from './handlers/create_account';
import { getAccounts } from './handlers/get_accounts';
import { createEmployee } from './handlers/create_employee';
import { getEmployees } from './handlers/get_employees';
import { createFxRate } from './handlers/create_fx_rate';
import { getFxRates } from './handlers/get_fx_rates';
import { createPeriod } from './handlers/create_period';
import { getPeriods } from './handlers/get_periods';
import { createJournal } from './handlers/create_journal';
import { getJournals } from './handlers/get_journals';
import { postJournal } from './handlers/post_journal';
import { createJournalLine } from './handlers/create_journal_line';
import { getJournalLines } from './handlers/get_journal_lines';
import { createCapitalMovement } from './handlers/create_capital_movement';
import { getCapitalMovements } from './handlers/get_capital_movements';
import { createImportBatch } from './handlers/create_import_batch';
import { getImportBatches } from './handlers/get_import_batches';
import { processImportBatch } from './handlers/process_import_batch';
import { createAttachment } from './handlers/create_attachment';
import { getAttachments } from './handlers/get_attachments';
import { getDashboardBalances } from './handlers/get_dashboard_balances';
import { getDashboardIncomeExpense } from './handlers/get_dashboard_income_expense';
import { getDashboardSalarySplit } from './handlers/get_dashboard_salary_split';
import { getDashboardPartnerCapital } from './handlers/get_dashboard_partner_capital';
import { getTrialBalanceReport } from './handlers/get_trial_balance_report';
import { getGeneralLedgerReport } from './handlers/get_general_ledger_report';
import { closePeriod } from './handlers/close_period';
import { generateAuditPack } from './handlers/generate_audit_pack';
import { createAuditLog } from './handlers/create_audit_log';
import { getAuditLogs } from './handlers/get_audit_logs';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Partner management
  createPartner: publicProcedure
    .input(createPartnerInputSchema)
    .mutation(({ input }) => createPartner(input)),
  getPartners: publicProcedure
    .query(() => getPartners()),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  getUsers: publicProcedure
    .query(() => getUsers()),

  // Account management
  createAccount: publicProcedure
    .input(createAccountInputSchema)
    .mutation(({ input }) => createAccount(input)),
  getAccounts: publicProcedure
    .query(() => getAccounts()),

  // Employee management
  createEmployee: publicProcedure
    .input(createEmployeeInputSchema)
    .mutation(({ input }) => createEmployee(input)),
  getEmployees: publicProcedure
    .query(() => getEmployees()),

  // FX Rate management
  createFxRate: publicProcedure
    .input(createFxRateInputSchema)
    .mutation(({ input }) => createFxRate(input, 1)), // TODO: Get actual user ID from context
  getFxRates: publicProcedure
    .query(() => getFxRates()),

  // Period management
  createPeriod: publicProcedure
    .input(createPeriodInputSchema)
    .mutation(({ input }) => createPeriod(input)),
  getPeriods: publicProcedure
    .query(() => getPeriods()),
  closePeriod: publicProcedure
    .input(z.object({ periodId: z.number() }))
    .mutation(({ input }) => closePeriod(input.periodId, 1)), // TODO: Get actual user ID from context

  // Journal management
  createJournal: publicProcedure
    .input(createJournalInputSchema)
    .mutation(({ input }) => createJournal(input, 1)), // TODO: Get actual user ID from context
  getJournals: publicProcedure
    .query(() => getJournals()),
  postJournal: publicProcedure
    .input(z.object({ journalId: z.number() }))
    .mutation(({ input }) => postJournal(input.journalId, 1)), // TODO: Get actual user ID from context

  // Journal Line management
  createJournalLine: publicProcedure
    .input(createJournalLineInputSchema)
    .mutation(({ input }) => createJournalLine(input)),
  getJournalLines: publicProcedure
    .input(z.object({ journalId: z.number() }))
    .query(({ input }) => getJournalLines(input.journalId)),

  // Capital Movement management
  createCapitalMovement: publicProcedure
    .input(createCapitalMovementInputSchema)
    .mutation(({ input }) => createCapitalMovement(input)),
  getCapitalMovements: publicProcedure
    .query(() => getCapitalMovements()),

  // Import Batch management
  createImportBatch: publicProcedure
    .input(createImportBatchInputSchema)
    .mutation(({ input }) => createImportBatch(input, 1)), // TODO: Get actual user ID from context
  getImportBatches: publicProcedure
    .query(() => getImportBatches()),
  processImportBatch: publicProcedure
    .input(z.object({ batchId: z.number() }))
    .mutation(({ input }) => processImportBatch(input.batchId)),

  // Attachment management
  createAttachment: publicProcedure
    .input(createAttachmentInputSchema)
    .mutation(({ input }) => createAttachment(input, 1)), // TODO: Get actual user ID from context
  getAttachments: publicProcedure
    .query(() => getAttachments()),

  // Dashboard widgets
  getDashboardBalances: publicProcedure
    .query(() => getDashboardBalances()),
  getDashboardIncomeExpense: publicProcedure
    .query(() => getDashboardIncomeExpense()),
  getDashboardSalarySplit: publicProcedure
    .query(() => getDashboardSalarySplit()),
  getDashboardPartnerCapital: publicProcedure
    .query(() => getDashboardPartnerCapital()),

  // Reports
  getTrialBalanceReport: publicProcedure
    .input(z.object({ periodId: z.number().optional() }))
    .query(({ input }) => getTrialBalanceReport(input.periodId)),
  getGeneralLedgerReport: publicProcedure
    .input(z.object({ 
      accountId: z.number().optional(),
      fromDate: z.coerce.date().optional(),
      toDate: z.coerce.date().optional()
    }))
    .query(({ input }) => getGeneralLedgerReport(input.accountId, input.fromDate, input.toDate)),

  // Period close and audit pack
  generateAuditPack: publicProcedure
    .input(z.object({ periodId: z.number() }))
    .mutation(({ input }) => generateAuditPack(input.periodId)),

  // Audit log management
  createAuditLog: publicProcedure
    .input(createAuditLogInputSchema)
    .mutation(({ input }) => createAuditLog(input, 1)), // TODO: Get actual user ID from context
  getAuditLogs: publicProcedure
    .query(() => getAuditLogs())
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Multi-Currency Partner Audit Dashboard TRPC server listening at port: ${port}`);
}

start();