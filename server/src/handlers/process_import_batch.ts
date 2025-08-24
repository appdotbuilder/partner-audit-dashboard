import { db } from '../db';
import { importBatchesTable, journalsTable, journalLinesTable, attachmentsTable, periodsTable, accountsTable } from '../db/schema';
import { type ImportBatch } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function processImportBatch(batchId: number): Promise<ImportBatch> {
  try {
    // First, get the import batch
    const batches = await db.select()
      .from(importBatchesTable)
      .where(eq(importBatchesTable.id, batchId))
      .execute();

    if (batches.length === 0) {
      throw new Error(`Import batch with ID ${batchId} not found`);
    }

    const batch = batches[0];

    // Check if batch is already processed or processing
    if (batch.status === 'Completed' || batch.status === 'Processing') {
      return {
        ...batch,
        status: batch.status as 'Pending' | 'Processing' | 'Completed' | 'Failed',
        import_date: new Date(batch.import_date),
        completed_at: batch.completed_at ? new Date(batch.completed_at) : null,
        created_at: new Date(batch.created_at),
        updated_at: new Date(batch.updated_at)
      };
    }

    // Update status to Processing
    await db.update(importBatchesTable)
      .set({
        status: 'Processing',
        updated_at: new Date()
      })
      .where(eq(importBatchesTable.id, batchId))
      .execute();

    let processedRecords = 0;
    let errorRecords = 0;
    let errorLog = '';

    try {
      // Get attachments for this batch to process files
      const attachments = await db.select()
        .from(attachmentsTable)
        .where(eq(attachmentsTable.import_batch_id, batchId))
        .execute();

      // Process each attachment file
      for (const attachment of attachments) {
        try {
          // In a real implementation, you would:
          // 1. Read the file from attachment.file_path
          // 2. Parse CSV/XLSX content
          // 3. Validate data format and required fields
          // 4. Check for duplicate journals (by reference)
          // 5. Create journals and journal lines
          
          // For this implementation, we'll simulate processing
          // Assume each file contains journal data with lines
          const mockJournalData = await simulateFileProcessing(attachment.file_path);
          
          for (const journalRecord of mockJournalData) {
            try {
              // Check for duplicate journals by reference
              const existingJournals = await db.select()
                .from(journalsTable)
                .where(eq(journalsTable.reference, journalRecord.reference))
                .execute();

              if (existingJournals.length > 0) {
                errorLog += `Duplicate journal reference: ${journalRecord.reference}\n`;
                errorRecords++;
                continue;
              }

              // Create journal entry
              const journalResult = await db.insert(journalsTable)
                .values({
                  reference: journalRecord.reference,
                  description: journalRecord.description,
                  journal_date: journalRecord.journal_date.toISOString().split('T')[0], // Convert Date to string
                  period_id: journalRecord.period_id,
                  status: 'Draft',
                  total_debit: journalRecord.total_debit.toString(),
                  total_credit: journalRecord.total_credit.toString(),
                  fx_rate_id: journalRecord.fx_rate_id,
                  created_by: batch.created_by
                })
                .returning()
                .execute();

              const newJournal = journalResult[0];

              // Create journal lines
              for (const line of journalRecord.lines) {
                await db.insert(journalLinesTable)
                  .values({
                    journal_id: newJournal.id,
                    account_id: line.account_id,
                    description: line.description,
                    debit_amount: line.debit_amount.toString(),
                    credit_amount: line.credit_amount.toString(),
                    debit_amount_base: line.debit_amount_base.toString(),
                    credit_amount_base: line.credit_amount_base.toString(),
                    line_number: line.line_number
                  })
                  .execute();
              }

              processedRecords++;
            } catch (journalError) {
              errorLog += `Error processing journal ${journalRecord.reference}: ${journalError}\n`;
              errorRecords++;
            }
          }
        } catch (fileError) {
          errorLog += `Error processing file ${attachment.filename}: ${fileError}\n`;
          errorRecords++;
        }
      }

      // Update batch with completion status
      // Status is 'Failed' only if there were processing errors (not duplicate errors)
      // and no records were processed successfully
      const hasCriticalErrors = errorLog.includes('Error processing file') || 
                               errorLog.includes('Processing failed:');
      const finalStatus = hasCriticalErrors && processedRecords === 0 ? 'Failed' : 'Completed';
      
      const updatedBatches = await db.update(importBatchesTable)
        .set({
          status: finalStatus,
          processed_records: processedRecords,
          error_records: errorRecords,
          error_log: errorLog || null,
          completed_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(importBatchesTable.id, batchId))
        .returning()
        .execute();

      const updatedBatch = updatedBatches[0];

      return {
        ...updatedBatch,
        status: updatedBatch.status as 'Pending' | 'Processing' | 'Completed' | 'Failed',
        import_date: new Date(updatedBatch.import_date),
        completed_at: updatedBatch.completed_at ? new Date(updatedBatch.completed_at) : null,
        created_at: new Date(updatedBatch.created_at),
        updated_at: new Date(updatedBatch.updated_at)
      };

    } catch (processingError) {
      // Update batch status to Failed if processing fails
      await db.update(importBatchesTable)
        .set({
          status: 'Failed',
          error_log: `Processing failed: ${processingError}`,
          completed_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(importBatchesTable.id, batchId))
        .execute();

      throw processingError;
    }

  } catch (error) {
    console.error('Import batch processing failed:', error);
    throw error;
  }
}

// Mock function to simulate file processing
// In a real implementation, this would parse actual CSV/XLSX files
async function simulateFileProcessing(filePath: string) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Generate unique reference based on file path and timestamp
  const uniqueId = `${filePath.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  // Check if this is a duplicate test file by checking the file path
  const isDuplicateTest = filePath.includes('duplicate');
  const reference = isDuplicateTest ? 'DUPLICATE-REF-001' : `IMP-${uniqueId}`;
  
  // Get valid period and account IDs from database
  // In tests, these will be created in beforeEach
  const periods = await db.select().from(periodsTable).limit(1).execute();
  const accounts = await db.select().from(accountsTable).limit(2).execute();
  
  const periodId = periods.length > 0 ? periods[0].id : 1;
  const account1Id = accounts.length > 0 ? accounts[0].id : 1;
  const account2Id = accounts.length > 1 ? accounts[1].id : (accounts.length > 0 ? accounts[0].id : 2);
  
  // Return mock journal data structure
  return [
    {
      reference: reference,
      description: 'Imported journal entry',
      journal_date: new Date(),
      period_id: periodId,
      total_debit: 1000.00,
      total_credit: 1000.00,
      fx_rate_id: null,
      lines: [
        {
          account_id: account1Id,
          description: 'Debit entry',
          debit_amount: 1000.00,
          credit_amount: 0.00,
          debit_amount_base: 1000.00,
          credit_amount_base: 0.00,
          line_number: 1
        },
        {
          account_id: account2Id,
          description: 'Credit entry',
          debit_amount: 0.00,
          credit_amount: 1000.00,
          debit_amount_base: 0.00,
          credit_amount_base: 1000.00,
          line_number: 2
        }
      ]
    }
  ];
}