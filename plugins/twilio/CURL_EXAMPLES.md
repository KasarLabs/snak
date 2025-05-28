# Twilio Plugin - Working cURL Examples

This document provides tested and working cURL commands for the HelmAI Snak Twilio plugin integration.

## Prerequisites

- Server running on `http://localhost:3001`
- Valid API key: `helmai-secret-key-2024`
- Twilio account configured with valid credentials
- ngrok tunnel active for webhook testing

## Agent Information

### Available Communication Agents

- **HelmAI General Assistant**: `399c78a8-a824-40c1-8f11-03aba936f450`
- **HelmAI Communication Assistant**: `e633c127-d0a0-43b0-a837-ba6776fc7780` (with Twilio plugin)

## Outgoing Messages

### 1. Send WhatsApp Message

```bash
curl -X POST http://localhost:3001/api/agents/supervisor/request \
  -H "Content-Type: application/json" \
  -H "x-api-key: helmai-secret-key-2024" \
  -d '{
    "request": {
      "content": "Send a WhatsApp message to +33786976911 saying: Hey! This is a test message from HelmAI 🚀",
      "agentId": "e633c127-d0a0-43b0-a837-ba6776fc7780"
    }
  }'
```

### 2. Send SMS Message

```bash
curl -X POST http://localhost:3001/api/agents/supervisor/request \
  -H "Content-Type: application/json" \
  -H "x-api-key: helmai-secret-key-2024" \
  -d '{
    "request": {
      "content": "Send an SMS to +33786976911 saying: Hello from HelmAI SMS service! 📱",
      "agentId": "e633c127-d0a0-43b0-a837-ba6776fc7780"
    }
  }'
```

### 3. Send Email

```bash
curl -X POST http://localhost:3001/api/agents/supervisor/request \
  -H "Content-Type: application/json" \
  -H "x-api-key: helmai-secret-key-2024" \
  -d '{
    "request": {
      "content": "Send an email to ramzi.laieb@gmail.com with subject \"HelmAI Test\" and message: Hello from HelmAI email service! 📧",
      "agentId": "e633c127-d0a0-43b0-a837-ba6776fc7780"
    }
  }'
```

### 4. Send to Multiple Recipients

```bash
curl -X POST http://localhost:3001/api/agents/supervisor/request \
  -H "Content-Type: application/json" \
  -H "x-api-key: helmai-secret-key-2024" \
  -d '{
    "request": {
      "content": "Send a WhatsApp message to +33786976911 and +33632253309 saying: Group message from HelmAI! 👥",
      "agentId": "e633c127-d0a0-43b0-a837-ba6776fc7780"
    }
  }'
```

## Webhook Testing

### 1. Test Incoming SMS Webhook

```bash
curl -X POST http://localhost:3001/api/twilio/webhook/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM_YOUR_MESSAGE_SID_HERE" \
  -d "AccountSid=AC_YOUR_ACCOUNT_SID_HERE" \
  -d "From=+33786976911" \
  -d "To=+15551234567" \
  -d "Body=Hello from webhook test!"
```

### 2. Test Incoming WhatsApp Webhook

```bash
curl -X POST http://localhost:3001/api/twilio/webhook/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM_YOUR_MESSAGE_SID_HERE" \
  -d "AccountSid=AC_YOUR_ACCOUNT_SID_HERE" \
  -d "From=whatsapp:+33786976911" \
  -d "To=whatsapp:+15551234567" \
  -d "Body=Hello from WhatsApp webhook test!" \
  -d "ProfileName=Ramzi" \
  -d "WaId=33786976911"
```

### 3. Test Status Callback Webhook

```bash
curl -X POST http://localhost:3001/api/twilio/webhook/status \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SM_YOUR_MESSAGE_SID_HERE" \
  -d "MessageStatus=delivered"
```

## Agent Management

### 1. Get All Agents

```bash
curl -X GET http://localhost:3001/api/agents/get_agents \
  -H "x-api-key: helmai-secret-key-2024"
```

### 2. Get Agent Status

```bash
curl -X GET http://localhost:3001/api/agents/get_agent_status \
  -H "x-api-key: helmai-secret-key-2024"
```

### 3. Get Supervisor Status

```bash
curl -X GET http://localhost:3001/api/agents/supervisor/status \
  -H "x-api-key: helmai-secret-key-2024"
```

### 4. Health Check

```bash
curl -X GET http://localhost:3001/api/agents/health \
  -H "x-api-key: helmai-secret-key-2024"
```

## Advanced Examples

### 1. Send Message with Emojis and Special Characters

```bash
curl -X POST http://localhost:3001/api/agents/supervisor/request \
  -H "Content-Type: application/json" \
  -H "x-api-key: helmai-secret-key-2024" \
  -d '{
    "request": {
      "content": "Send a WhatsApp message to +33786976911 saying: Bonjour! 🇫🇷 Comment ça va? Voici un test avec des caractères spéciaux: àéèùç 💫",
      "agentId": "e633c127-d0a0-43b0-a837-ba6776fc7780"
    }
  }'
```

### 2. Send Formatted Message

```bash
curl -X POST http://localhost:3001/api/agents/supervisor/request \
  -H "Content-Type: application/json" \
  -H "x-api-key: helmai-secret-key-2024" \
  -d '{
    "request": {
      "content": "Send a WhatsApp message to +33786976911 saying: *HelmAI Update* 🚀\n\n✅ Webhook system operational\n✅ All communication channels active\n✅ Ready for production\n\n_Powered by HelmAI_",
      "agentId": "e633c127-d0a0-43b0-a837-ba6776fc7780"
    }
  }'
```

### 3. Personal Message Example

```bash
curl -X POST http://localhost:3001/api/agents/supervisor/request \
  -H "Content-Type: application/json" \
  -H "x-api-key: helmai-secret-key-2024" \
  -d '{
    "request": {
      "content": "Send a WhatsApp message to +33632253309 saying: Coucou ma belle je t'\''aime. Assure toi qu'\''il mange bien avant de partir stp ! 💕",
      "agentId": "e633c127-d0a0-43b0-a837-ba6776fc7780"
    }
  }'
```

## Environment Variables Required

Make sure these environment variables are set in your `.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_WHATSAPP_NUMBER=whatsapp:+your_whatsapp_number

# SendGrid Configuration (for email)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_verified_sender_email

# Webhook Configuration
TWILIO_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/twilio/webhook

# Server Configuration
SERVER_API_KEY=helmai-secret-key-2024
```

## Webhook URLs for Twilio Configuration

When configuring webhooks in your Twilio console, use these URLs:

- **SMS Webhook**: `https://your-ngrok-url.ngrok-free.app/api/twilio/webhook/sms`
- **WhatsApp Webhook**: `https://your-ngrok-url.ngrok-free.app/api/twilio/webhook/whatsapp`
- **Status Callback**: `https://your-ngrok-url.ngrok-free.app/api/twilio/webhook/status`

## Response Examples

### Successful Message Send Response

```json
{
  "status": "success",
  "data": "The WhatsApp message has been sent successfully to +33786976911. Here's the content of the message:\n\n\"Hey Ramzi! 👋 The webhook system is now fully operational and ready to receive incoming messages. Testing the communication flow! 🚀\" \n\nIf you need anything else, feel free to ask!"
}
```

### Webhook Response

```json
{
  "status": "processed",
  "response": "I received your message: \"Hello from webhook test!\". Webhook is working!"
}
```

## Troubleshooting

### Common Issues

1. **API Key Error**: Make sure you're using `helmai-secret-key-2024` as the API key
2. **Agent Not Found**: Verify the agent ID is correct: `e633c127-d0a0-43b0-a837-ba6776fc7780`
3. **Webhook Not Receiving**: Check that ngrok is running and the URL is correctly configured in Twilio
4. **Message Not Sending**: Verify Twilio credentials and phone number verification

### Debug Commands

```bash
# Check if server is running
curl -X GET http://localhost:3001/api/agents/health -H "x-api-key: helmai-secret-key-2024"

# Check agent status
curl -X GET http://localhost:3001/api/agents/get_agents -H "x-api-key: helmai-secret-key-2024"

# Test webhook endpoint
curl -X POST http://localhost:3001/api/twilio/webhook/sms -d "Body=test"
```

## Notes

- All phone numbers should be in E.164 format (e.g., +33786976911)
- WhatsApp numbers in webhooks are prefixed with `whatsapp:` (e.g., `whatsapp:+33786976911`)
- The supervisor endpoint (`/api/agents/supervisor/request`) works more reliably than direct agent requests
- Webhook responses are automatically generated based on message content
- All timestamps are in UTC

---

**Last Updated**: 2025-05-27
**Version**: 1.0.0
**Author**: HelmAI Team 