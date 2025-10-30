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
  AddAgentRequestDTO,
  AgentDeleteRequestDTO,
  AgentRequestDTO,
  logger,
  MessageFromAgentIdDTO,
} from '@snakagent/core';
import { message } from '@snakagent/database/queries';
import { BaseAgent, EventType, SnakAgent } from '@snakagent/agents';
import { AgentResponse } from '@snakagent/core';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:4000',
      'http://localhost:3001',
      'http://localhost:3000',
    ],
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
    @MessageBody() userRequest: AgentRequestDTO,
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    await ErrorHandler.handleWebSocketError(
      async () => {
        if (!client || !client.connected) {
          throw new WsException('Socket connection is invalid or disconnected');
        }
        logger.info('handleUserRequest called');
        logger.debug('Request payload:', {
          agent_id: userRequest.request.agent_id,
          thread_id: userRequest.request.thread_id,
          content: userRequest.request.content,
          content_length: userRequest.request.content?.length ?? 0,
        });
        const userId = ControllerHelpers.getUserIdFromSocket(client);
        let agent: BaseAgent | undefined;

        // Validate content is not empty
        if (
          !userRequest.request.content ||
          userRequest.request.content.trim().length === 0
        ) {
          logger.warn('Request validation failed: empty content');
          throw new ServerError('E04TA120'); // Invalid request format
        }

        agent = await this.agentFactory.getAgentInstance(
          userRequest.request.agent_id,
          userId
        );
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
