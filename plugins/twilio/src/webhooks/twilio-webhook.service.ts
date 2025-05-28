import { Injectable, Logger } from '@nestjs/common';
import crypto from 'crypto';
import { TwilioIncomingMessage } from './twilio-webhook.controller.js';
import { SMSService } from '../actions/sms.js';
import { WhatsAppService } from '../actions/whatsapp.js';

export interface IncomingMessageContext {
  messageId: string;
  from: string;
  to: string;
  body: string;
  platform: 'sms' | 'whatsapp';
  timestamp: Date;
  profileName?: string;
  mediaUrl?: string;
}

export interface WebhookResponse {
  status: 'processed' | 'error';
  error?: string;
}

@Injectable()
export class TwilioWebhookService {
  private readonly logger = new Logger(TwilioWebhookService.name);
  private smsService?: SMSService;
  private whatsappService?: WhatsAppService;

  constructor() {
    // Initialize services with environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER || '+16162539219';
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+33613737897';

    if (accountSid && authToken) {
      this.smsService = new SMSService(accountSid, authToken, fromNumber);
      this.whatsappService = new WhatsAppService(
        accountSid,
        authToken,
        whatsappNumber
      );
    }
  }

  /**
   * Verify Twilio webhook signature for security
   */
  async verifyWebhook(
    body: TwilioIncomingMessage,
    signature?: string
  ): Promise<boolean> {
    if (!signature || !process.env.TWILIO_AUTH_TOKEN) {
      return false;
    }

    try {
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const url =
        process.env.TWILIO_WEBHOOK_URL ||
        'https://your-domain.com/twilio/webhook';

      // Create the expected signature
      const expectedSignature = crypto
        .createHmac('sha1', authToken)
        .update(url + JSON.stringify(body))
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(expectedSignature, 'base64')
      );
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle incoming SMS messages
   */
  async handleIncomingSMS(message: TwilioIncomingMessage): Promise<WebhookResponse> {
    const context: IncomingMessageContext = {
      messageId: message.MessageSid,
      from: message.From,
      to: message.To,
      body: message.Body,
      platform: 'sms',
      timestamp: new Date(),
      mediaUrl: message.MediaUrl0,
    };

    this.logger.log(`Processing SMS: ${context.from} -> ${context.body}`);

    // Process the message with the agent
    const agentResponse = await this.processWithAgent(context);

    // Send response back via SMS
    if (agentResponse && this.smsService) {
      await this.smsService.sendSMS({
        sendTo: context.from,
        message: agentResponse,
      });

      // Store conversation history
      await this.storeConversation(context, agentResponse);
    }

    return { status: 'processed' };
  }

  /**
   * Handle incoming WhatsApp messages
   */
  async handleIncomingWhatsApp(message: TwilioIncomingMessage): Promise<WebhookResponse> {
    const context: IncomingMessageContext = {
      messageId: message.MessageSid,
      from: message.From.replace('whatsapp:', ''), // Remove whatsapp: prefix
      to: message.To,
      body: message.Body,
      platform: 'whatsapp',
      timestamp: new Date(),
      profileName: message.ProfileName,
      mediaUrl: message.MediaUrl0,
    };

    this.logger.log(
      `Processing WhatsApp: ${context.from} (${context.profileName}) -> ${context.body}`
    );

    // Process the message with the agent
    const agentResponse = await this.processWithAgent(context);

    // Send response back via WhatsApp
    if (agentResponse && this.whatsappService) {
      await this.whatsappService.sendWhatsApp({
        sendTo: context.from,
        message: agentResponse,
      });

      // Store conversation history
      await this.storeConversation(context, agentResponse);
    }

    return { status: 'processed' };
  }

  /**
   * Process incoming message with the appropriate agent
   */
  private async processWithAgent(
    context: IncomingMessageContext
  ): Promise<string | null> {
    try {
      // Here we would integrate with the agent system
      // For now, let's create a simple response logic

      // You can customize this logic based on your needs
      const response = await this.generateAgentResponse(context);

      return response;
    } catch (error) {
      this.logger.error('Error processing message with agent:', error);
      return 'Sorry, I encountered an error processing your message. Please try again later.';
    }
  }

  /**
   * Generate agent response (this is where you'd integrate with your HelmAI agents)
   */
  private async generateAgentResponse(
    context: IncomingMessageContext
  ): Promise<string> {
    // Simple response logic - you can replace this with actual agent integration
    const message = context.body.toLowerCase();

    if (
      message.includes('hello') ||
      message.includes('hi') ||
      message.includes('bonjour')
    ) {
      return `Hello! I'm HelmAI assistant. How can I help you today? (Received via ${context.platform})`;
    }

    if (message.includes('help') || message.includes('aide')) {
      return 'I can help you with various tasks. What do you need assistance with?';
    }

    if (message.includes('time') || message.includes('heure')) {
      return `Current time: ${new Date().toLocaleString()}`;
    }

    // Default response
    return `I received your message: "${context.body}". I'm still learning how to respond to this type of message. Can you try asking something else?`;
  }

  /**
   * Store conversation history (implement based on your database)
   */
  private async storeConversation(
    context: IncomingMessageContext,
    response: string
  ): Promise<void> {
    // Implement conversation storage logic here
    this.logger.log(
      `Storing conversation: ${context.from} -> ${context.body} | Response: ${response}`
    );
  }
}
