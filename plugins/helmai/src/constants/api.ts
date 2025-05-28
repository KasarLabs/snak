export const API_CONFIG = {
  // Backend API Configuration - Hardcoded working values
  BACKEND_URL: 'https://hai-be.fly.dev',
  BACKEND_API_KEY: 'helmai-api-key-prod',

  // Desmos Integration Configuration
  DESMOS_URL:
    process.env.HELMAI_DESMOS_URL ||
    process.env.DESMOS_API_URL ||
    'https://novo-dental-ods.juxta.cloud',
  DESMOS_API_KEY: process.env.HELMAI_DESMOS_API_KEY,
  DESMOS_TOKEN: process.env.DESMOS_TOKEN,
  DESMOS_AUTH_URL:
    process.env.DESMOS_AUTH_URL ||
    'https://plateformservices-prod.juxta.cloud/identity/api/Authentification',
  DESMOS_LOGIN: process.env.DESMOS_API_LOGIN || 'Novo_prod',
  DESMOS_PASSWORD: process.env.DESMOS_API_PASSWORD,

  // WhatsApp API Configuration
  WHATSAPP_API_URL:
    process.env.WHATSAPP_API_URL || 'https://graph.facebook.com',
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v17.0',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,

  // OpenAI Configuration (for LLM integration)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_ASSISTANT_ID: process.env.OPENAI_ASSISTANT_ID,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',

  // Request Configuration
  REQUEST_TIMEOUT: parseInt(process.env.HELMAI_REQUEST_TIMEOUT || '30000'),
  MAX_RETRIES: parseInt(process.env.HELMAI_MAX_RETRIES || '3'),
  RETRY_DELAY: parseInt(process.env.HELMAI_RETRY_DELAY || '1000'),
} as const;

export const API_ENDPOINTS = {
  // Backend Endpoints
  PATIENTS: {
    SEARCH: '/api/patients',
    CREATE: '/api/patients',
    GET: '/api/patients/:id',
    UPDATE: '/api/patients/:id',
    DELETE: '/api/patients/:id',
  },
  CHATS: {
    CREATE: '/api/chats',
    GET: '/api/chats/:id',
    UPDATE: '/api/chats/:id',
    LIST: '/api/chats',
    CLOSE: '/api/chats/:id/close',
  },
  MESSAGES: {
    CREATE: '/api/messages',
    GET: '/api/messages/:id',
    UPDATE: '/api/messages/:id',
    LIST: '/api/messages',
    BY_CHAT: '/api/chats/:chatId/messages',
  },
  TASKS: {
    CREATE: '/api/tasks',
    GET: '/api/tasks/:id',
    UPDATE: '/api/tasks/:id',
    LIST: '/api/tasks',
    BY_PATIENT: '/api/patients/:patientId/tasks',
    COMPLETE: '/api/tasks/:id/complete',
  },

  // Desmos Endpoints
  DESMOS: {
    AUTH: '/api/Authentification',
    PATIENT_SEARCH: '/api/patients/search-by-ssn',
    PATIENT_DETAILS: '/api/patients/:ssn/details',
    PATIENT_BY_NAME: '/api/patients/search',
  },

  // WhatsApp Endpoints
  WHATSAPP: {
    SEND_MESSAGE: '/:phoneNumberId/messages',
    MEDIA_UPLOAD: '/:phoneNumberId/media',
    MEDIA_DOWNLOAD: '/:mediaId',
  },
} as const;
