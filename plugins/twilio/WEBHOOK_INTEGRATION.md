# 🎯 Twilio Webhook Integration - Incoming Message Listening

This guide explains how to implement incoming SMS and WhatsApp message listening using the Twilio plugin with HelmAI agents.

## 📋 **Step-by-Step Implementation Plan**

### **Step 1: Server Integration**

Add the Twilio webhook module to your main NestJS server:

```typescript
// packages/server/src/app.module.ts
import { TwilioWebhookModule } from '@snakagent/plugin-twilio';

@Module({
  imports: [
    // ... other modules
    TwilioWebhookModule,
  ],
  // ...
})
export class AppModule {}
```

### **Step 2: Environment Configuration**

Add these environment variables to your `.env` file:

```env
# Twilio Webhook Configuration
TWILIO_WEBHOOK_URL="https://your-domain.com/api/twilio/webhook"
TWILIO_WEBHOOK_PORT="3001"  # Same as your server port

# Existing Twilio credentials
TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID"
TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN"
TWILIO_FROM_NUMBER="+16162539219"
TWILIO_WHATSAPP_NUMBER="+33613737897"
```

### **Step 3: Expose Your Server (Development)**

For development, use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Expose your server port
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### **Step 4: Configure Twilio Webhooks**

#### **SMS Webhook Configuration:**
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers → Manage → Active numbers**
3. Click on your phone number (`+16162539219`)
4. Set **Webhook URL**: `https://your-domain.com/api/twilio/webhook/sms`
5. Set **HTTP Method**: `POST`
6. Save configuration

#### **WhatsApp Webhook Configuration:**
1. Go to **Messaging → Try it out → WhatsApp sandbox**
2. Set **Webhook URL**: `https://your-domain.com/api/twilio/webhook/whatsapp`
3. Set **HTTP Method**: `POST`
4. Save configuration

### **Step 5: Agent Integration**

Modify the webhook service to integrate with your HelmAI agents:

```typescript
// In TwilioWebhookService.generateAgentResponse()
private async generateAgentResponse(context: IncomingMessageContext): Promise<string> {
  try {
    // Call your HelmAI agent
    const agentResponse = await this.callHelmAIAgent(context);
    return agentResponse;
  } catch (error) {
    return 'Sorry, I encountered an error. Please try again.';
  }
}

private async callHelmAIAgent(context: IncomingMessageContext): Promise<string> {
  // Example integration with your agent system
  const agentRequest = {
    content: context.body,
    platform: context.platform,
    from: context.from,
    timestamp: context.timestamp
  };

  // Call your agent API
  const response = await fetch('http://localhost:3001/api/agents/supervisor/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.SERVER_API_KEY || 'helmai-secret-key-2024'
    },
    body: JSON.stringify({
      request: {
        content: `Incoming ${context.platform} message from ${context.from}: ${context.body}`,
        agentId: "1"
      }
    })
  });

  const result = await response.json();
  return result.data || 'I received your message but couldn\'t process it right now.';
}
```

## 🔄 **Message Flow**

```
1. User sends SMS/WhatsApp → Twilio
2. Twilio → Webhook → Your Server (/api/twilio/webhook/sms or /whatsapp)
3. TwilioWebhookController → TwilioWebhookService
4. TwilioWebhookService → HelmAI Agent (via API call)
5. Agent processes message → Returns response
6. TwilioWebhookService → Sends response back via SMS/WhatsApp
```

## 🧪 **Testing the Integration**

### **Test SMS:**
1. Send an SMS to your Twilio number: `+16162539219`
2. Message: "Hello HelmAI"
3. Check server logs for incoming webhook
4. Verify response is sent back

### **Test WhatsApp:**
1. Join WhatsApp sandbox: Send "join remain-famous" to `+1 415 523 8886`
2. Send message to your WhatsApp Business number
3. Check server logs for incoming webhook
4. Verify response is sent back

## 📊 **Conversation Storage**

Implement conversation history storage:

```typescript
// Add to TwilioWebhookService
private async storeConversation(context: IncomingMessageContext, response: string): Promise<void> {
  // Store in your database
  const conversation = {
    messageId: context.messageId,
    from: context.from,
    to: context.to,
    userMessage: context.body,
    agentResponse: response,
    platform: context.platform,
    timestamp: context.timestamp,
    profileName: context.profileName
  };

  // Save to database (implement based on your DB choice)
  await this.conversationRepository.save(conversation);
}
```

## 🔐 **Security Features**

1. **Webhook Signature Verification**: Validates requests come from Twilio
2. **Rate Limiting**: Prevent spam (implement in NestJS)
3. **Input Validation**: Sanitize incoming messages
4. **Error Handling**: Graceful error responses

## 🚀 **Advanced Features**

### **Multi-Agent Routing**
Route messages to different agents based on content:

```typescript
private async selectAgent(context: IncomingMessageContext): Promise<string> {
  const message = context.body.toLowerCase();
  
  if (message.includes('dental') || message.includes('dentaire')) {
    return 'dental-assistant-agent';
  }
  
  if (message.includes('code') || message.includes('programming')) {
    return 'coding-assistant-agent';
  }
  
  return 'general-assistant-agent'; // Default
}
```

### **Media Handling**
Handle images and files:

```typescript
private async handleMedia(context: IncomingMessageContext): Promise<string> {
  if (context.mediaUrl) {
    // Download and process media
    const mediaResponse = await fetch(context.mediaUrl);
    const mediaBuffer = await mediaResponse.buffer();
    
    // Process with vision AI or file analysis
    return await this.processMediaWithAgent(mediaBuffer, context);
  }
  
  return this.generateAgentResponse(context);
}
```

## 📈 **Monitoring & Analytics**

Track conversation metrics:

```typescript
// Add metrics tracking
private async trackMetrics(context: IncomingMessageContext, responseTime: number): Promise<void> {
  const metrics = {
    platform: context.platform,
    responseTime,
    messageLength: context.body.length,
    timestamp: context.timestamp,
    userPhone: context.from
  };
  
  // Send to analytics service
  await this.analyticsService.track('incoming_message', metrics);
}
```

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **Webhook not receiving messages:**
   - Check ngrok is running and URL is correct
   - Verify Twilio webhook configuration
   - Check server logs for errors

2. **Signature verification failing:**
   - Ensure `TWILIO_AUTH_TOKEN` is correct
   - Check webhook URL matches exactly

3. **Agent not responding:**
   - Verify agent API is accessible
   - Check agent service is running
   - Review agent logs for errors

### **Debug Commands:**

```bash
# Check webhook endpoints
curl -X POST http://localhost:3001/api/twilio/webhook/sms \
  -H "Content-Type: application/json" \
  -d '{"From":"+33786976911","Body":"test","MessageSid":"test123"}'

# Test agent integration
curl -X POST http://localhost:3001/api/agents/supervisor/request \
  -H "x-api-key: helmai-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"request":{"content":"test message","agentId":"1"}}'
```

## 🎯 **Next Steps**

1. **Build the plugin**: `pnpm run build` in the twilio plugin directory
2. **Integrate with server**: Add TwilioWebhookModule to your main app
3. **Configure webhooks**: Set up Twilio webhook URLs
4. **Test thoroughly**: Send test messages and verify responses
5. **Deploy**: Use a production domain instead of ngrok
6. **Monitor**: Set up logging and analytics

This implementation provides a complete foundation for bidirectional SMS and WhatsApp communication with your HelmAI agents! 🚀 