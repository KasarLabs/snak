import { Memories } from '@stypes/memory.types.js';
import { ToolCall } from '@stypes/tools.types.js';
import {
  AUTONOMOUS_AI_CONSTRAINTS,
  getConstraint,
  getConstraintsByCategory,
  CONSTRAINT_CATEGORIES,
} from '../../../../shared/prompts/agents/constraints-map.js';
import { logger } from '@snakagent/core';

/**
 * A module for generating custom prompt strings.
 */

interface ResponseFormatExecutorReAct {
  thoughts: {
    text: string;
    reasoning: string;
    plan: string;
    criticism: string;
    speak: string;
  };
  Tools: ToolCall;
}

interface ResponseFormatTaskInitializer {
  tasks: {
    text: string;
    reasoning: string;
    criticism: string;
    speak: string;
  };
}
interface ResponseFormats {
  [key: string]: ResponseFormatExecutorReAct | ResponseFormatTaskInitializer;
}

/**
 * A class for generating custom prompt strings based on constraints, tools,
 * resources, and performance evaluations.
 */
export class PromptGenerator {
  private header: string[];
  private instructions: string[];
  private goals: string[];
  private historyInstructions: string[];
  private memory: Memories;
  private constraints: string[];
  private tools: string[];
  private resources: string[];
  private performanceEvaluation: string[];
  private responseFormats: ResponseFormats;
  private activeFormatKey: string;

  /**
   * Initialize the PromptGenerator object with empty lists of constraints,
   * tools, resources, and performance evaluations.
   */
  constructor() {
    this.header = [];
    this.instructions = [];
    this.goals = [];
    this.historyInstructions = [];
    this.memory = {
      stm: { items: [], maxSize: 10, head: 0, size: 0, totalInserted: 0 },
      ltm: { items: [], episodic_size: 0, semantic_size: 0, merge_size: 0 },
      isProcessing: false,
    };
    this.constraints = [];
    this.tools = [];
    this.resources = [];
    this.performanceEvaluation = [];
    this.responseFormats = {};
    this.activeFormatKey = 'default';

    // Initialize with default format
    this.addResponseFormat('executor', {
      thoughts: {
        text: 'thought',
        reasoning: 'reasoning',
        plan: '- short bulleted\n- list that conveys\n- long-term plan',
        criticism: 'constructive self-criticism',
        speak: 'thoughts summary to say to user',
      },
      Tools: {
        name: 'Tools name',
        args: { 'arg name': 'value' },
      },
    });

    this.addResponseFormat('task_initializer', {
      tasks: {
        text: 'thought',
        reasoning: 'short reasoning about the goal',
        criticism: 'constructive self-criticism',
        speak: 'thoughts goal summary to say to executor',
      },
    });
  }

  /**
   * Add a new response format to the collection.
   * @param key - The identifier for this response format.
   * @param format - The response format object.
   */
  addResponseFormat(key: string, format: any): void {
    this.responseFormats[key] = format;
  }

  /**
   * Set the active response format to use.
   * @param key - The identifier of the response format to make active.
   * @throws Error if the specified key doesn't exist.
   */
  setActiveResponseFormat(key: string): void {
    if (!this.responseFormats[key]) {
      throw new Error(`Response format with key "${key}" does not exist`);
    }
    this.activeFormatKey = key;
  }

  /**
   * Get a response format by key.
   * @param key - The identifier of the response format.
   * @returns The response format object or undefined if not found.
   */
  getResponseFormat(): any {
    return this.responseFormats[this.activeFormatKey];
  }

  /**
   * Get all response format keys.
   * @returns Array of response format keys.
   */
  getResponseFormatKeys(): string[] {
    return Object.keys(this.responseFormats);
  }

  /**
   * Remove a response format from the collection.
   * @param key - The identifier of the response format to remove.
   * @throws Error if trying to remove the active format or the default format.
   */
  removeResponseFormat(key: string): void {
    if (key === 'default') {
      throw new Error('Cannot remove the default response format');
    }
    if (key === this.activeFormatKey) {
      throw new Error(
        'Cannot remove the active response format. Please set a different format as active first.'
      );
    }
    delete this.responseFormats[key];
  }

  /**
   * Add a header item to the header list.
   * @param header - The header item to be added.
   */
  addHeader(header: string): void {
    this.header.push(header);
  }

  /**
   * Add an instruction to the instructions list.
   * @param instruction - The instruction to be added.
   */
  addInstruction(instruction: string): void {
    this.instructions.push(instruction);
  }

  /**
   * Add a goal to the goals list.
   * @param goal - The goal to be added.
   */
  addGoal(goal: string): void {
    this.goals.push(goal);
  }

  /**
   * Add a history instruction to the history instructions list.
   * @param historyInstruction - The history instruction to be added.
   */
  addHistoryInstruction(historyInstruction: string): void {
    this.historyInstructions.push(historyInstruction);
  }

  /**
   * Set the memory object.
   * @param memory - The memory object to be set.
   */
  setMemory(memory: Memories): void {
    this.memory = memory;
  }

  /**
   * Add a constraint to the constraints list.
   * @param constraint - The constraint to be added (can be a string or a constraint key from the map).
   */
  addConstraint(constraint: keyof typeof AUTONOMOUS_AI_CONSTRAINTS): void {
    if (
      typeof constraint === 'string' &&
      constraint in AUTONOMOUS_AI_CONSTRAINTS
    ) {
      // If it's a key from the constraints map, get the actual constraint text
      this.constraints.push(
        getConstraint(constraint as keyof typeof AUTONOMOUS_AI_CONSTRAINTS)
      );
    } else {
      logger.warn(`Constraint "${constraint}" not found in constraints map.`);
    }
  }

  /**
   * Add multiple constraints by category.
   * @param category - The category of constraints to add.
   */
  addConstraintsByCategory(category: keyof typeof CONSTRAINT_CATEGORIES): void {
    const categoryConstraints = getConstraintsByCategory(category);
    categoryConstraints.forEach((constraint: string) =>
      this.constraints.push(constraint)
    );
  }

  /**
   * Add all available constraints.
   */
  addAllConstraints(): void {
    Object.values(AUTONOMOUS_AI_CONSTRAINTS).forEach((constraint: string) =>
      this.constraints.push(constraint)
    );
  }

  /**
   * Add a Tools to the tools list with a label, name, and optional arguments.
   * @param ToolsLabel - The label of the Tools.
   * @param ToolsName - The name of the Tools.
   * @param args - A dictionary containing argument names and their values. Defaults to empty object.
   */
  addTools(ToolsInfo: string): void {
    this.tools.push(ToolsInfo);
  }

  /**
   * Generate a formatted string representation of a Tools.
   * @param Tools - A dictionary containing Tools information.
   * @returns The formatted Tools string.
   */
  // private generatetoolstring(Tools: string): string {
  //   const argsString = Object.entries(Tools.args)
  //     .map(([key, value]) => `"${key}": "${value}"`)
  //     .join(', ');
  //   return `${Tools.label}: "${Tools.name}", args: ${argsString}`;
  // }

  /**
   * Add a resource to the resources list.
   * @param resource - The resource to be added.
   */
  addResource(resource: string): void {
    this.resources.push(resource);
  }

  /**
   * Add a performance evaluation item to the performance_evaluation list.
   * @param evaluation - The evaluation item to be added.
   */
  addPerformanceEvaluation(evaluation: string): void {
    this.performanceEvaluation.push(evaluation);
  }

  /**
   * Get the header array.
   * @returns The header array.
   */
  getHeader(): string[] {
    return this.header;
  }

  /**
   * Get the instructions array.
   * @returns The instructions array.
   */
  getInstructions(): string[] {
    return this.instructions;
  }

  /**
   * Get the goals array.
   * @returns The goals array.
   */
  getGoals(): string[] {
    return this.goals;
  }

  /**
   * Get the history instructions array.
   * @returns The history instructions array.
   */
  getHistoryInstructions(): string[] {
    return this.historyInstructions;
  }

  /**
   * Get the memory object.
   * @returns The memory object.
   */
  getMemory(): Memories {
    return this.memory;
  }

  /**
   * Get the constraints array.
   * @returns The constraints array.
   */
  getConstraints(): string[] {
    return this.constraints;
  }

  /**
   * Get the tools array.
   * @returns The tools array.
   */
  getTools(): string[] {
    return this.tools;
  }

  /**
   * Get the resources array.
   * @returns The resources array.
   */
  getResources(): string[] {
    return this.resources;
  }

  /**
   * Get the performance evaluation array.
   * @returns The performance evaluation array.
   */
  getPerformanceEvaluation(): string[] {
    return this.performanceEvaluation;
  }

  /**
   * Get all response formats.
   * @returns The response formats object.
   */
  getResponseFormats(): ResponseFormats {
    return this.responseFormats;
  }

  /**
   * Get the active format key.
   * @returns The active format key.
   */
  getActiveFormatKey(): string {
    return this.activeFormatKey;
  }

  /**
   * Generate a numbered list from given items based on the item_type.
   * @param items - A list of items to be numbered.
   * @param itemType - The type of items in the list. Defaults to 'list'.
   * @returns The formatted numbered list.
   */
  public generateNumberedList(
    items: any[],
    itemType: string = 'list'
  ): string {
    return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  }

  /**
   * Generate a prompt string based on the constraints, tools, resources,
   * and performance evaluations.
   * @param formatKey - Optional specific response format to use. If not provided, uses the active format.
   * @returns The generated prompt string.
   */
  generatePromptString(formatKey?: string): string {
    const keyToUse = formatKey || this.activeFormatKey;
    const responseFormat = this.responseFormats[keyToUse];

    if (!responseFormat) {
      throw new Error(`Response format with key "${keyToUse}" does not exist`);
    }

    const formattedResponseFormat = JSON.stringify(responseFormat, null, 4);

    let promptParts: string[] = [];

    // Add header if present
    if (this.header.length > 0) {
      promptParts.push(`Header:\n${this.generateNumberedList(this.header)}\n`);
    }

    // Add instructions if present
    if (this.instructions.length > 0) {
      promptParts.push(
        `Instructions:\n${this.generateNumberedList(this.instructions)}\n`
      );
    }

    // Add goals if present
    if (this.goals.length > 0) {
      promptParts.push(`Goals:\n${this.generateNumberedList(this.goals)}\n`);
    }

    // Add history instructions if present
    if (this.historyInstructions.length > 0) {
      promptParts.push(
        `History Instructions:\n${this.generateNumberedList(this.historyInstructions)}\n`
      );
    }

    // Add memory if present
    if (
      this.memory &&
      (this.memory.stm.size > 0 || this.memory.ltm.items.length > 0)
    ) {
      let memorySection = 'Memory:\n';
      if (this.memory.stm.size > 0) {
        const stmItems = this.memory.stm.items
          .filter((item) => item !== null)
          .map((item) => JSON.stringify(item));
        memorySection += `Short Term:\n${this.generateNumberedList(stmItems)}\n`;
      }
      if (this.memory.ltm.items.length > 0) {
        const ltmItems = this.memory.ltm.items.map((item) =>
          JSON.stringify(item)
        );
        memorySection += `Long Term:\n${this.generateNumberedList(ltmItems)}\n`;
      }
      promptParts.push(memorySection);
    }

    // Add constraints if present
    if (this.constraints.length > 0) {
      promptParts.push(
        `Constraints:\n${this.generateNumberedList(this.constraints)}\n`
      );
    }

    // Add tools if present
    if (this.tools.length > 0) {
      promptParts.push(`Tools:\n${this.generateNumberedList(this.tools)}\n`);
    }

    // Add resources if present
    if (this.resources.length > 0) {
      promptParts.push(
        `Resources:\n${this.generateNumberedList(this.resources)}\n`
      );
    }

    // Add performance evaluation if present
    if (this.performanceEvaluation.length > 0) {
      promptParts.push(
        `Performance Evaluation:\n${this.generateNumberedList(this.performanceEvaluation)}\n`
      );
    }

    // Add response format
    promptParts.push(
      `You should only respond in JSON format as described below \n` +
        `Response Format: \n${formattedResponseFormat} \n` +
        `Ensure the response can be parsed by Python json.loads`
    );

    return promptParts.join('\n');
  }
}

// Example usage:
/*
const promptGen = new PromptGenerator();

// Add a custom response format for simple responses
promptGen.addResponseFormat("simple", {
  response: {
    answer: "direct answer",
    confidence: "high/medium/low"
  }
});

// Add a custom response format for analysis tasks
promptGen.addResponseFormat("analysis", {
  analysis: {
    summary: "brief overview",
    details: "detailed analysis",
    recommendations: ["recommendation 1", "recommendation 2"],
    confidence_score: 0.95
  },
  metadata: {
    timestamp: "ISO 8601 timestamp",
    version: "1.0"
  }
});

// Set which format to use
promptGen.setActiveResponseFormat("analysis");

// Add constraints and tools
promptGen.addConstraint("Respond only with valid JSON");
promptGen.addConstraint("Be concise and clear");

promptGen.addTools("execute", "run_script", { 
  script_path: "/path/to/script.sh",
  timeout: "30"
});

promptGen.addResource("Internet access for searches");
promptGen.addResource("File system access");

promptGen.addPerformanceEvaluation("Response time under 2 seconds");
promptGen.addPerformanceEvaluation("Accuracy above 95%");

// Generate prompt with active format
const promptString = promptGen.generatePromptString();
console.log(promptString);

// Or generate with a specific format
const simplePrompt = promptGen.generatePromptString("simple");
console.log(simplePrompt);

// Get all available format keys
console.log(promptGen.getResponseFormatKeys()); // ["default", "simple", "analysis"]
*/
