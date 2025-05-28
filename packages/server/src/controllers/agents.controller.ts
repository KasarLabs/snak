// packages/server/src/agents.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { AgentService } from '../services/agent.service.js';
import { AgentStorage } from '../agents.storage.js';
import {
  AgentDeleteRequestDTO,
  AgentRequestDTO,
  getMessagesFromAgentsDTO,
} from '../dto/agents.js';
import { SupervisorService } from '../services/supervisor.service.js';
import { Reflector } from '@nestjs/core';
import { ServerError } from '../utils/error.js';
import {
  logger,
  metrics,
  MessageFromAgentIdDTO,
  AgentsDeleteRequestDTO,
} from '@snakagent/core';

export interface AgentResponse {
  status: 'success' | 'failure';
  data?: unknown;
}

export interface SupervisorRequestDTO {
  request: {
    content: string;
    agentId?: string;
    userId?: string;
    threadId?: string;
  };
}

/**
 * Controller for handling agent-related operations
 */
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentFactory: AgentStorage,
    private readonly supervisorService: SupervisorService,
    private readonly reflector: Reflector
  ) {}

  /**
   * Handle user request to a specific agent
   * @param userRequest - The user request containing agent ID and content
   * @returns Promise<AgentResponse> - Response with status and data
   */
  @Post('request')
  async handleUserRequest(
    @Body() userRequest: AgentRequestDTO
  ): Promise<AgentResponse> {
    try {
      const route = this.reflector.get('path', this.handleUserRequest);
      const agent = this.agentFactory.getAgent(userRequest.request.agent_id);
      if (!agent) {
        throw new ServerError('E01TA400');
      }

      const messageRequest = {
        agent_id: userRequest.request.agent_id,
        user_request: userRequest.request.content,
      };

      const action = this.agentService.handleUserRequest(agent, messageRequest);

      const response_metrics = await metrics.metricsAgentResponseTime(
        userRequest.request.agent_id.toString(),
        'key',
        route,
        action
      );

      const response: AgentResponse = {
        status: 'success',
        data: response_metrics,
      };
      logger.warn(JSON.stringify(action));
      return response;
    } catch (error) {
      logger.error('Error in handleUserRequest:', error);
      throw new ServerError('E03TA100');
    }
  }

  /**
   * Handle supervisor request with optional agent specification
   * @param userRequest - The supervisor request containing content and optional agent ID
   * @returns Promise<AgentResponse> - Response with status and data
   */
  @Post('supervisor/request')
  async handleSupervisorRequest(
    @Body() userRequest: SupervisorRequestDTO
  ): Promise<AgentResponse> {
    try {
      if (!this.supervisorService.isInitialized()) {
        throw new ServerError('E07TA110');
      }

      const route = this.reflector.get('path', this.handleSupervisorRequest);

      const config: Record<string, any> = {};
      if (userRequest.request.agentId) {
        config.agentId = userRequest.request.agentId;
      }
      if (userRequest.request.userId) {
        config.userId = userRequest.request.userId;
      }
      if (userRequest.request.threadId) {
        config.threadId = userRequest.request.threadId;
      }

      const result = await this.supervisorService.executeRequest(
        userRequest.request.content,
        config
      );

      await metrics.metricsAgentResponseTime(
        'supervisor',
        'key',
        route,
        Promise.resolve(result)
      );

      const response: AgentResponse = {
        status: 'success',
        data: result,
      };

      logger.debug(
        `Supervisor request processed successfully: ${JSON.stringify(result)}`
      );
      return response;
    } catch (error) {
      logger.error('Error in handleSupervisorRequest:', error);
      throw new ServerError('E03TA100');
    }
  }

  /**
   * Initialize and add a new agent
   * @param userRequest - Request containing agent configuration
   * @returns Promise<AgentResponse> - Response with status and confirmation message
   */
  @Post('init_agent')
  async addAgent(@Body() userRequest: any): Promise<AgentResponse> {
    try {
      await this.agentFactory.addAgent(userRequest.agent);
      const response: AgentResponse = {
        status: 'success',
        data: `Agent ${userRequest.agent.name} added and registered with supervisor`,
      };
      return response;
    } catch (error) {
      logger.error('Error in addAgent:', error);
      throw new ServerError('E02TA200');
    }
  }

  /**
   * Get messages from a specific agent
   * @param userRequest - Request containing agent ID
   * @returns Promise<AgentResponse> - Response with agent messages
   */
  @Post('get_messages_from_agent')
  async getMessagesFromAgent(
    @Body() userRequest: MessageFromAgentIdDTO
  ): Promise<AgentResponse> {
    try {
      const agent = this.agentFactory.getAgent(userRequest.agent_id);
      if (!agent) {
        throw new ServerError('E01TA400');
      }
      const messages =
        await this.agentService.getMessageFromAgentId(userRequest);
      const response: AgentResponse = {
        status: 'success',
        data: messages,
      };
      return response;
    } catch (error) {
      logger.error('Error in getMessagesFromAgent:', error);
      throw new ServerError('E04TA100');
    }
  }

  /**
   * Delete a specific agent
   * @param userRequest - Request containing agent ID to delete
   * @returns Promise<AgentResponse> - Response with deletion confirmation
   */
  @Post('delete_agent')
  async deleteAgent(
    @Body() userRequest: AgentDeleteRequestDTO
  ): Promise<AgentResponse> {
    try {
      const agent = this.agentFactory.getAgent(userRequest.agent_id);
      if (!agent) {
        throw new ServerError('E01TA400');
      }
      await this.agentFactory.deleteAgent(userRequest.agent_id);
      const response: AgentResponse = {
        status: 'success',
        data: `Agent ${userRequest.agent_id} deleted and unregistered from supervisor`,
      };
      return response;
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      throw new ServerError('E02TA300');
    }
  }

  /**
   * Delete multiple agents
   * @param userRequest - Request containing array of agent IDs to delete
   * @returns Promise<AgentResponse[]> - Array of responses for each deletion
   */
  @Post('delete_agents')
  async deleteAgents(
    @Body() userRequest: AgentsDeleteRequestDTO
  ): Promise<AgentResponse[]> {
    try {
      let arr_response: AgentResponse[] = [];
      for (const agentId of userRequest.agent_id) {
        const agent = this.agentFactory.getAgent(agentId);
        if (!agent) {
          throw new ServerError('E01TA400');
        }
        await this.agentFactory.deleteAgent(agentId);
        logger.error('Agent deleted:', agentId);
        const response: AgentResponse = {
          status: 'success',
          data: `Agent ${agentId} deleted and unregistered from supervisor`,
        };
        arr_response.push(response);
      }
      return arr_response;
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      throw new ServerError('E02TA300');
    }
  }

  /**
   * Get messages from agents by ID
   * @param userRequest - Request containing agent ID
   * @returns Promise<AgentResponse> - Response with agent messages
   */
  @Post('get_messages_from_agents_id')
  async getMessageFromAgentsId(
    @Body() userRequest: getMessagesFromAgentsDTO
  ): Promise<AgentResponse> {
    try {
      const agent = this.agentFactory.getAgent(userRequest.agent_id);
      if (!agent) {
        throw new ServerError('E01TA400');
      }
      const messageRequest: MessageFromAgentIdDTO = {
        agent_id: userRequest.agent_id,
        limit_message: undefined,
      };
      const messages =
        await this.agentService.getMessageFromAgentId(messageRequest);
      const response: AgentResponse = {
        status: 'success',
        data: messages,
      };
      return response;
    } catch (error) {
      logger.error('Error in getMessageFromAgentsId:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Get all agents
   * @returns Promise<AgentResponse> - Response with all agents data
   */
  @Get('get_agents')
  async getAgents(): Promise<AgentResponse> {
    try {
      const agents = await this.agentService.getAllAgents();
      if (!agents) {
        throw new ServerError('E01TA400');
      }
      const response: AgentResponse = {
        status: 'success',
        data: agents,
      };
      return response;
    } catch (error) {
      logger.error('Error in getAgents:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Get supervisor status and information
   * @returns Promise<AgentResponse> - Response with supervisor status
   */
  @Get('supervisor/status')
  async getSupervisorStatus(): Promise<AgentResponse> {
    try {
      const isInitialized = this.supervisorService.isInitialized();
      const supervisor = this.supervisorService.getSupervisor();

      const response: AgentResponse = {
        status: 'success',
        data: {
          initialized: isInitialized,
          supervisorAvailable: supervisor !== null,
          registeredAgents: this.agentFactory.getAllAgents()?.length || 0,
        },
      };
      return response;
    } catch (error) {
      logger.error('Error in getSupervisorStatus:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Handle legacy supervisor request (deprecated)
   * @param userRequest - Legacy format request
   * @returns Promise<AgentResponse> - Response from supervisor
   */
  @Post('requestSupervisor')
  async handleLegacySupervisorRequest(
    @Body() userRequest: AgentRequestDTO
  ): Promise<AgentResponse> {
    try {
      const supervisorRequest: SupervisorRequestDTO = {
        request: {
          content:
            typeof userRequest.request === 'string'
              ? userRequest.request
              : userRequest.request.content,
          agentId: userRequest.request.agent_id,
        },
      };

      return await this.handleSupervisorRequest(supervisorRequest);
    } catch (error) {
      logger.error('Error in handleLegacySupervisorRequest:', error);
      throw new ServerError('E03TA100');
    }
  }

  /**
   * Get agent status (alias for get_agents)
   * @returns Promise<AgentResponse> - Response with agents status
   */
  @Get('get_agent_status')
  async getAgentStatus(): Promise<AgentResponse> {
    try {
      const agents = await this.agentService.getAllAgents();
      if (!agents) {
        throw new ServerError('E01TA400');
      }
      const response: AgentResponse = {
        status: 'success',
        data: agents,
      };
      return response;
    } catch (error) {
      logger.error('Error in getAgentStatus:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Get agent thread information (alias for get_agents)
   * @returns Promise<AgentResponse> - Response with agents thread data
   */
  @Get('get_agent_thread')
  async getAgentThread(): Promise<AgentResponse> {
    try {
      const agents = await this.agentService.getAllAgents();
      if (!agents) {
        throw new ServerError('E01TA400');
      }
      const response: AgentResponse = {
        status: 'success',
        data: agents,
      };
      return response;
    } catch (error) {
      logger.error('Error in getAgentThread:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Health check endpoint
   * @returns Promise<AgentResponse> - Health status response
   */
  @Get('health')
  async getAgentHealth(): Promise<AgentResponse> {
    const response: AgentResponse = {
      status: 'success',
      data: 'Agent is healthy',
    };
    return response;
  }
}
