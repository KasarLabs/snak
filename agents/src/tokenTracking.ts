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

  // Ajout des limites de tokens par défaut
  maxInputTokens = 100000; // Limite de tokens d'entrée
  maxCompletionTokens = 100000; // Limite de tokens de sortie
  maxTotalTokens = 150000; // Limite totale de tokens

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
   * Check if the input exceeds token limits
   * @param messages Messages to analyze
   * @returns True if within limits, error object if exceeded
   */
  checkTokenLimits(messageTokens: number): {
    success: boolean;
    error?: string;
  } {
    // On ne bloque jamais même en cas de dépassement extrême
    // On enregistre simplement un avertissement avec des niveaux de gravité
    if (messageTokens > this.maxInputTokens * 2) {
      // Dépassement très important - avertissement critique
      logger.warn(
        `CRITIQUE: Input tokens (${messageTokens}) dépassent largement la limite (${this.maxInputTokens}). Performances dégradées probables.`
      );
      // On force une réinitialisation des compteurs pour éviter l'accumulation
      this.reset();
      return { success: true };
    } else if (messageTokens > this.maxInputTokens) {
      // Dépassement modéré - simple avertissement
      logger.warn(
        `Input tokens (${messageTokens}) excèdent la limite suggérée (${this.maxInputTokens}), mais on continue avec précaution`
      );
      return { success: true };
    }

    // Vérifier si l'ajout de ces tokens dépasserait la limite totale
    if (this.promptTokens + messageTokens > this.maxTotalTokens) {
      logger.warn(
        `Total tokens (${this.promptTokens + messageTokens}) dépasseraient la limite (${this.maxTotalTokens}), réinitialisation des compteurs`
      );
      // Réinitialiser les compteurs et continuer plutôt que de bloquer
      this.reset();
      return { success: true };
    }

    return { success: true };
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

      // Détecter les problèmes de tokens plus tôt
      // Vérifier à la fois les tokens d'entrée et de sortie
      const totalForThisCall =
        (tokenUsage.promptTokens || 0) + (tokenUsage.completionTokens || 0);

      // Si un seul appel dépasse déjà 75% de la limite, c'est un signe de problème potentiel
      if (totalForThisCall > this.maxTotalTokens * 0.75) {
        logger.warn(
          `Appel LLM volumineux: ${totalForThisCall} tokens (${tokenUsage.promptTokens || 0} in / ${tokenUsage.completionTokens || 0} out)`
        );
        logger.warn(
          `Cet appel représente plus de 75% de la limite totale (${this.maxTotalTokens}). Traitement plus agressif recommandé.`
        );
      }

      // Check if completion tokens exceed limit
      if (tokenUsage.completionTokens > this.maxCompletionTokens) {
        logger.warn(
          `Completion tokens exceeded limit: ${tokenUsage.completionTokens} > ${this.maxCompletionTokens}`
        );
      }

      // Update counters
      this.promptTokens += tokenUsage.promptTokens || 0;
      this.completionTokens += tokenUsage.completionTokens || 0;
      this.totalTokens += tokenUsage.totalTokens || 0;

      // Auto-reset des compteurs à un seuil plus bas (80% au lieu de 90%)
      // pour anticiper les problèmes plus tôt
      const tokenThreshold = this.maxTotalTokens * 0.8;
      if (this.totalTokens > tokenThreshold) {
        logger.warn(
          `Limite de tokens approchée (${this.totalTokens}/${this.maxTotalTokens}). Réinitialisation préventive des compteurs.`
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
          `Tokens: ${this.lastTokenUsage.totalTokens} (${this.lastTokenUsage.promptTokens} in / ${this.lastTokenUsage.completionTokens} out)`
        )
      );
    } catch (e) {
      // Ne pas laisser les erreurs d'extraction d'infos sur les tokens bloquer le système
      console.error('Error in handleLLMEnd:', e);
      // Si on ne peut pas extraire les infos, continuer quand même mais en réinitialisant par sécurité
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

// Remplacer l'instance singleton - changer const à let pour permettre la mise à jour
export let tokenTracker = new SilentTokenTrackingHandler();

/**
 * Exporter l'estimateur de tokens pour l'utiliser dans d'autres modules
 */
export function estimateTokens(text: string): number {
  // Estimation simple: 4 caractères ~ 1 token (estimation générale)
  return Math.ceil(text.length / 4);
}

/**
 * Truncates content to fit within token limits more intelligently
 * @param content Text content to truncate
 * @param maxTokens Maximum tokens allowed
 * @returns Truncated content
 */
export function truncateToTokenLimit(
  content: string,
  maxTokens: number
): string {
  const estimatedTokens = estimateTokens(content);
  if (estimatedTokens <= maxTokens) return content;

  // Si nous avons besoin de tronquer le contenu, essayons de le faire intelligemment

  // 1. Détection des commandes ou résultats d'outils - ces sections sont souvent les plus volumineuses
  const containsToolOutput =
    content.includes('Result:') ||
    content.includes('Tool output:') ||
    content.includes('Command output:');

  // 2. Découper le contenu en paragraphes pour pouvoir garder les plus importants
  const paragraphs = content.split('\n\n');

  // 3. Stratégie différente selon le type de contenu
  if (containsToolOutput && paragraphs.length > 2) {
    // Pour les résultats d'outils, nous voulons garder le début et la fin, mais résumer le milieu

    // Approximation: chaque token = ~4 caractères
    const targetChars = maxTokens * 4;

    // Réserver 10% pour le message d'avertissement et les derniers paragraphes
    const reservedChars = targetChars * 0.1;

    // Utiliser 50% pour le début (contexte initial)
    const headChars = targetChars * 0.5;

    // Utiliser le reste (40%) pour la fin (résultats et conclusions)
    const tailChars = targetChars - headChars - reservedChars;

    // Extraire le début et la fin
    let currentLength = 0;
    let headParagraphs = [];
    for (const para of paragraphs) {
      if (currentLength + para.length <= headChars) {
        headParagraphs.push(para);
        currentLength += para.length + 2; // +2 pour les \n\n
      } else {
        break;
      }
    }

    let tailParagraphs = [];
    currentLength = 0;
    for (const para of paragraphs.slice().reverse()) {
      if (currentLength + para.length <= tailChars) {
        tailParagraphs.unshift(para); // Ajouter au début
        currentLength += para.length + 2;
      } else {
        break;
      }
    }

    // Construire le contenu tronqué
    return (
      headParagraphs.join('\n\n') +
      '\n\n[...CONTENU TRONQUÉ...]\n\n' +
      tailParagraphs.join('\n\n') +
      '\n\n[NOTE: CONTENU TRONQUÉ POUR RESPECTER LA LIMITE DE TOKENS]'
    );
  } else if (content.length > 1000 && containsToolOutput) {
    // Pour les très longs résultats d'outils, garder le début et la fin sans paragraphes
    const charLimit = maxTokens * 4;
    const headSize = Math.floor(charLimit * 0.5);
    const tailSize = Math.floor(charLimit * 0.3);

    const head = content.substring(0, headSize);
    const tail = content.substring(content.length - tailSize);

    return (
      head +
      '\n\n[...CONTENU TRONQUÉ...]\n\n' +
      tail +
      '\n\n[NOTE: CONTENU TRONQUÉ POUR RESPECTER LA LIMITE DE TOKENS]'
    );
  } else {
    // Pour les contenus normaux, préserver le début qui contient souvent le raisonnement principal
    // Estimation: maxTokens * 4 caractères pour la taille approximative
    const approximateChars = maxTokens * 4;

    // Réserver de l'espace pour le message d'avertissement
    const reservedChars = 100;
    const usableChars = approximateChars - reservedChars;

    // Préserver 80% du début et 20% de la fin
    const headSize = Math.floor(usableChars * 0.8);
    const tailSize = Math.floor(usableChars * 0.2);

    if (content.length <= headSize + tailSize + reservedChars) {
      // Pas besoin de tronquer la fin
      return (
        content.substring(0, approximateChars - reservedChars) +
        '\n\n[FIN TRONQUÉE POUR RESPECTER LA LIMITE DE TOKENS]'
      );
    }

    // Tronquer en préservant le début et la fin
    const head = content.substring(0, headSize);
    const tail = content.substring(content.length - tailSize);

    return (
      head +
      '\n\n[...CONTENU CENTRAL TRONQUÉ...]\n\n' +
      tail +
      '\n\n[NOTE: CONTENU TRONQUÉ POUR RESPECTER LA LIMITE DE TOKENS]'
    );
  }
}

/**
 * Configure a model with token tracking
 * @param model LLM model instance
 * @param options Options for token tracking
 * @returns Model with token tracking
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
  // Create a new token tracker with custom limits if specified
  const tracker = new SilentTokenTrackingHandler({
    maxInputTokens: options?.maxInputTokens,
    maxCompletionTokens: options?.maxCompletionTokens,
    maxTotalTokens: options?.maxTotalTokens,
  });

  // Check if token logging is disabled
  if (options?.tokenLogging === false) {
    // Assurez-vous de désactiver la verbosité du modèle
    model.verbose = false;
    return model; // Return model without token tracking
  }

  // Désactiver explicitement la verbosité même si on suit les tokens
  model.verbose = false;

  // Override the invoke method to check token limits before sending to the model
  const originalInvoke = model.invoke.bind(model);
  model.invoke = async function (messages: any, ...args: any[]) {
    let messageContent = '';

    try {
      // Extract text content from messages for token estimation
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

      // Check token limits - notre approche permissive qui n'échoue jamais
      tracker.checkTokenLimits(estimatedTokens);

      // Gestion progressive des cas de dépassement
      let truncationApplied = false;

      // 1. Cas de dépassement extrême (plus de 2x la limite) - réduction drastique
      if (estimatedTokens > tracker.maxInputTokens * 2) {
        logger.warn(
          `ALERTE: Entrée extrêmement volumineuse (${estimatedTokens} tokens estimés)`
        );
        truncationApplied = true;

        // Réduction drastique - conserver uniquement les informations essentielles
        if (typeof messages === 'string') {
          // Créer un résumé avec juste 20% de la limite autorisée
          messages =
            'LE CONTEXTE PRÉCÉDENT ÉTAIT TROP VOLUMINEUX. Merci de prendre une action simple basée sur les informations suivantes : ' +
            truncateToTokenLimit(
              messages,
              Math.floor(tracker.maxInputTokens * 0.2)
            );
        } else if (Array.isArray(messages)) {
          // Garder uniquement les messages essentiels
          if (messages.length > 1) {
            // Garder uniquement le premier message (système) et le dernier (plus récent)
            messages = [
              messages[0],
              {
                role: 'system',
                content:
                  'Le contexte précédent était trop volumineux et a été complètement supprimé. Merci de prendre une action simple.',
              },
              messages[messages.length - 1],
            ];
          }
        } else if (messages?.messages && Array.isArray(messages.messages)) {
          // Même approche pour les objets avec une propriété messages
          const msgArray = messages.messages;
          if (msgArray.length > 1) {
            messages.messages = [
              msgArray[0],
              {
                role: 'system',
                content:
                  'Le contexte précédent était trop volumineux et a été complètement supprimé. Merci de prendre une action simple.',
              },
              msgArray[msgArray.length - 1],
            ];
          }
        }
      }
      // 2. Cas de dépassement important mais gérable (entre 1x et 2x la limite)
      else if (estimatedTokens > tracker.maxInputTokens * 1.5) {
        logger.warn(
          `Entrée très volumineuse (${estimatedTokens} tokens estimés), troncature appliquée`
        );
        truncationApplied = true;

        // Préparer un message tronqué
        if (typeof messages === 'string') {
          // Si c'est une chaîne simple
          messages = truncateToTokenLimit(messages, tracker.maxInputTokens);
        } else if (Array.isArray(messages)) {
          // Si c'est un tableau de messages, garder les plus récents
          if (messages.length > 3) {
            messages = [
              // Garder le premier message (souvent le système)
              messages[0],
              // Ajouter un message indiquant la troncature
              {
                role: 'system',
                content:
                  'Le contexte précédent a été partiellement tronqué pour des raisons de limite de tokens.',
              },
              // Garder les derniers messages (plus pertinents)
              ...messages.slice(-Math.min(4, messages.length)),
            ];
          }
        } else if (messages?.messages && Array.isArray(messages.messages)) {
          // Si messages.messages est un tableau
          const msgArray = messages.messages;
          if (msgArray.length > 3) {
            messages.messages = [
              // Garder le premier message
              msgArray[0],
              // Ajouter un message de troncature
              {
                role: 'system',
                content:
                  'Le contexte précédent a été partiellement tronqué pour des raisons de limite de tokens.',
              },
              // Garder les derniers messages
              ...msgArray.slice(-Math.min(4, msgArray.length)),
            ];
          }
        }
      }
      // 3. Cas de dépassement léger (entre 1x et 1.5x la limite)
      else if (estimatedTokens > tracker.maxInputTokens) {
        logger.warn(
          `Entrée volumineuse (${estimatedTokens} tokens estimés), légère troncature appliquée`
        );
        truncationApplied = true;

        // Troncature légère
        if (typeof messages === 'string') {
          messages = truncateToTokenLimit(messages, tracker.maxInputTokens);
        } else if (Array.isArray(messages) && messages.length > 4) {
          // Garder plus de messages mais supprimer certains du milieu
          const systemMessages = messages.slice(0, 1);
          const recentMessages = messages.slice(-Math.min(5, messages.length));

          messages = [
            ...systemMessages,
            {
              role: 'system',
              content:
                'Quelques messages intermédiaires ont été omis pour des raisons de limite de tokens.',
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
                'Quelques messages intermédiaires ont été omis pour des raisons de limite de tokens.',
            },
            ...recentMessages,
          ];
        }
      }

      // Si une troncature a été appliquée, estimer à nouveau les tokens pour vérification
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
          `Après troncature: ${newEstimatedTokens} tokens estimés (réduction de ${Math.round(((estimatedTokens - newEstimatedTokens) / estimatedTokens) * 100)}%)`
        );
      }

      // Tenter d'invoquer le modèle avec les messages (potentiellement tronqués)
      try {
        return await originalInvoke(messages, ...args);
      } catch (invokeError) {
        // Gérer les erreurs d'invocation liées aux tokens
        if (
          invokeError instanceof Error &&
          (invokeError.message.includes('token limit') ||
            invokeError.message.includes('tokens exceed') ||
            invokeError.message.includes('context length') ||
            invokeError.message.includes('maximum context length'))
        ) {
          logger.error(
            `Erreur de tokens malgré la troncature: ${invokeError.message}`
          );

          // Tentative d'urgence - réduction drastique à un simple message
          if (typeof messages === 'string') {
            const emergencyMessage =
              'Le contexte était trop volumineux. Merci de prendre une action très simple basée sur les objectifs généraux.';
            return await originalInvoke(emergencyMessage, ...args);
          } else if (Array.isArray(messages) && messages.length > 0) {
            // Créer un message d'urgence minimal
            const emergencyMessages = [
              messages[0], // Conserver le message système si disponible
              {
                role: 'system',
                content:
                  'Toutes les informations précédentes ont été perdues en raison de limites de tokens. Prendre une action très simple.',
              },
            ];
            return await originalInvoke(emergencyMessages, ...args);
          } else if (
            messages?.messages &&
            Array.isArray(messages.messages) &&
            messages.messages.length > 0
          ) {
            // Même approche pour les objets avec une propriété messages
            const msgArray = messages.messages;
            messages.messages = [
              msgArray[0], // Message système
              {
                role: 'system',
                content:
                  'Toutes les informations précédentes ont été perdues en raison de limites de tokens. Prendre une action très simple.',
              },
            ];
            return await originalInvoke(messages, ...args);
          }

          // Si toutes les tentatives échouent, retourner un message d'erreur formaté comme une réponse LLM
          // Cela permettra au code appelant de continuer sans exception
          return {
            content:
              'Je ne peux pas traiter cette demande en raison de limites de tokens. Veuillez essayer une action plus simple.',
            tool_calls: [],
            usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
          };
        }

        // Pour les autres types d'erreurs, les propager
        throw invokeError;
      }
    } catch (error) {
      // Gestion des erreurs lors de la préparation des messages
      logger.error(`Erreur lors de la préparation des messages: ${error}`);

      // Tenter une récupération d'urgence avec un message minimal
      try {
        const emergencyMessage =
          "Une erreur s'est produite lors du traitement du contexte. Merci de prendre une action simple basée sur les objectifs généraux.";
        return await originalInvoke(emergencyMessage, ...args);
      } catch (finalError) {
        // Si même la récupération d'urgence échoue, retourner un format compatible
        return {
          content:
            'Impossible de traiter cette demande. Veuillez réessayer avec une requête plus simple.',
          tool_calls: [],
          usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        };
      }
    }
  };

  // Add our token tracker to the callbacks
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
        `${leftPart}│ ${finalContent}${' '.repeat(paddingLength)} ${chalk.cyan('│')}${rightPart.substring(1)}`;

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
          const tokenLine = `${leftPart}│ ${finalContent}${' '.repeat(paddingLength)} ${chalk.cyan('│')}${rightPart.substring(1)}`;

          // Insert after the separator
          lines.splice(i + 1, 0, tokenLine);

          return lines.join('\n');
        }
      }
    }
  }

  return boxContent;
}

/**
 * Create a debug token tracker that prints more information
 */
export function createDebugTokenTracker(): TokenTrackingHandler {
  return new TokenTrackingHandler({ debug: true });
}
