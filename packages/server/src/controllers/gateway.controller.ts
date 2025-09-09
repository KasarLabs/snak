import { AgentResponse } from '@snakagent/core';
import { AgentStorage } from '../agents.storage.js';
import { AgentService } from '../services/agent.service.js';
import ServerError from '../utils/error.js';
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
import { Postgres } from '@snakagent/database';
import { SnakAgent } from '@snakagent/agents';
import { getUserIdFromSocketHeaders } from '../utils/headers.js';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class MyGateway {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentFactory: AgentStorage
  ) {
    logger.info('Gateway initialized');
  }

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('agents_request')
  async handleUserRequest(
    @MessageBody() userRequest: WebsocketAgentRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    try {
      logger.info('handleUserRequest called');
      logger.debug(`handleUserRequest: ${JSON.stringify(userRequest)}`);

      const userId = getUserIdFromSocketHeaders(client);
      let agent: SnakAgent | undefined;

      if (userRequest.request.agent_id === undefined) {
        logger.info(
          'Agent ID not provided in request, Using agent Selector to select agent'
        );

        const agentSelector = this.agentFactory.getAgentSelector();
        if (!agentSelector) {
          throw new ServerError('E01TA400');
        }
        try {
          agent = await agentSelector.execute(
            userRequest.request.user_request,
            false,
            { userId }
          );
        } catch (error) {
          logger.error('Error in agentSelector:', error);
          throw new ServerError('E01TA400');
        }

        if (agent) {
          const agentId = agent.getAgentConfig().id;
          const agentConfig = this.agentFactory.getAgentConfig(agentId, userId);
          if (!agentConfig) {
            throw new ServerError('E01TA400');
          }
        }
      } else {
        agent = this.agentFactory.getAgentInstance(
          userRequest.request.agent_id,
          userId
        );
      }
      if (!agent) {
        throw new ServerError('E01TA400');
      }
      const agentId = agent.getAgentConfig().id;

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
                agentId,
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
              [agentId, userRequest.request.user_request, chunk.chunk]
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
      const userId = getUserIdFromSocketHeaders(client);
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

      const userId = getUserIdFromSocketHeaders(client);
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
      const userId = getUserIdFromSocketHeaders(client);
      const agentConfig = this.agentFactory.getAgentConfig(
        userRequest.agent_id,
        userId
      );
      if (!agentConfig) {
        throw new ServerError('E01TA400');
      }

      await this.agentFactory.deleteAgent(userRequest.agent_id, userId);

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

      const userId = getUserIdFromSocketHeaders(client);
      const agents = await this.agentService.getAllAgentsOfUser(userId);

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

      const userId = getUserIdFromSocketHeaders(client);

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
