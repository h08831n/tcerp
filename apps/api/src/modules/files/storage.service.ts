/**
 * FooladERP - Content-Addressable File Vault & Attachment Service
 * Uses SHA-256 content hash deduplication: identical files are stored physically only once.
 */

import { FileAttachment, FileRecord } from '@foolad/domain';

export class FileStorageService {
  private filesByHash: Map<string, FileRecord> = new Map();
  private filesById: Map<string, FileRecord> = new Map();
  private attachments: FileAttachment[] = [];

  /**
   * Calculates SHA-256 hash of a buffer or string.
   */
  public async computeHash(data: Uint8Array | string): Promise<string> {
    const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer as unknown as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Uploads and registers a file.
   * If the file hash already exists, reuses the existing physical FileRecord (deduplication)
   * and creates a new FileAttachment.
   */
  public async uploadAndAttach(params: {
    companyId: string;
    filename: string;
    mimeType: string;
    content: Uint8Array | string;
    entityType: string;
    entityId: string;
    category?: string;
    isSensitive?: boolean;
    userId?: string;
  }): Promise<{ file: FileRecord; attachment: FileAttachment; isDeduplicated: boolean }> {
    const contentHash = await this.computeHash(params.content);
    let file = this.filesByHash.get(contentHash);
    let isDeduplicated = false;

    if (file) {
      isDeduplicated = true;
    } else {
      const sizeBytes = typeof params.content === 'string'
        ? new TextEncoder().encode(params.content).length
        : params.content.length;

      file = {
        id: crypto.randomUUID(),
        company_id: params.companyId,
        filename: params.filename,
        mime_type: params.mimeType,
        size_bytes: sizeBytes,
        content_hash: contentHash,
        storage_path: `/vault/${contentHash.substring(0, 2)}/${contentHash.substring(2, 4)}/${contentHash}`,
        storage_bucket: 'foolad-erp-vault',
        created_by: params.userId,
        created_at: new Date().toISOString(),
      };

      this.filesByHash.set(contentHash, file);
      this.filesById.set(file.id, file);
    }

    const attachment: FileAttachment = {
      id: crypto.randomUUID(),
      company_id: params.companyId,
      file_id: file.id,
      entity_type: params.entityType,
      entity_id: params.entityId,
      category: params.category || 'GENERAL',
      is_sensitive: params.isSensitive || false,
      created_at: new Date().toISOString(),
    };

    this.attachments.push(attachment);

    return { file, attachment, isDeduplicated };
  }

  /**
   * Retrieves all attachments for a specific entity.
   */
  public getAttachmentsForEntity(entityType: string, entityId: string): Array<{ attachment: FileAttachment; file?: FileRecord }> {
    return this.attachments
      .filter(a => a.entity_type === entityType && a.entity_id === entityId)
      .map(a => ({
        attachment: a,
        file: this.filesById.get(a.file_id),
      }));
  }

  public getStats(): { totalFiles: number; totalAttachments: number; deduplicatedSavings: number } {
    return {
      totalFiles: this.filesById.size,
      totalAttachments: this.attachments.length,
      deduplicatedSavings: this.attachments.length - this.filesById.size,
    };
  }
}

export const fileStorageService = new FileStorageService();
