import { db } from '../db';
import { attachmentsTable } from '../db/schema';
import { type CreateAttachmentInput, type Attachment } from '../schema';

export const createAttachment = async (input: CreateAttachmentInput, userId: number): Promise<Attachment> => {
  try {
    // Insert attachment record
    const result = await db.insert(attachmentsTable)
      .values({
        filename: input.filename,
        original_filename: input.original_filename,
        mime_type: input.mime_type,
        file_size: input.file_size,
        file_path: input.file_path,
        journal_id: input.journal_id,
        import_batch_id: input.import_batch_id,
        uploaded_by: userId
      })
      .returning()
      .execute();

    // Return the created attachment
    return result[0];
  } catch (error) {
    console.error('Attachment creation failed:', error);
    throw error;
  }
};