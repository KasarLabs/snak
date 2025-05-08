import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  AgentAddRequestDTO,
  AgentDeleteRequestDTO,
  AgentRequestDTO,
} from './dto/agents.js';
import { AgentService } from './services/agent.service.js';
import { AgentResponseInterceptor } from './interceptors/response.js';
import { FileTypeGuard } from './guard/file-validator.guard.js';
import { promises as fs } from 'fs';
import { getFilename } from './utils/index.js';
import { AgentStorage } from './agents.storage.js';
import { metrics } from '@snakagent/core';
import { Reflector } from '@nestjs/core';
import errorMap from './utils/error.js';
import { FastifyRequest } from 'fastify';
// import { Postgres } from '@snakagent/database';

export class ServerError extends Error {
  errorCode: string;
  statusCode: number;
  constructor(errorCode: string) {
    const errorMessage = errorMap.get(errorCode) || 'Unknown error';
    super(errorMessage);
    this.name = 'ServerError';
    this.errorCode = errorCode;
    this.statusCode = 500;
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

@Controller('agents')
@UseInterceptors(AgentResponseInterceptor)
export class AgentsController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentFactory: AgentStorage,
    private readonly reflector: Reflector
  ) {}

  @Post('request')
  async handleUserRequest(@Body() userRequest: AgentRequestDTO) {
    try {
      const route = this.reflector.get('path', this.handleUserRequest);
      const agent = this.agentFactory.getAgent(userRequest.agent);
      if (!agent) {
        throw new ServerError('E01TA400');
      }
      const action = this.agentService.handleUserRequest(agent, userRequest);
      return await metrics.metricsAgentResponseTime(
        userRequest.agent,
        'key',
        route,
        action
      );
    } catch (error) {
      console.log(process.env.POSTGRES_USER);
      console.log('Error in handleUserRequest:', error);
      throw new ServerError('E03TA100');
    }
  }

  @Post('delete_agent')
  async deleteAgent(@Body() userRequest: AgentDeleteRequestDTO) {
    try {
      const agent = this.agentFactory.getAgent(userRequest.agent);
      if (!agent) {
        throw new ServerError('E01TA400');
      }
      await this.agentFactory.deleteAgent(userRequest.agent);
      console.log('Agent deleted:', userRequest.agent);
      return { status: 'success', data: 'Agent deleted' };
    } catch (error) {
      throw new ServerError('E04TA100');
    }
  }

  @Post('add_agent')
  async addAgent(@Body() userRequest: AgentAddRequestDTO) {
    try {
      await this.agentFactory.addAgent(userRequest.agent);
      return { status: 'success', data: 'Agent added' };
    } catch (error) {
      console.log('Error in addAgent:', error);
      throw new ServerError('E02TA200');
    }
  }

  @Get('health')
  async getAgentHealth() {
    return { status: 'success', data: 'Agent is healthy' };
  }

  @Post('upload_large_file')
  @UseGuards(
    new FileTypeGuard([
      'application/json',
      'application/zip',
      'image/jpeg',
      'image/png',
    ])
  )

  async uploadFile(@Req() req: FastifyRequest) {
    const logger = new Logger('Upload service');
    req.log.info('File upload request received');
    logger.debug({ message: 'The file has been uploaded' });
    return { status: 'success', data: 'The file has been uploaded.' };
  }

  

  @Post('delete_large_file')
  async deleteUploadFile(@Body() filename: { filename: string }) {
    const logger = new Logger('Upload service');

    const path = process.env.PATH_UPLOAD_DIR;
    if (!path) throw new Error(`PATH_UPLOAD_DIR must be defined in .env file`);

    const fullPath = await getFilename(filename.filename);
    const normalizedPath = fullPath.normalize();

    try {
      await fs.access(normalizedPath);
    } catch {
      throw new NotFoundException(`File not found : ${path}`);
    }

    try {
      await fs.unlink(fullPath);
      logger.debug({ message: `File ${filename.filename} has been deleted` });
      return { status: 'success', data: 'The file has been deleted.' };
    } catch (error) {
      logger.error('Error delete file', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        filePath: fullPath,
      });
      switch (error.code) {
        case 'ENOENT':
          throw new NotFoundException(
            `File not found : ${path}${filename.filename}`
          ); // HttpException(404)
        case 'EACCES':
          throw new Error(
            `Insufficient permits for ${path}${filename.filename}`
          ); // HttpException(403)
        default:
          throw new Error(`Deletion error : ${error.message}`); // throw personalised error
      }
    }
  }
}
