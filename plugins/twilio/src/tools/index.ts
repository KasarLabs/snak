import { StarknetTool } from '@snakagent/core';
import { smsSchema, whatsappSchema, emailSchema, communicationSchema } from '../schema/index.js';
import { sendSMS } from '../actions/sms.js';
import { sendWhatsApp } from '../actions/whatsapp.js';
import { sendEmail } from '../actions/email.js';
import { sendCommunication } from '../actions/communication.js';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'twilio_send_sms',
    plugins: 'twilio',
    description: 'Send a single SMS message to a phone number. Use this tool once per message request. Do not call multiple times for the same message.',
    schema: smsSchema,
    execute: sendSMS,
  });

  StarknetToolRegistry.push({
    name: 'twilio_send_whatsapp',
    plugins: 'twilio',
    description: 'Send a single WhatsApp message to a phone number. Use this tool once per message request. Do not call multiple times for the same message.',
    schema: whatsappSchema,
    execute: sendWhatsApp,
  });

  StarknetToolRegistry.push({
    name: 'twilio_send_email',
    plugins: 'twilio',
    description: 'Send a single email message via SendGrid. Use this tool once per email request. Do not call multiple times for the same email.',
    schema: emailSchema,
    execute: sendEmail,
  });

  StarknetToolRegistry.push({
    name: 'twilio_send_communication',
    plugins: 'twilio',
    description: 'Send a message across multiple communication channels (SMS, WhatsApp, Email) in a single operation. Use channel selection flags to control which channels to use.',
    schema: communicationSchema,
    execute: sendCommunication,
  });
}; 