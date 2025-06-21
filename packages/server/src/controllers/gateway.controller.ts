import { AgentResponse } from './agents.controller.js';
import { AgentStorage } from '../agents.storage.js';
import { AgentService } from '../services/agent.service.js';
import { SupervisorService } from '../services/supervisor.service.js';
import ServerError from '../utils/error.js';
import { OnModuleInit } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  logger,
  metrics,
  WebsocketAgentAddRequestDTO,
  WebsocketAgentDeleteRequestDTO,
  WebsocketAgentRequestDTO,
  WebsocketGetAgentsConfigRequestDTO,
  WebsocketGetMessagesRequestDTO,
  WebsocketSupervisorRequestDTO,
} from '@snakagent/core';
import { Postgres } from '@snakagent/database';
@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class MyGateway implements OnModuleInit {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentFactory: AgentStorage,
    private readonly supervisorService: SupervisorService,
    private readonly reflector: Reflector
  ) {
    logger.info('Gateway initialized');
  }

  private readonly clients = new Map<string, Socket>();
  @WebSocketServer()
  server: Server;

  onModuleInit() {
    this.server.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      this.clients.set(socket.id, socket);
      socket.on('disconnect', () => {
        logger.error('Client disconnected:', socket.id);
        this.clients.delete(socket.id);
      });
    });
  }

  @SubscribeMessage('supervisor_request')
  async handleSupervisorRequest(
    @MessageBody() userRequest: WebsocketSupervisorRequestDTO
  ): Promise<void> {
    try {
      if (!this.supervisorService.isInitialized()) {
        throw new ServerError('E07TA110');
      }

      const config: Record<string, any> = {};
      if (userRequest.request.agentId) {
        config.agentId = userRequest.request.agentId;
      }

      const client = this.clients.get(userRequest.socket_id);
      if (!client) {
        logger.error('Client not found');
        throw new ServerError('E01TA400');
      }

      for await (const chunk of this.supervisorService.websocketExecuteRequest(
        userRequest.request.content,
        config
      )) {
        const response: AgentResponse = {
          status: 'success',
          data: {
            ...chunk.chunk,
            iteration_number: chunk.iteration_number,
            isLastChunk: chunk.final,
          },
        };

        client.emit('onSupervisorRequest', response);

        if (chunk.final === true) {
          break;
        }
      }

      logger.debug(`Supervisor request processed successfully`);
    } catch (error) {
      logger.error('Error in handleSupervisorRequest:', error);
      throw new ServerError('E03TA100');
    }
  }

  @SubscribeMessage('agents_request')
  async handleUserRequest(
    @MessageBody() userRequest: WebsocketAgentRequestDTO
  ): Promise<void> {
    try {
      logger.info('handleUserRequest called');
      const route = this.reflector.get('path', this.handleUserRequest);
      logger.debug(`handleUserRequest: ${JSON.stringify(userRequest)}`);

      const agent = this.supervisorService.getAgentInstance(
        userRequest.request.agent_id
      );
      if (!agent) {
        throw new ServerError('E01TA400');
      }

      const client = this.clients.get(userRequest.socket_id);
      if (!client) {
        logger.error('Client not found');
        throw new ServerError('E01TA400');
      }

      for await (const chunk of this.agentService.handleUserRequestWebsocket(
        agent,
        userRequest.request
      )) {
        if (chunk.final === true) {
          const q = new Postgres.Query(
            'INSERT INTO message (agent_id,user_request,agent_iteration)  VALUES($1, $2, $3)',
            [
              userRequest.request.agent_id,
              userRequest.request.user_request,
              chunk.chunk,
            ]
          );
          await Postgres.query(q);
          logger.info('Message Saved in DB');
        }
        const response: AgentResponse = {
          status: 'success',
          data: {
            ...chunk.chunk,
            iteration_number: chunk.iteration_number,
            isLastChunk: chunk.final,
          },
        };
        client.emit('onAgentRequest', response);
      }
    } catch (error) {
      const client = this.clients.get(userRequest.socket_id);
      if (!client) {
        logger.error('Client not found');
        throw new ServerError('E01TA400');
      }
      if (error instanceof ServerError) {
        client.emit('onAgentRequest', error);
      }
    }
  }

  @SubscribeMessage('init_agent')
  async addAgent(
    @MessageBody() userRequest: WebsocketAgentAddRequestDTO
  ): Promise<void> {
    try {
      logger.info('init_agent called');
      const client = this.clients.get(userRequest.socket_id);
      if (!client) {
        logger.error('Client not found');
        throw new ServerError('E01TA400');
      }
      const newAgentConfig = await this.agentFactory.addAgent(
        userRequest.agent
      );

      await this.supervisorService.addAgentInstance(
        newAgentConfig.id,
        newAgentConfig
      );

      const response: AgentResponse = {
        status: 'success',
        data: `Agent ${userRequest.agent.name} added`,
      };
      client.emit('onInitAgentRequest', response);
    } catch (error) {
      logger.error('Error in addAgent:', error);
      throw new ServerError('E02TA200');
    }
  }

  @SubscribeMessage('delete_agent')
  async deleteAgent(
    @MessageBody() userRequest: WebsocketAgentDeleteRequestDTO
  ): Promise<void> {
    try {
      const client = this.clients.get(userRequest.socket_id);
      if (!client) {
        logger.error('Client not found');
        throw new ServerError('E01TA400');
      }

      const agentConfig = this.agentFactory.getAgentConfig(
        userRequest.agent_id
      );
      if (!agentConfig) {
        throw new ServerError('E01TA400');
      }

      await this.supervisorService.removeAgentInstance(userRequest.agent_id);
      await this.agentFactory.deleteAgent(userRequest.agent_id);

      const response: AgentResponse = {
        status: 'success',
        data: `Agent ${userRequest.agent_id} deleted`,
      };
      client.emit('onDeleteAgentRequest', response);
    } catch (error) {
      if (error instanceof ServerError) {
        throw error;
      }
      throw new ServerError('E02TA300');
    }
  }

  @SubscribeMessage('get_agents')
  async getAgents(
    @MessageBody() userRequest: WebsocketGetAgentsConfigRequestDTO
  ): Promise<void> {
    try {
      logger.info('getAgents called');
      const client = this.clients.get(userRequest.socket_id);
      if (!client) {
        logger.error('Client not found');
        throw new ServerError('E01TA400'); // TODO Need to create a new error for socket not found
      }
      const agents = await this.agentService.getAllAgents();
      if (!agents) {
        throw new ServerError('E01TA400');
      }
      const response: AgentResponse = {
        status: 'success',
        data: agents,
      };
      client.emit('onGetAgentsRequest', response);
    } catch (error) {
      logger.error('Error in getAgents:', error);
      throw new ServerError('E05TA100');
    }
  }

  @SubscribeMessage('get_messages')
  async getMessages(
    @MessageBody() userRequest: WebsocketGetMessagesRequestDTO
  ): Promise<void> {
    try {
      logger.info('getMessages called');
      const client = this.clients.get(userRequest.socket_id);
      if (!client) {
        logger.error('Client not found');
        throw new ServerError('E01TA400'); // TODO Need to create a new error for socket not found
      }
      const messages = await this.agentService.getMessageFromAgentId({
        agent_id: userRequest.agent_id,
        limit_message: userRequest.limit_message,
      });
      if (!messages) {
        throw new ServerError('E01TA400');
      }
      const response: AgentResponse = {
        status: 'success',
        data: messages,
      };
      client.emit('onGetMessagesRequest', response);
    } catch (error) {
      logger.error('Error in getMessages:', error);
      throw new ServerError('E05TA100');
    }
  }
}
