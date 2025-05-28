import z from 'zod';

export const smsSchema = z.object({
  sendTo: z
    .string()
    .describe('Recipient phone number in E.164 format (e.g., +33786976911)'),
  message: z
    .string()
    .max(1600)
    .describe('SMS message content (max 1600 characters)'),
  from: z
    .string()
    .nullable()
    .describe('Optional sender phone number'),
});

export const whatsappSchema = z.object({
  sendTo: z
    .string()
    .describe('Recipient phone number in E.164 format (e.g., +33786976911)'),
  message: z
    .string()
    .describe('WhatsApp message content'),
  from: z
    .string()
    .nullable()
    .describe('Optional sender WhatsApp number'),
});

export const emailSchema = z.object({
  sendTo: z
    .string()
    .email()
    .describe('Recipient email address'),
  subject: z
    .string()
    .describe('Email subject line'),
  message: z
    .string()
    .describe('Email message content (plain text)'),
  html: z
    .string()
    .nullable()
    .describe('Optional HTML email content'),
  fromEmail: z
    .string()
    .nullable()
    .describe('Optional sender email address'),
  fromName: z
    .string()
    .nullable()
    .describe('Optional sender name'),
});

export const communicationSchema = z.object({
  recipientName: z
    .string()
    .describe('Name of the recipient for personalization'),
  sendToPhone: z
    .string()
    .nullable()
    .describe('Optional recipient phone number in E.164 format'),
  sendToEmail: z
    .string()
    .nullable()
    .describe('Optional recipient email address'),
  message: z
    .string()
    .describe('Message content to send'),
  subject: z
    .string()
    .nullable()
    .describe('Optional email subject (required if sending email)'),
  html: z
    .string()
    .nullable()
    .describe('Optional HTML email content'),
  channels: z
    .number()
    .nullable()
    .describe('Optional channel selection flags: 1=SMS, 2=Email, 4=WhatsApp, 7=All (default: 7)'),
});

export type SMSSchemaType = z.infer<typeof smsSchema>;
export type WhatsAppSchemaType = z.infer<typeof whatsappSchema>;
export type EmailSchemaType = z.infer<typeof emailSchema>;
export type CommunicationSchemaType = z.infer<typeof communicationSchema>; 