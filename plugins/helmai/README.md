# HelmAI Plugin

Plugin d'assistant dentaire HelmAI pour la communication WhatsApp avec gestion complète des patients, création de tâches et assistance médicale. Intègre Desmos pour la gestion des dossiers patients et permet la création automatique de tâches pour le cabinet dentaire suite aux échanges avec les patients.

## Fonctionnalités

### 🦷 Gestion des Patients
- **Recherche de patients** par prénom et nom
- **Intégration Desmos** pour accéder aux dossiers patients existants
- **Validation automatique** des informations patients
- **Support multi-centres** dentaires

### 💬 Communication WhatsApp
- **Envoi de messages** texte, images et documents
- **Gestion des réponses** et conversations
- **Support des médias** (images, documents PDF)
- **Intégration webhook** pour les messages entrants

### 📋 Gestion des Tâches
- **Création automatique de tâches** pour le cabinet dentaire
- **Priorisation** (LOW, MEDIUM, HIGH, URGENT)
- **Types de tâches** : rendez-vous, suivi, médicaments, résultats, consultations, urgences
- **Notes au dentiste** générées automatiquement

### 🔧 Intégrations
- **Desmos** : Système de gestion de cabinet dentaire
- **WhatsApp Business API** : Communication directe
- **Backend HelmAI** : Stockage et gestion des données

## Installation

### 1. Prérequis
- Node.js 18+
- TypeScript
- Snak Framework

### 2. Installation des dépendances
```bash
cd plugins/helmai
pnpm install
```

### 3. Configuration des variables d'environnement

Ajoutez les variables suivantes à votre fichier `.env` :

```env
# --- HelmAI Plugin Configuration ---
# Backend API Configuration
BACKEND_API_URL="https://hai-be.fly.dev"
BACKEND_API_KEY="helmai-api-key-dev"

# Desmos Integration (Dental Practice Management System)
DESMOS_TOKEN="your_desmos_jwt_token"
DESMOS_AUTH_URL="https://plateformservices-prod.juxta.cloud/identity/api/Authentification"
DESMOS_API_URL="https://novo-dental-ods.juxta.cloud/"
DESMOS_API_LOGIN="Novo_prod"
DESMOS_API_PASSWORD="your_desmos_password"

# WhatsApp Business API Configuration
WHATSAPP_API_URL="https://graph.facebook.com"
WHATSAPP_API_VERSION="v17.0"
WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
WHATSAPP_ACCESS_TOKEN="your_access_token"
WHATSAPP_VERIFY_TOKEN="helmai_webhook_verify_token"

# HelmAI Plugin Configuration
HELMAI_DEFAULT_CENTER_ID="4322a733-6aba-497e-b54d-6bd04cffd598"
HELMAI_REQUEST_TIMEOUT="30000"
HELMAI_MAX_RETRIES="3"
HELMAI_RETRY_DELAY="1000"
```

### 4. Build du plugin
```bash
pnpm build
```

## Utilisation

### Outils disponibles

#### 1. `get_patient_informations_by_first_and_last_name`
Récupère les informations du patient par son prénom et son nom.

```typescript
{
  firstName: "Jean",
  lastName: "Dupont",
  phoneNumber?: "+33123456789", // optionnel
  centerId?: "uuid", // optionnel
  limit?: 10, // optionnel
  offset?: 0 // optionnel
}
```

#### 2. `create_task`
Crée une tâche pour le cabinet dentaire avec une note au dentiste.

```typescript
{
  title: "Consultation urgente",
  description: "Patient avec douleur dentaire sévère",
  priority: "HIGH", // LOW, MEDIUM, HIGH, URGENT
  type: "EMERGENCY", // APPOINTMENT, FOLLOW_UP, MEDICATION, etc.
  patientId: "uuid",
  centerId: "uuid",
  assignedTo?: "dentist_id", // optionnel
  dueDate?: "2024-01-15", // optionnel
  notes?: "Notes supplémentaires" // optionnel
}
```

#### 3. `send_whatsapp_message`
Envoie un message WhatsApp à un patient ou professionnel de santé.

```typescript
{
  to: "+33123456789",
  message: "Votre rendez-vous est confirmé",
  messageType?: "TEXT", // TEXT, IMAGE, DOCUMENT
  mediaUrl?: "https://example.com/image.jpg", // pour IMAGE/DOCUMENT
  mediaCaption?: "Légende", // optionnel
  replyToMessageId?: "message_id" // optionnel
}
```

### Exemple d'utilisation dans un agent

```typescript
import { registerTools } from '@snakagent/plugin-helmai';

// Enregistrer les outils HelmAI
registerTools(toolRegistry);

// L'agent peut maintenant utiliser :
// - get_patient_informations_by_first_and_last_name
// - create_task  
// - send_whatsapp_message
```

## Architecture

### Structure du projet
```
plugins/helmai/
├── src/
│   ├── actions/           # Actions principales
│   │   ├── sendWhatsAppMessage.ts
│   │   ├── searchPatient.ts
│   │   └── createTask.ts
│   ├── constants/         # Configuration et constantes
│   │   ├── api.ts
│   │   └── healthcare.ts
│   ├── schema/           # Validation Zod
│   │   └── index.ts
│   ├── types/            # Types TypeScript
│   │   ├── Patient.ts
│   │   ├── Task.ts
│   │   └── WhatsApp.ts
│   ├── utils/            # Utilitaires
│   │   ├── errorHandler.ts
│   │   ├── httpClient.ts
│   │   └── validation.ts
│   ├── tools/            # Enregistrement des outils
│   │   └── index.ts
│   └── index.ts          # Point d'entrée
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

### Gestion des erreurs

Le plugin utilise un système de gestion d'erreurs centralisé avec :
- **Codes d'erreur** spécifiques par domaine
- **Messages d'erreur** localisés en français
- **Logging** détaillé pour le debugging
- **Retry automatique** pour les appels API

### Validation des données

Toutes les entrées sont validées avec Zod :
- **Numéros de téléphone** au format international
- **UUIDs** pour les identifiants
- **Emails** avec regex
- **Dates** au format ISO
- **Longueurs** de texte limitées

## Configuration avancée

### Timeouts et retry
```env
HELMAI_REQUEST_TIMEOUT="30000"  # 30 secondes
HELMAI_MAX_RETRIES="3"          # 3 tentatives
HELMAI_RETRY_DELAY="1000"       # 1 seconde entre les tentatives
```

### Limites de validation
- **Messages WhatsApp** : 4096 caractères max
- **Descriptions de tâches** : 2000 caractères max
- **Noms de patients** : 100 caractères max
- **Sujets de chat** : 200 caractères max

## Développement

### Tests
```bash
pnpm test
```

### Linting
```bash
pnpm lint
```

### Format du code
```bash
pnpm format
```

### Build en mode développement
```bash
pnpm build --watch
```

## Support

Pour toute question ou problème :
1. Vérifiez les logs du serveur
2. Validez la configuration des variables d'environnement
3. Testez les connexions API (Desmos, WhatsApp, Backend)

## Licence

ISC 