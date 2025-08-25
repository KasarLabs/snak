import { AgentResponse } from './agents.controller.js';
import { AgentStorage } from '../agents.storage.js';
import { AgentService } from '../services/agent.service.js';
import ServerError from '../utils/error.js';
import { OnModuleInit } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  logger,
  WebsocketAgentAddRequestDTO,
  WebsocketAgentDeleteRequestDTO,
  WebsocketAgentRequestDTO,
  WebsocketGetAgentsConfigRequestDTO,
  WebsocketGetMessagesRequestDTO,
} from '@snakagent/core';
import { metrics } from '@snakagent/metrics';
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
    private readonly agentFactory: AgentStorage
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
  @SubscribeMessage('agents_request')
  async handleUserRequest(
    @MessageBody() userRequest: WebsocketAgentRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      logger.info('handleUserRequest called');
      logger.debug(`handleUserRequest: ${JSON.stringify(userRequest)}`);

      const userId = client.handshake.headers['x-user-id'] as string;
      if (!userId) {
        throw new ServerError('E01TA400');
      }

      const agent = this.agentFactory.getAgentInstance(
        userRequest.request.agent_id,
        userId
      );
      if (!agent) {
        throw new ServerError('E01TA400');
      }

      let response: AgentResponse;

      for await (const chunk of this.agentService.handleUserRequestWebsocket(
        agent,
        userRequest.request,
        userId
      )) {
        if (chunk.final === true) {
          let q;

          if (chunk.chunk.event === 'on_graph_interrupted') {
            logger.info(
              'Graph interrupted, saving message with status waiting_for_human_input'
            );
            q = new Postgres.Query(
              'INSERT INTO message (agent_id,user_request,agent_iteration,status)  VALUES($1, $2, $3, $4)',
              [
                userRequest.request.agent_id,
                userRequest.request.user_request,
                chunk.chunk,
                'waiting_for_human_input',
              ]
            );
            response = {
              status: 'waiting_for_human_input',
              data: {
                ...chunk.chunk,
                graph_step: chunk.graph_step,
                langgraph_step: chunk.langgraph_step,
                from: chunk.from,
                retry_count: chunk.retry_count,
                final: chunk.final,
              },
            };
          } else {
            q = new Postgres.Query(
              'INSERT INTO message (agent_id,user_request,agent_iteration)  VALUES($1, $2, $3)',
              [
                userRequest.request.agent_id,
                userRequest.request.user_request,
                chunk.chunk,
              ]
            );
            response = {
              status: 'success',
              data: {
                ...chunk.chunk,
                graph_step: chunk.graph_step,
                langgraph_step: chunk.langgraph_step,
                from: chunk.from,
                retry_count: chunk.retry_count,
                final: chunk.final,
              },
            };
          }

          await Postgres.query(q);
          logger.info('Message Saved in DB');
        } else {
          response = {
            status: 'success',
            data: {
              ...chunk.chunk,
              graph_step: chunk.graph_step,
              langgraph_step: chunk.langgraph_step,
              from: chunk.from,
              retry_count: chunk.retry_count,
              final: chunk.final,
            },
          };
        }

        client.emit('onAgentRequest', response);
      }
    } catch (error) {
      if (error instanceof ServerError) {
        client.emit('onAgentRequest', error);
      }
    }
  }

  @SubscribeMessage('stop_agent')
  async stopAgent(
    @MessageBody() userRequest: { agent_id: string; socket_id: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      logger.info('stop_agent called');
      const userId = client.handshake.headers['x-user-id'] as string;
      if (!userId) {
        throw new ServerError('E01TA400');
      }
      const agent = this.agentFactory.getAgentInstance(
        userRequest.agent_id,
        userId
      );
      if (!agent) {
        throw new ServerError('E01TA400');
      }

      agent.stop();
      const response: AgentResponse = {
        status: 'success',
        data: `Agent ${userRequest.agent_id} stopped`,
      };
      client.emit('onStopAgentRequest', response);
    } catch (error) {
      logger.error('Error in stopAgent:', error);
      throw new ServerError('E02TA100');
    }
  }

  @SubscribeMessage('init_agent')
  async addAgent(
    @MessageBody() userRequest: WebsocketAgentAddRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      logger.info('init_agent called');

      const userId = client.handshake.headers['x-user-id'] as string;
      await this.agentFactory.addAgent({
        ...userRequest.agent,
        user_id: userId,
      });

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
    @MessageBody() userRequest: WebsocketAgentDeleteRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {

      const userId = client.handshake.headers['x-user-id'] as string;
      const agentConfig = this.agentFactory.getAgentConfig(
        userRequest.agent_id,
        userId
      );
      if (!agentConfig) {
        throw new ServerError('E01TA400');
      }

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
    @MessageBody() userRequest: WebsocketGetAgentsConfigRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      logger.info('getAgents called');

      const userId = client.handshake.headers['x-user-id'] as string;
      const agents = await this.agentService.getAllAgentsOfUser(userId);
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
    @MessageBody() userRequest: WebsocketGetMessagesRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      logger.info('getMessages called');

      // Get userId from socket handshake headers
      const userId = client.handshake.headers['x-user-id'] as string;
      if (!userId) {
        throw new ServerError('E01TA400');
      }



      const messages = await this.agentService.getMessageFromAgentId(
        {
          agent_id: userRequest.agent_id,
          limit_message: userRequest.limit_message,
        },
        userId
      );
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
