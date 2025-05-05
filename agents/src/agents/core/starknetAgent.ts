import { BaseAgent, AgentType, IModelAgent } from '../core/baseAgent.js';
import { RpcProvider } from 'starknet';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { logger, metrics } from '@snakagent/core';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { DatabaseCredentials } from '../../tools/types/database.js';
import { JsonConfig } from '../../config/jsonConfig.js';
import { MemoryConfig } from '../operators/memoryAgent.js';
import { createAgent } from '../modes/interactive.js';
import { createAutonomousAgent } from '../modes/autonomous.js';
import { createHybridAgent } from '../modes/hybrid.js';
import { Command } from '@langchain/langgraph';

/**
 * Configuration for StarknetAgent
 */
export interface StarknetAgentConfig {
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  signature: string;
  agentMode: string;
  db_credentials: DatabaseCredentials;
  agentconfig?: JsonConfig;
  memory?: MemoryConfig;
  modelSelector?: ModelSelectionAgent;
}

/**
 * Main agent for interacting with the Starknet blockchain
 */
export class StarknetAgent extends BaseAgent implements IModelAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly signature: string;
  private readonly agentMode: string;
  private readonly agentconfig?: JsonConfig;
  private readonly db_credentials: DatabaseCredentials;
  private memory: MemoryConfig;
  private currentMode: string;
  private agentReactExecutor: any;
  private modelSelector: ModelSelectionAgent | null = null;

  constructor(config: StarknetAgentConfig) {
    super('snak', AgentType.SNAK);

    // Initialize properties
    this.provider = config.provider;
    this.accountPrivateKey = config.accountPrivateKey;
    this.accountPublicKey = config.accountPublicKey;
    this.signature = config.signature;
    this.agentMode = config.agentMode;
    this.db_credentials = config.db_credentials;
    this.currentMode =
      config.agentMode === 'auto' ||
      config.agentconfig?.mode?.autonomous === true
        ? 'auto'
        : 'interactive';
    this.agentconfig = config.agentconfig;
    this.memory = config.memory || {};
    this.modelSelector = config.modelSelector || null;

    // Check for required configurations
    if (!config.accountPrivateKey) {
      throw new Error('STARKNET_PRIVATE_KEY is required');
    }

    metrics.metricsAgentConnect(
      config.agentconfig?.name ?? 'agent',
      config.agentMode
    );
  }

  /**
   * Initialize the Starknet agent
   */
  public async init(): Promise<void> {
    try {
      logger.debug('Initializing StarknetAgent...');

      if (!this.modelSelector) {
        logger.warn(
          'StarknetAgent: No ModelSelectionAgent provided, functionality will be limited'
        );
      }

      // Ensure agentconfig has necessary properties
      if (this.agentconfig) {
        // Ensure plugins array exists
        if (!this.agentconfig.plugins) {
          logger.debug(
            'StarknetAgent: Initializing empty plugins array in config'
          );
          this.agentconfig.plugins = [];
        }
      } else {
        logger.warn('StarknetAgent: No agent configuration available');
      }

      // Set default mode to hybrid if configuration allows
      if (
        this.agentconfig?.mode?.hybrid !== false &&
        (this.agentMode === 'auto' ||
          this.agentconfig?.mode?.autonomous === true)
      ) {
        logger.debug('StarknetAgent: Setting default mode to hybrid');
        this.currentMode = 'hybrid';
      }

      try {
        logger.debug(
          'StarknetAgent: Testing agent executor creation during init...'
        );
        await this.createAgentReactExecutor();

        if (!this.agentReactExecutor) {
          logger.warn(
            'StarknetAgent: Agent executor creation succeeded but returned null/undefined'
          );
        }
      } catch (executorError) {
        logger.error(
          `StarknetAgent: Failed to create agent executor during init: ${executorError}`
        );
        logger.warn(
          'StarknetAgent: Will attempt to recover during execute() calls'
        );
      }

      logger.debug('StarknetAgent initialized successfully.');
    } catch (error) {
      logger.error(`StarknetAgent initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Create agent executor based on current mode
   */
  private async createAgentReactExecutor(): Promise<void> {
    try {
      logger.debug(
        'StarknetAgent: Starting createAgentReactExecutor with mode=' +
          this.currentMode
      );

      logger.debug(`StarknetAgent: Using current mode: ${this.currentMode}`);

      if (this.currentMode === 'auto') {
        logger.debug('StarknetAgent: Creating autonomous agent executor...');
        this.agentReactExecutor = await createAutonomousAgent(
          this,
          this.modelSelector
        );
      } else if (this.currentMode === 'interactive') {
        logger.debug('StarknetAgent: Creating interactive agent executor...');
        this.agentReactExecutor = await createAgent(this, this.modelSelector);
      } else if (this.currentMode === 'hybrid') {
        logger.debug('StarknetAgent: Creating hybrid agent executor...');
        this.agentReactExecutor = await createHybridAgent(
          this,
          this.modelSelector
        );
      } else {
        throw new Error(`Invalid mode: ${this.currentMode}`);
      }

      if (!this.agentReactExecutor) {
        throw new Error(
          `Failed to create agent executor for mode ${this.currentMode}: result is null/undefined`
        );
      }
    } catch (error) {
      logger.error(
        `StarknetAgent: Failed to create Agent React Executor: ${error}`
      );
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Get appropriate model for a task based on messages
   */
  public async getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    if (!this.modelSelector) {
      throw new Error('ModelSelectionAgent not available');
    }

    return this.modelSelector.getModelForTask(messages, forceModelType);
  }

  /**
   * Invoke model with appropriate selection logic
   */
  public async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    if (!this.modelSelector) {
      throw new Error('ModelSelectionAgent not available');
    }

    return this.modelSelector.invokeModel(messages, forceModelType);
  }

  /**
   * Get Starknet account credentials
   */
  public getAccountCredentials() {
    return {
      accountPrivateKey: this.accountPrivateKey,
      accountPublicKey: this.accountPublicKey,
    };
  }

  /**
   * Get database credentials
   */
  public getDatabaseCredentials() {
    return this.db_credentials;
  }

  /**
   * Get agent signature
   */
  public getSignature() {
    return {
      signature: this.signature,
    };
  }

  /**
   * Get current agent mode
   */
  public getAgent() {
    return {
      agentMode: this.currentMode,
    };
  }

  /**
   * Get agent configuration
   */
  public getAgentConfig(): JsonConfig | undefined {
    return this.agentconfig;
  }

  /**
   * Get original agent mode from initialization
   */
  public getAgentMode(): string {
    return this.agentMode;
  }

  /**
   * Get Starknet RPC provider
   */
  public getProvider(): RpcProvider {
    return this.provider;
  }

  /**
   * Execute the agent with the given input
   * @param input The input message or string
   * @param config Optional configuration for execution, can include `agentMode` to temporarily change mode
   * @returns The agent response
   */
  public async execute(
    input: string | BaseMessage | any,
    config?: Record<string, any>
  ): Promise<unknown> {
    let responseContent: string | any;
    let errorCount = 0;
    const maxErrors = 3;
    let fallbackAttempted = false;
    let originalMode = this.currentMode;

    try {
      logger.debug(`StarknetAgent executing with mode: ${this.currentMode}`);

      // Retrieve the original user query if it exists in config metadata
      let originalUserQuery = null;
      if (config && config.originalUserQuery) {
        originalUserQuery = config.originalUserQuery;
        logger.debug(
          `StarknetAgent: Retrieved original user query from config: "${originalUserQuery}"`
        );
      }

      // Also extract from the input if it's a message from ModelSelectionAgent
      if (
        input instanceof BaseMessage &&
        input.additional_kwargs?.from === 'model-selector' &&
        input.additional_kwargs?.originalUserQuery
      ) {
        originalUserQuery = input.additional_kwargs.originalUserQuery;
        logger.debug(
          `StarknetAgent: Retrieved original user query from model-selector: "${originalUserQuery}"`
        );
      }

      // Check if we need to temporarily adjust mode for this execution
      const requestedMode = config?.agentMode;

      // Temporarily change mode if requested, valid, and different from current
      if (
        requestedMode &&
        (requestedMode === 'interactive' ||
          requestedMode === 'auto' ||
          requestedMode === 'hybrid') &&
        requestedMode !== this.currentMode
      ) {
        logger.debug(
          `Temporarily switching mode from ${this.currentMode} to ${requestedMode} for this execution`
        );
        this.currentMode = requestedMode;
      }

      // Ensure executor is created for current mode
      if (!this.agentReactExecutor) {
        logger.debug(
          'StarknetAgent: No executor exists, attempting to create one...'
        );
        try {
          await this.createAgentReactExecutor();
        } catch (initError) {
          logger.error(
            `StarknetAgent: Initial attempt to initialize executor failed: ${initError}`
          );
          errorCount++;
          // Return formatted error message on initial failure
          const errorMessage = new AIMessage({
            content: `I cannot process your request at this time because the agent failed to initialize properly. Error: ${initError}`,
            additional_kwargs: {
              from: 'snak',
              final: true,
              error: 'initialization_failed',
            },
          });

          // Check if we should retry or fallback
          if (errorCount >= maxErrors) {
            logger.warn(
              'StarknetAgent: Maximum initialization attempts reached, using fallback mode'
            );
            fallbackAttempted = true;
            return this.executeSimpleFallback(input);
          } else {
            // If not max errors, return the init error message but allow retry on next call
            return errorMessage;
          }
        }
      }

      // Retry logic within execute if executor is still null after initial attempt or becomes null later
      while (!this.agentReactExecutor && errorCount < maxErrors) {
        errorCount++;
        logger.warn(
          `StarknetAgent: Attempt ${errorCount} to initialize executor failed, trying again...`
        );
        try {
          await this.createAgentReactExecutor();
        } catch (retryError) {
          logger.error(
            `StarknetAgent: Retry attempt ${errorCount} failed: ${retryError}`
          );
        }
        if (this.agentReactExecutor) {
          logger.debug(
            `StarknetAgent: Executor successfully created on attempt ${errorCount}`
          );
          break; // Exit loop if successful
        }
      }

      // If still no executor after retries, use fallback
      if (
        !this.agentReactExecutor &&
        errorCount >= maxErrors &&
        !fallbackAttempted
      ) {
        logger.warn(
          'StarknetAgent: Maximum initialization attempts reached after retries, using fallback mode'
        );
        fallbackAttempted = true;
        return this.executeSimpleFallback(input);
      }

      // Ensure we have a valid executor now before proceeding
      if (!this.agentReactExecutor) {
        logger.error(
          'StarknetAgent: Failed to create a valid executor after attempts'
        );
        return new AIMessage({
          content:
            'Failed to initialize execution agent after multiple attempts. Please try again or contact an administrator.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'executor_creation_failed_retries',
          },
        });
      }

      // Check if we need to recreate the executor for a different mode
      else if (originalMode !== this.currentMode) {
        logger.debug(`Re-creating executor for mode: ${this.currentMode}`);
        try {
          await this.createAgentReactExecutor();
          if (!this.agentReactExecutor) {
            throw new Error(
              `Failed to initialize Agent React Executor for mode: ${this.currentMode}`
            );
          }
          logger.debug(
            `Executor successfully re-created for mode: ${this.currentMode}`
          );
        } catch (modeChangeError) {
          logger.error(
            `StarknetAgent: Failed to recreate executor for mode ${this.currentMode}: ${modeChangeError}`
          );

          // Restore original mode on failure
          this.currentMode = originalMode;

          return new AIMessage({
            content: `Unable to change agent mode to "${requestedMode}". Error: ${modeChangeError}`,
            additional_kwargs: {
              from: 'snak',
              final: true,
              error: 'mode_change_failed',
            },
          });
        }
      }

      // ----- Main execution logic starts here -----
      // Ensure input is a BaseMessage for LangChain compatibility
      let currentMessages: BaseMessage[];
      if (input instanceof BaseMessage) {
        currentMessages = [input];
      } else if (typeof input === 'string') {
        currentMessages = [new HumanMessage({ content: input })];
      } else {
        logger.error(`StarknetAgent: Unsupported input type: ${typeof input}`);
        return new AIMessage({
          content: 'Unsupported input type.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'unsupported_input_type',
          },
        });
      }

      logger.debug(
        `StarknetAgent: Invoking agent executor with input: ${JSON.stringify(currentMessages)}`
      );

      // If we have an original query, use it as the main input
      if (
        originalUserQuery &&
        currentMessages.length > 0 &&
        currentMessages[0].additional_kwargs?.from === 'model-selector'
      ) {
        logger.debug(
          `StarknetAgent: Using original user query instead of model-selector message`
        );
        currentMessages = [new HumanMessage(originalUserQuery)];
      }

      let result: any;
      try {
        result = await this.agentReactExecutor.invoke(
          { messages: currentMessages },
          { configurable: { thread_id: 'default' } }
        );

        if (result && result.messages && result.messages.length > 0) {
          // Get the last non-empty AIMessage from the result
          for (let i = result.messages.length - 1; i >= 0; i--) {
            const msg = result.messages[i];
            if (msg instanceof AIMessage && msg.content) {
              if (
                typeof msg.content === 'string' &&
                msg.content.trim() !== ''
              ) {
                responseContent = msg.content;
                break;
              } else if (Array.isArray(msg.content) && msg.content.length > 0) {
                responseContent = msg.content;
                break;
              }
            }
          }

          // If we still don't have content, use the last message or a default
          if (!responseContent) {
            const lastMsg = result.messages[result.messages.length - 1];
            responseContent =
              lastMsg && lastMsg.content
                ? lastMsg.content
                : "I couldn't generate a specific response for this request.";
          }
        } else {
          // Default response if no valid messages found
          responseContent =
            'No response could be generated. Please try again with a different request.';
        }
      } catch (agentExecError: any) {
        logger.error(
          `StarknetAgent: Agent execution failed: ${agentExecError}`
        );
        // Check for specific error types if needed
        if (this.isTokenRelatedError(agentExecError)) {
          logger.warn('Token related error detected during execution.');
          responseContent = 'Error: Token validation or processing failed.';
        } else {
          responseContent = `Error during agent execution: ${agentExecError.message}`;
        }
        // Decide if we should fallback even on execution error
        logger.error(
          `StarknetAgent: Catastrophic error in execute, using fallback: ${agentExecError}`
        );
        return this.executeSimpleFallback(input); // Using fallback for execution errors too
      }

      // Always return a properly formatted AIMessage with required metadata
      return new AIMessage({
        content: responseContent,
        additional_kwargs: {
          from: 'snak',
          final: true,
          agent_mode: this.currentMode,
        },
      });
    } catch (error: any) {
      logger.error(`StarknetAgent main execution failed: ${error}`);
      // In case of catastrophic error outside agent invocation, use fallback
      if (!fallbackAttempted) {
        logger.error(
          `StarknetAgent: Catastrophic error in execute, using fallback: ${error}`
        );
        // Ensure fallback returns directly
        return this.executeSimpleFallback(input);
      }
      // If fallback was attempted or error happened after fallback check, create error AIMessage
      return new AIMessage({
        content: `Error: ${error.message}`,
        additional_kwargs: {
          from: 'snak',
          final: true,
          error: 'execution_error',
        },
      });
    } finally {
      // Restore original mode if temporarily changed
      if (config?.agentMode && this.currentMode !== originalMode) {
        logger.debug(`Restoring original agent mode: ${originalMode}`);
        this.currentMode = originalMode;
      }
    }
  }

  /**
   * Simple fallback execution mode when main executor fails
   * @param input The original input received by execute method
   * @returns A simple AIMessage indicating fallback mode
   */
  private async executeSimpleFallback(
    input: string | BaseMessage
  ): Promise<AIMessage> {
    logger.warn('StarknetAgent: Executing in simple fallback mode');

    // Safely extract query content
    let queryContent = 'Unavailable';
    try {
      if (typeof input === 'string') {
        queryContent = input;
      } else if (
        input instanceof BaseMessage &&
        typeof input.content === 'string'
      ) {
        queryContent = input.content;
      } else if (input && typeof input.toString === 'function') {
        queryContent = input.toString(); // Fallback to toString()
      }
    } catch (e) {
      logger.error(`Error extracting content in fallback mode: ${e}`);
    }

    // Simplified response
    const truncatedQuery =
      queryContent.substring(0, 100) + (queryContent.length > 100 ? '...' : '');
    const responseMessage = `I cannot process your request completely because I'm in fallback mode. Your query was: "${truncatedQuery}"`;

    return new AIMessage({
      content: responseMessage,
      additional_kwargs: {
        from: 'snak',
        final: true,
        error: 'fallback_mode_activated',
      },
    });
  }

  /**
   * Check if an error is token-related
   */
  private isTokenRelatedError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes('token limit') ||
      errorMessage.includes('tokens exceed') ||
      errorMessage.includes('context length') ||
      errorMessage.includes('prompt is too long') ||
      errorMessage.includes('maximum context length')
    );
  }

  /**
   * Execute call data request (signature mode) in agent mode
   */
  public async execute_call_data(input: string): Promise<unknown> {
    try {
      // Check if in interactive mode now
      if (this.currentMode !== 'interactive') {
        throw new Error(
          `Need to be in interactive mode to execute_call_data (current mode: ${this.currentMode})`
        );
      }

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      // Prepare invocation options with message pruning
      const invokeOptions: any = {};

      // Add message pruning if memory is enabled
      if (this.memory.enabled !== false) {
        // Use mode.maxIteration if available, otherwise fall back to memory config
        const maxIteration =
          this.agentconfig?.mode?.maxIteration !== undefined
            ? this.agentconfig.mode.maxIteration
            : this.memory.maxIteration !== undefined
              ? this.memory.maxIteration
              : this.memory.shortTermMemorySize || 15;

        // Only apply recursion limit if it's not null (0 means no limit)
        if (maxIteration !== 0) {
          invokeOptions.maxIteration = maxIteration;
          invokeOptions.messageHandler = (messages: any[]) => {
            if (messages.length > maxIteration) {
              logger.debug(
                `Call data - message pruning: ${messages.length} messages exceeds limit ${maxIteration}`
              );
              const prunedMessages = [
                messages[0],
                ...messages.slice(-(maxIteration - 1)),
              ];
              logger.debug(
                `Call data - pruned from ${messages.length} to ${prunedMessages.length} messages`
              );
              return prunedMessages;
            }
            return messages;
          };
          logger.debug(
            `Execute call data: configured with maxIteration=${maxIteration}`
          );
        } else {
          logger.debug(`Execute call data: running without recursion limit`);
        }
      }

      // Invoke with 'messages' key as expected by Langchain standard interfaces
      logger.debug('Execute call data: invoking agent with input message');
      const result = await this.agentReactExecutor.invoke(
        {
          // Ensure the input is wrapped correctly if it's just a string
          messages: [new HumanMessage({ content: input })],
        },
        invokeOptions
      );
      logger.debug('Execute call data: agent invocation complete');

      try {
        // Process the result - Assuming result structure includes 'messages'
        if (!result || !result.messages || result.messages.length === 0) {
          throw new Error('No messages returned from call data execution');
        }

        // Find the last AIMessage content which should contain the observation
        const lastAiMessage = result.messages
          .slice()
          .reverse()
          .find((m: BaseMessage) => m instanceof AIMessage);

        if (!lastAiMessage || typeof lastAiMessage.content !== 'string') {
          throw new Error(
            'Could not find valid AIMessage content in the result.'
          );
        }

        const messageContent = lastAiMessage.content;

        // Attempt to parse the JSON content
        return JSON.parse(messageContent);
      } catch (parseError) {
        // More specific error handling for parsing issues
        const lastMessageContent =
          result?.messages?.[result.messages.length - 1]?.content;
        logger.error(
          `Failed to parse observation JSON: ${parseError}. Content was: ${lastMessageContent}`
        );
        return {
          status: 'failure',
          error: `Failed to parse observation: ${parseError instanceof Error ? parseError.message : String(parseError)}. Raw content: ${lastMessageContent}`,
        };
      }
    } catch (error) {
      logger.error(`Execute call data error: ${error}`);
      return {
        status: 'failure',
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Execute in autonomous mode with a structure similar to execute()
   * @returns Result of the autonomous execution
   */
  public async execute_autonomous(): Promise<unknown> {
    let responseContent: string | any;
    let errorCount = 0;
    let maxErrors = 3;
    let fallbackAttempted = false;
    let originalMode = this.currentMode;
    let iterationCount = 0;
    let conversationHistory: BaseMessage[] = [];

    try {
      logger.debug(
        `StarknetAgent executing autonomous mode: ${this.currentMode}`
      );

      // Verify we are in autonomous mode
      if (this.currentMode !== 'auto') {
        if (this.agentconfig?.mode?.autonomous) {
          logger.info(
            `Overriding mode to 'auto' based on config settings (autonomous=${this.agentconfig?.mode?.autonomous})`
          );
          this.currentMode = 'auto';
        } else {
          throw new Error(
            `Need to be in autonomous mode to execute_autonomous (current mode: ${this.currentMode})`
          );
        }
      }

      // Ensure executor is created
      if (!this.agentReactExecutor) {
        logger.debug(
          'StarknetAgent: No executor exists, attempting to create one...'
        );
        try {
          await this.createAgentReactExecutor();
        } catch (initError) {
          logger.error(
            `StarknetAgent: Initial attempt to initialize executor failed: ${initError}`
          );
          errorCount++;

          // Check if we should retry or use fallback
          if (errorCount >= maxErrors) {
            logger.warn(
              'StarknetAgent: Maximum initialization attempts reached, using fallback mode'
            );
            fallbackAttempted = true;
            return this.executeSimpleFallback(
              'Autonomous execution initialization failed'
            );
          } else {
            return new AIMessage({
              content: `I cannot process autonomous execution at this time because the agent failed to initialize properly. Error: ${initError}`,
              additional_kwargs: {
                from: 'snak',
                final: true,
                error: 'initialization_failed',
              },
            });
          }
        }
      }

      // Retry logic identical to execute()
      while (!this.agentReactExecutor && errorCount < maxErrors) {
        errorCount++;
        logger.warn(
          `StarknetAgent: Attempt ${errorCount} to initialize executor failed, trying again...`
        );
        try {
          await this.createAgentReactExecutor();
        } catch (retryError) {
          logger.error(
            `StarknetAgent: Retry attempt ${errorCount} failed: ${retryError}`
          );
        }
        if (this.agentReactExecutor) {
          logger.debug(
            `StarknetAgent: Executor successfully created on attempt ${errorCount}`
          );
          break;
        }
      }

      // If still no executor after retries, use fallback
      if (
        !this.agentReactExecutor &&
        errorCount >= maxErrors &&
        !fallbackAttempted
      ) {
        logger.warn(
          'StarknetAgent: Maximum initialization attempts reached after retries, using fallback mode'
        );
        fallbackAttempted = true;
        return this.executeSimpleFallback(
          'Autonomous execution initialization failed after retries'
        );
      }

      // Ensure we have a valid executor
      if (!this.agentReactExecutor) {
        logger.error(
          'StarknetAgent: Failed to create a valid executor after attempts'
        );
        return new AIMessage({
          content:
            'Failed to initialize autonomous execution agent after multiple attempts. Please try again or contact an administrator.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'executor_creation_failed_retries',
          },
        });
      }

      // ----- Main autonomous execution logic starts here -----
      // The agentReactExecutor now holds { app, json_config, maxIteration }
      if (!this.agentReactExecutor?.app) {
        logger.error(
          'StarknetAgent: Autonomous executor created, but app is missing.'
        );
        return new AIMessage({
          content: 'Failed to initialize autonomous execution agent structure.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'executor_app_missing',
          },
        });
      }

      const app = this.agentReactExecutor.app;
      const agentJsonConfig = this.agentReactExecutor.json_config; // Config from agent creator
      const maxIteration = this.agentReactExecutor.maxIteration; // Max iterations from agent creator

      // Setup initial conversation state - requires an initial input message
      // We need a starting point for the autonomous agent. Let's use a generic starter message.
      // If a specific goal/task is needed, it should be passed into this function in the future.
      const initialHumanMessage = new HumanMessage({
        content:
          agentJsonConfig?.prompt?.initial_goal || // Use a configured initial goal if available
          'Start executing the primary objective defined in your system prompt.',
      });
      conversationHistory = [initialHumanMessage]; // Start history with the initial prompt

      // Define the thread configuration for stateful execution
      const threadConfig = {
        configurable: {
          thread_id: agentJsonConfig?.chat_id || 'autonomous_session',
        },
      };

      logger.info(
        `Starting autonomous execution with max iterations: ${maxIteration}`
      );

      // Main autonomous loop using graph streaming
      try {
        let finalState: any = null;

        // Use invoke instead of stream. The recursionLimit handles max iterations.
        finalState = await app.invoke(
          { messages: conversationHistory }, // Initial input to the graph
          { ...threadConfig, recursionLimit: maxIteration } // Pass thread and recursion limit
        );

        logger.debug('Autonomous graph invocation complete.');
        iterationCount = finalState?.iterations || iterationCount; // Try to get iteration count if available in final state

        // Check for explicit errors in the final state (e.g., token limit error from callModel)
        if (finalState?.messages?.length > 0) {
          const lastMsg = finalState.messages[finalState.messages.length - 1];
          if (
            lastMsg instanceof AIMessage &&
            lastMsg.additional_kwargs?.error
          ) {
            logger.error(
              `Autonomous Agent: Error detected in final graph state: ${lastMsg.additional_kwargs.error}`
            );
            responseContent =
              lastMsg.content ||
              `Execution stopped due to error: ${lastMsg.additional_kwargs.error}`;
            // Mark as final if needed
            if (!lastMsg.additional_kwargs.final) {
              if (!lastMsg.additional_kwargs) lastMsg.additional_kwargs = {};
              lastMsg.additional_kwargs.final = true;
            }
          }
        }

        logger.info(
          `Autonomous session finished. Iteration count might not be accurate with invoke.`
        );

        // Extract final response from the last state
        if (
          finalState &&
          finalState.messages &&
          finalState.messages.length > 0
        ) {
          const lastMessage =
            finalState.messages[finalState.messages.length - 1];
          if (lastMessage instanceof AIMessage) {
            responseContent = lastMessage.content;
            // Ensure metadata includes final=true if it came from __end__ implicitly
            if (!lastMessage.additional_kwargs?.final) {
              if (!lastMessage.additional_kwargs)
                lastMessage.additional_kwargs = {};
              lastMessage.additional_kwargs.final = true;
            }
          } else {
            logger.warn(
              `Autonomous execution ended with non-AI message: ${lastMessage._getType()}`
            );
            responseContent =
              responseContent || // Use content from loop break if available
              'Autonomous execution finished, but the final message was not from the AI.';
          }
        } else {
          responseContent =
            responseContent || // Use content from loop break if available
            'Autonomous execution completed, but no final state or messages were found.';
        }
      } catch (graphExecError) {
        logger.error(
          `Error during autonomous graph execution: ${graphExecError}`
        );
        // Decide if fallback is needed based on error type
        if (this.isTokenRelatedError(graphExecError)) {
          responseContent =
            'Error: Token limit likely exceeded during autonomous execution.';
        } else {
          responseContent = `Error during autonomous execution: ${graphExecError instanceof Error ? graphExecError.message : graphExecError}`;
        }
        // Use fallback for graph execution errors as well?
        logger.error(
          `StarknetAgent: Catastrophic error in autonomous execute, using fallback: ${graphExecError}`
        );
        return this.executeSimpleFallback(
          'Autonomous execution failed during graph processing'
        );
      }

      // Return a formatted message
      return new AIMessage({
        content: responseContent,
        additional_kwargs: {
          from: 'snak',
          final: true,
          agent_mode: this.currentMode,
          iterations: iterationCount,
        },
      });
    } catch (error: any) {
      logger.error(`StarknetAgent autonomous execution failed: ${error}`);

      // In case of catastrophic error, use fallback
      if (!fallbackAttempted) {
        logger.error(
          `StarknetAgent: Catastrophic error in autonomous execute, using fallback: ${error}`
        );
        return this.executeSimpleFallback('Autonomous execution failed');
      }

      // If fallback was already attempted, create error message
      return new AIMessage({
        content: `Autonomous execution error: ${error.message}`,
        additional_kwargs: {
          from: 'snak',
          final: true,
          error: 'autonomous_execution_error',
        },
      });
    } finally {
      // Restore original mode
      if (this.currentMode !== originalMode) {
        logger.debug(`Restoring original agent mode: ${originalMode}`);
        this.currentMode = originalMode;
      }
    }
  }

  /**
   * Execute in hybrid mode
   * @param initialInput The initial input to start the autonomous execution
   * @returns Result of the hybrid execution
   */
  public async execute_hybrid(initialInput: string): Promise<unknown> {
    let errorCount = 0;
    let maxErrors = 3;
    let fallbackAttempted = false;
    let originalMode = this.currentMode;
    let threadId = `hybrid_${Date.now()}`;

    try {
      logger.debug(`StarknetAgent executing hybrid mode`);

      // Set mode to hybrid
      this.currentMode = 'hybrid';

      // Create hybrid agent executor if needed
      if (!this.agentReactExecutor || this.currentMode !== 'hybrid') {
        logger.debug('Creating hybrid agent executor...');
        try {
          // Validate agent configuration
          const agentConfig = this.getAgentConfig();
          if (!agentConfig) {
            logger.warn(
              'StarknetAgent: No agent configuration available for hybrid mode'
            );
            throw new Error('Agent configuration is required for hybrid mode');
          }

          // Ensure required configurations are available
          if (!agentConfig.name) {
            logger.warn(
              'StarknetAgent: Agent name is missing in configuration'
            );
          }

          if (!(agentConfig as any).bio) {
            logger.warn('StarknetAgent: Agent bio is missing in configuration');
          }

          if (
            !Array.isArray((agentConfig as any).objectives) ||
            (agentConfig as any).objectives.length === 0
          ) {
            logger.warn(
              'StarknetAgent: Agent objectives are missing or empty in configuration'
            );
          }

          if (
            !Array.isArray((agentConfig as any).knowledge) ||
            (agentConfig as any).knowledge.length === 0
          ) {
            logger.warn(
              'StarknetAgent: Agent knowledge is missing or empty in configuration'
            );
          }

          // Ensure plugins array exists
          if (!agentConfig.plugins) {
            logger.warn(
              'StarknetAgent: No plugins configured in agent configuration'
            );
            agentConfig.plugins = [];
          }

          this.agentReactExecutor = await createHybridAgent(
            this,
            this.modelSelector
          );

          if (!this.agentReactExecutor) {
            throw new Error(
              'Failed to create hybrid agent executor: returned null/undefined'
            );
          }
        } catch (initError) {
          logger.error(`Failed to initialize hybrid executor: ${initError}`);
          errorCount++;

          if (errorCount >= maxErrors) {
            logger.warn(
              'Maximum initialization attempts reached, using fallback mode'
            );
            fallbackAttempted = true;
            return this.executeSimpleFallback(
              'Hybrid execution initialization failed'
            );
          }
        }
      }

      if (!this.agentReactExecutor?.app) {
        logger.error('Hybrid executor created, but app is missing.');
        return new AIMessage({
          content: 'Failed to initialize hybrid execution agent structure.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'executor_app_missing',
          },
        });
      }

      const app = this.agentReactExecutor.app;
      const threadConfig = {
        configurable: {
          thread_id: threadId,
        },
      };

      // Start with an initial message
      const initialHumanMessage = new HumanMessage({
        content: initialInput || 'Start executing the primary objective.',
      });

      // Initial invocation to start the process
      logger.info(`Starting hybrid execution with thread ID: ${threadId}`);
      let state = await app.invoke(
        { messages: [initialHumanMessage] },
        threadConfig
      );

      logger.debug('Initial hybrid invocation complete.');

      // Return the state for the caller to manage further interactions
      return {
        state,
        threadId,
      };
    } catch (error) {
      logger.error(`StarknetAgent hybrid execution failed: ${error}`);

      if (!fallbackAttempted) {
        logger.error(`Catastrophic error in hybrid execute, using fallback`);
        return this.executeSimpleFallback('Hybrid execution failed');
      }

      return new AIMessage({
        content: `Hybrid execution error: ${error instanceof Error ? error.message : String(error)}`,
        additional_kwargs: {
          from: 'snak',
          final: true,
          error: 'hybrid_execution_error',
        },
      });
    } finally {
      // Restore original mode
      if (this.currentMode !== originalMode) {
        logger.debug(`Restoring original agent mode: ${originalMode}`);
        this.currentMode = originalMode;
      }
    }
  }

  /**
   * Resume hybrid execution with human input
   * @param input The human input to provide
   * @param threadId The thread ID of the paused execution
   * @returns Updated state after resuming execution
   */
  public async resume_hybrid(
    input: string,
    threadId: string
  ): Promise<unknown> {
    try {
      logger.debug(`Resuming hybrid execution with thread ID: ${threadId}`);

      if (!this.agentReactExecutor?.app) {
        throw new Error('Hybrid agent not initialized');
      }

      const app = this.agentReactExecutor.app;
      const threadConfig = {
        configurable: {
          thread_id: threadId,
        },
      };

      // Resume execution with the Command containing human input
      const state = await app.invoke(
        new Command({ resume: input }),
        threadConfig
      );

      logger.debug('Hybrid execution resumed successfully');
      return {
        state,
        threadId,
      };
    } catch (error) {
      logger.error(`Error resuming hybrid execution: ${error}`);
      throw error;
    }
  }

  /**
   * Get memory configuration
   */
  public getMemoryConfig(): MemoryConfig {
    return this.memory;
  }

  /**
   * Set memory configuration
   */
  public setMemoryConfig(config: MemoryConfig): void {
    this.memory = { ...this.memory, ...config };
  }

  /**
   * Validates the user request before execution
   * @param request The user's request string
   * @returns Promise<boolean> indicating if request is valid
   */
  public async validateRequest(request: string): Promise<boolean> {
    logger.debug(`Validating request (currently always true): ${request}`);
    return true;
  }

  public async getModelForCurrentTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    if (!this.modelSelector) {
      logger.warn(
        'StarknetAgent: No ModelSelectionAgent available, using default model'
      );
      throw new Error(
        'ModelSelectionAgent is not available and no default model is configured'
      );
    }

    // Use the model selector to determine the best model
    const selectedModelType =
      forceModelType ||
      (await this.modelSelector.selectModelForMessages(messages));

    logger.debug(
      `StarknetAgent: Selected model type for current task: ${selectedModelType}`
    );
    return this.modelSelector.getModelForTask(messages, selectedModelType);
  }
}
