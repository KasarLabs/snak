import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
} from '@langchain/core/messages';
import { AgentConfig } from '@snakagent/core';

export interface AgentReturn {
  app: any;
  agent_config: AgentConfig;
}

// ============================================
// TYPES & INTERFACES
// ============================================

export interface StepInfo {
  stepNumber: number;
  stepName: string;
  result: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface ParsedPlan {
  steps: StepInfo[];
  summary: string;
}

interface StepResponse {
  number: number;
  validated: boolean;
}

export interface ValidatorStepResponse {
  steps: StepResponse[];
  nextSteps: number;
  isFinal: boolean;
}

export enum Agent {
  PLANNER = 'planner',
  EXEC_VALIDATOR = 'exec_validator',
  PLANNER_VALIDATOR = 'planner_validator',
  EXECUTOR = 'executor',
  MODEL_SELECTOR = 'model_selector',
  ADAPTIVE_PLANNER = 'adaptive_planner',
  TOOLS = 'tools',
  SUMMARIZE = 'summarize',
}

export interface AgentKwargs {
  error: boolean;
  from: Agent;
  validated?: boolean;
}

export type TypedBaseMessage<
  T extends Record<string, any> = Record<string, any>,
> = BaseMessage & {
  additional_kwargs: T;
};

export type TypedAiMessage<
  T extends Record<string, any> = Record<string, any>,
> = AIMessage & {
  additional_kwargs: T;
};

export type TypedAiMessageChunk<
  T extends Record<string, any> = Record<string, any>,
> = AIMessageChunk & {
  additional_kwargs: T;
};

export type TypedHumanMessage<
  T extends Record<string, any> = Record<string, any>,
> = HumanMessage & {
  additional_kwargs: T;
};
