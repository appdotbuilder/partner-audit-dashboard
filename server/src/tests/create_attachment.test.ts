import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { attachmentsTable, usersTable, journalsTable, importBatchesTable, periodsTable } from '../db/schema';
import { type CreateAttachmentInput } from '../schema';
import { createAttachment } from '../handlers/create_attachment';
import { eq } from 'drizzle-orm';

// Test user ID
const testUserId = 1;

// Simple test input
const testInput: CreateAttachmentInput = {
  filename: 'document_12345.pdf',
  original_filename: 'Financial Report Q1.pdf',
  mime_type: 'application/pdf',
  file_size: 1024000,
  file_path: '/uploads/documents/2024/document_12345.pdf',
  journal_id: null,
  import_batch_id: null
};

describe('createAttachment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an attachment', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    const result = await createAttachment(testInput, testUserId);

    // Basic field validation
    expect(result.filename).toEqual('document_12345.pdf');
    expect(result.original_filename).toEqual('Financial Report Q1.pdf');
    expect(result.mime_type).toEqual('application/pdf');
    expect(result.file_size).toEqual(1024000);
    expect(result.file_path).toEqual('/uploads/documents/2024/document_12345.pdf');
    expect(result.journal_id).toBeNull();
    expect(result.import_batch_id).toBeNull();
    expect(result.uploaded_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save attachment to database', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    const result = await createAttachment(testInput, testUserId);

    // Query using proper drizzle syntax
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, result.id))
      .execute();

    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toEqual('document_12345.pdf');
    expect(attachments[0].original_filename).toEqual('Financial Report Q1.pdf');
    expect(attachments[0].mime_type).toEqual('application/pdf');
    expect(attachments[0].file_size).toEqual(1024000);
    expect(attachments[0].file_path).toEqual('/uploads/documents/2024/document_12345.pdf');
    expect(attachments[0].uploaded_by).toEqual(testUserId);
    expect(attachments[0].created_at).toBeInstanceOf(Date);
    expect(attachments[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create attachment with journal association', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    // Create test period
    const periodResult = await db.insert(periodsTable).values({
      year: 2024,
      month: 3,
      status: 'Open',
      fx_rate_locked: false
    }).returning().execute();

    // Create test journal
    const journalResult = await db.insert(journalsTable).values({
      reference: 'JV-2024-001',
      description: 'Test journal entry',
      journal_date: '2024-03-15',
      period_id: periodResult[0].id,
      status: 'Draft',
      total_debit: '1000.00',
      total_credit: '1000.00',
      fx_rate_id: null,
      created_by: testUserId,
      posted_by: null,
      posted_at: null
    }).returning().execute();

    const inputWithJournal: CreateAttachmentInput = {
      ...testInput,
      journal_id: journalResult[0].id
    };

    const result = await createAttachment(inputWithJournal, testUserId);

    expect(result.journal_id).toEqual(journalResult[0].id);
    expect(result.import_batch_id).toBeNull();

    // Verify in database
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, result.id))
      .execute();

    expect(attachments[0].journal_id).toEqual(journalResult[0].id);
  });

  it('should create attachment with import batch association', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    // Create test import batch
    const batchResult = await db.insert(importBatchesTable).values({
      name: 'Monthly Import Batch',
      description: 'Test import batch',
      status: 'Pending',
      total_records: 100,
      processed_records: 0,
      error_records: 0,
      import_date: '2024-03-15',
      completed_at: null,
      created_by: testUserId,
      error_log: null
    }).returning().execute();

    const inputWithBatch: CreateAttachmentInput = {
      ...testInput,
      import_batch_id: batchResult[0].id
    };

    const result = await createAttachment(inputWithBatch, testUserId);

    expect(result.journal_id).toBeNull();
    expect(result.import_batch_id).toEqual(batchResult[0].id);

    // Verify in database
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, result.id))
      .execute();

    expect(attachments[0].import_batch_id).toEqual(batchResult[0].id);
  });

  it('should handle different file types', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    const imageInput: CreateAttachmentInput = {
      filename: 'receipt_image.jpg',
      original_filename: 'Receipt Scan.jpg',
      mime_type: 'image/jpeg',
      file_size: 512000,
      file_path: '/uploads/images/2024/receipt_image.jpg',
      journal_id: null,
      import_batch_id: null
    };

    const result = await createAttachment(imageInput, testUserId);

    expect(result.filename).toEqual('receipt_image.jpg');
    expect(result.original_filename).toEqual('Receipt Scan.jpg');
    expect(result.mime_type).toEqual('image/jpeg');
    expect(result.file_size).toEqual(512000);
    expect(result.file_path).toEqual('/uploads/images/2024/receipt_image.jpg');
  });

  it('should handle Excel files', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    const excelInput: CreateAttachmentInput = {
      filename: 'data_import.xlsx',
      original_filename: 'Financial Data Import.xlsx',
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      file_size: 2048000,
      file_path: '/uploads/spreadsheets/2024/data_import.xlsx',
      journal_id: null,
      import_batch_id: null
    };

    const result = await createAttachment(excelInput, testUserId);

    expect(result.filename).toEqual('data_import.xlsx');
    expect(result.original_filename).toEqual('Financial Data Import.xlsx');
    expect(result.mime_type).toEqual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(result.file_size).toEqual(2048000);
  });

  it('should handle large file sizes', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    const largeFileInput: CreateAttachmentInput = {
      filename: 'large_backup.zip',
      original_filename: 'Database Backup Archive.zip',
      mime_type: 'application/zip',
      file_size: 52428800, // 50 MB
      file_path: '/uploads/backups/2024/large_backup.zip',
      journal_id: null,
      import_batch_id: null
    };

    const result = await createAttachment(largeFileInput, testUserId);

    expect(result.filename).toEqual('large_backup.zip');
    expect(result.original_filename).toEqual('Database Backup Archive.zip');
    expect(result.mime_type).toEqual('application/zip');
    expect(result.file_size).toEqual(52428800);
    expect(result.file_path).toEqual('/uploads/backups/2024/large_backup.zip');
  });

  it('should handle both journal and import batch as null', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    const result = await createAttachment(testInput, testUserId);

    expect(result.journal_id).toBeNull();
    expect(result.import_batch_id).toBeNull();

    // Verify in database
    const attachments = await db.select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, result.id))
      .execute();

    expect(attachments[0].journal_id).toBeNull();
    expect(attachments[0].import_batch_id).toBeNull();
  });

  it('should create multiple attachments with unique IDs', async () => {
    // Create test user first
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Finance',
      partner_id: null
    }).execute();

    const input1: CreateAttachmentInput = {
      ...testInput,
      filename: 'document1.pdf'
    };

    const input2: CreateAttachmentInput = {
      ...testInput,
      filename: 'document2.pdf'
    };

    const result1 = await createAttachment(input1, testUserId);
    const result2 = await createAttachment(input2, testUserId);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.filename).toEqual('document1.pdf');
    expect(result2.filename).toEqual('document2.pdf');
    expect(result1.uploaded_by).toEqual(testUserId);
    expect(result2.uploaded_by).toEqual(testUserId);
  });
});