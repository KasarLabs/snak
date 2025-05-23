import { BaseAgent, AgentType, IAgent } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { ModelSelectionAgent } from './modelSelectionAgent.js';

export interface AgentInfo {
  id: string;
  type: AgentType;
  description: string;
  name?: string;
  group?: string;
  metadata?: Record<string, any>;
}

export interface AgentSelectionConfig {
  availableAgents: Record<string, IAgent>;
  modelSelector: ModelSelectionAgent | null;
  debug?: boolean;
}

export class AgentSelectionAgent extends BaseAgent {
  private availableAgents: Record<string, IAgent>;
  private agentInfo: Record<string, AgentInfo> = {};
  private modelSelector: ModelSelectionAgent | null;
  private debug: boolean;

  constructor(config: AgentSelectionConfig) {
    super('agent-selector', AgentType.OPERATOR);
    this.availableAgents = config.availableAgents || {};
    this.modelSelector = config.modelSelector;
    this.debug = config.debug || false;

    // Initialiser les informations sur les agents
    this.updateAgentInfo();
  }

  public async init(): Promise<void> {
    logger.debug('AgentSelectionAgent: Initializing');
    if (!this.modelSelector) {
      logger.warn(
        'AgentSelectionAgent: No ModelSelectionAgent provided, selection capabilities will be limited'
      );
    }

    if (Object.keys(this.availableAgents).length === 0) {
      logger.warn(
        'AgentSelectionAgent: No available agents provided for selection'
      );
    } else {
      logger.debug(
        `AgentSelectionAgent: Initialized with ${Object.keys(this.availableAgents).length} available agents`
      );
    }
  }

  /**
   * Met à jour la liste des agents disponibles
   */
  public setAvailableAgents(agents: Record<string, IAgent>): void {
    this.availableAgents = agents;
    this.updateAgentInfo();
  }

  /**
   * Met à jour les informations descriptives sur chaque agent
   */
  private updateAgentInfo(): void {
    this.agentInfo = {};

    Object.entries(this.availableAgents).forEach(([id, agent]) => {
      let description = this.getAgentDescription(id, agent.type);
      let name: string | undefined = undefined;
      let group: string | undefined = undefined;

      // Try to get more specific info from agent.getAgentConfig() if available
      if (typeof (agent as any).getAgentConfig === 'function') {
        try {
          const agentConfig = (agent as any).getAgentConfig();
          if (agentConfig) {
            description = agentConfig.description || description;
            name = agentConfig.name || name;
            group = agentConfig.group || group;
          }
        } catch (e) {
          logger.debug(`Could not retrieve agent config for ${id}: ${e}`);
        }
      }

      const info: AgentInfo = {
        id,
        type: agent.type,
        description,
        name,
        group,
      };

      // Extraire les métadonnées (name, group, description, etc.)
      // Metadata can override info from getAgentConfig if present
      if ((agent as any).metadata) {
        const metadata = (agent as any).metadata;
        if (metadata.name) info.name = metadata.name;
        if (metadata.group) info.group = metadata.group;
        if (metadata.description) info.description = metadata.description;

        // Stocker toutes les métadonnées pour une utilisation ultérieure
        info.metadata = { ...metadata };
      }

      this.agentInfo[id] = info;
    });

    if (this.debug) {
      logger.debug(
        `AgentSelectionAgent: Updated info for ${Object.keys(this.agentInfo).length} agents`
      );
      // Log détaillé des agents disponibles en mode debug
      Object.values(this.agentInfo).forEach((agent) => {
        logger.debug(
          `Agent ${agent.id}: ${agent.name || 'unnamed'} (${agent.group || 'no group'}) - ${agent.description?.substring(0, 50)}...`
        );
      });
    }
  }

  public async execute(
    input: string | BaseMessage,
    _config?: Record<string, any>
  ): Promise<AIMessage> {
    let queryString: string;
    if (typeof input === 'string') {
      queryString = input;
    } else if (input instanceof BaseMessage) {
      if (typeof input.content === 'string') {
        queryString = input.content;
      } else if (Array.isArray(input.content)) {
        // Handle MessageContentComplex[] by joining or serializing
        queryString = input.content
          .map((part) => {
            if (typeof part === 'string') {
              return part;
            }
            switch (part.type) {
              case 'text':
                return part.text || '';
              case 'image_url':
                // Represent image with a placeholder or serialize URL
                return '[Image]'; // Or: typeof part.image_url === 'string' ? part.image_url : JSON.stringify(part.image_url)
              default:
                return '';
            }
          })
          .join(' ');
      } else {
        // Fallback for other MessageContent types if necessary, or if input.content is a non-array object
        queryString = JSON.stringify(input.content);
      }
    } else {
      // This path should ideally not be hit due to type signature
      queryString = JSON.stringify(input);
    }

    if (this.debug) {
      logger.debug(
        `AgentSelectionAgent: Analyzing query: "${queryString.substring(0, 100)}${queryString.length > 100 ? '...' : ''}"`
      );
    }

    // Vérifie d'abord s'il y a une mention explicite d'un agent
    const explicitAgent = this.checkForExplicitAgentMention(queryString);
    if (explicitAgent) {
      if (this.debug) {
        logger.debug(
          `AgentSelectionAgent: Detected explicit mention of agent "${explicitAgent.id}"`
        );
      }
      return this.createSelectionResponse(explicitAgent.id, queryString);
    }

    // Sinon, utiliser le modèle pour analyser la requête et déterminer l'agent approprié
    return await this.analyzeQueryWithModel(queryString);
  }

  private checkForExplicitAgentMention(query: string): AgentInfo | null {
    // Patterns de détection
    const idPattern = /agent(?:\s+id)?\s+(\d+|[a-zA-Z_-]+)/i;
    const namePattern = /agent (?:named|called) ["']?([a-zA-Z_-]+)["']?/i;
    const groupPattern =
      /(?:use|with|in) (?:the|a)? ["']?([a-zA-Z_-]+)["']? (?:group|category)/i;
    const groupNamePattern =
      /(?:use|with|from) (?:the|a)? ["']?([a-zA-Z_-]+)["']? ["']?([a-zA-Z_-]+)["']?/i;

    // Chercher les combinaisons groupe+nom
    const groupNameMatch = query.match(groupNamePattern);
    if (groupNameMatch && groupNameMatch[1] && groupNameMatch[2]) {
      const potentialGroup = groupNameMatch[1].toLowerCase();
      const potentialName = groupNameMatch[2].toLowerCase();

      // Cherche un agent avec ce groupe et ce nom exacts
      for (const agent of Object.values(this.agentInfo)) {
        if (
          agent.group?.toLowerCase() === potentialGroup &&
          agent.name?.toLowerCase() === potentialName
        ) {
          return agent;
        }
      }

      // Si pas trouvé, cherche avec groupe exact et nom partiel
      for (const agent of Object.values(this.agentInfo)) {
        if (
          agent.group?.toLowerCase() === potentialGroup &&
          agent.name?.toLowerCase().includes(potentialName)
        ) {
          return agent;
        }
      }
    }

    // Vérifier la mention par ID
    const idMatch = query.match(idPattern);
    if (idMatch && idMatch[1]) {
      const agentId = idMatch[1];
      for (const [id] of Object.entries(this.availableAgents)) {
        if (id === agentId || id === `snak-${agentId}`) {
          return this.agentInfo[id];
        }
      }
    }

    // Vérifier la mention par nom
    const nameMatch = query.match(namePattern);
    if (nameMatch && nameMatch[1]) {
      const agentName = nameMatch[1].toLowerCase();
      for (const agent of Object.values(this.agentInfo)) {
        if (agent.name?.toLowerCase() === agentName) {
          return agent;
        }
      }
      for (const agent of Object.values(this.agentInfo)) {
        if (agent.name?.toLowerCase().includes(agentName)) {
          return agent;
        }
      }
    }

    // Vérifier la mention par groupe
    const groupMatch = query.match(groupPattern);
    if (groupMatch && groupMatch[1]) {
      const groupName = groupMatch[1].toLowerCase();
      const matchingAgents = Object.values(this.agentInfo).filter(
        (agent) => agent.group?.toLowerCase() === groupName
      );

      if (matchingAgents.length === 1) {
        return matchingAgents[0];
      }
    }

    return null;
  }

  private async analyzeQueryWithModel(query: string): Promise<AIMessage> {
    if (!this.modelSelector) {
      logger.warn(
        'AgentSelectionAgent: No ModelSelectionAgent available, defaulting to "snak"'
      );
      return this.createSelectionResponse('snak', query);
    }

    try {
      // Créer une description complète des agents disponibles avec tous leurs attributs
      const agentDescriptions = Object.entries(this.agentInfo)
        .map(([id, info]) => {
          const name = info.name || id;
          const group = info.group ? ` [Group: ${info.group}]` : '';
          const description = info.description || 'No description available';

          // Format simplifié : nom + groupe + description
          return `- ${name}${group}: ${description}`;
        })
        .join('\n');

      if (this.debug) {
        logger.debug(
          `AgentSelectionAgent: Available agents for selection:\n${agentDescriptions}`
        );
      }

      const prompt = new HumanMessage({
        content: `Analyze the following user query and determine which agent should handle it:
    
USER QUERY: "${query}"

Available agents:
${agentDescriptions}

First, understand what the user is trying to accomplish and identify key requirements.
Then determine which agent or type of agent would be most appropriate based on its name, group, and capabilities.

Your response must ONLY contain the ID of the selected agent (the exact string at the beginning of each agent line).
Do not include any explanations, analysis, or other text.

If multiple agents could handle this query but you need more specific information, respond with "NEED_CLARIFICATION" followed by a JSON object with these fields:
{
  "possibleAgents": [list of agent IDs that could handle this],
  "missingInfo": "what specific information is needed",
  "clarificationQuestion": "a precise question to ask the user"
}

If the query doesn\'t match any available agent\'s capabilities, respond with "NO_MATCHING_AGENT".`,
      });

      const model = await this.modelSelector.getModelForTask([], 'fast');
      const result = await model.invoke([prompt]);
      const content =
        typeof result.content === 'string'
          ? result.content.trim()
          : JSON.stringify(result.content);

      if (this.debug) {
        logger.debug(`AgentSelectionAgent: Model raw response: "${content}"`);
      }

      // Traiter les cas de clarification
      if (content.startsWith('NEED_CLARIFICATION')) {
        try {
          const jsonStartIndex = content.indexOf('{');
          const jsonEndIndex = content.lastIndexOf('}') + 1;
          if (jsonStartIndex > 0 && jsonEndIndex > jsonStartIndex) {
            const jsonContent = content.substring(jsonStartIndex, jsonEndIndex);
            const clarificationData = JSON.parse(jsonContent);

            return this.createClarificationResponse(
              clarificationData.possibleAgents || [],
              clarificationData.missingInfo || 'more specific information',
              clarificationData.clarificationQuestion ||
                'Could you please provide more details about what you need?'
            );
          }
        } catch (jsonError) {
          logger.error(
            `AgentSelectionAgent: Error parsing clarification JSON: ${jsonError}`
          );
        }

        // Fallback si le parsing JSON échoue
        return this.createClarificationResponse(
          [],
          'agent selection criteria',
          'I need more information to select the appropriate agent. Could you provide more details?'
        );
      }

      if (content.startsWith('NO_MATCHING_AGENT')) {
        return this.createClarificationResponse(
          [],
          'matching agent capabilities',
          "I don\'t have an agent that can handle this specific request. Could you clarify what you\'re trying to do?"
        );
      }

      // Extraire l\'ID de l\'agent - prendre le premier mot/ligne qui correspond à un agent existant
      const lines = content.split(/[\n\r]+/);
      let agentId = '';

      // Essayer d\'abord la première ligne complète comme ID
      const firstLine = lines[0].trim();
      if (this.availableAgents[firstLine]) {
        agentId = firstLine;
      } else {
        // Sinon, diviser en tokens et chercher un ID valide
        const tokens = content.split(/[\s,;:]+/);
        for (const token of tokens) {
          const cleanToken = token.trim().replace(/[^\w-]/g, '');
          if (cleanToken && this.availableAgents[cleanToken]) {
            agentId = cleanToken;
            break;
          }
        }
      }

      if (agentId && this.availableAgents[agentId]) {
        logger.debug(
          `AgentSelectionAgent: Selected agent "${agentId}" for query "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`
        );
        return this.createSelectionResponse(agentId, query);
      } else {
        // Vérifier si un agent pourrait correspondre partiellement
        const possibleAgents = Object.keys(this.availableAgents).filter(
          (id) =>
            content.toLowerCase().includes(id.toLowerCase()) ||
            (this.agentInfo[id]?.name &&
              content
                .toLowerCase()
                .includes(this.agentInfo[id].name!.toLowerCase()))
        );

        if (possibleAgents.length === 1) {
          // Si un seul agent correspond partiellement, l\'utiliser
          logger.debug(
            `AgentSelectionAgent: Found partial match with agent "${possibleAgents[0]}"`
          );
          return this.createSelectionResponse(possibleAgents[0], query);
        }

        if (possibleAgents.length > 1) {
          // Si plusieurs agents correspondent partiellement, demander une clarification
          return this.createClarificationResponse(
            possibleAgents,
            'specific agent selection',
            "I found multiple agents that could handle this request. Could you specify which one you\'d like to use?"
          );
        }

        // Si aucun agent ne correspond, essayer de rediriger vers l\'agent par défaut
        if (this.availableAgents['snak']) {
          logger.warn(
            `AgentSelectionAgent: No matching agent found for "${content}", defaulting to "snak"`
          );
          return this.createSelectionResponse('snak', query);
        }

        // En dernier recours, demander une clarification
        logger.warn(
          `AgentSelectionAgent: Unable to identify any agent from model response: "${content}"`
        );
        return this.createClarificationResponse(
          [],
          'valid agent identifier',
          "I couldn\'t identify which agent should handle your request. Could you describe more precisely what you need help with?"
        );
      }
    } catch (error) {
      logger.error(
        `AgentSelectionAgent: Error during model analysis: ${error}`
      );
      return this.createClarificationResponse(
        [],
        'clear request intent',
        'I encountered an issue understanding your request. Could you rephrase it or provide more details about what you need help with?'
      );
    }
  }

  private getAgentDescription(id: string, type: AgentType): string {
    if (id === 'supervisor') {
      return 'The main coordinator agent that orchestrates system operations';
    } else if (id === 'model-selector') {
      return 'Responsible for selecting the appropriate AI model for each task';
    } else if (id === 'memory') {
      return 'Manages persisting and retrieving memories across conversations';
    } else if (id === 'tools') {
      return 'Handles executing various tools and external integrations';
    } else if (id.startsWith('snak')) {
      return 'A general-purpose agent created by the user to handle various tasks';
    } else if (type === AgentType.OPERATOR) {
      return 'An operator agent that performs specific system functions';
    }
    return 'An agent in the system';
  }

  private createSelectionResponse(
    agentId: string,
    originalQuery: string
  ): AIMessage {
    return new AIMessage({
      content: `Selected agent: ${agentId}`,
      additional_kwargs: {
        from: 'agent-selector',
        nextAgent: agentId,
        originalUserQuery: originalQuery,
      },
    });
  }

  private createClarificationResponse(
    possibleAgents: string[],
    missingInfo: string,
    clarificationQuestion: string
  ): AIMessage {
    let agentOptions = '';
    if (possibleAgents.length > 0) {
      const agentsList = possibleAgents
        .map((id) => {
          const agent = this.agentInfo[id];
          if (!agent) return id;

          const name = agent.name || id;
          const group = agent.group ? ` [Group: ${agent.group}]` : '';
          const description = agent.description || 'No description available';

          // Format simplifié : nom + groupe + description
          return `- ${name}${group}: ${description}`;
        })
        .join('\n');

      agentOptions = `\n\nThese agents might be able to help:\n${agentsList}`;
    }

    return new AIMessage({
      content: `I need more information to select the most appropriate agent for your request. Specifically, I need to know ${missingInfo}.${agentOptions}\n\n${clarificationQuestion}`,
      additional_kwargs: {
        from: 'agent-selector',
        needsClarification: true,
        possibleAgents: possibleAgents,
        originalClarificationQuestion: clarificationQuestion,
      },
    });
  }
}
