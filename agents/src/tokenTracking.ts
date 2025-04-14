import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import chalk from 'chalk';
import { logger } from '@hijox/core';

/**
 * Interface for token usage information
 */
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Class for tracking token usage across LLM calls
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

  // Default token limits
  maxInputTokens = 100000;
  maxCompletionTokens = 100000;
  maxTotalTokens = 150000;

  constructor(options?: {
    debug?: boolean;
    maxInputTokens?: number;
    maxCompletionTokens?: number;
    maxTotalTokens?: number;
  }) {
    super();
    if (options?.maxInputTokens) this.maxInputTokens = options.maxInputTokens;
    if (options?.maxCompletionTokens)
      this.maxCompletionTokens = options.maxCompletionTokens;
    if (options?.maxTotalTokens) this.maxTotalTokens = options.maxTotalTokens;
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
   * Check if input exceeds token limits
   */
  checkTokenLimits(messageTokens: number): {
    success: boolean;
    error?: string;
  } {
    if (messageTokens > this.maxInputTokens * 2) {
      logger.warn(
        `CRITICAL: Input tokens (${messageTokens}) greatly exceed the limit (${this.maxInputTokens}).`
      );
      this.reset();
      return { success: true };
    } else if (messageTokens > this.maxInputTokens) {
      logger.warn(
        `Input tokens (${messageTokens}) exceed the suggested limit (${this.maxInputTokens}).`
      );
      return { success: true };
    }

    if (this.promptTokens + messageTokens > this.maxTotalTokens) {
      logger.warn(
        `Total tokens (${this.promptTokens + messageTokens}) would exceed the limit (${this.maxTotalTokens}).`
      );
      this.reset();
      return { success: true };
    }

    return { success: true };
  }

  /**
   * Handle the start of an LLM call
   */
  async handleLLMStart(): Promise<void> {
    // Nothing to do at start
  }

  /**
   * Recursively search for usage information in complex objects
   */
  findUsageInformation(obj: any, depth = 0, maxDepth = 5): any {
    if (depth > maxDepth || !obj || typeof obj !== 'object') return null;

    // Check if this object has usage information
    // Anthropic format
    if (
      obj.usage &&
      (obj.usage.input_tokens !== undefined ||
        obj.usage.output_tokens !== undefined)
    ) {
      return obj.usage;
    }

    // LangChain or OpenAI format
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
      // Check in output.llmOutput
      if (output.llmOutput?.usage) {
        return {
          promptTokens: output.llmOutput.usage.input_tokens || 0,
          completionTokens: output.llmOutput.usage.output_tokens || 0,
          totalTokens:
            (output.llmOutput.usage.input_tokens || 0) +
            (output.llmOutput.usage.output_tokens || 0),
        };
      }

      // Check in response metadata for Claude 3
      if (output.generations?.length > 0) {
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

      // Deeper search if we still don't have information
      const usageInfo = this.findUsageInformation(output);
      if (usageInfo) {
        // Anthropic format
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

        // OpenAI/standard format
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

      // Fallback to standard LangChain format
      if (output.llmOutput?.tokenUsage) {
        return {
          promptTokens: output.llmOutput.tokenUsage.promptTokens || 0,
          completionTokens: output.llmOutput.tokenUsage.completionTokens || 0,
          totalTokens: output.llmOutput.tokenUsage.totalTokens || 0,
        };
      }
    } catch (e) {
      logger.error('Error extracting token information:', e);
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

      // Check for token issues
      const totalForThisCall =
        (tokenUsage.promptTokens || 0) + (tokenUsage.completionTokens || 0);

      if (totalForThisCall > this.maxTotalTokens * 0.75) {
        logger.warn(
          `Large LLM call: ${totalForThisCall} tokens ` +
            `(${tokenUsage.promptTokens || 0} in / ${tokenUsage.completionTokens || 0} out)`
        );
        logger.warn(
          `This call represents more than 75% of the total limit (${this.maxTotalTokens}).`
        );
      }

      if (tokenUsage.completionTokens > this.maxCompletionTokens) {
        logger.warn(
          `Completion tokens exceeded limit: ${tokenUsage.completionTokens} > ${this.maxCompletionTokens}`
        );
      }

      // Update counters
      this.promptTokens += tokenUsage.promptTokens || 0;
      this.completionTokens += tokenUsage.completionTokens || 0;
      this.totalTokens += tokenUsage.totalTokens || 0;

      // Auto-reset counters at 80% threshold
      const tokenThreshold = this.maxTotalTokens * 0.8;
      if (this.totalTokens > tokenThreshold) {
        logger.warn(
          `Token limit approaching (${this.totalTokens}/${this.maxTotalTokens}).`
        );
        this.reset();
      }

      // Store the last usage
      this.lastTokenUsage = {
        promptTokens: tokenUsage.promptTokens || 0,
        completionTokens: tokenUsage.completionTokens || 0,
        totalTokens: tokenUsage.totalTokens || 0,
      };

      // Display token usage in console
      logger.debug(
        chalk.gray(
          `Tokens: ${this.lastTokenUsage.totalTokens} ` +
            `(${this.lastTokenUsage.promptTokens} in / ${this.lastTokenUsage.completionTokens} out)`
        )
      );
    } catch (e) {
      logger.error('Error in handleLLMEnd:', e);
      this.reset();
    }
  }

  /**
   * Handle the start of a tool call
   */
  async handleToolStart(): Promise<void> {
    this.toolCalls++;
  }

  /**
   * Get a token usage string for the current session
   */
  getTokenUsageSummary(): string {
    return chalk.gray(
      `${this.totalTokens} total (${this.promptTokens} in / ${this.completionTokens} out) | Tools: ${this.toolCalls}`
    );
  }

  /**
   * Get the last token usage
   */
  getLastTokenUsage(): string {
    return chalk.gray(
      `${this.lastTokenUsage.totalTokens} ` +
        `(${this.lastTokenUsage.promptTokens} in / ${this.lastTokenUsage.completionTokens} out)`
    );
  }
}

/**
 * Class that extends TokenTrackingHandler but disables LLM logs
 */
export class SilentTokenTrackingHandler extends TokenTrackingHandler {
  async handleLLMStart(): Promise<void> {
    // Do nothing at startup
  }

  async handleLLMEnd(output: any): Promise<void> {
    try {
      const tokenUsage = this.extractTokenUsage(output);

      this.promptTokens += tokenUsage.promptTokens || 0;
      this.completionTokens += tokenUsage.completionTokens || 0;
      this.totalTokens += tokenUsage.totalTokens || 0;

      this.lastTokenUsage = {
        promptTokens: tokenUsage.promptTokens || 0,
        completionTokens: tokenUsage.completionTokens || 0,
        totalTokens: tokenUsage.totalTokens || 0,
      };

      logger.debug(
        `Tokens: ${this.lastTokenUsage.totalTokens} ` +
          `(${this.lastTokenUsage.promptTokens} in / ${this.lastTokenUsage.completionTokens} out)`
      );
    } catch (e) {
      logger.error('Error in handleLLMEnd:', e);
    }
  }
}

// Default singleton instance
export let tokenTracker = new SilentTokenTrackingHandler();

/**
 * Estimate the number of tokens in a text
 */
export function estimateTokens(text: string): number {
  // Simple estimation: 4 characters ~ 1 token
  return Math.ceil(text.length / 4);
}

/**
 * Truncate content to respect token limits
 */
export function truncateToTokenLimit(
  content: string,
  maxTokens: number
): string {
  const estimatedTokens = estimateTokens(content);
  if (estimatedTokens <= maxTokens) return content;

  // Detection of commands or tool results
  const containsToolOutput =
    content.includes('Result:') ||
    content.includes('Tool output:') ||
    content.includes('Command output:');

  // Split content into paragraphs
  const paragraphs = content.split('\n\n');

  // Strategy based on content type
  if (containsToolOutput && paragraphs.length > 2) {
    const targetChars = maxTokens * 4;
    const reservedChars = targetChars * 0.1;
    const headChars = targetChars * 0.5;
    const tailChars = targetChars - headChars - reservedChars;

    // Extract the beginning
    let currentLength = 0;
    let headParagraphs = [];
    for (const para of paragraphs) {
      if (currentLength + para.length <= headChars) {
        headParagraphs.push(para);
        currentLength += para.length + 2; // +2 for \n\n
      } else {
        break;
      }
    }

    // Extract the end
    let tailParagraphs = [];
    currentLength = 0;
    for (const para of paragraphs.slice().reverse()) {
      if (currentLength + para.length <= tailChars) {
        tailParagraphs.unshift(para); // Add to beginning
        currentLength += para.length + 2;
      } else {
        break;
      }
    }

    return (
      headParagraphs.join('\n\n') +
      '\n\n[...TRUNCATED CONTENT...]\n\n' +
      tailParagraphs.join('\n\n') +
      '\n\n[NOTE: CONTENT TRUNCATED TO RESPECT TOKEN LIMIT]'
    );
  } else if (content.length > 1000 && containsToolOutput) {
    // For very long tool results
    const charLimit = maxTokens * 4;
    const headSize = Math.floor(charLimit * 0.5);
    const tailSize = Math.floor(charLimit * 0.3);

    const head = content.substring(0, headSize);
    const tail = content.substring(content.length - tailSize);

    return (
      head +
      '\n\n[...TRUNCATED CONTENT...]\n\n' +
      tail +
      '\n\n[NOTE: CONTENT TRUNCATED TO RESPECT TOKEN LIMIT]'
    );
  } else {
    // For normal content
    const approximateChars = maxTokens * 4;
    const reservedChars = 100;
    const usableChars = approximateChars - reservedChars;
    const headSize = Math.floor(usableChars * 0.8);
    const tailSize = Math.floor(usableChars * 0.2);

    if (content.length <= headSize + tailSize + reservedChars) {
      return (
        content.substring(0, approximateChars - reservedChars) +
        '\n\n[END TRUNCATED TO RESPECT TOKEN LIMIT]'
      );
    }

    const head = content.substring(0, headSize);
    const tail = content.substring(content.length - tailSize);

    return (
      head +
      '\n\n[...CENTRAL CONTENT TRUNCATED...]\n\n' +
      tail +
      '\n\n[NOTE: CONTENT TRUNCATED TO RESPECT TOKEN LIMIT]'
    );
  }
}

/**
 * Configure a model with token tracking
 */
export function configureModelWithTracking(
  model: any,
  options?: {
    tokenLogging?: boolean;
    maxInputTokens?: number;
    maxCompletionTokens?: number;
    maxTotalTokens?: number;
  }
): any {
  // Create a new tracker with custom limits
  const tracker = new SilentTokenTrackingHandler({
    maxInputTokens: options?.maxInputTokens,
    maxCompletionTokens: options?.maxCompletionTokens,
    maxTotalTokens: options?.maxTotalTokens,
  });

  // Disable token logging if specified
  if (options?.tokenLogging === false) {
    model.verbose = false;
    return model;
  }

  // Explicitly disable verbosity
  model.verbose = false;

  // Replace the invoke method to check token limits
  const originalInvoke = model.invoke.bind(model);
  model.invoke = async function (messages: any, ...args: any[]) {
    let messageContent = '';

    try {
      // Extract textual content from messages
      if (Array.isArray(messages)) {
        messageContent = messages
          .map((m: any) => {
            if (typeof m === 'string') return m;
            if (m.content) return m.content;
            return JSON.stringify(m);
          })
          .join('\n');
      } else if (typeof messages === 'object') {
        if (messages.content) messageContent = messages.content;
        else if (messages.messages) {
          messageContent = messages.messages
            .map((m: any) => {
              if (typeof m === 'string') return m;
              if (m.content) return m.content;
              return JSON.stringify(m);
            })
            .join('\n');
        } else {
          messageContent = JSON.stringify(messages);
        }
      } else if (typeof messages === 'string') {
        messageContent = messages;
      }

      // Estimate tokens in the prompt
      const estimatedTokens = estimateTokens(messageContent);

      // Check token limits
      tracker.checkTokenLimits(estimatedTokens);

      // Progressive handling of overages
      let truncationApplied = false;

      // Extreme overage (>2x the limit)
      if (estimatedTokens > tracker.maxInputTokens * 2) {
        logger.warn(
          `ALERT: Extremely large input (${estimatedTokens} estimated tokens)`
        );
        truncationApplied = true;

        if (typeof messages === 'string') {
          messages =
            'THE PREVIOUS CONTEXT WAS TOO LARGE. Please take a simple action based on the following information: ' +
            truncateToTokenLimit(
              messages,
              Math.floor(tracker.maxInputTokens * 0.2)
            );
        } else if (Array.isArray(messages)) {
          if (messages.length > 1) {
            messages = [
              messages[0],
              {
                role: 'system',
                content:
                  'The previous context was too large and has been removed.',
              },
              messages[messages.length - 1],
            ];
          }
        } else if (messages?.messages && Array.isArray(messages.messages)) {
          const msgArray = messages.messages;
          if (msgArray.length > 1) {
            messages.messages = [
              msgArray[0],
              {
                role: 'system',
                content:
                  'The previous context was too large and has been removed.',
              },
              msgArray[msgArray.length - 1],
            ];
          }
        }
      }
      // Large overage (1.5x to 2x the limit)
      else if (estimatedTokens > tracker.maxInputTokens * 1.5) {
        logger.warn(
          `Very large input (${estimatedTokens} estimated tokens), truncation applied`
        );
        truncationApplied = true;

        if (typeof messages === 'string') {
          messages = truncateToTokenLimit(messages, tracker.maxInputTokens);
        } else if (Array.isArray(messages)) {
          if (messages.length > 3) {
            messages = [
              messages[0],
              {
                role: 'system',
                content:
                  'The previous context has been partially truncated due to token limits.',
              },
              ...messages.slice(-Math.min(4, messages.length)),
            ];
          }
        } else if (messages?.messages && Array.isArray(messages.messages)) {
          const msgArray = messages.messages;
          if (msgArray.length > 3) {
            messages.messages = [
              msgArray[0],
              {
                role: 'system',
                content:
                  'The previous context has been partially truncated due to token limits.',
              },
              ...msgArray.slice(-Math.min(4, msgArray.length)),
            ];
          }
        }
      }
      // Slight overage (1x to 1.5x the limit)
      else if (estimatedTokens > tracker.maxInputTokens) {
        logger.warn(
          `Large input (${estimatedTokens} estimated tokens), slight truncation applied`
        );
        truncationApplied = true;

        if (typeof messages === 'string') {
          messages = truncateToTokenLimit(messages, tracker.maxInputTokens);
        } else if (Array.isArray(messages) && messages.length > 4) {
          const systemMessages = messages.slice(0, 1);
          const recentMessages = messages.slice(-Math.min(5, messages.length));

          messages = [
            ...systemMessages,
            {
              role: 'system',
              content:
                'Some intermediate messages have been omitted due to token limits.',
            },
            ...recentMessages,
          ];
        } else if (
          messages?.messages &&
          Array.isArray(messages.messages) &&
          messages.messages.length > 4
        ) {
          const msgArray = messages.messages;
          const systemMessages = msgArray.slice(0, 1);
          const recentMessages = msgArray.slice(-Math.min(5, msgArray.length));

          messages.messages = [
            ...systemMessages,
            {
              role: 'system',
              content:
                'Some intermediate messages have been omitted due to token limits.',
            },
            ...recentMessages,
          ];
        }
      }

      // If truncation was applied, re-estimate tokens
      if (truncationApplied) {
        let newContent = '';
        if (typeof messages === 'string') {
          newContent = messages;
        } else if (Array.isArray(messages)) {
          newContent = messages
            .map((m: any) =>
              typeof m === 'string' ? m : m.content || JSON.stringify(m)
            )
            .join('\n');
        } else if (messages?.messages && Array.isArray(messages.messages)) {
          newContent = messages.messages
            .map((m: any) =>
              typeof m === 'string' ? m : m.content || JSON.stringify(m)
            )
            .join('\n');
        } else {
          newContent = JSON.stringify(messages);
        }

        const newEstimatedTokens = estimateTokens(newContent);
        logger.info(
          `After truncation: ${newEstimatedTokens} estimated tokens (reduction of ${Math.round(
            ((estimatedTokens - newEstimatedTokens) / estimatedTokens) * 100
          )}%)`
        );
      }

      // Invoke the model
      try {
        return await originalInvoke(messages, ...args);
      } catch (invokeError) {
        // Handle token-related errors
        if (
          invokeError instanceof Error &&
          (invokeError.message.includes('token limit') ||
            invokeError.message.includes('tokens exceed') ||
            invokeError.message.includes('context length'))
        ) {
          logger.error(
            `Token error despite truncation: ${invokeError.message}`
          );

          // Emergency attempt
          if (typeof messages === 'string') {
            const emergencyMessage =
              'The context was too large. Please take a simple action.';
            return await originalInvoke(emergencyMessage, ...args);
          } else if (Array.isArray(messages) && messages.length > 0) {
            const emergencyMessages = [
              messages[0],
              {
                role: 'system',
                content:
                  'All previous information has been lost. Take a simple action.',
              },
            ];
            return await originalInvoke(emergencyMessages, ...args);
          } else if (
            messages?.messages &&
            Array.isArray(messages.messages) &&
            messages.messages.length > 0
          ) {
            const msgArray = messages.messages;
            messages.messages = [
              msgArray[0],
              {
                role: 'system',
                content:
                  'All previous information has been lost. Take a simple action.',
              },
            ];
            return await originalInvoke(messages, ...args);
          }

          // Error message formatted as LLM response
          return {
            content: 'I cannot process this request due to token limits.',
            tool_calls: [],
            usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
          };
        }

        throw invokeError;
      }
    } catch (error) {
      logger.error(`Error while preparing messages: ${error}`);

      // Emergency recovery
      try {
        const emergencyMessage =
          'An error occurred while processing the context. Please take a simple action.';
        return await originalInvoke(emergencyMessage, ...args);
      } catch (finalError) {
        return {
          content:
            'Unable to process this request. Please try again with a simpler query.',
          tool_calls: [],
          usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        };
      }
    }
  };

  // Add our tracker to callbacks
  if (model.callbacks) {
    model.callbacks = [tracker, ...(model.callbacks || [])];
  } else {
    model.callbacks = [tracker];
  }

  // Make the tracker globally available
  tokenTracker = tracker;

  return model;
}

/**
 * Add token information to an existing box
 */
export function addTokenInfoToBox(boxContent: string): string {
  if (!boxContent || typeof boxContent !== 'string') {
    return boxContent;
  }

  const lines = boxContent.split('\n');
  const tokenInfo = tokenTracker.getLastTokenUsage();

  if (lines.length < 3) {
    return boxContent;
  }

  // Look for the title line
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
    // Find border positions
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

      // Calculate exact width between pipes
      const exactWidth = lastPipe - firstPipe - 1;

      // If content is too long, truncate
      let finalContent = newContent;
      if (newContent.length + 2 > exactWidth) {
        const maxLength = exactWidth - 2;
        finalContent = `${title} ${tokenInfo.substring(0, Math.max(0, maxLength - title.length - 1))}`;
      }

      // Calculate padding to fill remaining space
      const paddingLength = Math.max(0, exactWidth - finalContent.length - 12);

      // Rebuild the line completely
      const leftPart = line.substring(0, firstPipe);
      const rightPart = line.substring(lastPipe);

      // Assemble the new line with exact spacing
      lines[titleLineIndex] =
        `${leftPart}│ ${finalContent}${' '.repeat(paddingLength)} ${chalk.cyan('│')}${rightPart.substring(1)}`;

      return lines.join('\n');
    }
  }

  // If we couldn't modify the title, try inserting after the separator
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
            finalContent = tokenContent.substring(0, exactWidth - 2);
          }

          // Calculate exact padding
          const paddingLength = Math.max(
            0,
            exactWidth - finalContent.length - 2
          );

          // Get line parts for precise reconstruction
          const leftPart = nextLine.substring(0, firstPipe);
          const rightPart = nextLine.substring(lastPipe);

          // Build the line with exact spacing
          const tokenLine = `${leftPart}│ ${finalContent}${' '.repeat(paddingLength)} ${chalk.cyan('│')}${rightPart.substring(1)}`;

          // Insert after separator
          lines.splice(i + 1, 0, tokenLine);

          return lines.join('\n');
        }
      }
    }
  }

  return boxContent;
}

/**
 * Create a debug token tracker that displays more information
 */
export function createDebugTokenTracker(): TokenTrackingHandler {
  return new TokenTrackingHandler({ debug: true });
}
