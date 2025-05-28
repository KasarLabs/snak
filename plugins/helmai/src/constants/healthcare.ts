export const HEALTHCARE_CONFIG = {
  // Default Center Configuration
  DEFAULT_CENTER_ID:
    process.env.HELMAI_DEFAULT_CENTER_ID ||
    '4322a733-6aba-497e-b54d-6bd04cffd598',

  // Task Configuration
  TASK_PRIORITIES: ['LOW', 'MEDIUM', 'HIGH'] as const,
  TASK_STATUSES: [
    'OPEN',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'ON_HOLD',
  ] as const,
  TASK_TYPES: [
    'APPOINTMENT',
    'FOLLOW_UP',
    'MEDICATION',
    'TEST_RESULT',
    'CONSULTATION',
    'EMERGENCY',
    'ADMINISTRATIVE',
  ] as const,

  // Chat Configuration
  CHAT_STATUSES: ['ACTIVE', 'CLOSED', 'ARCHIVED'] as const,
  CHAT_TYPES: ['WHATSAPP', 'SMS', 'EMAIL', 'PHONE', 'IN_PERSON'] as const,
  CHAT_PRIORITIES: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const,

  // Message Configuration
  MESSAGE_TYPES: [
    'TEXT',
    'IMAGE',
    'AUDIO',
    'VIDEO',
    'DOCUMENT',
    'LOCATION',
  ] as const,
  MESSAGE_STATUSES: ['SENT', 'DELIVERED', 'READ', 'FAILED'] as const,
  SENDER_TYPES: ['PATIENT', 'USER', 'ASSISTANT', 'SYSTEM'] as const,

  // Patient Configuration
  GENDER_OPTIONS: ['MALE', 'FEMALE', 'OTHER'] as const,

  // Validation Rules
  PHONE_NUMBER_REGEX: /^\+?[1-9]\d{1,14}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  SSN_REGEX: /^\d{3}-?\d{2}-?\d{4}$/,

  // Limits
  MAX_MESSAGE_LENGTH: 4096,
  MAX_TASK_DESCRIPTION_LENGTH: 2000,
  MAX_PATIENT_NAME_LENGTH: 100,
  MAX_CHAT_SUBJECT_LENGTH: 200,

  // Timeouts and Intervals
  MESSAGE_TIMEOUT: 30000, // 30 seconds
  TASK_REMINDER_INTERVAL: 3600000, // 1 hour
  CHAT_INACTIVE_TIMEOUT: 86400000, // 24 hours

  // File Upload Limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,
} as const;

export const ERROR_MESSAGES = {
  // Patient Errors
  PATIENT_NOT_FOUND: 'Patient not found',
  PATIENT_ALREADY_EXISTS: 'Patient with this phone number already exists',
  INVALID_PATIENT_DATA: 'Invalid patient data provided',

  // Chat Errors
  CHAT_NOT_FOUND: 'Chat not found',
  CHAT_ALREADY_CLOSED: 'Chat is already closed',
  INVALID_CHAT_DATA: 'Invalid chat data provided',

  // Message Errors
  MESSAGE_NOT_FOUND: 'Message not found',
  MESSAGE_TOO_LONG: `Message exceeds maximum length of ${HEALTHCARE_CONFIG.MAX_MESSAGE_LENGTH} characters`,
  INVALID_MESSAGE_TYPE: 'Invalid message type',

  // Task Errors
  TASK_NOT_FOUND: 'Task not found',
  TASK_ALREADY_COMPLETED: 'Task is already completed',
  INVALID_TASK_DATA: 'Invalid task data provided',

  // WhatsApp Errors
  WHATSAPP_API_ERROR: 'WhatsApp API error',
  WHATSAPP_MESSAGE_FAILED: 'Failed to send WhatsApp message',
  INVALID_PHONE_NUMBER: 'Invalid phone number format',

  // Backend Errors
  BACKEND_API_ERROR: 'Backend API error',
  BACKEND_TIMEOUT: 'Backend request timeout',
  BACKEND_UNAUTHORIZED: 'Backend API unauthorized',

  // Desmos Errors
  DESMOS_API_ERROR: 'Desmos API error',
  DESMOS_PATIENT_NOT_FOUND: 'Patient not found in Desmos system',
  INVALID_SSN: 'Invalid SSN format',

  // General Errors
  INTERNAL_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation error',
  NETWORK_ERROR: 'Network error',
  TIMEOUT_ERROR: 'Request timeout',
} as const;

export const SUCCESS_MESSAGES = {
  // Patient Success
  PATIENT_CREATED: 'Patient created successfully',
  PATIENT_UPDATED: 'Patient updated successfully',
  PATIENT_FOUND: 'Patient found successfully',

  // Chat Success
  CHAT_CREATED: 'Chat created successfully',
  CHAT_UPDATED: 'Chat updated successfully',
  CHAT_CLOSED: 'Chat closed successfully',

  // Message Success
  MESSAGE_SENT: 'Message sent successfully',
  MESSAGE_CREATED: 'Message created successfully',
  MESSAGE_UPDATED: 'Message updated successfully',

  // Task Success
  TASK_CREATED: 'Task created successfully',
  TASK_UPDATED: 'Task updated successfully',
  TASK_COMPLETED: 'Task completed successfully',

  // WhatsApp Success
  WHATSAPP_MESSAGE_SENT: 'WhatsApp message sent successfully',
  WHATSAPP_WEBHOOK_PROCESSED: 'WhatsApp webhook processed successfully',

  // Mapping and Workflow Success
  MAPPING_SAVED: 'Patient-chat mapping saved successfully',
  PATIENT_WORKFLOW_COMPLETED: 'Patient workflow completed successfully',
  PHONE_NUMBER_FORMATTED: 'Phone number formatted successfully',
  CHAT_FROM_NAME_CREATED: 'Chat created from name detection successfully',
} as const;
