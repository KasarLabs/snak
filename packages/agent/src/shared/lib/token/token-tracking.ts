import { logger } from '@snakagent/core';
import type { AIMessage } from '@langchain/core/messages';

/**
 * A utility class for tracking token usage across LLM calls within a session.
 * Provides static methods to track usage from various response formats and maintains session totals.
 * Offers fallback estimation when explicit token counts are unavailable.
 */
export class TokenTracker {
  // Constants for token estimation heuristic
  private static readonly TOKENS_PER_WORD = 1.3;
  private static readonly TOKENS_PER_SPECIAL_CHAR = 0.5;

  // Static session counters
  private static sessionPromptTokens: number = 0;
  private static sessionResponseTokens: number = 0;
  private static sessionTotalTokens: number = 0;

  /**
   * Resets the static session token counters to zero.
   */
  public static resetSessionCounters(): void {
    this.sessionPromptTokens = 0;
    this.sessionResponseTokens = 0;
    this.sessionTotalTokens = 0;
  }

  /**
   * Retrieves the cumulative token usage for the current session.
   * @returns An object containing the total prompt, response, and overall tokens used in the session.
   */
  public static getSessionTokenUsage(): {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  } {
    return {
      promptTokens: this.sessionPromptTokens,
      responseTokens: this.sessionResponseTokens,
      totalTokens: this.sessionTotalTokens,
    };
  }

  /**
   * Tracks token usage based on the result object from an LLM call.
   * It inspects the result for known metadata structures (`usage_metadata`, `response_metadata`)
   * across different formats (standard LangChain, OpenAI, Anthropic).
   * If no explicit token info is found, it falls back to estimation.
   * Updates the session counters.
   *
   * @param result - The result object from an LLM call (e.g., AIMessage, array of messages, or other structures).
   * @param modelName - The name of the model used for the call (optional, defaults to 'unknown_model').
   * @returns An object containing the prompt, response, and total tokens for this specific call.
   */
  public static trackCall(
    result: any,
    modelName: string = 'unknown_model'
  ): { promptTokens: number; responseTokens: number; totalTokens: number } {
    // Handle null or undefined result early
    if (result == null) {
      logger.warn(
        `trackCall received null or undefined result for model [${modelName}]. Returning zero tokens.`
      );
      return { promptTokens: 0, responseTokens: 0, totalTokens: 0 };
    }

    let messageToProcess: AIMessage | null = null;

    // Attempt to find an AIMessage within the result
    if (
      result &&
      typeof result === 'object' &&
      'content' in result &&
      result.content !== undefined &&
      result._getType &&
      result._getType() === 'ai'
    ) {
      messageToProcess = result as AIMessage;
    } else if (Array.isArray(result)) {
      // Check array elements for the last AIMessage
      for (let i = result.length - 1; i >= 0; i--) {
        const msg = result[i];
        if (
          msg &&
          typeof msg === 'object' &&
          msg._getType &&
          msg._getType() === 'ai'
        ) {
          messageToProcess = msg as AIMessage;
          break;
        }
      }
    }

    if (messageToProcess) {
      // Try standard `usage_metadata` first
      if (messageToProcess.usage_metadata) {
        const {
          input_tokens = 0,
          output_tokens = 0,
          total_tokens = 0,
        } = messageToProcess.usage_metadata;
        const finalTotalTokens = total_tokens || input_tokens + output_tokens;

        logger.debug(
          `Token usage for model [${modelName}]: Prompt tokens: ${input_tokens}, Response tokens: ${output_tokens}, Total tokens: ${finalTotalTokens}`
        );

        this.sessionPromptTokens += input_tokens;
        this.sessionResponseTokens += output_tokens;
        this.sessionTotalTokens += finalTotalTokens;

        return {
          promptTokens: input_tokens,
          responseTokens: output_tokens,
          totalTokens: finalTotalTokens,
        };
      }

      // Then try provider-specific `response_metadata`
      if (messageToProcess.response_metadata) {
        // OpenAI format
        if ('tokenUsage' in messageToProcess.response_metadata) {
          const {
            promptTokens = 0,
            completionTokens = 0,
            totalTokens = 0,
          } = messageToProcess.response_metadata.tokenUsage;
          const finalTotalTokens =
            totalTokens || promptTokens + completionTokens;

          logger.debug(
            `Token usage for model [${modelName}]: Prompt tokens: ${promptTokens}, Response tokens: ${completionTokens}, Total tokens: ${finalTotalTokens}`
          );

          this.sessionPromptTokens += promptTokens;
          this.sessionResponseTokens += completionTokens;
          this.sessionTotalTokens += finalTotalTokens;

          return {
            promptTokens: promptTokens,
            responseTokens: completionTokens,
            totalTokens: finalTotalTokens,
          };
        }

        // Anthropic format
        if ('usage' in messageToProcess.response_metadata) {
          const { input_tokens = 0, output_tokens = 0 } =
            messageToProcess.response_metadata.usage;
          const total_tokens = input_tokens + output_tokens;

          logger.debug(
            `Token usage for model [${modelName}]: Prompt tokens: ${input_tokens}, Response tokens: ${output_tokens}, Total tokens: ${total_tokens}`
          );

          this.sessionPromptTokens += input_tokens;
          this.sessionResponseTokens += output_tokens;
          this.sessionTotalTokens += total_tokens;

          return {
            promptTokens: input_tokens,
            responseTokens: output_tokens,
            totalTokens: total_tokens,
          };
        }
      }
    }

    logger.warn(
      `No token usage information available for model [${modelName}], using fallback estimation.`
    );
    const estimation = this.estimateTokensFromResult(result);

    this.sessionPromptTokens += estimation.promptTokens;
    this.sessionResponseTokens += estimation.responseTokens;
    this.sessionTotalTokens += estimation.totalTokens;

    logger.debug(
      `Token estimation fallback for model [${modelName}]: ` +
        `Response tokens: ~${estimation.responseTokens} (prompt unknown)`
    );

    return estimation;
  }

  /**
   * Fallback estimation of response tokens based on the result content.
   * Attempts to extract text content from various result structures.
   * Note: This method currently only estimates *response* tokens as prompt info isn't available here.
   *
   * @param result - The result object from an LLM call.
   * @returns An object with estimated response tokens (prompt tokens set to 0).
   */
  private static estimateTokensFromResult(result: any): {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  } {
    let responseText = '';

    if (typeof result === 'string') {
      responseText = result;
    } else if (Array.isArray(result)) {
      responseText = result
        .map((msg) =>
          typeof msg === 'object' && msg.content
            ? typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content)
            : ''
        )
        .join(' ');
    } else if (result && typeof result === 'object') {
      if ('content' in result) {
        responseText =
          typeof result.content === 'string'
            ? result.content
            : JSON.stringify(result.content);
      } else {
        responseText = JSON.stringify(result);
      }
    }

    const responseTokens = this.estimateTokensFromText(responseText);

    // Currently, fallback only estimates response tokens
    return { promptTokens: 0, responseTokens, totalTokens: responseTokens };
  }

  /**
   * Tracks token usage using potentially more complete information, including the prompt.
   * This is often used with LangChain callbacks like `handleLLMEnd` which provide separate
   * prompt and response details. It prioritizes explicit token data (`llmOutput.tokenUsage`)
   * then checks for metadata within the result object (`generations`), and finally falls back
   * to estimating both prompt and response tokens based on text content.
   * Updates the session counters.
   *
   * @param promptText - The input prompt text or structure.
   * @param resultObj - The result object from the LLM call, potentially containing `llmOutput` or `generations`.
   * @param modelName - The name of the model used (optional, defaults to 'unknown_model').
   * @returns An object containing the prompt, response, and total tokens for this call (potentially estimated).
   */
  public static trackFullUsage(
    promptText: any,
    resultObj: any,
    modelName: string = 'unknown_model'
  ): { promptTokens: number; responseTokens: number; totalTokens: number } {
    // Prioritize explicit token usage data if available
    if (resultObj.llmOutput?.tokenUsage) {
      const {
        promptTokens = 0,
        completionTokens = 0,
        totalTokens = 0,
      } = resultObj.llmOutput.tokenUsage;
      const finalTotalTokens = totalTokens || promptTokens + completionTokens;

      logger.debug(
        `Token usage for model [${modelName}]: Prompt tokens: ${promptTokens}, Response tokens: ${completionTokens}, Total tokens: ${finalTotalTokens}`
      );

      this.sessionPromptTokens += promptTokens;
      this.sessionResponseTokens += completionTokens;
      this.sessionTotalTokens += finalTotalTokens;

      return {
        promptTokens,
        responseTokens: completionTokens,
        totalTokens: finalTotalTokens,
      };
    }

    // Check for AIMessage with metadata within `generations` structure
    if (resultObj.generations?.[0]?.[0]?.message) {
      const message = resultObj.generations[0][0].message;
      // Use trackCall to parse the message metadata
      const messageUsage = this.trackCall(message, modelName); // This also updates session counters

      // If trackCall couldn't find prompt tokens (e.g., only response metadata available),
      // but we have the promptText here, estimate the prompt tokens separately.
      if (messageUsage.promptTokens === 0 && promptText) {
        const promptString =
          typeof promptText === 'string'
            ? promptText
            : JSON.stringify(promptText);
        const estimatedPromptTokens = this.estimateTokensFromText(promptString);

        // Update session counters for the estimated prompt tokens
        // Note: sessionResponseTokens were already updated in the trackCall above
        this.sessionPromptTokens += estimatedPromptTokens;
        this.sessionTotalTokens += estimatedPromptTokens;

        logger.debug(
          `[ESTIMATED PROMPT] Token usage for model [${modelName}]: ` +
            `Prompt tokens: ~${estimatedPromptTokens}, Response tokens: ${messageUsage.responseTokens}, ` +
            `Total tokens: ~${estimatedPromptTokens + messageUsage.responseTokens}`
        );

        return {
          promptTokens: estimatedPromptTokens,
          responseTokens: messageUsage.responseTokens,
          totalTokens: estimatedPromptTokens + messageUsage.responseTokens,
        };
      }

      return messageUsage;
    }

    const promptString =
      typeof promptText === 'string' ? promptText : JSON.stringify(promptText);
    let responseString = '';

    if (resultObj.generations?.[0]?.[0]?.text) {
      responseString = resultObj.generations[0][0].text;
    } else if (resultObj.content) {
      responseString =
        typeof resultObj.content === 'string'
          ? resultObj.content
          : JSON.stringify(resultObj.content);
    } else {
      responseString = JSON.stringify(resultObj);
    }

    const promptTokens = this.estimateTokensFromText(promptString);
    const responseTokens = this.estimateTokensFromText(responseString);
    const totalTokens = promptTokens + responseTokens;

    logger.warn(
      `[FALLBACK ESTIMATE - FULL] Token usage for model [${modelName}]: ` +
        `Prompt tokens: ~${promptTokens}, Response tokens: ~${responseTokens}, Total tokens: ~${totalTokens}`
    );

    this.sessionPromptTokens += promptTokens;
    this.sessionResponseTokens += responseTokens;
    this.sessionTotalTokens += totalTokens;

    return { promptTokens, responseTokens, totalTokens };
  }

  /**
   * Utility method to estimate token count for a given text string.
   * Uses a basic heuristic: approximately 1.3 tokens per word plus 0.5 per special character.
   * This is a rough estimate and may not be accurate for all models or languages.
   *
   * @param text - The text string to estimate tokens for.
   * @returns The estimated number of tokens.
   */
  private static estimateTokensFromText(text: string): number {
    if (!text) return 0;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;

    return Math.ceil(
      wordCount * this.TOKENS_PER_WORD +
        specialChars * this.TOKENS_PER_SPECIAL_CHAR
    );
  }
}
