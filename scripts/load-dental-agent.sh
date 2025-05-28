#!/bin/bash

# Load Dental Assistant Agent Script
# This script loads the HelmaI dental assistant agent into the Snak system

set -e  # Exit on any error

# Configuration
SERVER_URL="http://localhost:3001"
API_KEY="helmai-secret-key-2024"
AGENT_CONFIG_FILE="config/agents/helmai.agent.json"

echo "🦷 Loading HelmaI Dental Assistant Agent..."

# Check if server is running
echo "📡 Checking if server is running..."
if ! curl -s "$SERVER_URL/api/agents/health" -H "x-api-key: $API_KEY" > /dev/null; then
    echo "❌ Server is not running on $SERVER_URL"
    echo "Please start the server with: pnpm run start:server"
    exit 1
fi

echo "✅ Server is running"

# Check if agent config file exists
if [ ! -f "$AGENT_CONFIG_FILE" ]; then
    echo "❌ Agent config file not found: $AGENT_CONFIG_FILE"
    exit 1
fi

echo "✅ Agent config file found"

# Create temporary request file with proper format
TEMP_REQUEST_FILE=$(mktemp)
cat > "$TEMP_REQUEST_FILE" << 'EOF'
{
  "agent": {
    "name": "HelmaI - Assistant Dentaire",
    "group": "Centre Dentaire Maréchal Foch",
    "bio": "Assistant virtuel spécialisé pour le centre dentaire Maréchal Foch à Grenoble. Je gère les demandes patients, vérifie leur statut dans notre base de données et les oriente selon leurs besoins spécifiques.",
    "description": "Assistant virtuel spécialisé pour le centre dentaire Maréchal Foch à Grenoble. Je gère les demandes patients, vérifie leur statut dans notre base de données et les oriente selon leurs besoins spécifiques.",
    "lore": [
      "Je suis l'assistant numérique du centre dentaire Maréchal Foch, formé pour comprendre et traiter efficacement toutes les demandes patients.",
      "Mon expertise couvre la gestion des urgences dentaires, les demandes de rendez-vous, les suivis de patients et les devis de soins."
    ],
    "objectives": [
      "Vérifier l'identité du patient dans notre base de données en demandant prénom et nom",
      "Rediriger les nouveaux patients vers Doctolib pour leur premier rendez-vous",
      "Classifier les demandes des patients connus en 4 catégories : Urgence Dentaire, Demande spéciale du patient suivi, Autre demande de rendez-vous, ou Rubrique devis suite de soins",
      "Créer des tâches structurées dans Doctolib avec des notes détaillées pour le dentiste",
      "Ne poser qu'une question à la fois pour une expérience patient optimale"
    ],
    "knowledge": [
      "Procédures de vérification d'identité patient via la fonction get_patient_informations_by_first_and_last_name",
      "URL Doctolib du centre : https://www.doctolib.fr/cabinet-dentaire/grenoble/centre-dentaire-marechal-foch/booking/motives?specialityId=1&telehealth=false&placeId=practice-194749&bookingFunnelSource=profile",
      "Classification des demandes en 4 catégories spécifiques du centre dentaire",
      "Création de tâches via la fonction make_task avec format de note standardisé commençant par Dr,",
      "Protocole de communication patient : une question à la fois, pas d'exposition explicite des intentions de classification"
    ],
    "interval": 1000,
    "maxIterations": 10,
    "mode": "interactive",
    "memory": {
      "enabled": true,
      "shortTermMemorySize": 20
    },
    "plugins": ["twilio"]
  }
}
EOF

# Load the agent
echo "🚀 Loading dental assistant agent..."
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/agents/init_agent" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d @"$TEMP_REQUEST_FILE")

# Clean up temp file
rm "$TEMP_REQUEST_FILE"

# Check response
if echo "$RESPONSE" | grep -q '"status":"success"'; then
    echo "✅ Dental assistant agent loaded successfully!"
    
    # Get agent ID
    echo "📋 Getting agent details..."
    AGENTS_RESPONSE=$(curl -s -X GET "$SERVER_URL/api/agents/get_agents" \
      -H "x-api-key: $API_KEY")
    
    AGENT_ID=$(echo "$AGENTS_RESPONSE" | grep -o '"id":"[^"]*","name":"HelmaI - Assistant Dentaire"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$AGENT_ID" ]; then
        echo "🆔 Agent ID: $AGENT_ID"
        echo "📱 Agent has Twilio plugin enabled for WhatsApp/SMS"
        echo ""
        echo "🎉 Dental assistant is ready to handle patient communications!"
        echo ""
        echo "📞 Webhook endpoints:"
        echo "   SMS: https://your-ngrok-url.ngrok-free.app/api/twilio/webhook/sms"
        echo "   WhatsApp: https://your-ngrok-url.ngrok-free.app/api/twilio/webhook/whatsapp"
        echo ""
        echo "💡 To update webhook to use this agent, update the agentId in:"
        echo "   plugins/twilio/src/webhooks/twilio-webhook.controller.ts"
        echo "   Change agentId to: $AGENT_ID"
    else
        echo "⚠️  Agent loaded but couldn't retrieve ID"
    fi
else
    echo "❌ Failed to load dental assistant agent"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""
echo "✨ Script completed successfully!" 