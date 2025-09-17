import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { START, StateGraph, Command, END } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AnyZodObject, z } from 'zod';
import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { ModelSelector } from '../../operators/modelSelector.js';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  TaskType,
  StepType,
  TasksType,
  validatorResponse,
  MemoryItem,
  GraphErrorType,
} from '../../../shared/types/index.js';
import {
  VerifierNode,
  ExecutionMode,
} from '../../../shared/enums/agent-modes.enum.js';
import { handleNodeError } from '../utils/graph-utils.js';
import { PromptGenerator } from '../manager/prompts/prompt-generator-manager.js';
import { headerPromptStandard } from '@prompts/agents/header.prompt.js';
import { PERFORMANCE_EVALUATION_PROMPT } from '@prompts/agents/performance-evaluation.prompt.js';
import { CORE_AGENT_PROMPT } from '@prompts/agents/core.prompts.js';
import { stm_format_for_history } from '../parser/memory/stm-parser.js';

// Task verification schema
export const TaskVerificationSchema = z.object({
  taskCompleted: z
    .boolean()
    .describe('true if the task was successfully completed, false otherwise'),
  confidenceScore: z
    .number()
    .min(0)
    .max(100)
    .describe('Confidence level (0-100) in the completion assessment'),
  reasoning: z
    .string()
    .describe('Detailed reasoning for the completion assessment'),
  missingElements: z
    .array(z.string())
    .describe('List of missing elements or requirements if task is incomplete'),
  nextActions: z
    .array(z.string())
    .optional()
    .describe('Suggested next actions if task needs to continue'),
});

export type TaskVerificationResult = z.infer<typeof TaskVerificationSchema>;

// Task verification prompts
const TASK_VERIFICATION_SYSTEM_PROMPT = `You are a task verification specialist. Your role is to objectively assess whether a task has been truly completed based on:

1. ORIGINAL TASK REQUIREMENTS: Compare the initial task goal with what was actually accomplished
2. EXECUTION STEPS ANALYSIS: Review all executed steps and their results
3. TOOL OUTPUTS EVALUATION: Analyze the actual outputs and results from tool executions
4. COMPLETENESS CHECK: Identify any missing elements or unfulfilled requirements

ASSESSMENT CRITERIA:
- Only the Task objectives must be fully met, not partially completed
- All critical requirements must be addressed
- No essential steps should be missing or failed

Be fair in your assessment. A task is only complete if the original objectives are genuinely fulfilled.`;

const TASK_VERIFICATION_CONTEXT_PROMPT = `Verify task completion for:

ORIGINAL TASK GOAL:
{originalTask}

EXECUTED STEPS AND RESULTS:
{executedSteps}

Assess whether this task is truly complete or requires additional work.`;
export class TaskVerifierGraph {
  private modelSelector: ModelSelector | null;
  private graph: any;

  constructor(modelSelector: ModelSelector | null) {
    this.modelSelector = modelSelector;
  }

  private buildPromptGenerator(): PromptGenerator {
    const prompt = new PromptGenerator();
    prompt.addHeader(headerPromptStandard);

    // Add verification-specific constraints
    prompt.addConstraints([
      'OBJECTIVE_ANALYSIS_REQUIRED',
      'EVIDENCE_BASED_ASSESSMENT',
      'STRICT_COMPLETION_CRITERIA',
      'DETAILED_REASONING_MANDATORY',
      'JSON_RESPONSE_MANDATORY',
    ]);

    prompt.addPerformanceEvaluation(PERFORMANCE_EVALUATION_PROMPT);
    prompt.setActiveResponseFormat('task_verifier');

    return prompt;
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
      if (!this.modelSelector) {
        throw new Error('ModelSelector is required for task verification');
      }

      const model = this.modelSelector.getModels()['fast'];
      if (!model) {
        throw new Error('Fast model not available for task verification');
      }

      const currentTask = state.tasks[state.tasks.length - 1];
      if (!currentTask) {
        throw new Error('No current task to verify');
      }

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

      const prompts = this.buildPromptGenerator();
      const structuredModel = model.withStructuredOutput(
        TaskVerificationSchema
      );

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', TASK_VERIFICATION_SYSTEM_PROMPT],
        ['user', TASK_VERIFICATION_CONTEXT_PROMPT],
      ]);

      const executedSteps = stm_format_for_history(state.memories.stm);
      const lastStep = currentTask.steps[currentTask.steps.length - 1];

      const formattedResponseFormat = JSON.stringify(
        prompts.getResponseFormat(),
        null,
        4
      );

      logger.info('[TaskVerifier] Starting task completion verification');
      const formattedPrompt = await prompt.formatMessages({
        originalTask: currentTask.task.directive,
        taskReasoning: currentTask.thought.reasoning,
        executedSteps,
        header: prompts.generateNumberedList(prompts.getHeader()),
        constraints: prompts.generateNumberedList(
          prompts.getConstraints(),
          'constraint'
        ),
        performance_evaluation: prompts.generateNumberedList(
          prompts.getPerformanceEvaluation(),
          'performance evaluation'
        ),
        output_format: formattedResponseFormat,
      });
      const verificationResult = (await structuredModel.invoke(
        formattedPrompt
      )) as TaskVerificationResult;

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
        updatedTasks[state.currentTaskIndex].status = 'completed';

        return {
          messages: [verificationMessage],
          last_node: VerifierNode.TASK_VERIFIER,
          tasks: state.tasks,
          currentTaskIndex: state.currentTaskIndex,
          currentGraphStep: state.currentGraphStep + 1,
          
          error: verificationMessage.additional_kwargs.taskCompleted
            ? null
            : {
                type: 'validation_error',
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
        updatedTasks[state.currentTaskIndex].status = 'failed';

        // Add verification failure context to short-term memory
        const verificationContext = `TASK VERIFICATION FAILED:
Task: ${currentTask.thought.text}
Reason: ${verificationResult.reasoning}
Missing Elements: ${verificationResult.missingElements.join(', ')}
Suggested Actions: ${verificationResult.nextActions?.join(', ') || 'None specified'}`;
        console.log('AiMessage : ', [verificationMessage].length); // Push task to state

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
      .addEdge(START, VerifierNode.TASK_VERIFIER)
      .addConditionalEdges(
        VerifierNode.TASK_VERIFIER,
        this.taskVerifierRouter.bind(this)
      )
      .addEdge(VerifierNode.TASK_SUCCESS_HANDLER, END)
      .addEdge(VerifierNode.TASK_FAILURE_HANDLER, END);

    this.graph = verifier_subgraph.compile();
  }
}
