import { SnakAgentInterface } from '@snakagent/core';
import { SMSService } from './sms.js';
import { WhatsAppService } from './whatsapp.js';
import { EmailService } from './email.js';
import { CommunicationResult, CommunicationParams } from '../types/index.js';

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
 * Unified communication service for sending messages across multiple channels
 */
export class CommunicationService {
  private smsService?: SMSService;
  private whatsappService?: WhatsAppService;
  private emailService?: EmailService;

  constructor(
    twilioAccountSid: string,
    twilioAuthToken: string,
    twilioFromNumber: string,
    twilioWhatsAppNumber: string,
    sendGridApiKey?: string,
    sendGridFromEmail?: string,
    sendGridFromName?: string
  ) {
    // Initialize SMS service
    this.smsService = new SMSService(
      twilioAccountSid,
      twilioAuthToken,
      twilioFromNumber
    );

    // Initialize WhatsApp service
    this.whatsappService = new WhatsAppService(
      twilioAccountSid,
      twilioAuthToken,
      twilioWhatsAppNumber
    );

    // Initialize Email service if SendGrid credentials are provided
    if (sendGridApiKey && sendGridFromEmail && sendGridFromName) {
      this.emailService = new EmailService(
        sendGridApiKey,
        sendGridFromEmail,
        sendGridFromName
      );
    }
  }

  /**
   * Sends messages across multiple communication channels
   */
  async sendToRecipient(
    params: CommunicationParams
  ): Promise<CommunicationSummary> {
    const channels = params.channels || 7; // Default to all channels (111 in binary)

    // Channel selection using binary flags:
    // 1 (001) = SMS only
    // 2 (010) = Email only
    // 3 (011) = SMS + Email
    // 4 (100) = WhatsApp only
    // 5 (101) = SMS + WhatsApp
    // 6 (110) = Email + WhatsApp
    // 7 (111) = All channels (default)

    const enableSMS = (channels & 1) !== 0;
    const enableEmail = (channels & 2) !== 0;
    const enableWhatsApp = (channels & 4) !== 0;

    const results: CommunicationSummary['results'] = [];
    let successCount = 0;
    let totalChannels = 0;

    // Send SMS
    if (enableSMS) {
      totalChannels++;
      if (params.sendToPhone && this.smsService) {
        try {
          const result = await this.smsService.sendSMS({
            sendTo: params.sendToPhone,
            message: params.message,
          });
          
          results.push({
            channel: 'SMS',
            success: result.status === 'success',
            result,
          });
          
          if (result.status === 'success') successCount++;
        } catch (error) {
          results.push({
            channel: 'SMS',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        results.push({
          channel: 'SMS',
          success: false,
          error: params.sendToPhone ? 'SMS service not available' : 'No phone number provided',
        });
      }
    }

    // Send Email
    if (enableEmail) {
      totalChannels++;
      if (params.sendToEmail && this.emailService) {
        try {
          const emailSubject = params.subject || `Message from ${params.recipientName}`;
          const emailHtml = params.html || `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2c5aa0;">Message for ${params.recipientName}</h2>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #2c5aa0;">
                <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
                  ${params.message}
                </p>
              </div>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                Message sent via HelmaI Communication Service
              </p>
            </div>
          `;

          const result = await this.emailService.sendEmail({
            sendTo: params.sendToEmail,
            subject: emailSubject,
            message: params.message,
            html: emailHtml,
          });
          
          results.push({
            channel: 'Email',
            success: result.status === 'success',
            result,
          });
          
          if (result.status === 'success') successCount++;
        } catch (error) {
          results.push({
            channel: 'Email',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        results.push({
          channel: 'Email',
          success: false,
          error: params.sendToEmail ? 'Email service not available' : 'No email address provided',
        });
      }
    }

    // Send WhatsApp
    if (enableWhatsApp) {
      totalChannels++;
      if (params.sendToPhone && this.whatsappService) {
        try {
          const result = await this.whatsappService.sendWhatsApp({
            sendTo: params.sendToPhone,
            message: params.message,
          });
          
          results.push({
            channel: 'WhatsApp',
            success: result.status === 'success',
            result,
          });
          
          if (result.status === 'success') successCount++;
        } catch (error) {
          results.push({
            channel: 'WhatsApp',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        results.push({
          channel: 'WhatsApp',
          success: false,
          error: params.sendToPhone ? 'WhatsApp service not available' : 'No phone number provided',
        });
      }
    }

    // Determine overall status
    let status: 'success' | 'partial' | 'failure';
    if (successCount === totalChannels) {
      status = 'success';
    } else if (successCount > 0) {
      status = 'partial';
    } else {
      status = 'failure';
    }

    const enabledChannels = [];
    if (enableSMS) enabledChannels.push('SMS');
    if (enableEmail) enabledChannels.push('Email');
    if (enableWhatsApp) enabledChannels.push('WhatsApp');

    return {
      status,
      message: `Sent message to ${params.recipientName} via ${enabledChannels.join(', ')}. Success rate: ${successCount}/${totalChannels}`,
      results,
      successCount,
      totalChannels,
    };
  }
}

/**
 * Utility function to send unified communication
 */
export const sendCommunication = async (
  _agent: SnakAgentInterface,
  params: CommunicationParams
): Promise<string> => {
  try {
    // Get credentials from environment
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFromNumber = process.env.TWILIO_FROM_NUMBER || '+16162539219';
    const twilioWhatsAppNumber =
      process.env.TWILIO_WHATSAPP_NUMBER || '+33613737897';
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const sendGridFromEmail =
      process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
    const sendGridFromName = process.env.SENDGRID_FROM_NAME || 'HelmaI';

    if (!twilioAccountSid || !twilioAuthToken) {
      return JSON.stringify({
        status: 'failure',
        error: 'Missing Twilio credentials',
      });
    }

    const communicationService = new CommunicationService(
      twilioAccountSid,
      twilioAuthToken,
      twilioFromNumber,
      twilioWhatsAppNumber,
      sendGridApiKey,
      sendGridFromEmail,
      sendGridFromName
    );

    const result = await communicationService.sendToRecipient(params);
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
 