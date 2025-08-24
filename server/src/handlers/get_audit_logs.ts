import { z } from 'zod';
import { db } from '../db';
import { auditLogTable, usersTable } from '../db/schema';
import { type AuditLog } from '../schema';
import { and, eq, gte, lte, desc, type SQL } from 'drizzle-orm';

// Input schema for filtering audit logs
const getAuditLogsInputSchemaBase = z.object({
  table_name: z.string().optional(),
  record_id: z.number().optional(),
  user_id: z.number().optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0)
});

export const getAuditLogsInputSchema = getAuditLogsInputSchemaBase.partial().extend({
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0)
});

// Input type for the function (all fields optional)
export type GetAuditLogsInput = {
  table_name?: string;
  record_id?: number;
  user_id?: number;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
};

// Parsed input type (with defaults applied)
type ParsedAuditLogsInput = {
  table_name?: string;
  record_id?: number;
  user_id?: number;
  start_date?: Date;
  end_date?: Date;
  limit: number;
  offset: number;
};

export const getAuditLogs = async (input?: GetAuditLogsInput): Promise<AuditLog[]> => {
  try {
    // Parse and apply defaults to input
    const parsedInput = getAuditLogsInputSchema.parse(input || {}) as ParsedAuditLogsInput;

    // Build filter conditions
    const conditions: SQL<unknown>[] = [];

    if (parsedInput.table_name) {
      conditions.push(eq(auditLogTable.table_name, parsedInput.table_name));
    }

    if (parsedInput.record_id !== undefined) {
      conditions.push(eq(auditLogTable.record_id, parsedInput.record_id));
    }

    if (parsedInput.user_id !== undefined) {
      conditions.push(eq(auditLogTable.user_id, parsedInput.user_id));
    }

    if (parsedInput.start_date) {
      conditions.push(gte(auditLogTable.timestamp, parsedInput.start_date));
    }

    if (parsedInput.end_date) {
      conditions.push(lte(auditLogTable.timestamp, parsedInput.end_date));
    }

    // Build the complete query with a single where clause
    const whereClause = conditions.length === 0 
      ? undefined 
      : conditions.length === 1 
        ? conditions[0] 
        : and(...conditions);

    // Execute query with all clauses at once to avoid TypeScript issues
    const results = whereClause
      ? await db.select({
          id: auditLogTable.id,
          table_name: auditLogTable.table_name,
          record_id: auditLogTable.record_id,
          action: auditLogTable.action,
          old_values: auditLogTable.old_values,
          new_values: auditLogTable.new_values,
          user_id: auditLogTable.user_id,
          timestamp: auditLogTable.timestamp,
          ip_address: auditLogTable.ip_address
        })
        .from(auditLogTable)
        .innerJoin(usersTable, eq(auditLogTable.user_id, usersTable.id))
        .where(whereClause)
        .orderBy(desc(auditLogTable.timestamp))
        .limit(parsedInput.limit)
        .offset(parsedInput.offset)
        .execute()
      : await db.select({
          id: auditLogTable.id,
          table_name: auditLogTable.table_name,
          record_id: auditLogTable.record_id,
          action: auditLogTable.action,
          old_values: auditLogTable.old_values,
          new_values: auditLogTable.new_values,
          user_id: auditLogTable.user_id,
          timestamp: auditLogTable.timestamp,
          ip_address: auditLogTable.ip_address
        })
        .from(auditLogTable)
        .innerJoin(usersTable, eq(auditLogTable.user_id, usersTable.id))
        .orderBy(desc(auditLogTable.timestamp))
        .limit(parsedInput.limit)
        .offset(parsedInput.offset)
        .execute();

    // Convert the results to AuditLog format
    return results.map(result => ({
      id: result.id,
      table_name: result.table_name,
      record_id: result.record_id,
      action: result.action,
      old_values: result.old_values ? JSON.stringify(result.old_values) : null,
      new_values: result.new_values ? JSON.stringify(result.new_values) : null,
      user_id: result.user_id,
      timestamp: result.timestamp,
      ip_address: result.ip_address
    }));
  } catch (error) {
    console.error('Audit logs retrieval failed:', error);
    throw error;
  }
};