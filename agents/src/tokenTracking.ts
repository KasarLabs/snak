import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { createBox } from './formatting.js';
import chalk from 'chalk';
import { BaseMessage } from '@langchain/core/messages';
import logger from './logger.js';

// Patch pour désactiver les logs verbeux de LangChain
const originalLog = console.log;
console.log = function (...args) {
  // Filtrer les messages commençant par [llm/
  if (typeof args[0] === 'string' && args[0].startsWith('[llm/')) {
    return;
  }
  originalLog.apply(console, args);
};

/**
 * Interface for token usage information
 */
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Class to track token usage for different LLM calls
 */
export class TokenTrackingHandler extends BaseCallbackHandler {
  name = 'TokenTrackingHandler';
  promptTokens = 0;
  completionTokens = 0;
  totalTokens = 0;
  toolCalls = 0;
  lastTokenUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  constructor(options?: { debug?: boolean }) {
    super();
  }

  /**
   * Reset counters for a new conversation
   */
  reset(): void {
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.totalTokens = 0;
    this.toolCalls = 0;
    this.lastTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  /**
   * Handle the start of an LLM call
   */
  async handleLLMStart(): Promise<void> {
    // Nothing to do at the start
  }

  /**
   * Deep search for usage information in complex objects
   */
  findUsageInformation(obj: any, depth = 0, maxDepth = 5): any {
    if (depth > maxDepth) return null;
    if (!obj || typeof obj !== 'object') return null;

    // Check if this object has usage information
    // First look for Anthropic-style usage
    if (
      obj.usage &&
      (obj.usage.input_tokens !== undefined ||
        obj.usage.output_tokens !== undefined)
    ) {
      return obj.usage;
    }

    // Then check for LangChain or OpenAI style
    if (
      obj.tokenUsage ||
      (obj.usage &&
        (obj.usage.total_tokens !== undefined ||
          obj.usage.prompt_tokens !== undefined))
    ) {
      return obj.tokenUsage || obj.usage;
    }

    // Recursive search
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        const result = this.findUsageInformation(obj[key], depth + 1, maxDepth);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Extract token usage from different LLM outputs
   */
  extractTokenUsage(output: any): TokenUsage {
    // Default empty usage
    let usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    try {
      // First, check for Anthropic-specific format in different locations

      // Check in output.llmOutput first
      if (output.llmOutput && output.llmOutput.usage) {
        return {
          promptTokens: output.llmOutput.usage.input_tokens || 0,
          completionTokens: output.llmOutput.usage.output_tokens || 0,
          totalTokens:
            (output.llmOutput.usage.input_tokens || 0) +
            (output.llmOutput.usage.output_tokens || 0),
        };
      }

      // Check in message response metadata for Claude 3
      if (output.generations && output.generations.length > 0) {
        const generation = output.generations[0][0];

        // Check in message.additional_kwargs
        if (generation.message?.additional_kwargs?.usage) {
          const tokenInfo = generation.message.additional_kwargs.usage;
          return {
            promptTokens: tokenInfo.input_tokens || 0,
            completionTokens: tokenInfo.output_tokens || 0,
            totalTokens:
              (tokenInfo.input_tokens || 0) + (tokenInfo.output_tokens || 0),
          };
        }

        // Check in message.response_metadata
        if (generation.message?.response_metadata?.usage) {
          const tokenInfo = generation.message.response_metadata.usage;
          return {
            promptTokens: tokenInfo.input_tokens || 0,
            completionTokens: tokenInfo.output_tokens || 0,
            totalTokens:
              (tokenInfo.input_tokens || 0) + (tokenInfo.output_tokens || 0),
          };
        }

        // Check in message.usage_metadata
        if (generation.message?.usage_metadata) {
          const tokenInfo = generation.message.usage_metadata;
          return {
            promptTokens: tokenInfo.input_tokens || 0,
            completionTokens: tokenInfo.output_tokens || 0,
            totalTokens:
              tokenInfo.total_tokens ||
              (tokenInfo.input_tokens || 0) + (tokenInfo.output_tokens || 0),
          };
        }
      }

      // Try deep search if we still don't have usage info
      const usageInfo = this.findUsageInformation(output);
      if (usageInfo) {
        // Handle Anthropic format
        if (
          usageInfo.input_tokens !== undefined ||
          usageInfo.output_tokens !== undefined
        ) {
          return {
            promptTokens: usageInfo.input_tokens || 0,
            completionTokens: usageInfo.output_tokens || 0,
            totalTokens:
              (usageInfo.input_tokens || 0) + (usageInfo.output_tokens || 0),
          };
        }

        // Handle OpenAI/standard format
        if (
          usageInfo.prompt_tokens !== undefined ||
          usageInfo.completion_tokens !== undefined
        ) {
          return {
            promptTokens:
              usageInfo.prompt_tokens || usageInfo.promptTokens || 0,
            completionTokens:
              usageInfo.completion_tokens || usageInfo.completionTokens || 0,
            totalTokens:
              usageInfo.total_tokens ||
              usageInfo.totalTokens ||
              (usageInfo.prompt_tokens || 0) +
                (usageInfo.completion_tokens || 0),
          };
        }
      }

      // Fallback to standard LangChain format if all else fails
      if (output.llmOutput?.tokenUsage) {
        return {
          promptTokens: output.llmOutput.tokenUsage.promptTokens || 0,
          completionTokens: output.llmOutput.tokenUsage.completionTokens || 0,
          totalTokens: output.llmOutput.tokenUsage.totalTokens || 0,
        };
      }
    } catch (e) {
      console.error('Error extracting token usage:', e);
    }

    return usage;
  }

  /**
   * Handle the end of an LLM call with token usage information
   */
  async handleLLMEnd(output: any): Promise<void> {
    try {
      // Extract token usage from the output
      const tokenUsage = this.extractTokenUsage(output);

      // Update counters
      this.promptTokens += tokenUsage.promptTokens || 0;
      this.completionTokens += tokenUsage.completionTokens || 0;
      this.totalTokens += tokenUsage.totalTokens || 0;

      // Store the last usage
      this.lastTokenUsage = {
        promptTokens: tokenUsage.promptTokens || 0,
        completionTokens: tokenUsage.completionTokens || 0,
        totalTokens: tokenUsage.totalTokens || 0,
      };

      // Display token usage in console
      logger.debug(
        chalk.gray(
          `Tokens: ${this.lastTokenUsage.totalTokens} (${this.lastTokenUsage.promptTokens} in / ${this.lastTokenUsage.completionTokens} out)`
        )
      );
    } catch (e) {
      console.error('Error in handleLLMEnd:', e);
    }
  }

  /**
   * Handle the start of a tool call
   */
  async handleToolStart(): Promise<void> {
    this.toolCalls++;
  }

  /**
   * Get token usage string for current session
   */
  getTokenUsageSummary(): string {
    return chalk.gray(
      `${this.totalTokens} total (${this.promptTokens} in / ${this.completionTokens} out) | Tools: ${this.toolCalls}`
    );
  }

  /**
   * Get the last token usage for adding to tool call boxes
   */
  getLastTokenUsage(): string {
    return chalk.gray(
      `${this.lastTokenUsage.totalTokens} (${this.lastTokenUsage.promptTokens} in / ${this.lastTokenUsage.completionTokens} out)`
    );
  }
}

/**
 * Class that extends TokenTrackingHandler but disables LLM logs
 */
export class SilentTokenTrackingHandler extends TokenTrackingHandler {
  // Toujours collecter les tokens mais sans journalisation
  async handleLLMStart(): Promise<void> {
    // Ne rien afficher au démarrage
  }

  async handleLLMEnd(output: any): Promise<void> {
    try {
      // Extraire les informations de token comme avant
      const tokenUsage = this.extractTokenUsage(output);

      // Mettre à jour les compteurs
      this.promptTokens += tokenUsage.promptTokens || 0;
      this.completionTokens += tokenUsage.completionTokens || 0;
      this.totalTokens += tokenUsage.totalTokens || 0;

      // Stocker le dernier usage
      this.lastTokenUsage = {
        promptTokens: tokenUsage.promptTokens || 0,
        completionTokens: tokenUsage.completionTokens || 0,
        totalTokens: tokenUsage.totalTokens || 0,
      };

      // Journaliser seulement en mode debug au lieu d'afficher
      logger.debug(
        `Tokens: ${this.lastTokenUsage.totalTokens} (${this.lastTokenUsage.promptTokens} in / ${this.lastTokenUsage.completionTokens} out)`
      );
    } catch (e) {
      logger.error('Error in handleLLMEnd:', e);
    }
  }
}

// Remplacer l'instance singleton
export const tokenTracker = new SilentTokenTrackingHandler();

/**
 * Configure a model with token tracking
 * @param model LLM model instance
 * @param options Options for token tracking
 * @returns Model with token tracking
 */
export function configureModelWithTracking(
  model: any,
  options?: { tokenLogging?: boolean }
): any {
  // Check if token logging is disabled
  if (options?.tokenLogging === false) {
    // Assurez-vous de désactiver la verbosité du modèle
    model.verbose = false;
    return model; // Return model without token tracking
  }

  // Désactiver explicitement la verbosité même si on suit les tokens
  model.verbose = false;

  // Add our token tracker to the callbacks
  if (model.callbacks) {
    model.callbacks = [tokenTracker, ...(model.callbacks || [])];
  } else {
    model.callbacks = [tokenTracker];
  }

  return model;
}

/**
 * Add token information to an existing box
 * @param boxContent Original box content
 * @returns Modified content with token information
 */
export function addTokenInfoToBox(boxContent: string): string {
  if (!boxContent || typeof boxContent !== 'string') {
    return boxContent;
  }

  const lines = boxContent.split('\n');
  const tokenInfo = tokenTracker.getLastTokenUsage();

  if (lines.length < 3) {
    return boxContent; // Box too small, don't modify
  }

  // Find the line with the title (Agent Action/Response)
  let titleLineIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (
      (lines[i].includes('Agent Action') ||
        lines[i].includes('Agent Response')) &&
      lines[i].includes('│')
    ) {
      titleLineIndex = i;
      break;
    }
  }

  if (titleLineIndex >= 0) {
    // Find border positions and exact available width
    const line = lines[titleLineIndex];
    const firstPipe = line.indexOf('│');
    const lastPipe = line.lastIndexOf('│');

    if (firstPipe >= 0 && lastPipe > firstPipe) {
      // Extract current title
      const title = line.includes('Agent Action')
        ? 'Agent Action'
        : 'Agent Response';

      // Create new content with token info
      const newContent = `${title} ${tokenInfo}`;

      // Calculate exact width between pipes (excluding pipes themselves)
      const exactWidth = lastPipe - firstPipe - 1;

      // If content is too long, truncate token info
      let finalContent = newContent;
      if (newContent.length + 2 > exactWidth) {
        // +2 for spaces on both sides
        // Truncate to fit, preserving as much token info as possible
        const maxLength = exactWidth - 2;
        finalContent = `${title} ${tokenInfo.substring(0, Math.max(0, maxLength - title.length - 1))}`;
      }

      // Calculate padding to fill remaining space exactly
      const paddingLength = Math.max(0, exactWidth - finalContent.length - 12); // change this to compute correct padding

      // Reconstruct the line completely to avoid any misalignment
      const leftPart = line.substring(0, firstPipe);
      const rightPart = line.substring(lastPipe);

      // Assemble the new line with exact spacing
      lines[titleLineIndex] =
        `${leftPart}│ ${finalContent}${' '.repeat(paddingLength)} │${rightPart.substring(1)}`;

      return lines.join('\n');
    }
  }

  // If we couldn't modify the title, try to insert after the separator
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].includes('├') && lines[i].includes('┤')) {
      const nextLine = lines[i + 1];

      if (nextLine) {
        const firstPipe = nextLine.indexOf('│');
        const lastPipe = nextLine.lastIndexOf('│');

        if (firstPipe >= 0 && lastPipe > firstPipe) {
          // Calculate exact width between pipes
          const exactWidth = lastPipe - firstPipe - 1;

          // Create a line with token info
          const tokenContent = tokenInfo.trim();

          // Check if content fits, otherwise truncate
          let finalContent = tokenContent;
          if (tokenContent.length + 2 > exactWidth) {
            // +2 for spaces
            finalContent = tokenContent.substring(0, exactWidth - 2);
          }

          // Calculate exact padding
          const paddingLength = Math.max(
            0,
            exactWidth - finalContent.length - 2
          );

          // Get parts of the line for precise reconstruction
          const leftPart = nextLine.substring(0, firstPipe);
          const rightPart = nextLine.substring(lastPipe);

          // Construct line with exact spacing and correct borders
          const tokenLine = `${leftPart}│ ${finalContent}${' '.repeat(paddingLength)} │${rightPart.substring(1)}`;

          // Insert after the separator
          lines.splice(i + 1, 0, tokenLine);

          return lines.join('\n');
        }
      }
    }
  }

  // If all else fails, return the unchanged box
  return boxContent;
}

/**
 * Create a debug token tracker that prints more information
 */
export function createDebugTokenTracker(): TokenTrackingHandler {
  return new TokenTrackingHandler({ debug: true });
}
