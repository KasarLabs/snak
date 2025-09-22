import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { START, StateGraph, Command, END } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject, z } from 'zod';
import { logger } from '@snakagent/core';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  TaskType,
  GraphErrorType,
  Memories,
  GraphErrorTypeEnum,
} from '../../../shared/types/index.js';
import { VerifierNode } from '../../../shared/enums/agent-modes.enum.js';
import {
  getCurrentTask,
  handleNodeError,
  hasReachedMaxSteps,
  isValidConfiguration,
  isValidConfigurationType,
} from '../utils/graph-utils.js';
import { stm_format_for_history } from '../parser/memory/stm-parser.js';
import { STMManager } from '@lib/memory/index.js';
import { v4 as uuidv4 } from 'uuid';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TASK_VERIFICATION_CONTEXT_PROMPT } from '@prompts/agents/task-verifier.prompts.js';
import {
  TaskVerificationSchema,
  TaskVerificationSchemaType,
} from '@schemas/graph.schemas.js';
// Task verification schema

export class TaskVerifierGraph {
  private model: BaseChatModel;
  private graph: any;

  constructor(model: BaseChatModel) {
    this.model = model;
  }

  private async verifyTaskCompletion(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<
    | {
        messages: BaseMessage[];
        last_node: VerifierNode;
        tasks?: TaskType[];
        currentTaskIndex?: number;
        currentGraphStep?: number;
        error?: GraphErrorType | null;
      }
    | Command
  > {
    try {
      const _isValidConfiguration: isValidConfigurationType =
        isValidConfiguration(config);
      if (_isValidConfiguration.isValid === false) {
        throw new Error(_isValidConfiguration.error);
      }
      if (
        hasReachedMaxSteps(
          state.currentGraphStep,
          config.configurable!.agent_config!
        )
      ) {
        logger.warn(
          `[MemoryRouter] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
        );
        throw new Error('Max memory graph steps reached');
      }
      const agentConfig = config.configurable!.agent_config!;
      const currentTask = getCurrentTask(state.tasks);
      // Check if task was marked as completed by end_task tool
      if (currentTask.status !== 'waiting_validation') {
        logger.debug(
          '[TaskVerifier] Task not marked as completed, skipping verification'
        );
        return {
          messages: [],
          last_node: VerifierNode.TASK_VERIFIER,
          tasks: state.tasks,
          currentTaskIndex: state.currentTaskIndex,
          currentGraphStep: state.currentGraphStep + 1,
          error: null,
        };
      }

      const structuredModel = this.model.withStructuredOutput(
        TaskVerificationSchema
      );

      const prompt = ChatPromptTemplate.fromMessages([
        agentConfig.prompts.task_verifier_prompt,
        ['user', TASK_VERIFICATION_CONTEXT_PROMPT],
      ]);

      const executedSteps = stm_format_for_history(state.memories.stm);

      logger.info('[TaskVerifier] Starting task completion verification');
      const formattedPrompt = await prompt.formatMessages({
        originalTask: currentTask.task.directive,
        taskReasoning: currentTask.thought.reasoning,
        executedSteps: executedSteps || 'No prior steps executed',
      });
      const verificationResult = (await structuredModel.invoke(
        formattedPrompt
      )) as TaskVerificationSchemaType;

      const verificationMessage = new AIMessageChunk({
        content: `Task verification completed: ${verificationResult.taskCompleted ? 'SUCCESS' : 'INCOMPLETE'}
Confidence: ${verificationResult.confidenceScore}%
Reasoning: ${verificationResult.reasoning}`,
        additional_kwargs: {
          from: 'task_verifier',
          taskCompleted: verificationResult.taskCompleted,
          confidenceScore: verificationResult.confidenceScore,
          reasoning: verificationResult.reasoning,
          missingElements: verificationResult.missingElements,
          nextActions: verificationResult.nextActions,
        },
      });
      if (
        verificationResult.taskCompleted &&
        verificationResult.confidenceScore >= 70
      ) {
        // Task is truly complete, proceed to next task
        logger.info(
          `[TaskVerifier] Task ${state.currentTaskIndex + 1} verified as complete (${verificationResult.confidenceScore}% confidence)`
        );
        const updatedTasks = [...state.tasks];
        updatedTasks[state.tasks.length - 1].status = 'completed';
        updatedTasks[state.tasks.length - 1].task_verification =
          verificationResult.reasoning;

        return {
          messages: [verificationMessage],
          last_node: VerifierNode.TASK_VERIFIER,
          tasks: updatedTasks,
          currentTaskIndex: state.currentTaskIndex,
          currentGraphStep: state.currentGraphStep + 1,

          error: verificationMessage.additional_kwargs.taskCompleted
            ? null
            : {
                type: GraphErrorTypeEnum.VALIDATION_ERROR,
                hasError: true,
                message: verificationResult.reasoning,
                source: 'task_verifier',
                timestamp: Date.now(),
              },
        };
      } else {
        // Task needs more work, mark as incomplete and go back to planning
        logger.warn(
          `[TaskVerifier] Task ${state.currentTaskIndex + 1} verification failed (${verificationResult.confidenceScore}% confidence)`
        );

        // Mark task as incomplete and add verification context to memory
        const updatedTasks = [...state.tasks];
        updatedTasks[state.tasks.length - 1].status = 'failed';
        updatedTasks[state.tasks.length - 1].task_verification =
          verificationResult.reasoning;

        return {
          messages: [verificationMessage],
          last_node: VerifierNode.TASK_VERIFIER,
          tasks: updatedTasks,
          currentTaskIndex: state.currentTaskIndex,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
    } catch (error: any) {
      logger.error(`[TaskVerifier] Task verification failed: ${error.message}`);
      return handleNodeError(
        error,
        'TASK_VERIFIER',
        state,
        'Task verification process failed'
      );
    }
  }

  private taskVerifierRouter(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): VerifierNode {
    const lastMessage = state.messages[state.messages.length - 1];

    if (lastMessage?.additional_kwargs?.taskCompleted === true) {
      logger.debug(
        '[TaskVerifierRouter] Task verified as complete, routing to success handler'
      );
      return VerifierNode.TASK_SUCCESS_HANDLER;
    } else {
      logger.debug(
        '[TaskVerifierRouter] Task verification failed, routing to failure handler'
      );
      return VerifierNode.TASK_FAILURE_HANDLER;
    }
  }

  private async taskSuccessHandler(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_node: VerifierNode;
    currentTaskIndex?: number;
  }> {
    logger.info('[TaskSuccessHandler] Processing successful task completion');

    const successMessage = new AIMessageChunk({
      content: `Task ${state.currentTaskIndex + 1} successfully completed and verified.`,
      additional_kwargs: {
        from: 'task_success_handler',
        final: false,
        taskSuccess: true,
      },
    });

    // Move to next task
    const nextTaskIndex = state.currentTaskIndex + 1;
    const hasMoreTasks = nextTaskIndex < state.tasks.length;

    return {
      messages: [successMessage],
      last_node: VerifierNode.TASK_SUCCESS_HANDLER,
      currentTaskIndex: hasMoreTasks ? nextTaskIndex : state.currentTaskIndex,
    };
  }

  private async taskFailureHandler(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_node: VerifierNode;
    retry?: number;
  }> {
    logger.info('[TaskFailureHandler] Processing failed task verification');

    const failureMessage = new AIMessageChunk({
      content: `Task ${state.currentTaskIndex + 1} verification failed. Returning to planning phase.`,
      additional_kwargs: {
        from: 'task_failure_handler',
        final: false,
        taskSuccess: false,
        needsReplanning: true,
      },
    });

    return {
      messages: [failureMessage],
      last_node: VerifierNode.TASK_FAILURE_HANDLER,
      retry: state.retry + 1,
    };
  }

  private task_updater(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): {
    tasks?: TaskType[];
    currentTaskIndex?: number;
    last_node?: VerifierNode;
    memories?: Memories;
  } {
    try {
      if (!state.tasks || state.tasks.length === 0) {
        throw new Error('[Task Updater] No tasks found in the state.');
      }

      const currentTask = state.tasks[state.tasks.length - 1];
      if (!currentTask) {
        throw new Error(
          `[Task Updater] No current task found at index ${state.currentTaskIndex}.`
        );
      }

      // Check if we have task verification context from the previous message
      const lastMessage = state.messages[state.messages.length - 1];
      let updatedMemories = state.memories;

      if (
        lastMessage &&
        lastMessage.additional_kwargs?.from === 'task_verifier'
      ) {
        STMManager.addMemory(state.memories.stm, [lastMessage], uuidv4());
        logger.info(
          `[Task Updater] Verfication ${lastMessage.additional_kwargs.taskCompleted ? 'successfull' : 'failed'}`
        );
      }
      // If task is completed and verified successfully, move to next task
      if (
        currentTask.status === 'completed' &&
        lastMessage?.additional_kwargs?.taskCompleted === true
      ) {
        logger.info(
          `[Task Updater] Moving from completed task ${state.currentTaskIndex} to task ${state.currentTaskIndex + 1}`
        );
        return {
          tasks: state.tasks,
          currentTaskIndex: state.currentTaskIndex,
          last_node: VerifierNode.TASK_UPDATER,
          memories: updatedMemories,
        };
      }

      // If task verification failed, mark task as failed and keep current index for retry
      if (
        currentTask.status === 'completed' &&
        lastMessage?.additional_kwargs?.taskCompleted === false
      ) {
        const updatedTasks = [...state.tasks];
        updatedTasks[state.currentTaskIndex].status = 'failed';

        logger.warn(
          `[Task Updater] Task ${state.currentTaskIndex + 1} verification failed, marked as failed for retry`
        );
        return {
          tasks: updatedTasks,
          currentTaskIndex: state.currentTaskIndex, // Keep same index for retry
          last_node: VerifierNode.TASK_UPDATER,
          memories: updatedMemories,
        };
      }

      // Default case - no change
      return {
        last_node: VerifierNode.TASK_UPDATER,
        memories: updatedMemories,
      };
    } catch (error) {
      logger.error(`[Task Updater] Error: ${error}`);
      return { last_node: VerifierNode.TASK_UPDATER };
    }
  }

  public getVerifierGraph() {
    return this.graph;
  }

  public createTaskVerifierGraph() {
    const verifier_subgraph = new StateGraph(
      GraphState,
      GraphConfigurableAnnotation
    )
      .addNode(VerifierNode.TASK_VERIFIER, this.verifyTaskCompletion.bind(this))
      .addNode(
        VerifierNode.TASK_SUCCESS_HANDLER,
        this.taskSuccessHandler.bind(this)
      )
      .addNode(
        VerifierNode.TASK_FAILURE_HANDLER,
        this.taskFailureHandler.bind(this)
      )
      .addNode(VerifierNode.TASK_UPDATER, this.task_updater.bind(this))
      .addEdge(START, VerifierNode.TASK_VERIFIER)
      .addConditionalEdges(
        VerifierNode.TASK_VERIFIER,
        this.taskVerifierRouter.bind(this)
      )
      .addEdge(VerifierNode.TASK_SUCCESS_HANDLER, VerifierNode.TASK_UPDATER)
      .addEdge(VerifierNode.TASK_FAILURE_HANDLER, VerifierNode.TASK_UPDATER)
      .addEdge(VerifierNode.TASK_UPDATER, END);

    this.graph = verifier_subgraph.compile();
  }
}
