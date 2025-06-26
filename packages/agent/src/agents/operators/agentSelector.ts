import { BaseAgent, AgentType, IAgent } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ModelSelector } from './modelSelector.js';
import {
  agentSelectionPrompt,
  agentSelectionSystemPrompt,
  noMatchingAgentMessage,
  defaultClarificationMessage,
  errorFallbackMessage,
  noValidAgentMessage,
} from '../../prompt/agentSelectorPrompts.js';

export interface AgentInfo {
  id: string;
  type: AgentType;
  name: string;
  group: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface AgentSelectionConfig {
  availableAgents: Record<string, IAgent>;
  modelSelector: ModelSelector | null;
  debug?: boolean;
}

/**
 * AgentSelector analyzes user queries and determines which specialized agent should handle each request.
 * It supports both explicit agent mentions and AI-powered agent selection based on query context.
 */
export class AgentSelector extends BaseAgent {
  private availableAgents: Record<string, IAgent>;
  private agentInfo: Record<string, AgentInfo> = {};
  private modelSelector: ModelSelector | null;
  private debug: boolean;

  constructor(config: AgentSelectionConfig) {
    super('agent-selector', AgentType.OPERATOR);
    this.availableAgents = config.availableAgents || {};
    this.modelSelector = config.modelSelector;
    this.debug = config.debug || false;
    this.updateAgentInfo();
  }

  public async init(): Promise<void> {
    logger.debug('AgentSelector: Initializing');

    if (!this.modelSelector) {
      logger.warn(
        'AgentSelector: No ModelSelector provided, selection capabilities will be limited'
      );
    }

    if (Object.keys(this.availableAgents).length === 0) {
      logger.warn('AgentSelector: No available agents provided for selection');
    } else {
      logger.debug(
        `AgentSelector: Initialized with ${Object.keys(this.availableAgents).length} available agents`
      );
    }
  }

  /**
   * Updates the list of available agents and refreshes agent information.
   */
  public setAvailableAgents(agents: Record<string, IAgent>): void {
    this.availableAgents = agents;
    this.updateAgentInfo();
  }

  /**
   * Updates descriptive information for each available agent by extracting metadata
   * from agent configuration and metadata properties.
   */
  private updateAgentInfo(): void {
    this.agentInfo = {};

    Object.entries(this.availableAgents).forEach(([id, agent]) => {
      let name: string | undefined;
      let group: string | undefined;
      let description: string | undefined;

      if (typeof (agent as any).getAgentConfig === 'function') {
        try {
          const agentConfig = (agent as any).getAgentConfig();
          if (agentConfig) {
            name = agentConfig.name;
            group = agentConfig.group;
            description = agentConfig.description;
          }
        } catch (e) {
          logger.debug(`Could not retrieve agent config for ${id}: ${e}`);
        }
      }

      const info: AgentInfo = {
        id,
        type: agent.type,
        name: name || '',
        group: group || '',
        description: description || '',
      };

      if ((agent as any).metadata) {
        const metadata = (agent as any).metadata;
        if (metadata.name) info.name = metadata.name;
        if (metadata.group) info.group = metadata.group;
        if (metadata.description) info.description = metadata.description;
        info.metadata = { ...metadata };
      }

      // Also check for direct properties on the agent
      if (!info.name && (agent as any).name) {
        info.name = (agent as any).name;
      }
      if (!info.group && (agent as any).group) {
        info.group = (agent as any).group;
      }
      if (!info.description && (agent as any).description) {
        info.description = (agent as any).description;
      }

      this.agentInfo[id] = info;
    });

    if (this.debug) {
      logger.debug(
        `AgentSelector: Updated info for ${Object.keys(this.agentInfo).length} agents`
      );
      Object.values(this.agentInfo).forEach((agent) => {
        logger.debug(
          `Agent ${agent.id}: ${agent.name || 'unnamed'} (${agent.group || 'no group'}) - ${agent.description?.substring(0, 50)}...`
        );
      });
    }
  }

  /**
   * Executes agent selection based on the input query.
   * First checks for explicit agent mentions, then uses AI model for intelligent selection.
   */
  public async execute(
    input: string | BaseMessage,
    isInterrupted?: boolean,
    _config?: Record<string, any>
  ): Promise<AIMessage> {
    const queryString = this.extractQueryString(input);

    if (this.debug) {
      logger.debug(
        `AgentSelector: Analyzing query: "${queryString.substring(0, 100)}${queryString.length > 100 ? '...' : ''}"`
      );
    }

    const explicitAgent = this.checkForExplicitAgentMention(queryString);
    if (explicitAgent) {
      if (this.debug) {
        logger.debug(
          `AgentSelector: Detected explicit mention of agent "${explicitAgent.id}"`
        );
      }
      return this.createSelectionResponse(explicitAgent.id, queryString);
    }

    return await this.analyzeQueryWithModel(queryString);
  }

  /**
   * Extracts query string from various input types including BaseMessage objects.
   */
  private extractQueryString(input: string | BaseMessage): string {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof BaseMessage) {
      if (typeof input.content === 'string') {
        return input.content;
      }

      if (Array.isArray(input.content)) {
        return input.content
          .map((part) => {
            if (typeof part === 'string') return part;

            switch (part.type) {
              case 'text':
                return part.text || '';
              case 'image_url':
                return '[Image]';
              default:
                return '';
            }
          })
          .join(' ');
      }

      return JSON.stringify(input.content);
    }

    return JSON.stringify(input);
  }

  /**
   * Checks for explicit agent mentions in the query using various patterns:
   * - Agent ID patterns
   * - Agent name patterns
   * - Group patterns
   * - Combined group+name patterns
   */
  private checkForExplicitAgentMention(query: string): AgentInfo | null {
    // First check for configuration-related queries

    const idPattern = /agent(?:\s+id)?\s+(\d+|[a-zA-Z_-]+)/i;
    const namePattern = /agent (?:named|called) ["']?([a-zA-Z_-]+)["']?/i;
    const groupPattern =
      /(?:use|with|in) (?:the|a)? ["']?([a-zA-Z_-]+)["']? (?:group|category)/i;
    const groupNamePattern =
      /(?:use|with|from) (?:the|a)? ["']?([a-zA-Z_-]+)["']? ["']?([a-zA-Z_-]+)["']?/i;

    const groupNameMatch = query.match(groupNamePattern);
    if (groupNameMatch?.[1] && groupNameMatch[2]) {
      const potentialGroup = groupNameMatch[1].toLowerCase();
      const potentialName = groupNameMatch[2].toLowerCase();

      for (const agent of Object.values(this.agentInfo)) {
        if (
          agent.group?.toLowerCase() === potentialGroup &&
          agent.name?.toLowerCase() === potentialName
        ) {
          return agent;
        }
      }

      for (const agent of Object.values(this.agentInfo)) {
        if (
          agent.group?.toLowerCase() === potentialGroup &&
          agent.name?.toLowerCase().includes(potentialName)
        ) {
          return agent;
        }
      }
    }

    const idMatch = query.match(idPattern);
    if (idMatch?.[1]) {
      const agentId = idMatch[1];
      for (const [id] of Object.entries(this.availableAgents)) {
        if (id === agentId || id === `snak-${agentId}`) {
          return this.agentInfo[id];
        }
      }
    }

    const nameMatch = query.match(namePattern);
    if (nameMatch?.[1]) {
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

    const groupMatch = query.match(groupPattern);
    if (groupMatch?.[1]) {
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

  /**
   * Uses AI model to analyze the query and determine the most appropriate agent.
   * Falls back to default 'snak' agent if no model is available.
   */
  private async analyzeQueryWithModel(query: string): Promise<AIMessage> {
    if (!this.modelSelector) {
      logger.warn(
        'AgentSelector: No ModelSelector available, defaulting to "snak"'
      );
      return this.createSelectionResponse('snak', query);
    }

    try {
      const agentDescriptions = Object.entries(this.agentInfo)
        .map(([id, info]) => {
          const name = info.name || id;
          const group = info.group || 'No group';
          const description = info.description || 'No description available';
          const type = info.type || 'No type available';
          return `  {
    "id": "${id}",
    "name": "${name}",
    "group": "${group}",
    "description": "${description}",
	"type": "${type}"
  }`;
        })
        .join(',\n');

      if (this.debug) {
        logger.debug(
          `AgentSelector: Available agents for selection:\n${agentDescriptions}`
        );
      }

      const systemPrompt = new SystemMessage({
        content: agentSelectionSystemPrompt(agentDescriptions),
      });
      const humanPrompt = new HumanMessage({
        content: agentSelectionPrompt(query),
      });

      const model = this.modelSelector.getModels()['fast'];
      const result = await model.invoke([systemPrompt, humanPrompt]);
      const content =
        typeof result.content === 'string'
          ? result.content.trim()
          : JSON.stringify(result.content);

      if (this.debug) {
        logger.debug(`AgentSelector: Model raw response: "${content}"`);
      }

      if (content.startsWith('NEED_CLARIFICATION')) {
        return this.handleClarificationResponse(content);
      }

      if (content.startsWith('NO_MATCHING_AGENT')) {
        return this.createClarificationResponse(
          [],
          'matching agent capabilities',
          noMatchingAgentMessage()
        );
      }

      return this.extractAgentFromResponse(content, query);
    } catch (error) {
      logger.error(`AgentSelector: Error during model analysis: ${error}`);
      return this.createClarificationResponse(
        [],
        'clear request intent',
        errorFallbackMessage()
      );
    }
  }

  /**
   * Processes clarification responses from the AI model and creates appropriate clarification requests.
   */
  private handleClarificationResponse(content: string): AIMessage {
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
            defaultClarificationMessage()
        );
      }
    } catch (jsonError) {
      logger.error(
        `AgentSelector: Error parsing clarification JSON: ${jsonError}`
      );
    }

    return this.createClarificationResponse(
      [],
      'agent selection criteria',
      defaultClarificationMessage()
    );
  }

  /**
   * Extracts agent ID from model response and validates it against available agents.
   */
  private extractAgentFromResponse(content: string, query: string): AIMessage {
    const lines = content.split(/[\n\r]+/);
    let agentId = '';

    const firstLine = lines[0].trim();
    if (this.availableAgents[firstLine]) {
      agentId = firstLine;
    } else {
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
        `AgentSelector: Selected agent "${agentId}" for query "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`
      );
      return this.createSelectionResponse(agentId, query);
    }

    return this.handlePartialMatches(content, query);
  }

  /**
   * Handles cases where no exact agent match is found but there might be partial matches.
   * Attempts to find the best match or request clarification.
   */
  private handlePartialMatches(content: string, query: string): AIMessage {
    const possibleAgents = Object.keys(this.availableAgents).filter(
      (id) =>
        content.toLowerCase().includes(id.toLowerCase()) ||
        (this.agentInfo[id]?.name &&
          content
            .toLowerCase()
            .includes(this.agentInfo[id].name!.toLowerCase()))
    );

    if (possibleAgents.length === 1) {
      logger.debug(
        `AgentSelector: Found partial match with agent "${possibleAgents[0]}"`
      );
      return this.createSelectionResponse(possibleAgents[0], query);
    }

    if (possibleAgents.length > 1) {
      return this.createClarificationResponse(
        possibleAgents,
        'specific agent selection',
        "I found multiple agents that could handle this request. Could you specify which one you'd like to use?"
      );
    }

    if (this.availableAgents['snak']) {
      logger.warn(
        `AgentSelector: No matching agent found, defaulting to "snak"`
      );
      return this.createSelectionResponse('snak', query);
    }

    logger.warn(
      `AgentSelector: Unable to identify any agent from model response`
    );
    return this.createClarificationResponse(
      [],
      'valid agent identifier',
      noValidAgentMessage()
    );
  }

  /**
   * Creates a successful agent selection response with metadata for routing.
   */
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

  /**
   * Creates a clarification request response when agent selection is ambiguous.
   * Includes possible agent options and specific clarification questions.
   */
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
          if (!agent) {
            return `  {
    "id": "${id}",
    "name": "${id}",
    "group": "Unknown",
    "description": "No description available"
  }`;
          }

          const name = agent.name || id;
          const group = agent.group || 'No group';
          const description = agent.description || 'No description available';

          return `  {
    "id": "${id}",
    "name": "${name}",
    "group": "${group}",
    "description": "${description}"
  }`;
        })
        .join(',\n');

      agentOptions = `\n\nThese agents might be able to help:\n[\n${agentsList}\n]`;
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
