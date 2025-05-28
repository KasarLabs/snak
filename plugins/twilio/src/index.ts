// Export all schemas
export {
  smsSchema,
  whatsappSchema,
  emailSchema,
  communicationSchema,
  type SMSSchemaType,
  type WhatsAppSchemaType,
  type EmailSchemaType,
  type CommunicationSchemaType,
} from './schema/index.js';

// Export all types
export {
  type SMSParams,
  type WhatsAppParams,
  type EmailParams,
  type CommunicationParams,
  type CommunicationResult,
  type CommunicationSummary,
  type TwilioConfig,
  type SendGridConfig,
} from './types/index.js';

// Export services
export { SMSService } from './actions/sms.js';
export { WhatsAppService } from './actions/whatsapp.js';
export { EmailService } from './actions/email.js';
export { CommunicationService } from './actions/communication.js';

// Export utility functions
export { sendSMS } from './actions/sms.js';
export { sendWhatsApp } from './actions/whatsapp.js';
export { sendEmail } from './actions/email.js';
export { sendCommunication } from './actions/communication.js';

// Export tools registry
export { registerTools } from './tools/index.js';

// Export webhook functionality
export { TwilioWebhookModule } from './webhooks/twilio-webhook.module.js';
export { TwilioWebhookService } from './webhooks/twilio-webhook.service.js';
export { TwilioWebhookController } from './webhooks/twilio-webhook.controller.js';
export type { IncomingMessageContext } from './webhooks/twilio-webhook.service.js';
export type { TwilioIncomingMessage } from './webhooks/twilio-webhook.controller.js'; 