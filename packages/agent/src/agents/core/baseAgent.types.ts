import type { BaseMessage } from '@langchain/core/messages';
import type { AgentType } from './baseAgent.js';
import type { StreamChunk } from './snakAgent.js';

export interface IAgent<Input = unknown, Output = unknown> {
  readonly id: string;
  readonly type: AgentType;
  readonly description?: string;
  init(): Promise<void>;
  execute(
    input: Input,
    isInterrupted?: boolean,
    config?: Record<string, unknown>
  ): Promise<Output> | AsyncGenerator<StreamChunk>;
  dispose?: () => Promise<void>;
}

export interface IModelAgent<Input = unknown, Output = unknown> extends IAgent<Input, Output> {
  invokeModel(messages: BaseMessage[], forceModelType?: string): Promise<Output>;
}