import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  importBatchesTable, 
  usersTable, 
  periodsTable, 
  accountsTable,
  journalsTable,
  journalLinesTable,
  attachmentsTable 
} from '../db/schema';
import { processImportBatch } from '../handlers/process_import_batch';
import { eq } from 'drizzle-orm';

describe('processImportBatch', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testPeriodId: number;
  let testAccountId1: number;
  let testAccountId2: number;

  beforeEach(async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();
    testPeriodId = periodResult[0].id;

    const account1Result = await db.insert(accountsTable)
      .values({
        code: 'ACC001',
        name: 'Test Account 1',
        account_type: 'Asset',
        currency: 'USD',
        is_active: true
      })
      .returning()
      .execute();
    testAccountId1 = account1Result[0].id;

    const account2Result = await db.insert(accountsTable)
      .values({
        code: 'ACC002',
        name: 'Test Account 2',
        account_type: 'Liability',
        currency: 'USD',
        is_active: true
      })
      .returning()
      .execute();
    testAccountId2 = account2Result[0].id;
  });

  it('should throw error for non-existent batch', async () => {
    await expect(processImportBatch(99999)).rejects.toThrow(/Import batch with ID 99999 not found/);
  });

  it('should return completed batch unchanged if already completed', async () => {
    // Create a completed batch
    const batchResult = await db.insert(importBatchesTable)
      .values({
        name: 'Completed Batch',
        description: 'Already completed',
        status: 'Completed',
        total_records: 10,
        processed_records: 10,
        error_records: 0,
        import_date: new Date().toISOString().split('T')[0],
        created_by: testUserId,
        completed_at: new Date()
      })
      .returning()
      .execute();

    const result = await processImportBatch(batchResult[0].id);

    expect(result.status).toEqual('Completed');
    expect(result.processed_records).toEqual(10);
    expect(result.error_records).toEqual(0);
  });

  it('should return processing batch unchanged if currently processing', async () => {
    // Create a processing batch
    const batchResult = await db.insert(importBatchesTable)
      .values({
        name: 'Processing Batch',
        description: 'Currently processing',
        status: 'Processing',
        total_records: 5,
        processed_records: 2,
        error_records: 0,
        import_date: new Date().toISOString().split('T')[0],
        created_by: testUserId
      })
      .returning()
      .execute();

    const result = await processImportBatch(batchResult[0].id);

    expect(result.status).toEqual('Processing');
    expect(result.processed_records).toEqual(2);
  });

  it('should successfully process a pending batch with attachments', async () => {
    // Create a pending batch
    const batchResult = await db.insert(importBatchesTable)
      .values({
        name: 'Test Batch',
        description: 'Test import batch',
        status: 'Pending',
        total_records: 1,
        processed_records: 0,
        error_records: 0,
        import_date: new Date().toISOString().split('T')[0],
        created_by: testUserId
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create an attachment for the batch
    await db.insert(attachmentsTable)
      .values({
        filename: 'test-import.csv',
        original_filename: 'test-import.csv',
        mime_type: 'text/csv',
        file_size: 1024,
        file_path: '/tmp/test-import.csv',
        import_batch_id: batchId,
        journal_id: null,
        uploaded_by: testUserId
      })
      .execute();

    const result = await processImportBatch(batchId);

    expect(result.status).toEqual('Completed');
    expect(result.processed_records).toBeGreaterThan(0);
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(typeof result.processed_records).toBe('number');
    expect(typeof result.error_records).toBe('number');

    // Verify batch was updated in database
    const updatedBatches = await db.select()
      .from(importBatchesTable)
      .where(eq(importBatchesTable.id, batchId))
      .execute();

    expect(updatedBatches[0].status).toEqual('Completed');
    expect(updatedBatches[0].completed_at).toBeInstanceOf(Date);
  });

  it('should create journals and journal lines during processing', async () => {
    // Create a pending batch
    const batchResult = await db.insert(importBatchesTable)
      .values({
        name: 'Journal Creation Batch',
        description: 'Test journal creation',
        status: 'Pending',
        total_records: 1,
        processed_records: 0,
        error_records: 0,
        import_date: new Date().toISOString().split('T')[0],
        created_by: testUserId
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create an attachment
    await db.insert(attachmentsTable)
      .values({
        filename: 'journals.csv',
        original_filename: 'journals.csv',
        mime_type: 'text/csv',
        file_size: 2048,
        file_path: '/tmp/journals.csv',
        import_batch_id: batchId,
        journal_id: null,
        uploaded_by: testUserId
      })
      .execute();

    await processImportBatch(batchId);

    // Check that journals were created
    const journals = await db.select()
      .from(journalsTable)
      .where(eq(journalsTable.created_by, testUserId))
      .execute();

    expect(journals.length).toBeGreaterThan(0);

    const journal = journals[0];
    expect(journal.status).toEqual('Draft');
    expect(parseFloat(journal.total_debit)).toEqual(1000.00);
    expect(parseFloat(journal.total_credit)).toEqual(1000.00);

    // Check that journal lines were created
    const journalLines = await db.select()
      .from(journalLinesTable)
      .where(eq(journalLinesTable.journal_id, journal.id))
      .execute();

    expect(journalLines.length).toEqual(2);
    expect(parseFloat(journalLines[0].debit_amount)).toEqual(1000.00);
    expect(parseFloat(journalLines[1].credit_amount)).toEqual(1000.00);
  });

  it('should handle duplicate journal references', async () => {
    // First, create a journal with a specific reference
    await db.insert(journalsTable)
      .values({
        reference: 'DUPLICATE-REF-001',
        description: 'Existing journal',
        journal_date: new Date().toISOString().split('T')[0],
        period_id: testPeriodId,
        status: 'Draft',
        total_debit: '500.00',
        total_credit: '500.00',
        created_by: testUserId
      })
      .execute();

    // Create a batch that would try to create the same reference
    const batchResult = await db.insert(importBatchesTable)
      .values({
        name: 'Duplicate Test Batch',
        description: 'Test duplicate handling',
        status: 'Pending',
        total_records: 1,
        processed_records: 0,
        error_records: 0,
        import_date: new Date().toISOString().split('T')[0],
        created_by: testUserId
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Create an attachment
    await db.insert(attachmentsTable)
      .values({
        filename: 'duplicate.csv',
        original_filename: 'duplicate.csv',
        mime_type: 'text/csv',
        file_size: 512,
        file_path: '/tmp/duplicate.csv',
        import_batch_id: batchId,
        journal_id: null,
        uploaded_by: testUserId
      })
      .execute();

    const result = await processImportBatch(batchId);

    // Should complete but with error records
    expect(result.status).toEqual('Completed');
    expect(result.error_records).toBeGreaterThan(0);
    expect(result.error_log).toContain('Duplicate journal reference');
  });

  it('should handle processing errors gracefully', async () => {
    // Create a batch with invalid data that will cause processing errors
    const batchResult = await db.insert(importBatchesTable)
      .values({
        name: 'Error Test Batch',
        description: 'Test error handling',
        status: 'Pending',
        total_records: 1,
        processed_records: 0,
        error_records: 0,
        import_date: new Date().toISOString().split('T')[0],
        created_by: testUserId
      })
      .returning()
      .execute();

    const batchId = batchResult[0].id;

    // Don't create any attachments to simulate a processing error condition

    const result = await processImportBatch(batchId);

    // Should complete without processing any records (no attachments)
    expect(result.status).toEqual('Completed');
    expect(result.processed_records).toEqual(0);
    expect(result.error_records).toEqual(0);
  });

  it('should update batch timestamps correctly', async () => {
    const batchResult = await db.insert(importBatchesTable)
      .values({
        name: 'Timestamp Test Batch',
        description: 'Test timestamp updates',
        status: 'Pending',
        total_records: 1,
        processed_records: 0,
        error_records: 0,
        import_date: new Date().toISOString().split('T')[0],
        created_by: testUserId
      })
      .returning()
      .execute();

    const originalBatch = batchResult[0];
    const originalUpdatedAt = originalBatch.updated_at;

    // Add small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await processImportBatch(originalBatch.id);

    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    expect(result.completed_at!.getTime()).toBeGreaterThanOrEqual(result.updated_at.getTime());
  });
});