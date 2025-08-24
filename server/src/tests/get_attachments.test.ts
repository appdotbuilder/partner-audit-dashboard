import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { attachmentsTable, usersTable, journalsTable, periodsTable, importBatchesTable } from '../db/schema';
import { type CreateAttachmentInput } from '../schema';
import { getAttachments, type GetAttachmentsFilters } from '../handlers/get_attachments';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'Admin' as const,
  partner_id: null
};

const testPeriod = {
  year: 2024,
  month: 1,
  status: 'Open' as const,
  fx_rate_locked: false
};

const testJournal = {
  reference: 'JE-001',
  description: 'Test Journal Entry',
  journal_date: '2024-01-15',
  total_debit: '1000.00',
  total_credit: '1000.00',
  fx_rate_id: null,
  status: 'Draft' as const,
  posted_by: null,
  posted_at: null
};

const testImportBatch = {
  name: 'Test Import Batch',
  description: 'A test import batch',
  status: 'Pending' as const,
  total_records: 100,
  processed_records: 0,
  error_records: 0,
  import_date: '2024-01-15',
  completed_at: null,
  error_log: null
};

const testAttachment1: CreateAttachmentInput = {
  filename: 'test-file-1.pdf',
  original_filename: 'Test Document 1.pdf',
  mime_type: 'application/pdf',
  file_size: 1024,
  file_path: '/uploads/test-file-1.pdf',
  journal_id: null,
  import_batch_id: null
};

const testAttachment2: CreateAttachmentInput = {
  filename: 'test-file-2.jpg',
  original_filename: 'Test Image 2.jpg',
  mime_type: 'image/jpeg',
  file_size: 2048,
  file_path: '/uploads/test-file-2.jpg',
  journal_id: null,
  import_batch_id: null
};

describe('getAttachments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should get all attachments when no filters provided', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    const [journal] = await db.insert(journalsTable).values({
      ...testJournal,
      period_id: period.id,
      created_by: user.id
    }).returning().execute();

    // Create test attachments
    await db.insert(attachmentsTable).values([
      {
        ...testAttachment1,
        journal_id: journal.id,
        uploaded_by: user.id
      },
      {
        ...testAttachment2,
        uploaded_by: user.id
      }
    ]).execute();

    const result = await getAttachments();

    expect(result).toHaveLength(2);
    expect(result[0].filename).toEqual('test-file-1.pdf');
    expect(result[0].original_filename).toEqual('Test Document 1.pdf');
    expect(result[0].mime_type).toEqual('application/pdf');
    expect(result[0].file_size).toEqual(1024);
    expect(result[0].file_path).toEqual('/uploads/test-file-1.pdf');
    expect(result[0].journal_id).toEqual(journal.id);
    expect(result[0].import_batch_id).toBeNull();
    expect(result[0].uploaded_by).toEqual(user.id);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    expect(result[1].filename).toEqual('test-file-2.jpg');
    expect(result[1].journal_id).toBeNull();
  });

  it('should filter attachments by journal_id', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    const [journal1] = await db.insert(journalsTable).values({
      ...testJournal,
      reference: 'JE-001',
      period_id: period.id,
      created_by: user.id
    }).returning().execute();
    const [journal2] = await db.insert(journalsTable).values({
      ...testJournal,
      reference: 'JE-002',
      period_id: period.id,
      created_by: user.id
    }).returning().execute();

    // Create attachments for different journals
    await db.insert(attachmentsTable).values([
      {
        ...testAttachment1,
        journal_id: journal1.id,
        uploaded_by: user.id
      },
      {
        ...testAttachment2,
        journal_id: journal2.id,
        uploaded_by: user.id
      }
    ]).execute();

    const filters: GetAttachmentsFilters = { journal_id: journal1.id };
    const result = await getAttachments(filters);

    expect(result).toHaveLength(1);
    expect(result[0].journal_id).toEqual(journal1.id);
    expect(result[0].filename).toEqual('test-file-1.pdf');
  });

  it('should filter attachments by import_batch_id', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [importBatch1] = await db.insert(importBatchesTable).values({
      ...testImportBatch,
      name: 'Batch 1',
      created_by: user.id
    }).returning().execute();
    const [importBatch2] = await db.insert(importBatchesTable).values({
      ...testImportBatch,
      name: 'Batch 2',
      created_by: user.id
    }).returning().execute();

    // Create attachments for different import batches
    await db.insert(attachmentsTable).values([
      {
        ...testAttachment1,
        import_batch_id: importBatch1.id,
        uploaded_by: user.id
      },
      {
        ...testAttachment2,
        import_batch_id: importBatch2.id,
        uploaded_by: user.id
      }
    ]).execute();

    const filters: GetAttachmentsFilters = { import_batch_id: importBatch1.id };
    const result = await getAttachments(filters);

    expect(result).toHaveLength(1);
    expect(result[0].import_batch_id).toEqual(importBatch1.id);
    expect(result[0].filename).toEqual('test-file-1.pdf');
  });

  it('should filter by both journal_id and import_batch_id', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    const [journal] = await db.insert(journalsTable).values({
      ...testJournal,
      period_id: period.id,
      created_by: user.id
    }).returning().execute();
    const [importBatch] = await db.insert(importBatchesTable).values({
      ...testImportBatch,
      created_by: user.id
    }).returning().execute();

    // Create attachments with different combinations
    await db.insert(attachmentsTable).values([
      {
        ...testAttachment1,
        journal_id: journal.id,
        import_batch_id: importBatch.id,
        uploaded_by: user.id
      },
      {
        ...testAttachment2,
        journal_id: journal.id,
        import_batch_id: null,
        uploaded_by: user.id
      }
    ]).execute();

    const filters: GetAttachmentsFilters = { 
      journal_id: journal.id, 
      import_batch_id: importBatch.id 
    };
    const result = await getAttachments(filters);

    expect(result).toHaveLength(1);
    expect(result[0].journal_id).toEqual(journal.id);
    expect(result[0].import_batch_id).toEqual(importBatch.id);
    expect(result[0].filename).toEqual('test-file-1.pdf');
  });

  it('should return empty array when no attachments match filters', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();

    // Create an attachment without journal_id
    await db.insert(attachmentsTable).values({
      ...testAttachment1,
      uploaded_by: user.id
    }).execute();

    const filters: GetAttachmentsFilters = { journal_id: 999 };
    const result = await getAttachments(filters);

    expect(result).toHaveLength(0);
  });

  it('should save attachments to database correctly', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    const [journal] = await db.insert(journalsTable).values({
      ...testJournal,
      period_id: period.id,
      created_by: user.id
    }).returning().execute();

    // Insert attachment
    const [createdAttachment] = await db.insert(attachmentsTable).values({
      ...testAttachment1,
      journal_id: journal.id,
      uploaded_by: user.id
    }).returning().execute();

    // Verify in database
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, createdAttachment.id))
      .execute();

    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toEqual('test-file-1.pdf');
    expect(attachments[0].file_size).toEqual(1024);
    expect(attachments[0].created_at).toBeInstanceOf(Date);
    expect(attachments[0].updated_at).toBeInstanceOf(Date);

    // Now test our handler
    const result = await getAttachments({ journal_id: journal.id });
    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(createdAttachment.id);
  });

  it('should handle null journal_id and import_batch_id correctly', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();

    // Create attachment with null foreign keys
    await db.insert(attachmentsTable).values({
      ...testAttachment1,
      journal_id: null,
      import_batch_id: null,
      uploaded_by: user.id
    }).execute();

    const result = await getAttachments();

    expect(result).toHaveLength(1);
    expect(result[0].journal_id).toBeNull();
    expect(result[0].import_batch_id).toBeNull();
  });
});