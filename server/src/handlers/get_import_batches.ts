import { db } from '../db';
import { importBatchesTable, usersTable, attachmentsTable } from '../db/schema';
import { type ImportBatch } from '../schema';
import { desc, eq } from 'drizzle-orm';

export async function getImportBatches(): Promise<ImportBatch[]> {
  try {
    // Get import batches with created_by user relation, ordered by creation date descending
    const results = await db.select()
      .from(importBatchesTable)
      .innerJoin(usersTable, eq(importBatchesTable.created_by, usersTable.id))
      .orderBy(desc(importBatchesTable.created_at))
      .execute();

    // Convert the results to the proper format with date and numeric conversions
    return results.map(result => ({
      id: result.import_batches.id,
      name: result.import_batches.name,
      description: result.import_batches.description,
      status: result.import_batches.status,
      total_records: result.import_batches.total_records,
      processed_records: result.import_batches.processed_records,
      error_records: result.import_batches.error_records,
      import_date: new Date(result.import_batches.import_date), // Convert string to Date
      completed_at: result.import_batches.completed_at,
      created_by: result.import_batches.created_by,
      error_log: result.import_batches.error_log,
      created_at: result.import_batches.created_at,
      updated_at: result.import_batches.updated_at
    }));
  } catch (error) {
    console.error('Get import batches failed:', error);
    throw error;
  }
}