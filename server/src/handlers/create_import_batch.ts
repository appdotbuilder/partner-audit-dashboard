import { db } from '../db';
import { importBatchesTable } from '../db/schema';
import { type CreateImportBatchInput, type ImportBatch } from '../schema';

export const createImportBatch = async (input: CreateImportBatchInput, userId: number): Promise<ImportBatch> => {
  try {
    // Insert import batch record
    const result = await db.insert(importBatchesTable)
      .values({
        name: input.name,
        description: input.description,
        status: 'Pending', // Initialize as Pending
        total_records: input.total_records,
        processed_records: 0, // Initialize progress counters
        error_records: 0,
        import_date: input.import_date.toISOString().split('T')[0], // Convert Date to date string (YYYY-MM-DD)
        completed_at: null,
        created_by: userId,
        error_log: null
      })
      .returning()
      .execute();

    // Convert date string back to Date object before returning
    const importBatch = result[0];
    return {
      ...importBatch,
      import_date: new Date(importBatch.import_date + 'T00:00:00.000Z') // Convert date string back to Date
    };
  } catch (error) {
    console.error('Import batch creation failed:', error);
    throw error;
  }
};