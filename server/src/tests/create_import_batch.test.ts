import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { importBatchesTable, usersTable } from '../db/schema';
import { type CreateImportBatchInput } from '../schema';
import { createImportBatch } from '../handlers/create_import_batch';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'Admin' as const,
  partner_id: null
};

// Simple test input
const testInput: CreateImportBatchInput = {
  name: 'Historical Data Import',
  description: 'Import batch for Q1 2024 historical data',
  total_records: 500,
  import_date: new Date('2024-01-15')
};

describe('createImportBatch', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;
  });

  afterEach(resetDB);

  it('should create an import batch', async () => {
    const result = await createImportBatch(testInput, userId);

    // Basic field validation
    expect(result.name).toEqual('Historical Data Import');
    expect(result.description).toEqual(testInput.description);
    expect(result.status).toEqual('Pending');
    expect(result.total_records).toEqual(500);
    expect(result.processed_records).toEqual(0);
    expect(result.error_records).toEqual(0);
    expect(result.import_date).toEqual(testInput.import_date);
    expect(result.completed_at).toBeNull();
    expect(result.created_by).toEqual(userId);
    expect(result.error_log).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save import batch to database', async () => {
    const result = await createImportBatch(testInput, userId);

    // Query using proper drizzle syntax
    const batches = await db.select()
      .from(importBatchesTable)
      .where(eq(importBatchesTable.id, result.id))
      .execute();

    expect(batches).toHaveLength(1);
    expect(batches[0].name).toEqual('Historical Data Import');
    expect(batches[0].description).toEqual(testInput.description);
    expect(batches[0].status).toEqual('Pending');
    expect(batches[0].total_records).toEqual(500);
    expect(batches[0].processed_records).toEqual(0);
    expect(batches[0].error_records).toEqual(0);
    expect(batches[0].import_date).toEqual('2024-01-15'); // Database stores as string
    expect(batches[0].completed_at).toBeNull();
    expect(batches[0].created_by).toEqual(userId);
    expect(batches[0].error_log).toBeNull();
    expect(batches[0].created_at).toBeInstanceOf(Date);
    expect(batches[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create import batch with null description', async () => {
    const inputWithNullDescription: CreateImportBatchInput = {
      ...testInput,
      description: null
    };

    const result = await createImportBatch(inputWithNullDescription, userId);

    expect(result.description).toBeNull();
    expect(result.name).toEqual(testInput.name);
    expect(result.status).toEqual('Pending');
  });

  it('should initialize progress counters correctly', async () => {
    const result = await createImportBatch(testInput, userId);

    // Verify all progress counters start at appropriate values
    expect(result.processed_records).toEqual(0);
    expect(result.error_records).toEqual(0);
    expect(result.total_records).toEqual(testInput.total_records);
    expect(result.status).toEqual('Pending');
    expect(result.completed_at).toBeNull();
    expect(result.error_log).toBeNull();
  });

  it('should handle zero total records', async () => {
    const zeroRecordsInput: CreateImportBatchInput = {
      ...testInput,
      total_records: 0
    };

    const result = await createImportBatch(zeroRecordsInput, userId);

    expect(result.total_records).toEqual(0);
    expect(result.processed_records).toEqual(0);
    expect(result.error_records).toEqual(0);
    expect(result.status).toEqual('Pending');
  });

  it('should create import batch with valid user reference', async () => {
    const result = await createImportBatch(testInput, userId);

    // Verify that the user reference is correctly stored
    expect(result.created_by).toEqual(userId);
    expect(result.id).toBeDefined();

    // Verify in database
    const batches = await db.select()
      .from(importBatchesTable)
      .where(eq(importBatchesTable.id, result.id))
      .execute();

    expect(batches).toHaveLength(1);
    expect(batches[0].created_by).toEqual(userId);
  });
});