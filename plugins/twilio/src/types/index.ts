/**
 * Parameters for sending an SMS message
 */
export interface SMSParams {
  sendTo: string;
  message: string;
  from?: string;
}

/**
 * Parameters for sending a WhatsApp message
 */
export interface WhatsAppParams {
  sendTo: string;
  message: string;
  from?: string;
}

/**
 * Parameters for sending an email
 */
export interface EmailParams {
  sendTo: string;
  subject: string;
  message: string;
  html?: string;
  fromEmail?: string;
  fromName?: string;
}

/**
 * Parameters for unified communication
 */
export interface CommunicationParams {
  recipientName: string;
  sendToPhone?: string;
  sendToEmail?: string;
  message: string;
  subject?: string; // For email
  html?: string; // For email HTML content
  channels?: number; // Binary flags: 1=SMS, 2=Email, 4=WhatsApp, 7=All (default)
}

/**
 * Result of a communication operation
 */
export interface CommunicationResult {
  status: 'success' | 'failure';
  message?: string;
  error?: string;
  messageId?: string;
  sid?: string;
  to?: string;
  from?: string;
}

/**
 * Result of communication operation across multiple channels
 */
export interface CommunicationSummary {
  status: 'success' | 'partial' | 'failure';
  message: string;
  results: Array<{
    channel: 'SMS' | 'Email' | 'WhatsApp';
    success: boolean;
    result?: CommunicationResult;
    error?: string;
  }>;
  successCount: number;
  totalChannels: number;
}

/**
 * Twilio service configuration
 */
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  whatsappNumber?: string;
}

/**
 * SendGrid service configuration
 */
export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
} 