import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentMode } from '@snakagent/core';
import { GraphState, GraphConfigurableAnnotation } from '../../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { getCurrentPlanStep } from '../../utils/graph-utils.js';
import {
  REACT_SYSTEM_PROMPT,
  REACT_CONTEXT_PROMPT,
  REACT_RETRY_PROMPT,
} from '../../../../shared/prompts/graph/executor/react_prompts.js';
import {
  MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_STEP_EXECUTOR_CONTEXT_PROMPT,
  RETRY_TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT,
  STEP_EXECUTOR_CONTEXT_PROMPT,
  TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT,
} from '../../../../shared/prompts/graph/executor/executor_prompts.js';
import { ExecutionMode } from '@enums/agent-modes.enum.js';
/**
 * Represents a pair of system and context prompts for execution
 * Used to encapsulate prompt selection logic
 */
interface PromptPair {
  /** System prompt that defines the AI's role and behavior */
  systemPrompt: string;
  /** Context prompt that provides execution-specific instructions */
  contextPrompt: string;
}

/**
 * Manager interface for building system prompts
 * Enables clean separation of prompt selection logic by execution mode
 */
interface PromptBuildingManager {
  /**
   * Builds a prompt pair based on current state and configuration
   * @param state - Current graph execution state
   * @param config - Configuration including execution mode and agent settings
   * @returns Prompt pair containing system and context prompts
   * @throws Error if the Manager cannot handle the given configuration
   */
  buildPrompts(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): PromptPair;

  /**
   * Checks if this Manager can handle the given execution mode
   * @param executionMode - The execution mode to check
   * @param agentMode - The agent mode to check
   * @returns true if this Manager supports the given modes
   */
  supports(executionMode: ExecutionMode, agentMode?: AgentMode): boolean;
}

/**
 * Manager for reactive execution mode
 * Handles ReAct-style prompts for interactive agents
 */
class ReactivePromptManager implements PromptBuildingManager {
  buildPrompts(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): PromptPair {
    const agentMode = config.configurable?.agent_config?.mode;

    if (agentMode !== AgentMode.INTERACTIVE) {
      throw new Error(
        'REACTIVE execution mode currently supports only INTERACTIVE agent mode'
      );
    }

    // Select prompts based on retry state
    const isRetry = state.retry > 0;

    return {
      systemPrompt: REACT_SYSTEM_PROMPT,
      contextPrompt: isRetry ? REACT_RETRY_PROMPT : REACT_CONTEXT_PROMPT,
    };
  }

  supports(executionMode: ExecutionMode, agentMode?: AgentMode): boolean {
    return (
      executionMode === ExecutionMode.REACTIVE &&
      agentMode === AgentMode.INTERACTIVE
    );
  }
}

/**
 * Manager for planning execution mode
 * Handles step-by-step execution with tools and message processing
 */
class PlanningPromptManager implements PromptBuildingManager {
  buildPrompts(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): PromptPair {
    // Get current step to determine prompt type
    const currentStep = getCurrentPlanStep(
      state.plans_or_histories,
      state.currentTaskIndex
    );

    if (!currentStep) {
      throw new Error(`No step found at index ${state.currentTaskIndex}`);
    }

    const isRetry = state.retry > 0;
    const isToolsStep = currentStep.type === 'tools';

    return {
      systemPrompt: this.selectSystemPrompt(isRetry, isToolsStep),
      contextPrompt: this.selectContextPrompt(isRetry),
    };
  }

  supports(executionMode: ExecutionMode): boolean {
    return executionMode === ExecutionMode.PLANNING;
  }

  /**
   * Selects appropriate system prompt based on retry state and step type
   * @param isRetry - Whether this is a retry attempt
   * @param isToolsStep - Whether the current step involves tools
   * @returns Selected system prompt
   */
  private selectSystemPrompt(isRetry: boolean, isToolsStep: boolean): string {
    if (isRetry) {
      return isToolsStep
        ? RETRY_TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT
        : RETRY_MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT;
    } else {
      return isToolsStep
        ? TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT
        : MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT;
    }
  }

  /**
   * Selects appropriate context prompt based on retry state
   * @param isRetry - Whether this is a retry attempt
   * @returns Selected context prompt
   */
  private selectContextPrompt(isRetry: boolean): string {
    return isRetry
      ? RETRY_STEP_EXECUTOR_CONTEXT_PROMPT
      : STEP_EXECUTOR_CONTEXT_PROMPT;
  }
}

/**
 * Factory for creating and managing prompt building strategies
 * Provides centralized Manager selection and prompt template creation
 */
export class PromptManagerFactory {
  private static readonly strategies: PromptBuildingManager[] = [
    new ReactivePromptManager(),
    new PlanningPromptManager(),
  ];

  /**
   * Builds a ChatPromptTemplate using the appropriate Manager
   * @param state - Current graph execution state
   * @param config - Configuration including execution mode and agent settings
   * @returns Configured ChatPromptTemplate ready for use
   * @throws Error if no suitable Manager is found
   */
  static buildSystemPrompt(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): ChatPromptTemplate {
    const executionMode = config.configurable?.executionMode;
    const agentMode = config.configurable?.agent_config?.mode;

    if (!executionMode) {
      throw new Error('Execution mode is required for prompt building');
    }

    // Find suitable Manager
    const Manager = this.findManager(executionMode, agentMode);
    if (!Manager) {
      throw new Error(
        `No prompt Manager found for execution mode: ${executionMode}`
      );
    }

    // Build prompts using selected Manager
    const { systemPrompt, contextPrompt } = Manager.buildPrompts(state, config);

    // Create and return prompt template
    return ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['ai', contextPrompt],
    ]);
  }

  /**
   * Finds a Manager that supports the given execution and agent modes
   * @param executionMode - The execution mode to find a Manager for
   * @param agentMode - The agent mode to find a Manager for
   * @returns Suitable Manager or undefined if none found
   */
  private static findManager(
    executionMode: ExecutionMode,
    agentMode?: AgentMode
  ): PromptBuildingManager | undefined {
    return this.strategies.find((Manager) =>
      Manager.supports(executionMode, agentMode)
    );
  }
}
