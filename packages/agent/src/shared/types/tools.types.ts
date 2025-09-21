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

import { z as Zod } from 'zod';
import { RpcProvider } from 'starknet';
import { AgentConfig, Id } from '@snakagent/core';
import { MemoryAgent } from '@agents/operators/memoryAgent.js';
import { RagAgent } from '@agents/operators/ragAgent.js';
import { DatabaseCredentials } from './database.types.js';

/**
 * @interface SnakAgentInterface
 * @description Interface for the Starknet agent
 * @property {() => { accountPublicKey: string; accountPrivateKey: string; }} getAccountCredentials - Function to get the account credentials
 * @property {() => { signature: string; }} getSignature - Function to get the signature
 * @property {() => RpcProvider} getProvider - Function to get the provider
 * @property {() => AgentConfig} getAgentConfig - Function to get the agent configuration
 * @property {() => PostgresAdaptater[]} getDatabase - Function to get the database
 * @property {(database_name: string) => Promise<void>} connectDatabase - Function to connect to a database
 * @property {(database_name: string) => Promise<PostgresAdaptater | undefined>} createDatabase - Function to create a database
 * @property {(name: string) => PostgresAdaptater | undefined} getDatabaseByName - Function to get a database by name
 */

export interface SnakAgentInterface {
  getAccountCredentials: () => {
    accountPublicKey: string;
    accountPrivateKey: string;
  };
  getDatabaseCredentials: () => DatabaseCredentials;
  getProvider: () => RpcProvider;
  getAgentConfig: () => AgentConfig<Id.Id>;
  getMemoryAgent: () => MemoryAgent | null;
  getRagAgent: () => RagAgent | null;
}

/**
 * @interface StarknetTool
 * @description Interface for the Starknet tool
 * @property {string} name - The name of the tool
 * @property {string} plugins - The plugins for the tool
 * @property {string} description - The description of the tool
 * @property {Zod.AnyZodObject} schema - The schema for the tool
 * @property {string} responseFormat - The response format for the tool
 * @property {(agent: SnakAgentInterface, params: any, plugins_manager?: any) => Promise<unknown>} execute - Function to execute the tool
 */
export interface StarknetTool<P = unknown> {
  name: string;
  plugins: string;
  description: string;
  schema?: Zod.AnyZodObject;
  responseFormat?: string;
  execute: (
    agent: SnakAgentInterface,
    params: P,
    plugins_manager?: any
  ) => Promise<unknown>;
}

/**
 * Signature Tool Interface
 */
export interface SignatureTool<P = any> {
  name: string;
  categorie?: string;
  description: string;
  schema?: object;
  execute: (params: P) => Promise<unknown>;
}
