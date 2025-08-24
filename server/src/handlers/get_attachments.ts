import { db } from '../db';
import { attachmentsTable } from '../db/schema';
import { type Attachment } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export interface GetAttachmentsFilters {
  journal_id?: number;
  import_batch_id?: number;
}

export const getAttachments = async (filters?: GetAttachmentsFilters): Promise<Attachment[]> => {
  try {
    const conditions: SQL<unknown>[] = [];

    if (filters?.journal_id !== undefined) {
      conditions.push(eq(attachmentsTable.journal_id, filters.journal_id));
    }

    if (filters?.import_batch_id !== undefined) {
      conditions.push(eq(attachmentsTable.import_batch_id, filters.import_batch_id));
    }

    const results = conditions.length > 0
      ? await db.select()
          .from(attachmentsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : await db.select()
          .from(attachmentsTable)
          .execute();

    // Return attachments with proper type conversion (no numeric fields to convert)
    return results.map(attachment => ({
      ...attachment,
      created_at: attachment.created_at,
      updated_at: attachment.updated_at
    }));
  } catch (error) {
    console.error('Failed to get attachments:', error);
    throw error;
  }
};