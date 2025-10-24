import { EventType } from '@enums/event.enums.js';
import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { ChatPromptValue } from '@langchain/core/prompt_values';

export interface BaseEvent {
  event: EventType;
  name: string;
  agent_id?: string;
  run_id: string;
  tags?: string[];
  metadata?: {
    langgraph_step?: number;
    langgraph_node?: string;
    langgraph_triggers?: string[];
    langgraph_task_idx?: number;
    checkpoint_id?: string;
    checkpoint_ns?: string;
    [key: string]: any;
  };
  /** IDs des événements parents */
  parent_ids?: string[];
}

export interface ChatModelStartEvent extends BaseEvent {
  event: EventType.ON_CHAT_MODEL_START;
  data: {
    input: {
      messages: BaseMessage[];
    };
  };
}

export interface ChatModelStreamEvent extends BaseEvent {
  event: EventType.ON_CHAT_MODEL_STREAM;
  data: {
    chunk: AIMessageChunk;
  };
}

export interface ChatModelEndEvent extends BaseEvent {
  event: EventType.ON_CHAT_MODEL_END;
  data: {
    input: {
      messages: BaseMessage[];
    };
    output: AIMessageChunk;
  };
}

/**
 * Événements LLM
 */
export interface LLMStartEvent extends BaseEvent {
  event: EventType.ON_LLM_START;
  data: {
    input: string;
  };
}

export interface LLMStreamEvent extends BaseEvent {
  event: EventType.ON_LLM_STREAM;
  data: {
    chunk: string;
  };
}

export interface LLMEndEvent extends BaseEvent {
  event: EventType.ON_LLM_END;
  data: {
    output: string;
  };
}

export interface ChainStartEvent extends BaseEvent {
  event: EventType.ON_CHAIN_START;
  data: {
    input?: any;
  };
}

export interface ChainStreamEvent extends BaseEvent {
  event: EventType.ON_CHAIN_STREAM;
  data: {
    chunk: any;
  };
}

export interface ChainEndEvent extends BaseEvent {
  event: EventType.ON_CHAIN_END;
  data: {
    input?: any;
    output: any;
  };
}

/**
 * Événements Tool
 */
export interface ToolStartEvent extends BaseEvent {
  event: EventType.ON_TOOL_START;
  data: {
    input: Record<string, any>;
  };
}

export interface ToolStreamEvent extends BaseEvent {
  event: EventType.ON_TOOL_STREAM;
  data: {
    chunk: any;
  };
}

export interface ToolEndEvent extends BaseEvent {
  event: EventType.ON_TOOL_END;
  data: {
    input: Record<string, any>;
    output: any;
  };
}

export interface ToolErrorEvent extends BaseEvent {
  event: EventType.ON_TOOL_ERROR;
  data: {
    input: Record<string, any>;
    error: Error | string;
  };
}

/**
 * Événements Retriever
 */
export interface RetrieverStartEvent extends BaseEvent {
  event: EventType.ON_RETRIEVER_START;
  data: {
    input: {
      query: string;
    };
  };
}

export interface RetrieverEndEvent extends BaseEvent {
  event: EventType.ON_RETRIEVER_END;
  data: {
    input: {
      query: string;
    };
    output: Document[];
  };
}

export interface RetrieverErrorEvent extends BaseEvent {
  event: EventType.ON_RETRIEVER_ERROR;
  data: {
    input: {
      query: string;
    };
    error: Error | string;
  };
}

/**
 * Événements Prompt
 */
export interface PromptStartEvent extends BaseEvent {
  event: EventType.ON_PROMPT_START;
  data: {
    input: Record<string, any>;
  };
}

export interface PromptEndEvent extends BaseEvent {
  event: EventType.ON_PROMPT_END;
  data: {
    input: Record<string, any>;
    output: ChatPromptValue;
  };
}

/**
 * Événement personnalisé (custom)
 */
export interface CustomEvent extends BaseEvent {
  event: EventType.ON_CUSTOM_EVENT;
  data: any;
}

export type LangGraphEvent =
  | ChatModelStartEvent
  | ChatModelStreamEvent
  | ChatModelEndEvent
  | LLMStartEvent
  | LLMStreamEvent
  | LLMEndEvent
  | ChainStartEvent
  | ChainStreamEvent
  | ChainEndEvent
  | ToolStartEvent
  | ToolStreamEvent
  | ToolEndEvent
  | ToolErrorEvent
  | RetrieverStartEvent
  | RetrieverEndEvent
  | RetrieverErrorEvent
  | PromptStartEvent
  | PromptEndEvent
  | CustomEvent;

export type EventTypeMap = {
  [EventType.ON_CHAT_MODEL_START]: ChatModelStartEvent;
  [EventType.ON_CHAT_MODEL_STREAM]: ChatModelStreamEvent;
  [EventType.ON_CHAT_MODEL_END]: ChatModelEndEvent;
  [EventType.ON_LLM_START]: LLMStartEvent;
  [EventType.ON_LLM_STREAM]: LLMStreamEvent;
  [EventType.ON_LLM_END]: LLMEndEvent;
  [EventType.ON_CHAIN_START]: ChainStartEvent;
  [EventType.ON_CHAIN_STREAM]: ChainStreamEvent;
  [EventType.ON_CHAIN_END]: ChainEndEvent;
  [EventType.ON_TOOL_START]: ToolStartEvent;
  [EventType.ON_TOOL_STREAM]: ToolStreamEvent;
  [EventType.ON_TOOL_END]: ToolEndEvent;
  [EventType.ON_TOOL_ERROR]: ToolErrorEvent;
  [EventType.ON_RETRIEVER_START]: RetrieverStartEvent;
  [EventType.ON_RETRIEVER_END]: RetrieverEndEvent;
  [EventType.ON_RETRIEVER_ERROR]: RetrieverErrorEvent;
  [EventType.ON_PROMPT_START]: PromptStartEvent;
  [EventType.ON_PROMPT_END]: PromptEndEvent;
  [EventType.ON_CUSTOM_EVENT]: CustomEvent;
};
