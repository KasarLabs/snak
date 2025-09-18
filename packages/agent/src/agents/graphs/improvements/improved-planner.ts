/**
 * Improved Task Planner
 * Creates more logical task granularity and prevents task duplication
 */

import { TaskType } from '../../../shared/types/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface TaskTemplate {
  type: 'compound' | 'atomic';
  name: string;
  description: string;
  requiredTools: string[];
  followupTasks?: string[];
  maxSteps?: number;
}

export interface WorkflowStep {
  description: string;
  tools: string[];
  validation?: string;
  continueCondition?: string;
}

export interface TaskWorkflow {
  name: string;
  goal: string;
  steps: WorkflowStep[];
  completionCriteria: string[];
}

export class ImprovedTaskPlanner {
  private static readonly TASK_TEMPLATES: Record<string, TaskTemplate> = {
    device_app_interaction: {
      type: 'compound',
      name: 'Device App Interaction',
      description: 'Complete workflow for device setup and app interaction',
      requiredTools: [
        'mobile_list_available_devices',
        'mobile_use_device',
        'mobile_launch_app',
      ],
      maxSteps: 8,
    },
    search_and_interact: {
      type: 'compound',
      name: 'Search and Interact',
      description: 'Search for content and interact with results',
      requiredTools: [
        'mobile_click_on_screen_at_coordinates',
        'mobile_type_keys',
        'mobile_list_elements_on_screen',
      ],
      maxSteps: 6,
    },
    verification_task: {
      type: 'atomic',
      name: 'Verification Task',
      description: 'Verify current state and check for completion',
      requiredTools: ['mobile_list_elements_on_screen'],
      maxSteps: 2,
    },
  };

  private static readonly WORKFLOW_PATTERNS: Record<string, TaskWorkflow> = {
    youtube_video_interaction: {
      name: 'YouTube Video Interaction',
      goal: 'Find and interact with a specific YouTube video',
      steps: [
        {
          description: 'Set up device and launch YouTube app',
          tools: [
            'mobile_list_available_devices',
            'mobile_use_default_device',
            'mobile_list_apps',
            'mobile_launch_app',
          ],
          validation: 'YouTube app is successfully launched and visible',
          continueCondition:
            'YouTube interface elements are detected on screen',
        },
        {
          description: 'Search for the target video',
          tools: ['mobile_click_on_screen_at_coordinates', 'mobile_type_keys'],
          validation: 'Search query is submitted and results are loading',
          continueCondition: 'Search results are displayed',
        },
        {
          description: 'Locate and interact with the target video',
          tools: [
            'mobile_list_elements_on_screen',
            'mobile_click_on_screen_at_coordinates',
          ],
          validation: 'Target video is found and interaction is completed',
          continueCondition:
            'Video page is loaded or interaction is successful',
        },
      ],
      completionCriteria: [
        'Target video has been found',
        'Required interaction (like, view, etc.) has been completed',
        'Success confirmation is visible or received',
      ],
    },
  };

  public static createOptimizedTask(
    userGoal: string,
    availableTools: string[]
  ): TaskType {
    // Detect workflow pattern
    const workflow = this.detectWorkflowPattern(userGoal, availableTools);

    if (workflow) {
      return this.createWorkflowTask(workflow, userGoal);
    }

    // Fallback to traditional task creation with improvements
    return this.createImprovedTask(userGoal, availableTools);
  }

  private static detectWorkflowPattern(
    userGoal: string,
    availableTools: string[]
  ): TaskWorkflow | null {
    const goal = userGoal.toLowerCase();

    // YouTube video interaction pattern
    if (
      goal.includes('youtube') &&
      (goal.includes('video') || goal.includes('like'))
    ) {
      return this.WORKFLOW_PATTERNS.youtube_video_interaction;
    }

    // Add more patterns as needed
    return null;
  }

  private static createWorkflowTask(
    workflow: TaskWorkflow,
    userGoal: string
  ): TaskType {
    // Create a comprehensive plan that includes all workflow steps
    const detailedPlan = workflow.steps
      .map(
        (step, index) =>
          `${index + 1}. ${step.description}\n   - Tools: ${step.tools.join(', ')}\n   - Success: ${step.validation}`
      )
      .join('\n');

    return {
      id: uuidv4(),
      text: `${workflow.goal}: ${userGoal}`,
      reasoning: `This is a compound task that requires multiple coordinated steps. Using the ${workflow.name} workflow pattern to ensure logical progression and avoid redundant actions.`,
      plan: detailedPlan,
      criticism: `Must complete each step fully before moving to the next. Avoid repeating actions unnecessarily.`,
      speak: `I'll complete this task using a systematic workflow approach with ${workflow.steps.length} main steps.`,
      steps: [],
      status: 'pending' as const,
    };
  }

  private static createImprovedTask(
    userGoal: string,
    availableTools: string[]
  ): TaskType {
    // Analyze goal complexity
    const complexity = this.analyzeTaskComplexity(userGoal, availableTools);

    // Create more detailed reasoning based on complexity
    const reasoning = this.generateImprovedReasoning(
      userGoal,
      complexity,
      availableTools
    );

    // Create step-by-step plan
    const plan = this.generateStepByStepPlan(userGoal, availableTools);

    return {
      id: uuidv4(),
      text: userGoal,
      reasoning,
      plan,
      criticism:
        'I should execute each step methodically and avoid repeating actions. I will use end_task only when the objective is truly complete.',
      speak: `I'll approach this systematically by breaking it down into logical steps.`,
      steps: [],
      status: 'pending' as const,
    };
  }

  private static analyzeTaskComplexity(
    userGoal: string,
    availableTools: string[]
  ): 'simple' | 'moderate' | 'complex' {
    const goalWords = userGoal.toLowerCase().split(' ');
    const actionWords = [
      'find',
      'search',
      'like',
      'click',
      'type',
      'open',
      'launch',
      'navigate',
    ];
    const actionCount = goalWords.filter((word) =>
      actionWords.includes(word)
    ).length;

    if (actionCount <= 1) return 'simple';
    if (actionCount <= 3) return 'moderate';
    return 'complex';
  }

  private static generateImprovedReasoning(
    userGoal: string,
    complexity: string,
    availableTools: string[]
  ): string {
    const baseReasoning = `This is a ${complexity} task that requires careful execution.`;

    const toolAnalysis =
      availableTools.length > 5
        ? 'I have access to a comprehensive set of tools for mobile interaction.'
        : 'I have basic tools available and should use them efficiently.';

    const strategyNote =
      complexity === 'complex'
        ? "I'll break this into smaller, sequential steps and validate progress at each stage."
        : "I'll execute this step-by-step, ensuring each action contributes to the goal.";

    return `${baseReasoning} ${toolAnalysis} ${strategyNote}`;
  }

  private static generateStepByStepPlan(
    userGoal: string,
    availableTools: string[]
  ): string {
    // Basic plan structure based on common mobile interaction patterns
    const steps = [
      '1. Assess current state and available resources',
      '2. Execute necessary setup or navigation actions',
      '3. Perform the main task actions',
      '4. Verify completion and confirm success',
    ];

    return steps.join('\n');
  }

  /**
   * Prevents creation of duplicate or redundant tasks
   */
  public static shouldCreateNewTask(
    existingTasks: TaskType[],
    proposedGoal: string
  ): boolean {
    // Check for similar existing tasks
    const similarity = existingTasks.some(
      (task) =>
        this.calculateSimilarity(
          task.text.toLowerCase(),
          proposedGoal.toLowerCase()
        ) > 0.8
    );

    return !similarity;
  }

  private static calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}
