import { db } from '../db';
import { auditLogTable } from '../db/schema';
import { type CreateAuditLogInput, type AuditLog } from '../schema';

export const createAuditLog = async (input: CreateAuditLogInput, userId: number): Promise<AuditLog> => {
  try {
    // Insert audit log entry
    const result = await db.insert(auditLogTable)
      .values({
        table_name: input.table_name,
        record_id: input.record_id,
        action: input.action,
        old_values: input.old_values,
        new_values: input.new_values,
        user_id: userId,
        ip_address: input.ip_address
      })
      .returning()
      .execute();

    const auditLog = result[0];
    return {
      ...auditLog,
      old_values: auditLog.old_values ? JSON.stringify(auditLog.old_values) : null,
      new_values: auditLog.new_values ? JSON.stringify(auditLog.new_values) : null
    };
  } catch (error) {
    console.error('Audit log creation failed:', error);
    throw error;
  }
};