import {
  Controller,
  Get,
  Req,
  Param,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ErrorHandler, HandleErrors } from '../utils/error-handler.js';
import { ControllerHelpers } from '../utils/controller-helpers.js';
import { logger } from '@snakagent/core';
import { WorkersService } from '../services/workers.service.js';

@Controller('jobs')
export class JobsController {
  constructor(private readonly workersService: WorkersService) {}

  @Get('status/:jobId')
  async getJobStatus(
    @Param('jobId') jobId: string,
    @Req() request: FastifyRequest
  ) {
    return ErrorHandler.handleControllerError(async () => {
      let userId: string;
      try {
        userId = ControllerHelpers.getUserId(request);
      } catch {
        throw new UnauthorizedException(
          'Missing or invalid authentication headers'
        );
      }

      const status = await this.workersService.getJobStatusForUser(
        jobId,
        userId
      );

      if (!status) {
        logger.error(`Job ${jobId} not found`);
        throw new NotFoundException(`Job ${jobId} not found`);
      }

      return {
        jobId: status.id,
        status: status.status,
        createdAt: status.createdAt,
        processedOn: status.processedOn,
        finishedOn: status.finishedOn,
        error: status.error,
      };
    }, 'getJobStatus');
  }

  @Get('result/:jobId')
  async getJobResult(
    @Param('jobId') jobId: string,
    @Req() request: FastifyRequest
  ) {
    return ErrorHandler.handleControllerError(async () => {
      let userId: string;
      try {
        userId = ControllerHelpers.getUserId(request);
      } catch {
        throw new UnauthorizedException(
          'Missing or invalid authentication headers'
        );
      }
      const result = await this.workersService.getJobResultForUser(
        jobId,
        userId
      );

      if (result && result.chunks) {
        result.chunks.forEach((chunk: any) => {
          if (chunk.metadata && chunk.metadata.embedding) {
            delete chunk.metadata.embedding;
          }
        });
      }

      return result;
    }, 'getJobResult');
  }

  @Get('queues/metrics')
  @HandleErrors()
  async getQueueMetrics() {
    return await this.workersService.getQueueMetrics();
  }
}
