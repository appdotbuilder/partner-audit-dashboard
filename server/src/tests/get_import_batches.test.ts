import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { importBatchesTable, usersTable } from '../db/schema';
import { type CreateUserInput, type CreateImportBatchInput } from '../schema';
import { getImportBatches } from '../handlers/get_import_batches';

// Test data
const testUser: CreateUserInput = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'Admin',
  partner_id: null
};

const testImportBatch: CreateImportBatchInput = {
  name: 'Test Import Batch',
  description: 'A batch for testing',
  total_records: 100,
  import_date: new Date('2024-01-15')
};

const secondTestImportBatch: CreateImportBatchInput = {
  name: 'Second Import Batch',
  description: 'Another batch for testing',
  total_records: 50,
  import_date: new Date('2024-01-16')
};

describe('getImportBatches', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no import batches exist', async () => {
    const result = await getImportBatches();

    expect(result).toEqual([]);
  });

  it('should return import batches ordered by creation date descending', async () => {
    // Create a user first
    const userResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        partner_id: testUser.partner_id
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create first import batch
    const firstBatch = await db.insert(importBatchesTable)
      .values({
        name: testImportBatch.name,
        description: testImportBatch.description,
        total_records: testImportBatch.total_records,
        import_date: testImportBatch.import_date.toISOString().split('T')[0], // Convert Date to string
        created_by: userId
      })
      .returning()
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create second import batch
    const secondBatch = await db.insert(importBatchesTable)
      .values({
        name: secondTestImportBatch.name,
        description: secondTestImportBatch.description,
        total_records: secondTestImportBatch.total_records,
        import_date: secondTestImportBatch.import_date.toISOString().split('T')[0], // Convert Date to string
        created_by: userId
      })
      .returning()
      .execute();

    const result = await getImportBatches();

    // Should return 2 batches
    expect(result).toHaveLength(2);

    // Should be ordered by creation date descending (newest first)
    expect(result[0].name).toEqual('Second Import Batch');
    expect(result[1].name).toEqual('Test Import Batch');

    // Verify all fields are properly mapped
    expect(result[0].id).toEqual(secondBatch[0].id);
    expect(result[0].description).toEqual(secondTestImportBatch.description);
    expect(result[0].status).toEqual('Pending'); // Default status
    expect(result[0].total_records).toEqual(50);
    expect(result[0].processed_records).toEqual(0); // Default value
    expect(result[0].error_records).toEqual(0); // Default value
    expect(result[0].import_date).toEqual(secondTestImportBatch.import_date);
    expect(result[0].created_by).toEqual(userId);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
    expect(result[0].completed_at).toBeNull(); // Should be null initially
    expect(result[0].error_log).toBeNull(); // Should be null initially
  });

  it('should handle import batch with all optional fields populated', async () => {
    // Create a user first
    const userResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        partner_id: testUser.partner_id
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create import batch with all fields populated
    const completedAt = new Date('2024-01-15T10:30:00Z');
    await db.insert(importBatchesTable)
      .values({
        name: 'Complete Batch',
        description: 'A completed batch',
        status: 'Completed',
        total_records: 200,
        processed_records: 180,
        error_records: 20,
        import_date: '2024-01-15', // Use string format for database
        completed_at: completedAt,
        created_by: userId,
        error_log: 'Some errors occurred during processing'
      })
      .returning()
      .execute();

    const result = await getImportBatches();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Complete Batch');
    expect(result[0].status).toEqual('Completed');
    expect(result[0].total_records).toEqual(200);
    expect(result[0].processed_records).toEqual(180);
    expect(result[0].error_records).toEqual(20);
    expect(result[0].completed_at).toEqual(completedAt);
    expect(result[0].error_log).toEqual('Some errors occurred during processing');
  });

  it('should include created_by user information through join', async () => {
    // Create a user first
    const userResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        partner_id: testUser.partner_id
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create import batch
    await db.insert(importBatchesTable)
      .values({
        name: testImportBatch.name,
        description: testImportBatch.description,
        total_records: testImportBatch.total_records,
        import_date: testImportBatch.import_date.toISOString().split('T')[0], // Convert Date to string
        created_by: userId
      })
      .returning()
      .execute();

    const result = await getImportBatches();

    expect(result).toHaveLength(1);
    expect(result[0].created_by).toEqual(userId);
    
    // The handler should successfully join with users table
    // (if user didn't exist, the inner join would return no results)
    expect(result[0].name).toEqual(testImportBatch.name);
  });

  it('should handle different import statuses correctly', async () => {
    // Create a user first
    const userResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        partner_id: testUser.partner_id
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create import batches with different statuses
    await db.insert(importBatchesTable)
      .values([
        {
          name: 'Pending Batch',
          description: 'Pending processing',
          status: 'Pending',
          total_records: 100,
          import_date: '2024-01-15', // Use string format for database
          created_by: userId
        },
        {
          name: 'Processing Batch',
          description: 'Currently processing',
          status: 'Processing',
          total_records: 150,
          processed_records: 50,
          import_date: '2024-01-16', // Use string format for database
          created_by: userId
        },
        {
          name: 'Failed Batch',
          description: 'Processing failed',
          status: 'Failed',
          total_records: 75,
          error_records: 75,
          import_date: '2024-01-17', // Use string format for database
          created_by: userId,
          error_log: 'Critical error during processing'
        }
      ])
      .execute();

    const result = await getImportBatches();

    expect(result).toHaveLength(3);
    
    // Find each batch by name and verify status
    const pendingBatch = result.find(batch => batch.name === 'Pending Batch');
    const processingBatch = result.find(batch => batch.name === 'Processing Batch');
    const failedBatch = result.find(batch => batch.name === 'Failed Batch');

    expect(pendingBatch?.status).toEqual('Pending');
    expect(processingBatch?.status).toEqual('Processing');
    expect(processingBatch?.processed_records).toEqual(50);
    expect(failedBatch?.status).toEqual('Failed');
    expect(failedBatch?.error_records).toEqual(75);
    expect(failedBatch?.error_log).toEqual('Critical error during processing');
  });
});