import { fileTypeFromBuffer } from 'file-type';
import logger from '../logger/logger.js';

export type SupportedMimeType =
  | 'text/plain'
  | 'text/markdown'
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/csv'
  | 'application/csv'
  | 'application/json'
  | 'text/html'
  | 'application/octet-stream';

export interface FileValidationResult {
  isValid: true;
  validatedMimeType: SupportedMimeType;
  detectedMimeType?: string;
  declaredMimeType?: string;
}

export interface FileValidationError {
  isValid: false;
  error: string;
  detectedMimeType?: string;
  declaredMimeType?: string;
}

export type FileValidationResponse = FileValidationResult | FileValidationError;

export class FileValidationService {
  private readonly supportedMimeTypes: SupportedMimeType[] = [
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/csv',
    'application/json',
    'text/html',
    'application/octet-stream',
  ];

  /**
   * Validates a file by checking its content against declared MIME type
   * @param buffer - The file buffer
   * @param fileName - The original file name
   * @param declaredMimeType - The MIME type declared by the client (optional)
   * @returns Validation result with validated MIME type or error
   */
  async validateFile(
    buffer: Buffer,
    fileName: string,
    declaredMimeType?: string
  ): Promise<FileValidationResponse> {
    try {
      const detected = await fileTypeFromBuffer(buffer);
      const detectedMimeType = detected?.mime;

      logger.debug(
        `File validation for ${fileName}: detected=${detectedMimeType || 'none'}, declared=${declaredMimeType || 'none'}`
      );

      let candidateMimeType: string;

      if (detectedMimeType) {
        candidateMimeType = detectedMimeType;
      } else if (declaredMimeType) {
        candidateMimeType = declaredMimeType;
      } else {
        candidateMimeType = this.inferMimeTypeFromExtension(fileName);
      }

      const validatedMimeType =
        this.validateMimeTypeWhitelist(candidateMimeType);

      if (detectedMimeType && declaredMimeType) {
        const securityValidation = this.validateMimeTypeConsistency(
          detectedMimeType,
          declaredMimeType
        );

        if (!securityValidation.isValid) {
          return {
            isValid: false,
            error: securityValidation.error || 'MIME type validation failed',
            detectedMimeType,
            declaredMimeType,
          };
        }
      }

      const securityCheck = this.performSecurityChecks(
        buffer,
        validatedMimeType,
        fileName
      );

      if (!securityCheck.isValid) {
        return {
          isValid: false,
          error: securityCheck.error || 'Security validation failed',
          detectedMimeType,
          declaredMimeType,
        };
      }

      logger.info(
        `File validation passed for ${fileName}: validated type=${validatedMimeType}`
      );

      return {
        isValid: true,
        validatedMimeType,
        detectedMimeType,
        declaredMimeType,
      };
    } catch (error) {
      logger.error(`File validation failed for ${fileName}:`, error);
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        declaredMimeType,
        detectedMimeType: undefined,
      };
    }
  }

  /**
   * Validates MIME type consistency between detected and declared types
   * @param detectedMimeType - MIME type detected from file content
   * @param declaredMimeType - MIME type declared by client
   * @returns Validation result
   */
  private validateMimeTypeConsistency(
    detectedMimeType: string,
    declaredMimeType: string
  ): { isValid: boolean; error?: string } {
    const normalizedDetected = this.normalizeMimeType(detectedMimeType);
    const normalizedDeclared = this.normalizeMimeType(declaredMimeType);

    // Exact match
    if (normalizedDetected === normalizedDeclared) {
      return { isValid: true };
    }
    const acceptableVariations =
      this.getAcceptableVariations(normalizedDetected);
    if (acceptableVariations.includes(normalizedDeclared)) {
      logger.info(
        `MIME type variation accepted: detected=${detectedMimeType}, declared=${declaredMimeType}`
      );
      return { isValid: true };
    }

    if (
      normalizedDeclared.startsWith('text/') &&
      normalizedDetected === 'application/octet-stream'
    ) {
      logger.warn(
        `Text file not detected properly, allowing declared type: ${declaredMimeType}`
      );
      return { isValid: true };
    }

    return {
      isValid: false,
      error: `MIME type mismatch: file content indicates '${detectedMimeType}' but '${declaredMimeType}' was declared. This could indicate a malicious file.`,
    };
  }

  /**
   * Get acceptable MIME type variations for a given type
   * @param mimeType - The base MIME type
   * @returns Array of acceptable variations
   */
  private getAcceptableVariations(mimeType: string): string[] {
    const variations: Record<string, string[]> = {
      'text/csv': ['application/csv'],
      'application/csv': ['text/csv'],
      'application/json': ['text/json'],
      'text/json': ['application/json'],
    };

    return variations[mimeType] || [];
  }

  /**
   * Perform additional security checks on the file
   * @param buffer - The file buffer
   * @param mimeType - The validated MIME type
   * @param fileName - The original file name
   * @returns Security check result
   */
  private performSecurityChecks(
    buffer: Buffer,
    mimeType: SupportedMimeType,
    fileName: string
  ): { isValid: boolean; error?: string } {
    const zipBasedFormats = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const skipZipCheck = zipBasedFormats.includes(mimeType);

    const suspiciousPatterns = [
      // Executable signatures
      { pattern: Buffer.from([0x4d, 0x5a]), description: 'PE executable' },
      {
        pattern: Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
        description: 'ELF executable',
      },
      // Script signatures
      { pattern: Buffer.from('<?php'), description: 'PHP script' },
      { pattern: Buffer.from('<script'), description: 'JavaScript in HTML' },
    ];
    if (!skipZipCheck) {
      suspiciousPatterns.push({
        pattern: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        description: 'ZIP archive',
      });
    }

    for (const { pattern, description } of suspiciousPatterns) {
      if (buffer.indexOf(pattern) === 0) {
        return {
          isValid: false,
          error: `Suspicious file content detected: ${description}. This type of content is not allowed.`,
        };
      }
    }

    // Check for null bytes (potential binary content in text files)
    if (mimeType.startsWith('text/') && buffer.indexOf(0) !== -1) {
      return {
        isValid: false,
        error:
          'Text file contains binary data (null bytes), which could indicate malicious content.',
      };
    }

    // Check file size consistency for known types
    if (mimeType === 'application/pdf' && buffer.length < 100) {
      return {
        isValid: false,
        error: 'PDF file is too small to be valid.',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate MIME type against supported types whitelist
   * @param mimeType - The MIME type to validate
   * @returns The validated MIME type
   * @throws Error if MIME type is not supported
   */
  private validateMimeTypeWhitelist(mimeType: string): SupportedMimeType {
    const normalizedMimeType = this.normalizeMimeType(mimeType);

    for (const supportedType of this.supportedMimeTypes) {
      if (this.normalizeMimeType(supportedType) === normalizedMimeType) {
        return supportedType;
      }
    }

    throw new Error(
      `Unsupported file type: ${mimeType}. Supported types: ${this.supportedMimeTypes.join(', ')}`
    );
  }

  /**
   * Infer MIME type from file extension
   * @param fileName - The file name
   * @returns The inferred MIME type
   */
  private inferMimeTypeFromExtension(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();

    const extensionToMimeType: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      markdown: 'text/markdown',
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html',
      htm: 'text/html',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return extensionToMimeType[extension || ''] || 'application/octet-stream';
  }

  /**
   * Normalize MIME type for comparison
   * @param mimeType - The MIME type to normalize
   * @returns The normalized MIME type
   */
  private normalizeMimeType(mimeType: string): string {
    return mimeType.toLowerCase().trim();
  }

  /**
   * Get the list of supported MIME types
   * @returns Array of supported MIME types
   */
  getSupportedMimeTypes(): SupportedMimeType[] {
    return [...this.supportedMimeTypes];
  }

  /**
   * Check if a MIME type is supported
   * @param mimeType - The MIME type to check
   * @returns True if the MIME type is supported
   */
  isMimeTypeSupported(mimeType: string): boolean {
    try {
      this.validateMimeTypeWhitelist(mimeType);
      return true;
    } catch {
      return false;
    }
  }
}
