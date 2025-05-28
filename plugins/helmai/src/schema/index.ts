import { z } from 'zod';
import { HEALTHCARE_CONFIG } from '../constants/healthcare.js';

// Base schemas for reusable validation
const phoneNumberSchema = z
  .string()
  .regex(HEALTHCARE_CONFIG.PHONE_NUMBER_REGEX, 'Invalid phone number format')
  .describe('Phone number in international format');

const emailSchema = z
  .string()
  .regex(HEALTHCARE_CONFIG.EMAIL_REGEX, 'Invalid email format')
  .describe('Valid email address');

const ssnSchema = z
  .string()
  .regex(HEALTHCARE_CONFIG.SSN_REGEX, 'Invalid SSN format')
  .describe('Social Security Number');

const uuidSchema = z
  .string()
  .uuid('Invalid UUID format')
  .describe('UUID identifier');

// Patient Management Schemas
export const searchPatientSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH, 'First name too long')
    .describe('Patient first name'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH, 'Last name too long')
    .describe('Patient last name'),
  phoneNumber: phoneNumberSchema.optional().nullable(),
  centerId: uuidSchema.optional().nullable().describe('Healthcare center ID'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .nullable()
    .default(10)
    .describe('Maximum number of results'),
  offset: z
    .number()
    .min(0)
    .optional()
    .nullable()
    .default(0)
    .describe('Number of results to skip'),
});

export const searchPatientBySSNSchema = z.object({
  ssn: ssnSchema,
  includeDetails: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include detailed patient information'),
});

export const createPatientSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH, 'First name too long')
    .describe('Patient first name'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH, 'Last name too long')
    .describe('Patient last name'),
  phoneNumber: phoneNumberSchema,
  email: emailSchema.optional(),
  dateOfBirth: z
    .string()
    .optional()
    .describe('Date of birth in YYYY-MM-DD format'),
  gender: z.enum(HEALTHCARE_CONFIG.GENDER_OPTIONS).optional(),
  ssn: ssnSchema.optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional()
    .describe('Patient address'),
  emergencyContact: z
    .object({
      name: z.string().min(1, 'Emergency contact name is required'),
      phoneNumber: phoneNumberSchema,
      relationship: z.string().min(1, 'Relationship is required'),
    })
    .optional()
    .describe('Emergency contact information'),
});

export const updatePatientSchema = z.object({
  patientId: uuidSchema,
  firstName: z
    .string()
    .max(HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH)
    .optional(),
  lastName: z
    .string()
    .max(HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH)
    .optional(),
  phoneNumber: phoneNumberSchema.optional(),
  email: emailSchema.optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(HEALTHCARE_CONFIG.GENDER_OPTIONS).optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1),
      phoneNumber: phoneNumberSchema,
      relationship: z.string().min(1),
    })
    .optional(),
});

// Chat Management Schemas
export const createChatSchema = z.object({
  patientId: uuidSchema,
  type: z
    .enum(HEALTHCARE_CONFIG.CHAT_TYPES)
    .describe('Type of chat communication'),
  priority: z
    .enum(HEALTHCARE_CONFIG.CHAT_PRIORITIES)
    .optional()
    .default('MEDIUM'),
  subject: z
    .string()
    .max(HEALTHCARE_CONFIG.MAX_CHAT_SUBJECT_LENGTH, 'Subject too long')
    .optional()
    .describe('Chat subject or topic'),
  centerId: uuidSchema.optional().describe('Healthcare center ID'),
  assignedTo: z.string().optional().describe('Healthcare provider ID'),
  metadata: z
    .object({
      twilioConversationSid: z.string().optional(),
      phoneNumber: phoneNumberSchema.optional(),
    })
    .optional()
    .describe('Additional chat metadata'),
});

export const updateChatSchema = z.object({
  chatId: uuidSchema,
  status: z.enum(HEALTHCARE_CONFIG.CHAT_STATUSES).optional(),
  priority: z.enum(HEALTHCARE_CONFIG.CHAT_PRIORITIES).optional(),
  subject: z.string().max(HEALTHCARE_CONFIG.MAX_CHAT_SUBJECT_LENGTH).optional(),
  summary: z.string().optional().describe('Chat summary'),
  tags: z.array(z.string()).optional().describe('Chat tags'),
  assignedTo: z.string().optional().describe('Healthcare provider ID'),
});

export const getChatHistorySchema = z.object({
  chatId: uuidSchema,
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  messageType: z.enum(HEALTHCARE_CONFIG.MESSAGE_TYPES).optional(),
  senderType: z.enum(HEALTHCARE_CONFIG.SENDER_TYPES).optional(),
});

// Message Management Schemas
export const createMessageSchema = z.object({
  chatId: uuidSchema,
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(HEALTHCARE_CONFIG.MAX_MESSAGE_LENGTH, 'Message too long')
    .describe('Message content'),
  senderType: z
    .enum(HEALTHCARE_CONFIG.SENDER_TYPES)
    .describe('Type of message sender'),
  senderId: z
    .string()
    .min(1, 'Sender ID is required')
    .describe('ID of the sender'),
  senderName: z.string().optional().describe('Name of the sender'),
  messageType: z
    .enum(HEALTHCARE_CONFIG.MESSAGE_TYPES)
    .optional()
    .default('TEXT'),
  priority: z
    .enum(HEALTHCARE_CONFIG.CHAT_PRIORITIES)
    .optional()
    .default('MEDIUM'),
  replyToMessageId: uuidSchema
    .optional()
    .describe('ID of message being replied to'),
  metadata: z
    .object({
      twilioMessageSid: z.string().optional(),
      twilioAccountSid: z.string().optional(),
      twilioFrom: z.string().optional(),
      twilioTo: z.string().optional(),
      mediaUrl: z.string().url().optional(),
      mediaType: z.string().optional(),
      location: z
        .object({
          latitude: z.number(),
          longitude: z.number(),
          address: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const updateMessageSchema = z.object({
  messageId: uuidSchema,
  content: z.string().max(HEALTHCARE_CONFIG.MAX_MESSAGE_LENGTH).optional(),
  status: z.enum(HEALTHCARE_CONFIG.MESSAGE_STATUSES).optional(),
  priority: z.enum(HEALTHCARE_CONFIG.CHAT_PRIORITIES).optional(),
});

// Task Management Schemas
export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(200, 'Title too long')
    .describe('Task title'),
  description: z
    .string()
    .min(1, 'Task description is required')
    .max(HEALTHCARE_CONFIG.MAX_TASK_DESCRIPTION_LENGTH, 'Description too long')
    .describe('Detailed task description'),
  priority: z
    .enum(HEALTHCARE_CONFIG.TASK_PRIORITIES)
    .describe('Task priority level'),
  type: z
    .enum(HEALTHCARE_CONFIG.TASK_TYPES)
    .optional()
    .nullable()
    .describe('Type of healthcare task'),
  patientId: uuidSchema,
  assignedTo: z.string().optional().nullable().describe('Healthcare provider ID'),
  assignedBy: z
    .string()
    .optional()
    .nullable()
    .describe('ID of person who assigned the task'),
  centerId: uuidSchema.describe('Healthcare center ID'),
  dueDate: z.string().optional().nullable().describe('Due date in ISO format'),
  estimatedDuration: z
    .number()
    .min(1)
    .optional()
    .nullable()
    .describe('Estimated duration in minutes'),
  tags: z.array(z.string()).optional().nullable().describe('Task tags'),
  notes: z.string().optional().nullable().describe('Additional notes'),
  relatedChatId: uuidSchema.optional().nullable().describe('Related chat ID'),
  relatedMessageId: uuidSchema.optional().nullable().describe('Related message ID'),
  metadata: z
    .object({
      appointmentType: z.string().optional().nullable(),
      testType: z.string().optional().nullable(),
      medicationName: z.string().optional().nullable(),
      dosage: z.string().optional().nullable(),
      frequency: z.string().optional().nullable(),
      symptoms: z.array(z.string()).optional().nullable(),
      diagnosis: z.string().optional().nullable(),
    })
    .optional()
    .nullable()
    .describe('Task-specific metadata'),
});

export const updateTaskSchema = z.object({
  taskId: uuidSchema,
  title: z.string().max(200).optional(),
  description: z
    .string()
    .max(HEALTHCARE_CONFIG.MAX_TASK_DESCRIPTION_LENGTH)
    .optional(),
  priority: z.enum(HEALTHCARE_CONFIG.TASK_PRIORITIES).optional(),
  status: z.enum(HEALTHCARE_CONFIG.TASK_STATUSES).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedDuration: z.number().min(1).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  metadata: z
    .object({
      appointmentType: z.string().optional(),
      testType: z.string().optional(),
      medicationName: z.string().optional(),
      dosage: z.string().optional(),
      frequency: z.string().optional(),
      symptoms: z.array(z.string()).optional(),
      diagnosis: z.string().optional(),
    })
    .optional(),
});

export const getPatientTasksSchema = z.object({
  patientId: uuidSchema,
  status: z.enum(HEALTHCARE_CONFIG.TASK_STATUSES).optional(),
  type: z.enum(HEALTHCARE_CONFIG.TASK_TYPES).optional(),
  priority: z.enum(HEALTHCARE_CONFIG.TASK_PRIORITIES).optional(),
  assignedTo: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

// Appointment Scheduling Schemas
export const scheduleAppointmentSchema = z.object({
  patientId: uuidSchema,
  appointmentDate: z.string().describe('Appointment date in ISO format'),
  appointmentTime: z.string().describe('Appointment time (HH:MM format)'),
  appointmentType: z
    .string()
    .min(1, 'Appointment type is required')
    .describe('Type of appointment'),
  providerId: z.string().optional().describe('Healthcare provider ID'),
  centerId: uuidSchema.describe('Healthcare center ID'),
  duration: z
    .number()
    .min(15)
    .max(480)
    .optional()
    .default(30)
    .describe('Duration in minutes'),
  reason: z
    .string()
    .min(1, 'Reason is required')
    .describe('Reason for appointment'),
  notes: z.string().optional().describe('Additional appointment notes'),
  priority: z
    .enum(HEALTHCARE_CONFIG.TASK_PRIORITIES)
    .optional()
    .default('MEDIUM'),
});

export const getAvailableSlotsSchema = z.object({
  centerId: uuidSchema,
  providerId: z.string().optional(),
  date: z.string().describe('Date to check availability (YYYY-MM-DD)'),
  appointmentType: z.string().optional(),
  duration: z.number().min(15).max(480).optional().default(30),
});

// Phone Number Formatting Schema
export const formatPhoneNumberSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .describe('Phone number to format (any format accepted)'),
});

// Patient Chat Mapping Schema
export const savePatientChatMappingSchema = z.object({
  phoneNumber: phoneNumberSchema,
  patientId: uuidSchema,
  chatId: uuidSchema,
  metadata: z
    .object({
      createdAt: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

// Create Chat From Name Schema
export const createChatFromNameSchema = z.object({
  messageContent: z
    .string()
    .min(1, 'Message content is required')
    .describe('Message content that may contain patient name'),
  phoneNumber: phoneNumberSchema
    .optional()
    .describe('Phone number of the sender'),
  centerId: uuidSchema.optional().describe('Healthcare center ID'),
});

// Process Patient and Create Chat Schema
export const processPatientAndCreateChatSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH, 'First name too long')
    .describe('Patient first name'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(HEALTHCARE_CONFIG.MAX_PATIENT_NAME_LENGTH, 'Last name too long')
    .describe('Patient last name'),
  phoneNumber: phoneNumberSchema.optional().describe('Patient phone number'),
  centerId: uuidSchema.optional().describe('Healthcare center ID'),
  autoCreateChat: z
    .boolean()
    .optional()
    .default(true)
    .describe('Automatically create chat if patient found'),
});
