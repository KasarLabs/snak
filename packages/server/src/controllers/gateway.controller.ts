import { AgentStorage } from '../agents.storage.js';
import { AgentService } from '../services/agent.service.js';
import { ServerError } from '../utils/error.js';
import { ErrorHandler, ResponseFormatter } from '../utils/error-handler.js';
import { ControllerHelpers } from '../utils/controller-helpers.js';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  WsException,
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
import { EventType } from '@snakagent/agents';
import { AgentResponse } from '@snakagent/core';

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
    await ErrorHandler.handleWebSocketError(
      async () => {
        if (!client || !client.connected) {
          throw new WsException('Socket connection is invalid or disconnected');
        }
        logger.info('handleUserRequest called');
        logger.debug(`handleUserRequest: ${JSON.stringify(userRequest)}`);

        const userId = ControllerHelpers.getUserIdFromSocket(client);
        let agent: SnakAgent | undefined;

        if (userRequest.request.agent_id === undefined) {
          logger.info(
            'Agent ID not provided in request, Using agent Selector to select agent'
          );

          const agentSelector = this.agentFactory.getAgentSelector();
          if (!agentSelector) {
            throw new ServerError('E01TA400');
          }
          if (!userRequest.request.request) {
            throw new ServerError('E01TA400'); // Bad request if no content
          }
          try {
            agent = await agentSelector.execute(userRequest.request.request);
          } catch (error) {
            logger.error('Error in agentSelector:', error);
            throw new ServerError('E01TA400');
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
        for await (const chunk of this.agentService.handleUserRequestWebsocket(
          agent,
          userRequest.request,
          userId
        )) {
          const q = new Postgres.Query(
            `
          INSERT INTO message (
            event, run_id, thread_id, checkpoint_id, "from", agent_id, user_id,
            message, tools, metadata, "timestamp"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id;
        `,
            [
              chunk.event,
              chunk.run_id,
              chunk.thread_id,
              chunk.checkpoint_id,
              chunk.from,
              agentId,
              userId,
              chunk.message ?? null,
              chunk.tools ? JSON.stringify(chunk.tools) : null,
              JSON.stringify(chunk.metadata || {}),
              chunk.timestamp || new Date(),
            ]
          );

          const result = await Postgres.query<number>(q);
          logger.info(
            `Inserted message with ID: ${result[0].toLocaleString()}`
          );
          client.emit('onAgentRequest', chunk);
        }
      },
      'handleUserRequest',
      client,
      'onAgentRequest'
    );
  }

  @SubscribeMessage('stop_agent')
  async stopAgent(
    @MessageBody() userRequest: { agent_id: string; socket_id: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    await ErrorHandler.handleWebSocketError(
      async () => {
        logger.info('stop_agent called');
        const { userId, agent } =
          ControllerHelpers.getSocketUserAndVerifyAgentOwnership(
            client,
            this.agentFactory,
            userRequest.agent_id
          );

        agent.stop();
        const response: AgentResponse = ResponseFormatter.success(
          `Agent ${userRequest.agent_id} stopped`
        );
        client.emit('onStopAgentRequest', response);
      },
      'stopAgent',
      client,
      'onStopAgentRequest',
      'E02TA100'
    );
  }

  @SubscribeMessage('init_agent')
  async addAgent(
    @MessageBody() userRequest: WebsocketAgentAddRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    await ErrorHandler.handleWebSocketError(
      async () => {
        logger.info('init_agent called');

        const userId = ControllerHelpers.getUserIdFromSocket(client);
        await this.agentFactory.addAgent(userRequest.agent, userId);
        const response: AgentResponse = ResponseFormatter.success(
          `Agent ${userRequest.agent.profile.name} added`
        );
        client.emit('onInitAgentRequest', response);
      },
      'addAgent',
      client,
      'onInitAgentRequest',
      'E02TA200'
    );
  }

  @SubscribeMessage('delete_agent')
  async deleteAgent(
    @MessageBody() userRequest: WebsocketAgentDeleteRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    await ErrorHandler.handleWebSocketError(
      async () => {
        const { userId } =
          ControllerHelpers.getSocketUserAndVerifyAgentConfigOwnership(
            client,
            this.agentFactory,
            userRequest.agent_id
          );

        await this.agentFactory.deleteAgent(userRequest.agent_id, userId);

        const response: AgentResponse = ResponseFormatter.success(
          `Agent ${userRequest.agent_id} deleted`
        );
        client.emit('onDeleteAgentRequest', response);
      },
      'deleteAgent',
      client,
      'onDeleteAgentRequest',
      'E02TA300'
    );
  }

  @SubscribeMessage('get_agents')
  async getAgents(
    @MessageBody() userRequest: WebsocketGetAgentsConfigRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    await ErrorHandler.handleWebSocketError(
      async () => {
        logger.info('getAgents called');

        const userId = ControllerHelpers.getUserIdFromSocket(client);
        const agents = await this.agentService.getAllAgentsOfUser(userId);

        const response: AgentResponse = ResponseFormatter.success(agents);
        client.emit('onGetAgentsRequest', response);
      },
      'getAgents',
      client,
      'onGetAgentsRequest',
      'E05TA100'
    );
  }

  @SubscribeMessage('get_messages')
  async getMessages(
    @MessageBody() userRequest: WebsocketGetMessagesRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    await ErrorHandler.handleWebSocketError(
      async () => {
        logger.info('getMessages called');
        const userId = ControllerHelpers.getUserIdFromSocket(client);
        const messages = await this.agentService.getMessageFromAgentId(
          {
            agent_id: userRequest.agent_id,
            thread_id: userRequest.thread_id,
            limit_message: userRequest.limit_message,
          },
          userId
        );
        if (!messages) {
          throw new ServerError('E01TA400');
        }
        const response: AgentResponse = ResponseFormatter.success(messages);
        client.emit('onGetMessagesRequest', response);
      },
      'getMessages',
      client,
      'onGetMessagesRequest',
      'E05TA100'
    );
  }
}
