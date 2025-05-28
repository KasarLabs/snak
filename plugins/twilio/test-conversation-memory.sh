#!/bin/bash

# Test Conversation Memory Script
# This script tests if the dental assistant remembers previous messages in the same thread

set -e

SERVER_URL="http://localhost:3001"
API_KEY="helmai-secret-key-2024"
AGENT_ID="7e20b1d9-06fe-4f0a-b076-99d56b1f5f23"
THREAD_ID="dental-patient-33786976911"

echo "🧪 Testing Conversation Memory with Thread ID: $THREAD_ID"
echo "=================================================="

# Test 1: Patient introduces themselves
echo "📝 Test 1: Patient introduces themselves"
echo "Message: 'Bonjour, je suis Ramzi Benzema'"

RESPONSE1=$(curl -s -X POST "$SERVER_URL/api/agents/supervisor/request" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"request\": {
      \"content\": \"Un patient vous contacte via WhatsApp depuis whatsapp:+33786976911 avec le message: \\\"Bonjour, je suis Ramzi Benzema\\\". Répondez selon votre rôle d'assistant dentaire en respectant strictement vos objectifs. Adoptez un ton professionnel et empathique. Utilisez twilio_send_whatsapp pour répondre.\",
      \"agentId\": \"$AGENT_ID\",
      \"threadId\": \"$THREAD_ID\"
    }
  }")

echo "Response 1: $(echo $RESPONSE1 | jq -r '.data')"
echo ""

# Wait a moment
sleep 2

# Test 2: Patient asks about dental pain (should remember the name)
echo "📝 Test 2: Patient asks about dental pain"
echo "Message: 'J'ai mal aux dents'"

RESPONSE2=$(curl -s -X POST "$SERVER_URL/api/agents/supervisor/request" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"request\": {
      \"content\": \"Un patient vous contacte via WhatsApp depuis whatsapp:+33786976911 avec le message: \\\"J'ai mal aux dents\\\". Répondez selon votre rôle d'assistant dentaire en respectant strictement vos objectifs. Adoptez un ton professionnel et empathique. Utilisez twilio_send_whatsapp pour répondre.\",
      \"agentId\": \"$AGENT_ID\",
      \"threadId\": \"$THREAD_ID\"
    }
  }")

echo "Response 2: $(echo $RESPONSE2 | jq -r '.data')"
echo ""

# Wait a moment
sleep 2

# Test 3: Patient asks for appointment (should still remember)
echo "📝 Test 3: Patient asks for appointment"
echo "Message: 'Je voudrais un rendez-vous'"

RESPONSE3=$(curl -s -X POST "$SERVER_URL/api/agents/supervisor/request" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"request\": {
      \"content\": \"Un patient vous contacte via WhatsApp depuis whatsapp:+33786976911 avec le message: \\\"Je voudrais un rendez-vous\\\". Répondez selon votre rôle d'assistant dentaire en respectant strictement vos objectifs. Adoptez un ton professionnel et empathique. Utilisez twilio_send_whatsapp pour répondre.\",
      \"agentId\": \"$AGENT_ID\",
      \"threadId\": \"$THREAD_ID\"
    }
  }")

echo "Response 3: $(echo $RESPONSE3 | jq -r '.data')"
echo ""

echo "🎯 Analysis:"
echo "============"
echo "If conversation memory is working:"
echo "- Response 1 should acknowledge the name"
echo "- Response 2 should address Ramzi by name and handle dental pain"
echo "- Response 3 should remember Ramzi and handle appointment request"
echo ""
echo "If it's NOT working:"
echo "- All responses will ask for the patient's name again" 