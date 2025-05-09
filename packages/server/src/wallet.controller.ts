import {
  Body,
  Controller,
  Logger,
  NotFoundException,
  OnModuleInit,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StarknetAgent } from '@snakagent/agents';
import { WalletService } from './services/wallet.service.js';
import { AgentRequestDTO } from './dto/agents.js';
import { FileTypeGuard } from './guard/file-validator.guard.js';
import { FastifyRequest } from 'fastify';
import { promises as fs } from 'fs';
import { getFilename } from './utils/index.js';
import { AgentFactory } from './agents.factory.js';
import { Reflector } from '@nestjs/core';
import { metrics } from '@snakagent/core';

@Controller('wallet')
export class WalletController implements OnModuleInit {
  private agent: StarknetAgent;

  constructor(
    private readonly walletService: WalletService,
    private readonly agentFactory: AgentFactory,
    private readonly reflector: Reflector
  ) {}

  async onModuleInit() {
    try {
      this.agent = await this.agentFactory.createAgent('wallet');
      await this.agent.init();
    } catch (error) {
      console.error('Failed to initialize WalletController:', error);
      throw error;
    }
  }

  @Post('request')
  async handleUserCalldataRequest(@Body() userRequest: AgentRequestDTO) {
    const agent = this.agent.getAgentConfig()?.name ?? 'agent';
    const mode = this.agent.getAgentMode(); // TODO: This should be exposed by method
    const route = this.reflector.get('path', this.handleUserCalldataRequest);
    const action = this.walletService.handleUserCalldataRequest(
      this.agent,
      userRequest
    );
    return await metrics.metricsAgentResponseTime(agent, mode, route, action);
  }

  @Post('upload_large_file')
  @UseGuards(new FileTypeGuard(['image/jpeg', 'image/png']))
  async uploadFile(@Req() _req: FastifyRequest) {
    const logger = new Logger('Upload service');
    logger.debug({ message: 'The file has been uploaded' });
    return {
      status: 'success',
      data: 'The file has been uploaded.',
    };
  }

  @Post('delete_large_file')
  async deleteUploadFile(@Body() filename: { filename: string }) {
    const logger = new Logger('Delete service');

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
