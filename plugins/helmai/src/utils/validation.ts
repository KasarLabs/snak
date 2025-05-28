import { HEALTHCARE_CONFIG } from '../constants/healthcare.js';
import { HelmaiErrorHandler, HelmaiResult } from './errorHandler.js';

export class ValidationUtils {
  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phoneNumber: string): HelmaiResult<string> {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_PHONE_NUMBER',
        'Phone number is required and must be a string'
      );
    }

    const cleaned = phoneNumber.trim();
    if (!HEALTHCARE_CONFIG.PHONE_NUMBER_REGEX.test(cleaned)) {
      return HelmaiErrorHandler.createError(
        'INVALID_PHONE_NUMBER',
        'Phone number must be in international format (e.g., +1234567890)'
      );
    }

    return HelmaiErrorHandler.createSuccess(cleaned);
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): HelmaiResult<string> {
    if (!email || typeof email !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_EMAIL',
        'Email is required and must be a string'
      );
    }

    const cleaned = email.trim().toLowerCase();
    if (!HEALTHCARE_CONFIG.EMAIL_REGEX.test(cleaned)) {
      return HelmaiErrorHandler.createError(
        'INVALID_EMAIL',
        'Email format is invalid'
      );
    }

    return HelmaiErrorHandler.createSuccess(cleaned);
  }

  /**
   * Validate SSN format
   */
  static validateSSN(ssn: string): HelmaiResult<string> {
    if (!ssn || typeof ssn !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_SSN',
        'SSN is required and must be a string'
      );
    }

    const cleaned = ssn.trim();
    if (!HEALTHCARE_CONFIG.SSN_REGEX.test(cleaned)) {
      return HelmaiErrorHandler.createError(
        'INVALID_SSN',
        'SSN must be in format XXX-XX-XXXX or XXXXXXXXX'
      );
    }

    // Normalize SSN format (remove dashes)
    const normalized = cleaned.replace(/-/g, '');
    return HelmaiErrorHandler.createSuccess(normalized);
  }

  /**
   * Validate patient name
   */
  static validatePatientName(
    name: string,
    fieldName: string
  ): HelmaiResult<string> {
    if (!name || typeof name !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_NAME',
        `${fieldName} is required and must be a string`
      );
    }

    const cleaned = name.trim();
    if (cleaned.length === 0) {
      return HelmaiErrorHandler.createError(
        'INVALID_NAME',
        `${fieldName} cannot be empty`
      );
    }

    if (cleaned.length > HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH) {
      return HelmaiErrorHandler.createError(
        'INVALID_NAME',
        `${fieldName} cannot exceed ${HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH} characters`
      );
    }

    // Check for invalid characters (only letters, spaces, hyphens, apostrophes, including French accented characters)
    const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']+$/;
    if (!nameRegex.test(cleaned)) {
      return HelmaiErrorHandler.createError(
        'INVALID_NAME',
        `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`
      );
    }

    return HelmaiErrorHandler.createSuccess(cleaned);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  static validateDate(
    dateString: string,
    fieldName: string
  ): HelmaiResult<string> {
    if (!dateString || typeof dateString !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_DATE',
        `${fieldName} is required and must be a string`
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return HelmaiErrorHandler.createError(
        'INVALID_DATE',
        `${fieldName} must be in YYYY-MM-DD format`
      );
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return HelmaiErrorHandler.createError(
        'INVALID_DATE',
        `${fieldName} is not a valid date`
      );
    }

    // Check if date is not in the future (for birth dates)
    if (fieldName.toLowerCase().includes('birth') && date > new Date()) {
      return HelmaiErrorHandler.createError(
        'INVALID_DATE',
        'Birth date cannot be in the future'
      );
    }

    return HelmaiErrorHandler.createSuccess(dateString);
  }

  /**
   * Validate UUID format
   */
  static validateUUID(uuid: string, fieldName: string): HelmaiResult<string> {
    if (!uuid || typeof uuid !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_UUID',
        `${fieldName} is required and must be a string`
      );
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return HelmaiErrorHandler.createError(
        'INVALID_UUID',
        `${fieldName} must be a valid UUID`
      );
    }

    return HelmaiErrorHandler.createSuccess(uuid.toLowerCase());
  }

  /**
   * Validate message content
   */
  static validateMessageContent(content: string): HelmaiResult<string> {
    if (!content || typeof content !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_MESSAGE',
        'Message content is required and must be a string'
      );
    }

    const cleaned = content.trim();
    if (cleaned.length === 0) {
      return HelmaiErrorHandler.createError(
        'INVALID_MESSAGE',
        'Message content cannot be empty'
      );
    }

    if (cleaned.length > HEALTHCARE_CONFIG.MAX_MESSAGE_LENGTH) {
      return HelmaiErrorHandler.createError(
        'INVALID_MESSAGE',
        `Message content cannot exceed ${HEALTHCARE_CONFIG.MAX_MESSAGE_LENGTH} characters`
      );
    }

    return HelmaiErrorHandler.createSuccess(cleaned);
  }

  /**
   * Validate task description
   */
  static validateTaskDescription(description: string): HelmaiResult<string> {
    if (!description || typeof description !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_TASK',
        'Task description is required and must be a string'
      );
    }

    const cleaned = description.trim();
    if (cleaned.length === 0) {
      return HelmaiErrorHandler.createError(
        'INVALID_TASK',
        'Task description cannot be empty'
      );
    }

    if (cleaned.length > HEALTHCARE_CONFIG.MAX_TASK_DESCRIPTION_LENGTH) {
      return HelmaiErrorHandler.createError(
        'INVALID_TASK',
        `Task description cannot exceed ${HEALTHCARE_CONFIG.MAX_TASK_DESCRIPTION_LENGTH} characters`
      );
    }

    return HelmaiErrorHandler.createSuccess(cleaned);
  }

  /**
   * Validate URL format
   */
  static validateURL(url: string, fieldName: string): HelmaiResult<string> {
    if (!url || typeof url !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_URL',
        `${fieldName} is required and must be a string`
      );
    }

    try {
      new URL(url);
      return HelmaiErrorHandler.createSuccess(url);
    } catch {
      return HelmaiErrorHandler.createError(
        'INVALID_URL',
        `${fieldName} must be a valid URL`
      );
    }
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(
    limit?: number,
    offset?: number
  ): HelmaiResult<{ limit: number; offset: number }> {
    const validatedLimit = limit ?? 10;
    const validatedOffset = offset ?? 0;

    if (validatedLimit < 1 || validatedLimit > 100) {
      return HelmaiErrorHandler.createError(
        'INVALID_PAGINATION',
        'Limit must be between 1 and 100'
      );
    }

    if (validatedOffset < 0) {
      return HelmaiErrorHandler.createError(
        'INVALID_PAGINATION',
        'Offset must be 0 or greater'
      );
    }

    return HelmaiErrorHandler.createSuccess({
      limit: validatedLimit,
      offset: validatedOffset,
    });
  }

  /**
   * Validate time format (HH:MM)
   */
  static validateTime(
    timeString: string,
    fieldName: string
  ): HelmaiResult<string> {
    if (!timeString || typeof timeString !== 'string') {
      return HelmaiErrorHandler.createError(
        'INVALID_TIME',
        `${fieldName} is required and must be a string`
      );
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeString)) {
      return HelmaiErrorHandler.createError(
        'INVALID_TIME',
        `${fieldName} must be in HH:MM format (24-hour)`
      );
    }

    return HelmaiErrorHandler.createSuccess(timeString);
  }

  /**
   * Validate duration in minutes
   */
  static validateDuration(
    duration: number,
    fieldName: string
  ): HelmaiResult<number> {
    if (typeof duration !== 'number' || isNaN(duration)) {
      return HelmaiErrorHandler.createError(
        'INVALID_DURATION',
        `${fieldName} must be a valid number`
      );
    }

    if (duration < 1) {
      return HelmaiErrorHandler.createError(
        'INVALID_DURATION',
        `${fieldName} must be at least 1 minute`
      );
    }

    if (duration > 480) {
      // 8 hours max
      return HelmaiErrorHandler.createError(
        'INVALID_DURATION',
        `${fieldName} cannot exceed 480 minutes (8 hours)`
      );
    }

    return HelmaiErrorHandler.createSuccess(Math.floor(duration));
  }

  /**
   * Sanitize string input (remove dangerous characters)
   */
  static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate and normalize WhatsApp phone number
   */
  static validateWhatsAppPhoneNumber(
    phoneNumber: string
  ): HelmaiResult<string> {
    const validation = this.validatePhoneNumber(phoneNumber);
    if (validation.status === 'error') {
      return validation;
    }

    let normalized = validation.data;

    // Ensure it starts with + for WhatsApp
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    // Remove any non-digit characters except the leading +
    normalized = '+' + normalized.substring(1).replace(/\D/g, '');

    return HelmaiErrorHandler.createSuccess(normalized);
  }
}
