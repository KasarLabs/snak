import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  OnModuleInit,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AgentRequestDTO } from './dto/agents';
import { StarknetAgent } from '@starknet-agent-kit/agents';
import { AgentService } from './services/agent.service';
import { AgentResponseInterceptor } from './interceptors/response';
import { FileTypeGuard } from './guard/file-validator.guard';
import { FastifyRequest } from 'fastify';
import { promises as fs } from 'fs';
import { getFilename } from './utils';
import { AgentFactory } from './agents.factory';

@Controller('key')
@UseInterceptors(AgentResponseInterceptor)
export class AgentsController implements OnModuleInit {
  private agent: StarknetAgent;
  constructor(
    private readonly agentService: AgentService,
    private readonly agentFactory: AgentFactory
  ) {}

  async onModuleInit() {
    this.agent = await this.agentFactory.createAgent('key', 'agent');
    this.agent.createAgentReactExecutor();
  }

  @Post('request')
  async handleUserRequest(@Body() userRequest: AgentRequestDTO) {
    return await this.agentService.handleUserRequest(this.agent, userRequest);
  }

  @Get('status')
  async getAgentStatus() {
    return await this.agentService.getAgentStatus(this.agent);
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
