import { AgentStorage } from '../agents.storage.js';
import { AgentService } from '../services/agent.service.js';
import { ServerError } from '../utils/error.js';
import { ErrorHandler, ResponseFormatter } from '../utils/error-handler.js';
import { SupervisorService } from '../services/supervisor.service.js';
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
import { message } from '@snakagent/database/queries';
import { BaseAgent, EventType, SnakAgent } from '@snakagent/agents';
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
    private readonly agentFactory: AgentStorage,
    private readonly supervisorService: SupervisorService
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
        let agent: BaseAgent | undefined;

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
            agent = await agentSelector.execute(
              userRequest.request.request,
              false,
              { userId }
            );
          } catch (error) {
            logger.error('Error in agentSelector:', error);
            throw new ServerError('E01TA400');
          }
        } else {
          agent = await this.agentFactory.getAgentInstance(
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
          if (
            chunk.event === EventType.ON_CHAT_MODEL_END ||
            chunk.event === EventType.ON_CHAIN_END
          ) {
            const messageId = await message.insert_message(
              agentId,
              userId,
              chunk
            );

            logger.info(
              `Inserted message with ID: ${messageId.toLocaleString()}`
            );
          }
          client.emit('onAgentRequest', chunk);
        }
      },
      'handleUserRequest',
      client,
      'onAgentRequest'
    );
  }
}
