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
import { TaskVerifierNode } from '../../../shared/enums/agent.enum.js';
import {
  getCurrentTask,
  handleNodeError,
  hasReachedMaxSteps,
  isValidConfiguration,
  isValidConfigurationType,
} from '../utils/graph.utils.js';
import { STMManager } from '@lib/memory/index.js';
import { v4 as uuidv4 } from 'uuid';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  TASK_VERIFICATION_CONTEXT_PROMPT,
  TASK_VERIFIER_SYSTEM_PROMPT,
} from '@prompts/agents/task-verifier.prompts.js';
import {
  TaskVerificationSchema,
  TaskVerificationSchemaType,
} from '@schemas/graph.schemas.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { formatSTMToXML } from '../parser/memory/stm-parser.js';
// Task verification schema

export class TaskVerifierGraph {
  private model: BaseChatModel;
  private graph: any;
  private readonly toolsList: DynamicStructuredTool<AnyZodObject>[] = [];
  constructor(model: BaseChatModel) {
    this.model = model;
  }

  private async verifyTaskCompletion(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<
    | {
        messages: BaseMessage[];
        last_node: TaskVerifierNode;
        tasks?: TaskType[];
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
          `[TaskVerifier] Memory sub-graph limit reached (${state.currentGraphStep}), routing to END`
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
          last_node: TaskVerifierNode.TASK_VERIFIER,
          tasks: state.tasks,
          currentGraphStep: state.currentGraphStep + 1,
          error: null,
        };
      }

      const structuredModel = this.model.withStructuredOutput(
        TaskVerificationSchema
      );

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          process.env.DEV_PROMPT === 'true'
            ? TASK_VERIFIER_SYSTEM_PROMPT
            : agentConfig.prompts.task_verifier_prompt,
        ],
        ['user', TASK_VERIFICATION_CONTEXT_PROMPT],
      ]);

      const executedSteps = formatSTMToXML(state.memories.stm);

      logger.info('[TaskVerifier] Starting task completion verification');
      const formattedPrompt = await prompt.formatMessages({
        originalTask: currentTask.task?.directive,
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
          `[TaskVerifier] Task ${currentTask.id} verified as complete (${verificationResult.confidenceScore}% confidence)`
        );
        const updatedTasks = [...state.tasks];
        updatedTasks[state.tasks.length - 1].status = 'completed';
        updatedTasks[state.tasks.length - 1].task_verification =
          verificationResult.reasoning;

        return {
          messages: [verificationMessage],
          last_node: TaskVerifierNode.TASK_VERIFIER,
          tasks: updatedTasks,
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
          `[TaskVerifier] Task ${currentTask.id} verification failed (${verificationResult.confidenceScore}% confidence)`
        );

        // Mark task as incomplete and add verification context to memory
        const updatedTasks = [...state.tasks];
        updatedTasks[state.tasks.length - 1].status = 'failed';
        updatedTasks[state.tasks.length - 1].task_verification =
          verificationResult.reasoning;

        return {
          messages: [verificationMessage],
          last_node: TaskVerifierNode.TASK_VERIFIER,
          tasks: updatedTasks,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }
    } catch (error: any) {
      logger.error(`[TaskVerifier] Task verification failed: ${error.message}`);
      return handleNodeError(
        GraphErrorTypeEnum.VALIDATION_ERROR,
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
  ): TaskVerifierNode {
    const lastMessage = state.messages[state.messages.length - 1];

    if (lastMessage?.additional_kwargs?.taskCompleted === true) {
      logger.debug(
        '[TaskVerifierRouter] Task verified as complete, routing to success handler'
      );
      return TaskVerifierNode.TASK_SUCCESS_HANDLER;
    } else {
      logger.debug(
        '[TaskVerifierRouter] Task verification failed, routing to failure handler'
      );
      return TaskVerifierNode.TASK_FAILURE_HANDLER;
    }
  }

  private async taskSuccessHandler(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_node: TaskVerifierNode;
  }> {
    logger.info('[TaskSuccessHandler] Processing successful task completion');
    const currentTask = getCurrentTask(state.tasks);
    const successMessage = new AIMessageChunk({
      content: `Task ${currentTask.id} successfully completed and verified.`,
      additional_kwargs: {
        from: 'task_success_handler',
        final: false,
        taskSuccess: true,
      },
    });

    return {
      messages: [successMessage],
      last_node: TaskVerifierNode.TASK_SUCCESS_HANDLER,
    };
  }

  private async taskFailureHandler(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): Promise<{
    messages: BaseMessage[];
    last_node: TaskVerifierNode;
    retry?: number;
  }> {
    logger.info('[TaskFailureHandler] Processing failed task verification');
    const currentTask = getCurrentTask(state.tasks);
    const failureMessage = new AIMessageChunk({
      content: `Task ${currentTask.id} verification failed. Returning to planning phase.`,
      additional_kwargs: {
        from: 'task_failure_handler',
        final: false,
        taskSuccess: false,
        needsReplanning: true,
      },
    });

    return {
      messages: [failureMessage],
      last_node: TaskVerifierNode.TASK_FAILURE_HANDLER,
      retry: state.retry + 1,
    };
  }

  private task_updater(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): {
    tasks?: TaskType[];
    last_node?: TaskVerifierNode;
    memories?: Memories;
  } {
    try {
      if (!state.tasks || state.tasks.length === 0) {
        throw new Error('[Task Updater] No tasks found in the state.');
      }

      const currentTask = getCurrentTask(state.tasks);
      if (!currentTask) {
        throw new Error(`[Task Updater] No current task found.`);
      }

      // Check if we have task verification context from the previous message
      const lastMessage = state.messages[state.messages.length - 1];
      let updatedMemories = state.memories;

      if (
        lastMessage &&
        lastMessage.additional_kwargs?.from === 'task_verifier'
      ) {
        STMManager.addMemory(
          state.memories.stm,
          [lastMessage],
          currentTask.id,
          uuidv4() // New step ID for the verification message
        );
        logger.info(
          `[Task Updater] Verification ${lastMessage.additional_kwargs.taskCompleted ? 'successful' : 'failed'}`
        );
      }
      // If task is completed and verified successfully, move to next task
      if (
        currentTask.status === 'completed' &&
        lastMessage?.additional_kwargs?.taskCompleted === true
      ) {
        logger.info(
          `[Task Updater] Moving from completed task ${currentTask.id} to next task`
        );
        return {
          tasks: state.tasks,
          last_node: TaskVerifierNode.TASK_UPDATER,
          memories: updatedMemories,
        };
      }

      // If task verification failed, mark task as failed and keep current index for retry
      if (
        currentTask.status === 'completed' &&
        lastMessage?.additional_kwargs?.taskCompleted === false
      ) {
        const updatedTasks = [...state.tasks];
        updatedTasks[state.tasks.length - 1].status = 'failed';

        logger.warn(
          `[Task Updater] Task ${currentTask.id} verification failed, marked as failed for retry`
        );
        return {
          tasks: updatedTasks,
          last_node: TaskVerifierNode.TASK_UPDATER,
          memories: updatedMemories,
        };
      }

      // Default case - no change
      return {
        last_node: TaskVerifierNode.TASK_UPDATER,
        memories: updatedMemories,
      };
    } catch (error) {
      logger.error(`[Task Updater] Error: ${error}`);
      return { last_node: TaskVerifierNode.TASK_UPDATER };
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
      .addNode(
        TaskVerifierNode.TASK_VERIFIER,
        this.verifyTaskCompletion.bind(this)
      )
      .addNode(
        TaskVerifierNode.TASK_SUCCESS_HANDLER,
        this.taskSuccessHandler.bind(this)
      )
      .addNode(
        TaskVerifierNode.TASK_FAILURE_HANDLER,
        this.taskFailureHandler.bind(this)
      )
      .addNode(TaskVerifierNode.TASK_UPDATER, this.task_updater.bind(this))
      .addEdge(START, TaskVerifierNode.TASK_VERIFIER)
      .addConditionalEdges(
        TaskVerifierNode.TASK_VERIFIER,
        this.taskVerifierRouter.bind(this)
      )
      .addEdge(
        TaskVerifierNode.TASK_SUCCESS_HANDLER,
        TaskVerifierNode.TASK_UPDATER
      )
      .addEdge(
        TaskVerifierNode.TASK_FAILURE_HANDLER,
        TaskVerifierNode.TASK_UPDATER
      )
      .addEdge(TaskVerifierNode.TASK_UPDATER, END);

    this.graph = verifier_subgraph.compile();
  }
}
