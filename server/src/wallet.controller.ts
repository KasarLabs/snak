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
import { StarknetAgent } from '@starknet-agent-kit/agents';
import { ConfigurationService } from '../config/configuration';
import { WalletService } from './services/wallet.service';
import { AgentRequestDTO } from './dto/agents';
import { FileTypeGuard } from './guard/file-validator.guard';
import { FastifyRequest } from 'fastify';
import { promises as fs } from 'fs';
import { getFilename } from './utils';
import { AgentFactory } from './agents.factory';

@Controller('wallet')
export class WalletController implements OnModuleInit {
  private agent: StarknetAgent;

  constructor(
    private readonly walletService: WalletService,
    private readonly agentFactory: AgentFactory
  ) {}

  async onModuleInit() {
    this.agent = await this.agentFactory.createAgent('wallet', 'agent');
    this.agent.createAgentReactExecutor();
  }

  @Post('request')
  async handleUserCalldataRequest(@Body() userRequest: AgentRequestDTO) {
    return await this.walletService.handleUserCalldataRequest(
      this.agent,
      userRequest
    );
  }

  @Post('output')
  async HandleOutputIAParsing(@Body() userRequest: AgentRequestDTO) {
    return await this.walletService.HandleOutputIAParsing(userRequest);
  }

  @Post('upload_large_file')
  @UseGuards(new FileTypeGuard(['image/jpeg', 'image/png']))
  async uploadFile(@Req() req: FastifyRequest) {
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
