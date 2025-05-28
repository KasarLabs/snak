import { Module } from '@nestjs/common';
import { TwilioWebhookController } from './twilio-webhook.controller.js';
import { TwilioWebhookService } from './twilio-webhook.service.js';

@Module({
  controllers: [TwilioWebhookController],
  providers: [TwilioWebhookService],
  exports: [TwilioWebhookService],
})
export class TwilioWebhookModule {} 