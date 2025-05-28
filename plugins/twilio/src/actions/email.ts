import sgMail from '@sendgrid/mail';
import { SnakAgentInterface } from '@snakagent/core';
import { EmailParams, CommunicationResult } from '../types/index.js';

/**
 * Service for sending emails via SendGrid
 */
export class EmailService {
  private fromEmail: string;
  private fromName: string;

  constructor(apiKey: string, fromEmail: string, fromName: string) {
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
    this.fromName = fromName;
  }

  /**
   * Validates email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sends an email
   */
  async sendEmail(params: EmailParams): Promise<CommunicationResult> {
    try {
      // Validate inputs
      if (!params.sendTo || !params.subject || !params.message) {
        return {
          status: 'failure',
          error: 'Missing required parameters: sendTo, subject, and message are required',
        };
      }

      if (!this.isValidEmail(params.sendTo)) {
        return {
          status: 'failure',
          error: 'Invalid recipient email address',
        };
      }

      const senderEmail = params.fromEmail || this.fromEmail;
      const senderName = params.fromName || this.fromName;

      if (!this.isValidEmail(senderEmail)) {
        return {
          status: 'failure',
          error: 'Invalid sender email address',
        };
      }

      const msg: sgMail.MailDataRequired = {
        to: params.sendTo,
        from: {
          email: senderEmail,
          name: senderName,
        },
        subject: params.subject,
        text: params.message,
      };

      // Add HTML content if provided
      if (params.html) {
        msg.html = params.html;
      }

      const response = await sgMail.send(msg);

      return {
        status: 'success',
        message: `Email sent successfully to ${params.sendTo}`,
        messageId: response[0].headers['x-message-id'] as string,
        to: params.sendTo,
        from: `${senderName} <${senderEmail}>`,
      };
    } catch (error) {
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Utility function to send email
 */
export const sendEmail = async (
  _agent: SnakAgentInterface,
  params: EmailParams
): Promise<string> => {
  try {
    // Get SendGrid credentials from environment
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
    const fromName = process.env.SENDGRID_FROM_NAME || 'HelmaI';

    if (!apiKey) {
      return JSON.stringify({
        status: 'failure',
        error: 'Missing SendGrid API key',
      });
    }

    const emailService = new EmailService(apiKey, fromEmail, fromName);
    const result = await emailService.sendEmail(params);
    
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}; 