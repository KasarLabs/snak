import twilio from 'twilio';
import { SnakAgentInterface } from '@snakagent/core';
import { WhatsAppParams, CommunicationResult } from '../types/index.js';

/**
 * Service for sending WhatsApp messages via Twilio
 */
export class WhatsAppService {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  /**
   * Validates phone number format
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Formats phone number for WhatsApp
   */
  private formatWhatsAppNumber(phoneNumber: string): string {
    return phoneNumber.startsWith('whatsapp:') 
      ? phoneNumber 
      : `whatsapp:${phoneNumber}`;
  }

  /**
   * Sends a WhatsApp message
   */
  async sendWhatsApp(params: WhatsAppParams): Promise<CommunicationResult> {
    try {
      // Validate inputs
      if (!params.sendTo || !params.message) {
        return {
          status: 'failure',
          error: 'Both "sendTo" and "message" parameters are required',
        };
      }

      if (!this.isValidPhoneNumber(params.sendTo)) {
        return {
          status: 'failure',
          error: 'Phone number must be in E.164 format (e.g., +33786976911)',
        };
      }

      const fromNumber = params.from || this.fromNumber;
      const toWhatsApp = this.formatWhatsAppNumber(params.sendTo);
      const fromWhatsApp = this.formatWhatsAppNumber(fromNumber);

      const message = await this.client.messages.create({
        from: fromWhatsApp,
        to: toWhatsApp,
        body: params.message,
      });

      return {
        status: 'success',
        message: `WhatsApp message sent successfully to ${params.sendTo}`,
        sid: message.sid,
        to: params.sendTo,
        from: fromNumber,
      };
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide specific guidance for common WhatsApp errors
      if (errorMessage.includes('63016') || errorMessage.includes('63015')) {
        errorMessage += '\n\nWhatsApp Sandbox Setup Required:\n1. Send "join remain-famous" to +1 415 523 8886\n2. Wait for confirmation before sending messages';
      }

      return {
        status: 'failure',
        error: errorMessage,
      };
    }
  }
}

/**
 * Utility function to send WhatsApp message
 */
export const sendWhatsApp = async (
  _agent: SnakAgentInterface,
  params: WhatsAppParams
): Promise<string> => {
  try {
    // Get Twilio credentials from environment or agent config
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+33613737897';

    if (!accountSid || !authToken) {
      return JSON.stringify({
        status: 'failure',
        error: 'Missing Twilio credentials',
      });
    }

    const whatsappService = new WhatsAppService(accountSid, authToken, fromNumber);
    const result = await whatsappService.sendWhatsApp(params);
    
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}; 