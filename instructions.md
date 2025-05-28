# HelmaI Dental Assistant - Prompt Optimization Guide

## Project Overview
Virtual dental assistant for Centre Dentaire Maréchal Foch that handles patient interactions via WhatsApp, verifies patient identity, qualifies their needs, and creates tasks for dentists.

## Core Functionalities
1. **Patient Identification**: Verify patients using first and last name
2. **Patient Routing**: Direct known patients to qualification, unknown to Doctolib
3. **Need Qualification**: Gather precise details about dental requests
4. **Task Creation**: Generate clear summaries for dentists
5. **Conversation Management**: Track state and enforce limits

## Prompt Architecture

### 1. Agent Configuration (`config/agents/helmai.agent.json`)
**Purpose**: Define persistent behavior, workflow, and objectives
- Language handling rules
- Complete workflow sequence
- Classification categories
- General communication guidelines
- Knowledge base (URLs, formats)

### 2. Runtime Context (`twilio-webhook.controller.ts`)
**Purpose**: Inject dynamic state and channel-specific information
- Current conversation state
- Patient verification status
- WhatsApp-specific parameters
- Tool invocation details
- Attempt tracking

## Optimization Strategy

### Useful Redundancy Preserved:
1. **Verification attempts** - Tracked both in config (max 2) and runtime (current count)
2. **Patient name handling** - Config defines when to ask, runtime tracks if provided
3. **Task creation format** - Config defines "Dr," prefix, runtime enforces after qualification

### Eliminated Redundancy:
1. Removed duplicate workflow instructions between files
2. Consolidated tool lists to runtime context only
3. Unified language preferences in agent config

### Language Choice:
- **English for instructions**: Better LLM comprehension and efficiency
- **Native language for responses**: Maintained per patient preference

## Current File Structure
```
/config/agents/helmai.agent.json    # Agent behavior configuration
/plugins/twilio/src/webhooks/       # Runtime context injection
  twilio-webhook.controller.ts      # WhatsApp message handling
```

## Key Design Decisions
1. **Separation of Concerns**: Static behavior vs dynamic state
2. **State Machine**: Clear conversation states (initial → verifying → verified/closed)
3. **Fail-Safe Limits**: Maximum 2 verification attempts before closure
4. **Single Message Rule**: Prevent spam by enforcing one message per interaction 