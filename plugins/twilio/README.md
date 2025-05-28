# Snak - Twilio Plugin

The Twilio Plugin provides tools for communication services including SMS, WhatsApp, and Email messaging through Twilio and SendGrid APIs.

## Features

This plugin adds the following tools:

- **twilio_send_sms**: Send an SMS message to a phone number.
- **twilio_send_whatsapp**: Send a WhatsApp message to a phone number.
- **twilio_send_email**: Send an email message via SendGrid.
- **twilio_send_communication**: Send a message across multiple channels (SMS, WhatsApp, Email) with channel selection flags.

## Usage

The Twilio Plugin is used internally by the Starknet Agent and doesn't need to be called directly. When the agent is initialized, it automatically registers these tools, making them available for use.

## Tool Parameters

### Individual Channel Tools

**twilio_send_sms**:
- `sendTo`: Recipient phone number in E.164 format (e.g., +33786976911)
- `message`: SMS message content (max 1600 characters)
- `from`: Optional sender phone number

**twilio_send_whatsapp**:
- `sendTo`: Recipient phone number in E.164 format (e.g., +33786976911)
- `message`: WhatsApp message content
- `from`: Optional sender WhatsApp number

**twilio_send_email**:
- `sendTo`: Recipient email address
- `subject`: Email subject line
- `message`: Email message content (plain text)
- `html`: Optional HTML email content
- `fromEmail`: Optional sender email address
- `fromName`: Optional sender name

### Unified Communication Tool

**twilio_send_communication**:
- `recipientName`: Name of the recipient
- `sendToPhone`: Optional recipient phone number in E.164 format
- `sendToEmail`: Optional recipient email address
- `message`: Message content to send
- `subject`: Optional email subject line
- `html`: Optional HTML content for email
- `channels`: Optional channel flags (1=SMS, 2=Email, 4=WhatsApp, 7=All channels)

## Example

When asking the agent to perform Twilio-related tasks, it will use the appropriate tool from this plugin:

```
"Send an SMS to +33786976911 saying Hello"  // Uses twilio_send_sms
"Send a WhatsApp message to +33786976911"   // Uses twilio_send_whatsapp
"Send an email to user@example.com"         // Uses twilio_send_email
"Send a message to John via all channels"   // Uses twilio_send_communication
```

## Configuration

Set the following environment variables:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID="your_account_sid"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_FROM_NUMBER="+16162539219"
TWILIO_WHATSAPP_NUMBER="+33613737897"

# SendGrid Configuration (for Email)
SENDGRID_API_KEY="your_sendgrid_api_key"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
SENDGRID_FROM_NAME="Your App Name"
```

## Development

To extend this plugin, add new tools in the `src/tools` directory and register them in the `registerTools` function in `src/tools/index.ts`. 