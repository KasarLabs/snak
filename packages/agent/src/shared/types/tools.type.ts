import { Id } from "@snakagent/core";

export interface ToolArgs {
  [key: string]: string | number | boolean;
}

// Base type without required id
export type ToolCallBase = {
  name: string;
  args: ToolArgs;
  type?: 'tool_call';
};

// Type with required id
export type ToolCallWithId = {
  name: string;
  args: ToolArgs;
  id: string;
  type?: 'tool_call';
};

export type ToolCall<HasId extends Id.NoId | Id.Id = Id.NoId> =
  HasId extends Id.Id ? ToolCallWithId : ToolCallBase;
