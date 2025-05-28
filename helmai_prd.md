# HealMAI Agent Refactoring - Product Requirements Document (PRD) v2.0

## 1. Project Overview

### Purpose
Refactor the existing HealMAI WhatsApp healthcare agent from a monolithic Python Flask application to a modular, robust, and maintainable TypeScript-based system using the snak agent framework, while adapting to its Starknet-centric architecture.

### Goal Summary
Transform the current healthcare communication agent into a well-structured, DRY (Don't Repeat Yourself), and robust system that can:
- Handle WhatsApp patient communications efficiently through snak's agent system
- Integrate with healthcare backend systems via custom tools
- Provide LLM-powered responses with function calling capabilities using snak's tool registry
- Maintain patient data integrity and search functionality
- Support extensible plugin architecture following snak conventions
- Leverage snak's built-in database, logging, and metrics systems

### Key Architectural Insights from Snak Framework
After deep analysis of the snak codebase, the refactoring must align with:
- **Agent-centric architecture**: Everything revolves around `StarknetAgentInterface`
- **Tool-based functionality**: All actions are implemented as tools with specific signatures
- **Zod schema validation**: All inputs validated using Zod schemas
- **Plugin registration pattern**: Tools registered via `registerTools()` function
- **Database integration**: Built-in PostgreSQL support with `@snakagent/database`
- **Metrics and logging**: Integrated monitoring via `@snakagent/core`

## 2. Core Functionalities

### 2.1 Current System Analysis

#### Existing Components:
1. **WhatsApp Communication Module** (`app/utils/whatsapp_utils.py`)
   - Message reception and validation
   - Message processing and formatting
   - Duplicate message detection
   - Response sending via Facebook Graph API

2. **Backend Client Module** (`app/utils/backend_client.py`)
   - Patient search by name
   - Chat creation and management
   - Message creation in backend system
   - Phone number formatting utilities

3. **Patient Search Module** (`app/utils/backend_search_patient.py`)
   - Patient information retrieval
   - Chat creation workflow
   - Patient-chat mapping storage

4. **Task Creation Module** (`app/utils/create_task.py`)
   - Healthcare task creation
   - Priority management
   - Patient association

5. **LLM Assistant Integration** (`services/assistant.py`)
   - OpenAI Assistant API integration
   - Thread management for conversations
   - Function calling orchestration
   - Response generation

6. **Desmos Integration** (`desmos/patient_search.py`)
   - Legacy patient search by SSN
   - External healthcare system integration

#### Current Workflow:
1. WhatsApp message received via webhook
2. Message validated and processed
3. Sent to OpenAI Assistant with available functions
4. Assistant can call functions: reply, create chat/message, create task, search patient
5. Response formatted and sent back via WhatsApp

### 2.2 Target System Architecture

#### Plugin Structure: `helmai`
Following snak framework conventions, create a comprehensive healthcare agent plugin.

## 3. Detailed Refactoring Plan

### 3.1 Plugin Structure (Aligned with Snak Conventions)
```
plugins/helmai/
├── package.json                    # Following @snakagent/plugin-* naming
├── tsconfig.json                   # TypeScript configuration
├── tsconfig.build.json            # Build configuration
├── README.md                       # Plugin documentation
├── src/
│   ├── index.ts                    # Main export: export * from './tools/index.js'
│   ├── actions/                    # Core business logic functions
│   │   ├── sendWhatsAppMessage.ts  # WhatsApp message sending
│   │   ├── searchPatient.ts        # Backend patient search
│   │   ├── createChat.ts           # Chat session creation
│   │   ├── createMessage.ts        # Message creation in backend
│   │   ├── createTask.ts           # Healthcare task creation
│   │   ├── searchPatientBySSN.ts   # Desmos patient search
│   │   └── scheduleAppointment.ts  # Appointment scheduling
│   ├── utils/                      # Shared utility functions
│   │   ├── whatsappFormatter.ts    # Message formatting utilities
│   │   ├── phoneNumberFormatter.ts # Phone number standardization
│   │   ├── messageValidator.ts     # Input validation helpers
│   │   ├── duplicateDetector.ts    # Duplicate message prevention
│   │   ├── backendClient.ts        # HTTP client for backend API
│   │   ├── desmosClient.ts         # Desmos system integration
│   │   └── errorHandler.ts         # Centralized error handling
│   ├── types/                      # TypeScript type definitions
│   │   ├── Patient.ts              # Patient entity types
│   │   ├── Chat.ts                 # Chat session types
│   │   ├── Message.ts              # Message types
│   │   ├── Task.ts                 # Healthcare task types
│   │   └── WhatsApp.ts             # WhatsApp API types
│   ├── constants/                  # Configuration constants
│   │   ├── api.ts                  # API endpoints and keys
│   │   ├── whatsapp.ts             # WhatsApp configuration
│   │   └── healthcare.ts           # Healthcare-specific constants
│   ├── schema/                     # Zod validation schemas
│   │   └── index.ts                # All schemas exported here
│   └── tools/                      # Snak tool registration
│       └── index.ts                # registerTools() implementation
```

### 3.1.1 Critical Alignment with Snak Patterns
- **Package naming**: Must follow `@snakagent/plugin-helmai` convention
- **Dependencies**: Must include `@snakagent/core` as workspace dependency
- **Export pattern**: Main index.ts exports tools via `export * from './tools/index.js'`
- **Tool signatures**: All actions must match `(agent: StarknetAgentInterface, params: P) => Promise<unknown>`
- **Schema validation**: All parameters validated using Zod schemas
- **Error handling**: Return JSON strings for consistent error reporting

### 3.2 Action Functions (1 function = 1 file)

#### 3.2.1 WhatsApp Actions
- **sendWhatsAppMessage.ts**: Send formatted messages via WhatsApp API
- **receiveWhatsAppMessage.ts**: Process incoming WhatsApp messages

#### 3.2.2 Patient Management Actions
- **searchPatient.ts**: Search patients by name in backend
- **searchPatientBySSN.ts**: Search patients by SSN in Desmos
- **createPatient.ts**: Create new patient records

#### 3.2.3 Communication Actions
- **createChat.ts**: Create new chat sessions
- **createMessage.ts**: Create messages in chat sessions
- **getChatHistory.ts**: Retrieve chat history

#### 3.2.4 Task Management Actions
- **createTask.ts**: Create healthcare tasks
- **updateTask.ts**: Update task status
- **getPatientTasks.ts**: Retrieve patient tasks

#### 3.2.5 Appointment Actions
- **scheduleAppointment.ts**: Schedule patient appointments
- **getAvailableSlots.ts**: Get available appointment slots

### 3.3 Utility Functions

#### 3.3.1 WhatsApp Utilities
- **whatsappFormatter.ts**: Format messages for WhatsApp (markdown conversion)
- **messageValidator.ts**: Validate incoming WhatsApp messages
- **duplicateDetector.ts**: Detect and prevent duplicate message processing

#### 3.3.2 Backend Integration Utilities
- **backendClient.ts**: HTTP client for backend API communication
- **phoneNumberFormatter.ts**: Standardize phone number formats
- **errorHandler.ts**: Centralized error handling

#### 3.3.3 External System Utilities
- **desmosClient.ts**: Integration with Desmos patient system
- **threadManager.ts**: Manage conversation threads
- **storageManager.ts**: Handle local data persistence

### 3.4 Corrected Tool Implementation Pattern

#### 3.4.1 Proper Tool Registration (Following Snak Pattern)
```typescript
// tools/index.ts
import { StarknetTool } from '@snakagent/core';
import { 
  sendWhatsAppMessageSchema,
  searchPatientSchema,
  createChatSchema,
  createMessageSchema,
  createTaskSchema 
} from '../schema/index.js';
import { sendWhatsAppMessage } from '../actions/sendWhatsAppMessage.js';
import { searchPatient } from '../actions/searchPatient.js';
import { createChat } from '../actions/createChat.js';
import { createMessage } from '../actions/createMessage.js';
import { createTask } from '../actions/createTask.js';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'send_whatsapp_message',
    plugins: 'helmai',
    description: 'Send a formatted message via WhatsApp to a patient',
    schema: sendWhatsAppMessageSchema,
    execute: sendWhatsAppMessage,
  });

  StarknetToolRegistry.push({
    name: 'search_patient',
    plugins: 'helmai', 
    description: 'Search for a patient by first and last name in the backend system',
    schema: searchPatientSchema,
    execute: searchPatient,
  });

  StarknetToolRegistry.push({
    name: 'create_chat',
    plugins: 'helmai',
    description: 'Create a new chat session for a patient',
    schema: createChatSchema,
    execute: createChat,
  });

  StarknetToolRegistry.push({
    name: 'create_message',
    plugins: 'helmai',
    description: 'Create a message in an existing chat session',
    schema: createMessageSchema,
    execute: createMessage,
  });

  StarknetToolRegistry.push({
    name: 'create_task',
    plugins: 'helmai',
    description: 'Create a healthcare task for a patient',
    schema: createTaskSchema,
    execute: createTask,
  });
};
```

#### 3.4.2 Corrected Action Function Signatures
```typescript
// actions/sendWhatsAppMessage.ts
import { StarknetAgentInterface, logger } from '@snakagent/core';

export interface SendWhatsAppMessageParams {
  recipient: string;
  message: string;
}

export interface WhatsAppResult {
  status: 'success' | 'failure';
  messageId?: string;
  error?: string;
}

export const sendWhatsAppMessage = async (
  agent: StarknetAgentInterface,
  params: SendWhatsAppMessageParams
): Promise<string> => {
  try {
    // Implementation logic here
    const result: WhatsAppResult = {
      status: 'success',
      messageId: 'msg_123'
    };
    
    logger.info('WhatsApp message sent successfully', { 
      recipient: params.recipient,
      messageId: result.messageId 
    });
    
    return JSON.stringify(result);
  } catch (error) {
    logger.error('Failed to send WhatsApp message', { error });
    
    const result: WhatsAppResult = {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    return JSON.stringify(result);
  }
};
```

#### 3.4.3 Core Type Definitions
```typescript
// types/Patient.ts
export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
}

// types/Chat.ts  
export interface Chat {
  id: string;
  patientId: string;
  centerId?: string;
  status: 'ACTIVE' | 'CLOSED';
  createdAt: Date;
}

// types/Message.ts
export interface Message {
  id: string;
  chatId: string;
  content: string;
  senderType: 'PATIENT' | 'USER' | 'ASSISTANT';
  senderId: string;
  timestamp: Date;
}

// types/Task.ts
export interface Task {
  id: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  patientId: string;
  assignedTo?: string;
  centerId: string;
}

// types/WhatsApp.ts
export interface WhatsAppMessage {
  id: string;
  from: string;
  text: {
    body: string;
  };
  timestamp: string;
}
```

### 3.5 Zod Schema Definitions (Critical for Snak)

#### 3.5.1 Schema Implementation
```typescript
// schema/index.ts
import { z } from 'zod';

export const sendWhatsAppMessageSchema = z.object({
  recipient: z.string().describe('The WhatsApp phone number to send message to'),
  message: z.string().describe('The formatted message content to send'),
});

export const searchPatientSchema = z.object({
  firstName: z.string().describe('Patient first name'),
  lastName: z.string().describe('Patient last name'),
});

export const createChatSchema = z.object({
  patientId: z.string().describe('The patient ID to create chat for'),
  centerId: z.string().optional().describe('Optional center ID'),
});

export const createMessageSchema = z.object({
  chatId: z.string().describe('The chat ID to add message to'),
  content: z.string().describe('The message content'),
  senderType: z.enum(['PATIENT', 'USER', 'ASSISTANT']).describe('Type of sender'),
  senderId: z.string().describe('ID of the sender'),
});

export const createTaskSchema = z.object({
  description: z.string().describe('Task description'),
  patientId: z.string().describe('Patient ID for the task'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).describe('Task priority level'),
  assignedTo: z.string().optional().describe('Optional user ID to assign task to'),
});

export const searchPatientBySSNSchema = z.object({
  ssn: z.string().describe('Patient social security number'),
});

export const scheduleAppointmentSchema = z.object({
  patientId: z.string().describe('Patient ID'),
  appointmentDate: z.string().describe('Appointment date in ISO format'),
  appointmentTime: z.string().describe('Appointment time'),
  reason: z.string().describe('Reason for appointment'),
  notes: z.string().optional().describe('Optional appointment notes'),
});
```

### 3.6 Configuration and Constants

#### 3.6.1 API Configuration
```typescript
// constants/api.ts
export const API_CONFIG = {
  BACKEND_URL: process.env.BACKEND_API_URL || 'https://hai-be.fly.dev',
  DESMOS_URL: 'https://novo-dental-ods.juxta.cloud',
  WHATSAPP_API_URL: 'https://graph.facebook.com',
  API_KEY: 'helmai-api-key-prod',
} as const;

// constants/whatsapp.ts
export const WHATSAPP_CONFIG = {
  VERIFY_TOKEN: 'token_gcp_beta_1',
  VERSION: process.env.VERSION || 'v17.0',
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID,
  ACCESS_TOKEN: process.env.ACCESS_TOKEN,
} as const;

// constants/healthcare.ts
export const HEALTHCARE_CONFIG = {
  DEFAULT_CENTER_ID: '4322a733-6aba-497e-b54d-6bd04cffd598',
  TASK_PRIORITIES: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const,
  CHAT_STATUSES: ['ACTIVE', 'CLOSED'] as const,
  SENDER_TYPES: ['PATIENT', 'USER', 'ASSISTANT'] as const,
} as const;
```

### 3.7 Package.json Configuration
```json
{
  "name": "@snakagent/plugin-helmai",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "module": "./dist/index.mjs",
  "type": "module",
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "dist",
    "LICENSE",
    "README.md",
    "tsconfig.json",
    "tsconfig.build.json"
  ],
  "scripts": {
    "test": "jest --passWithNoTests",
    "build": "tsup",
    "clean": "rm -rf node_modules",
    "clean:dist": "rm -rf dist",
    "clean:all": "pnpm clean && pnpm clean:dist",
    "format": "prettier --write \"./**/*.ts\"",
    "prepublishOnly": "npm run format && npm run build",
    "prepack": "npm run build",
    "lint": "eslint \"src/**/*.ts\" --fix"
  },
  "dependencies": {
    "@snakagent/core": "workspace:*",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "keywords": [
    "healthcare",
    "whatsapp",
    "agent",
    "plugin",
    "snak"
  ],
  "author": "HealMAI Team",
  "license": "ISC",
  "description": "Snak plugin for healthcare communication via WhatsApp with patient management capabilities."
}
```

## 4. Critical Integration Challenges & Solutions

### 4.1 Snak Framework Adaptation Challenges

#### 4.1.1 Starknet Dependency Challenge
**Problem**: Snak is built around Starknet blockchain, but HealMAI is a healthcare system
**Solution**: 
- Use snak's agent system without blockchain operations
- Leverage `StarknetAgentInterface` for configuration and database access only
- Implement healthcare tools that don't require Starknet transactions
- Mock or bypass Starknet-specific requirements where necessary

#### 4.1.2 Database Integration Challenge  
**Problem**: Current system uses JSON file storage, snak uses PostgreSQL
**Solution**:
- Migrate to snak's built-in PostgreSQL database system
- Use `@snakagent/database` package for data persistence
- Implement proper database schemas for patients, chats, messages, tasks
- Maintain data integrity during migration

#### 4.1.3 WhatsApp Webhook Integration Challenge
**Problem**: Snak doesn't have built-in webhook handling for external APIs
**Solution**:
- Create custom webhook handler as part of the plugin
- Integrate webhook with snak's agent system
- Use snak's tool calling mechanism to process WhatsApp messages
- Implement proper message routing and response handling

#### 4.1.4 LLM Integration Challenge
**Problem**: Current system uses OpenAI Assistant API, snak uses different LLM patterns
**Solution**:
- Adapt to snak's LLM integration patterns
- Use snak's built-in model configuration system
- Implement function calling through snak's tool registry
- Maintain conversation context using snak's memory system

### 4.2 Architecture Adaptation Strategy

#### 4.2.1 Hybrid Architecture Approach
```typescript
// Custom webhook server that integrates with snak agent
class HealMAIWebhookServer {
  private agent: StarknetAgent;
  
  constructor(agent: StarknetAgent) {
    this.agent = agent;
  }
  
  async handleWhatsAppWebhook(body: any) {
    // Process WhatsApp message
    const message = this.extractMessage(body);
    
    // Use snak agent to process and respond
    const response = await this.agent.processMessage(message);
    
    // Send response back via WhatsApp
    await this.sendWhatsAppResponse(response);
  }
}
```

#### 4.2.2 Tool-Based Healthcare Operations
```typescript
// All healthcare operations become snak tools
export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  // WhatsApp communication
  StarknetToolRegistry.push({
    name: 'send_whatsapp_message',
    plugins: 'helmai',
    description: 'Send WhatsApp message to patient',
    schema: sendWhatsAppMessageSchema,
    execute: sendWhatsAppMessage,
  });
  
  // Patient management
  StarknetToolRegistry.push({
    name: 'search_patient',
    plugins: 'helmai',
    description: 'Search patient in backend system',
    schema: searchPatientSchema,
    execute: searchPatient,
  });
  
  // Healthcare operations
  StarknetToolRegistry.push({
    name: 'create_task',
    plugins: 'helmai',
    description: 'Create healthcare task',
    schema: createTaskSchema,
    execute: createTask,
  });
};
```

### 4.3 Data Migration Strategy

#### 4.3.1 From JSON Files to PostgreSQL
```sql
-- Database schema for healthcare data
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  date_of_birth DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chats (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  center_id UUID,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  chat_id UUID REFERENCES chats(id),
  content TEXT NOT NULL,
  sender_type VARCHAR(20) NOT NULL,
  sender_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  description TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  status VARCHAR(20) DEFAULT 'OPEN',
  patient_id UUID REFERENCES patients(id),
  assigned_to VARCHAR(255),
  center_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 5. Technical Improvements

### 4.1 Code Quality Enhancements
- **Type Safety**: Full TypeScript implementation with strict typing
- **Error Handling**: Comprehensive error handling with proper logging
- **Validation**: Input validation using Zod schemas
- **Testing**: Unit tests for all actions and utilities
- **Documentation**: JSDoc comments for all functions

### 4.2 Architecture Improvements
- **Separation of Concerns**: Each function has a single responsibility
- **Modularity**: Reusable utilities and clear interfaces
- **Scalability**: Plugin-based architecture for easy extension
- **Maintainability**: Clear file structure and naming conventions

### 4.3 Performance Optimizations
- **Caching**: Implement caching for frequently accessed data
- **Rate Limiting**: Prevent API abuse and manage quotas
- **Async Operations**: Proper async/await patterns
- **Memory Management**: Efficient data handling and cleanup

## 5. Migration Strategy

### 5.1 Phase 1: Core Infrastructure
1. Set up snak plugin structure
2. Implement basic types and interfaces
3. Create utility functions
4. Set up configuration management

### 5.2 Phase 2: Action Implementation
1. Migrate WhatsApp communication functions
2. Implement patient search and management
3. Create chat and message handling
4. Add task management capabilities

### 5.3 Phase 3: Integration and Testing
1. Integrate with existing backend APIs
2. Implement comprehensive testing
3. Performance optimization
4. Documentation completion

### 5.4 Phase 4: Deployment and Monitoring
1. Deploy to production environment
2. Monitor performance and errors
3. Gradual migration from old system
4. User acceptance testing

## 6. Success Criteria

### 6.1 Functional Requirements
- ✅ All existing functionality preserved
- ✅ WhatsApp communication working seamlessly
- ✅ Patient search and management operational
- ✅ Task creation and management functional
- ✅ LLM integration with function calling

### 6.2 Non-Functional Requirements
- ✅ 99.9% uptime
- ✅ Response time < 2 seconds for WhatsApp messages
- ✅ Type-safe codebase with 0 TypeScript errors
- ✅ 90%+ test coverage
- ✅ Comprehensive documentation

### 6.3 Quality Metrics
- ✅ Code maintainability score > 8/10
- ✅ Zero critical security vulnerabilities
- ✅ Performance improvement over current system
- ✅ Reduced technical debt

## 7. Risk Assessment

### 7.1 Technical Risks
- **API Compatibility**: Ensure backward compatibility with existing APIs
- **Data Migration**: Safe migration of existing patient data
- **Performance**: Maintain or improve current response times

### 7.2 Mitigation Strategies
- **Gradual Migration**: Phase-by-phase implementation
- **Comprehensive Testing**: Unit, integration, and end-to-end tests
- **Rollback Plan**: Ability to revert to previous system if needed
- **Monitoring**: Real-time monitoring and alerting

## 8. Timeline and Milestones

### Week 1-2: Setup and Planning
- Plugin structure creation
- Type definitions
- Basic utilities implementation

### Week 3-4: Core Actions
- WhatsApp integration
- Patient management
- Chat functionality

### Week 5-6: Advanced Features
- Task management
- Appointment scheduling
- LLM integration

### Week 7-8: Testing and Optimization
- Comprehensive testing
- Performance optimization
- Documentation

### Week 9-10: Deployment
- Production deployment
- Monitoring setup
- User training

## 9. Future Enhancements

### 9.1 Potential Extensions
- **Multi-language Support**: Internationalization capabilities
- **Advanced Analytics**: Patient interaction analytics
- **AI Improvements**: Enhanced LLM capabilities
- **Mobile App Integration**: Native mobile app support

### 9.2 Scalability Considerations
- **Microservices**: Further decomposition into microservices
- **Cloud Native**: Kubernetes deployment
- **Multi-tenant**: Support for multiple healthcare centers
- **Real-time Features**: WebSocket integration for real-time updates

---

## 10. Key Insights from Framework Analysis

### 10.1 Critical Discoveries
After deep analysis of the snak framework, several critical insights emerged that fundamentally changed the refactoring approach:

1. **Starknet-Centric Design**: Snak is built specifically for blockchain operations, requiring adaptation for healthcare use cases
2. **Tool-Based Architecture**: All functionality must be implemented as tools with specific signatures
3. **Strict Type Safety**: Zod schemas are mandatory for all tool parameters
4. **Database Integration**: Built-in PostgreSQL support replaces current JSON file storage
5. **Agent Interface**: All operations must go through `StarknetAgentInterface`

### 10.2 Architectural Adaptations Required
- **Hybrid Integration**: Combine snak's agent system with custom WhatsApp webhook handling
- **Tool Conversion**: Convert all current utility functions to snak tools
- **Database Migration**: Move from JSON files to PostgreSQL with proper schemas
- **Schema Validation**: Implement comprehensive Zod validation for all inputs
- **Error Handling**: Standardize on JSON string returns for all operations

### 10.3 Implementation Priorities
1. **Phase 1**: Set up plugin structure and basic tool registration
2. **Phase 2**: Implement core healthcare tools (patient search, chat creation)
3. **Phase 3**: Integrate WhatsApp communication with snak agent system
4. **Phase 4**: Migrate data and implement comprehensive testing

### 10.4 Success Metrics Revised
- ✅ All tools properly registered in snak framework
- ✅ Zod schema validation for 100% of tool parameters
- ✅ PostgreSQL database integration functional
- ✅ WhatsApp webhook integration with agent system
- ✅ Maintain all existing healthcare functionality
- ✅ Improved error handling and logging via snak's built-in systems

This revised PRD provides a realistic and framework-aligned roadmap for refactoring the HealMAI system using the snak framework, accounting for its Starknet-centric architecture while adapting it for healthcare communication needs. 