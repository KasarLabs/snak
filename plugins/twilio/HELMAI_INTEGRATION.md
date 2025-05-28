# HelmaI Twilio Integration (TypeScript)

This integration allows your HelmaI dental assistant to receive and respond to SMS and WhatsApp messages via Twilio webhooks, properly integrated into the existing NestJS server architecture.

## 🚀 Quick Start

### 1. Start the NestJS Server

The Twilio integration is now part of the main server. Simply run:

```bash
# Start the server (includes Twilio webhooks)
pnpm run start:server --agent="helmai.agent.json" --models="helmai.models.json"
```

The Twilio webhooks will be available at:
- SMS: `http://localhost:3001/api/twilio/webhook/sms`
- WhatsApp: `http://localhost:3001/api/twilio/webhook/whatsapp`

### 2. Configure Twilio Webhooks

In your [Twilio Console](https://console.twilio.com/):

#### For SMS:
- Go to Phone Numbers → Manage → Active numbers
- Click on your Twilio number (`+16162539219`)
- Set webhook URL: `https://your-domain.com/api/twilio/webhook/sms`
- Method: POST

#### For WhatsApp:
- Go to Messaging → Try it out → WhatsApp sandbox (or WhatsApp Business if approved)
- Set webhook URL: `https://your-domain.com/api/twilio/webhook/whatsapp`
- Method: POST

### 3. Expose Your Local Server (for testing)

Use ngrok to expose your local server:

```bash
# Install ngrok if you haven't
npm install -g ngrok

# Expose port 3001 (NestJS server port)
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and use it in your Twilio webhook configuration.

## 🏗️ Architecture

### TypeScript Integration
- **NestJS Module**: `packages/server/src/twilio/twilio.module.ts`
- **Service**: `packages/server/src/twilio/twilio.service.ts` 
- **Controller**: `packages/server/src/twilio/twilio.controller.ts`
- **Proper Dependency Injection**: Integrated with AgentService

### No Separate Server Required
- ✅ Single service architecture
- ✅ Proper TypeScript types
- ✅ NestJS dependency injection
- ✅ Integrated with existing agent system
- ✅ Follows project structure conventions

## 📱 How It Works

1. **Patient sends SMS/WhatsApp** → Twilio receives message
2. **Twilio webhook** → Calls NestJS server endpoint
3. **TwilioController** → Processes webhook and creates IncomingMessage
4. **TwilioService** → Handles message and generates HelmaI response
5. **TwilioService** → Sends response back via SMS/WhatsApp

## 🔧 Configuration

### Environment Variables

Make sure these are set in your `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID"
TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN"
TWILIO_FROM_NUMBER="+16162539219"
TWILIO_WHATSAPP_NUMBER="+15557883830"

# Anthropic API (for HelmaI agent)
ANTHROPIC_API_KEY="your-anthropic-key"

# Server Configuration
SERVER_PORT="3001"
```

## 🧪 Testing

### Test SMS Integration

Send an SMS to your Twilio number (`+16162539219`) with any message. The HelmaI agent should respond asking for your name.

### Test WhatsApp Integration

1. Join your WhatsApp sandbox by sending "join remain-famous" to `+1 415 523 8886`
2. Send a message to your WhatsApp Business number
3. HelmaI should respond asking for your name

### API Endpoints

- **Health Check**: `GET /api/twilio/health`
- **Get Messages**: `GET /api/twilio/messages`
- **Get SMS Messages**: `GET /api/twilio/messages/sms`
- **Get WhatsApp Messages**: `GET /api/twilio/messages/whatsapp`

## 📋 Expected Conversation Flow

1. **Patient**: "Bonjour, j'ai mal aux dents"
2. **HelmaI**: "Bonjour ! Je suis HelmaI, votre assistant dentaire. Pour vous aider efficacement, j'aurais besoin de quelques informations. Pourriez-vous me donner votre prénom et votre nom de famille, s'il vous plaît ?"
3. **Patient**: "Jean Dupont"
4. **HelmaI**: "Merci Jean Dupont. Je vais vérifier si vous êtes dans notre base de données. En attendant, pouvez-vous me dire brièvement la raison de votre contact aujourd'hui ?"

## 🔍 Troubleshooting

### Server Issues

```bash
# Check if server is running
curl http://localhost:3001/api/twilio/health

# View server logs
pnpm run start:server --agent="helmai.agent.json" --models="helmai.models.json"
```

### Webhook Issues

- Verify webhook URLs in Twilio Console
- Check ngrok is running and URL is correct
- Ensure your server is accessible from the internet

### Agent Issues

- Test the agent directly: `pnpm run start --agent="helmai.agent.json"`
- Check Anthropic API key is valid
- Verify agent configuration files exist

## 🎯 Production Deployment

For production, you'll need:

1. **Domain & SSL**: Deploy to a server with HTTPS
2. **Process Manager**: Use PM2 or similar to keep the server running
3. **Load Balancer**: For high availability
4. **Database**: Store conversation sessions and patient data
5. **Monitoring**: Track message volume and response times

## 📞 Integration Points

The NestJS server provides these endpoints:

- `POST /api/twilio/webhook/sms` - Receives SMS messages
- `POST /api/twilio/webhook/whatsapp` - Receives WhatsApp messages  
- `GET /api/twilio/health` - Health check endpoint
- `GET /api/twilio/messages` - Get all messages
- `GET /api/twilio/messages/:type` - Get messages by type

## 🔐 Security Considerations

- Use HTTPS in production
- Validate Twilio webhook signatures
- Implement rate limiting (already included via NestJS throttler)
- Store sensitive data securely
- Log conversations for compliance (GDPR/HIPAA)

## 🚀 Advantages of This Approach

✅ **Single Service**: No need to run multiple servers  
✅ **TypeScript**: Proper type safety and IDE support  
✅ **NestJS Integration**: Follows project architecture  
✅ **Dependency Injection**: Proper service integration  
✅ **Scalable**: Built on enterprise-grade framework  
✅ **Maintainable**: Consistent with project structure  

---

**Your HelmaI dental assistant is now properly integrated with Twilio via TypeScript and NestJS! 🦷📱** 