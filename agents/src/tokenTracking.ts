import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { createBox } from './formatting.js';
import chalk from 'chalk';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Class to track token usage for different LLM calls
 */
export class TokenTrackingHandler extends BaseCallbackHandler {
  name = 'TokenTrackingHandler';
  promptTokens = 0;
  completionTokens = 0;
  totalTokens = 0;
  toolCalls = 0;
  lastTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor() {
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
   * Handle the end of an LLM call with token usage information
   */
  async handleLLMEnd(output: any): Promise<void> {
    const tokenUsage = output.llmOutput?.tokenUsage;
    if (tokenUsage) {
      this.promptTokens += tokenUsage.promptTokens || 0;
      this.completionTokens += tokenUsage.completionTokens || 0;
      this.totalTokens += tokenUsage.totalTokens || 0;
      this.lastTokenUsage = {
        promptTokens: tokenUsage.promptTokens || 0,
        completionTokens: tokenUsage.completionTokens || 0,
        totalTokens: tokenUsage.totalTokens || 0,
      };

      // Nous n'affichons plus de boîte ici, mais stockons simplement les dernières informations d'utilisation
      console.log(
        chalk.gray(
          `${this.lastTokenUsage.totalTokens} (${this.lastTokenUsage.promptTokens} in / ${this.lastTokenUsage.completionTokens} out)`
        )
      );
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

// Singleton instance
export const tokenTracker = new TokenTrackingHandler();

/**
 * Configure a model with token tracking
 * @param model LLM model instance
 * @returns Model with token tracking
 */
export function configureModelWithTracking(model: any): any {
  // For models that don't provide token counts, we need to manually track through tiktoken
  if (model.callbacks) {
    model.callbacks = [tokenTracker, ...(model.callbacks || [])];
  } else {
    model.callbacks = [tokenTracker];
  }

  return model;
}

/**
 * Ajoute des informations de tokens à une boîte existante
 * @param boxContent Contenu original de la boîte
 * @returns Contenu modifié avec des informations de tokens
 */
export function addTokenInfoToBox(boxContent: string): string {
  if (!boxContent || typeof boxContent !== 'string') {
    return boxContent;
  }

  const lines = boxContent.split('\n');
  const tokenInfo = tokenTracker.getLastTokenUsage();

  if (lines.length < 3) {
    return boxContent; // Boîte trop petite, ne pas modifier
  }

  // Trouver la ligne avec le titre (Agent Action/Response)
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
    // Trouver les positions des bordures
    const line = lines[titleLineIndex];
    const firstPipe = line.indexOf('│');
    const lastPipe = line.lastIndexOf('│');

    if (firstPipe >= 0 && lastPipe > firstPipe) {
      // Extraire le titre actuel
      const content = line.substring(firstPipe + 1, lastPipe).trim();
      const title = content.includes('Agent Action')
        ? 'Agent Action'
        : 'Agent Response';

      // Créer le nouveau contenu avec les infos de tokens
      const newContent = `${title} ${tokenInfo}`;

      // Calculer le padding nécessaire
      const availableWidth = lastPipe - firstPipe - 3; // -3 pour les espaces
      const paddingLength = Math.max(0, availableWidth - newContent.length);

      // Assembler la nouvelle ligne
      lines[titleLineIndex] =
        `${line.substring(0, firstPipe + 1)} ${newContent}${' '.repeat(paddingLength)} ${line.substring(lastPipe)}`;

      return lines.join('\n');
    }
  }

  // Si on n'a pas pu modifier le titre, essayer d'insérer après le séparateur
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].includes('├') && lines[i].includes('┤')) {
      // Trouver la largeur de la boîte
      const lineWidth = lines[i].length;
      const nextLine = lines[i + 1];

      if (nextLine) {
        const firstPipe = nextLine.indexOf('│');
        const lastPipe = nextLine.lastIndexOf('│');

        if (firstPipe >= 0 && lastPipe > firstPipe) {
          // Calculer la largeur intérieure
          const innerWidth = lastPipe - firstPipe - 3;

          // Créer une ligne avec les infos de tokens
          const tokenContent = tokenInfo.trim();
          const padding = ' '.repeat(
            Math.max(0, innerWidth - tokenContent.length)
          );
          const tokenLine = `${nextLine.substring(0, firstPipe + 1)} ${tokenContent}${padding} ${nextLine.substring(lastPipe)}`;

          // Insérer après le séparateur
          lines.splice(i + 1, 0, tokenLine);

          return lines.join('\n');
        }
      }
    }
  }

  // Si tout échoue, retourner la boîte inchangée
  return boxContent;
}
