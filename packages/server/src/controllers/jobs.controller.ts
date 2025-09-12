import {
  Controller,
  Get,
  Req,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  Param,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  JobNotFoundError,
  JobNotCompletedError,
  JobFailedError,
  JobAccessDeniedError,
  UnknownJobStatusError,
} from '../../common/errors/job.errors.js';
import { FastifyRequest } from 'fastify';
import { getUserIdFromHeaders } from '../utils/index.js';
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
    try {
      let userId: string;
      try {
        userId = getUserIdFromHeaders(request);
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
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (
        error instanceof ForbiddenException ||
        error instanceof JobAccessDeniedError
      ) {
        throw new ForbiddenException(
          'Access denied: Job does not belong to user'
        );
      }

      throw new InternalServerErrorException('Failed to get job status');
    }
  }

  @Get('result/:jobId')
  async getJobResult(
    @Param('jobId') jobId: string,
    @Req() request: FastifyRequest
  ) {
    try {
      const userId = getUserIdFromHeaders(request);
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
    } catch (error) {
      logger.error(`Failed to get job result for ${jobId}:`, error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof JobNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof JobAccessDeniedError) {
        throw new ForbiddenException(
          'Access denied: Job does not belong to user'
        );
      }

      if (error instanceof JobNotCompletedError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof JobFailedError) {
        throw new InternalServerErrorException(`Job failed: ${error.message}`);
      }

      if (error instanceof UnknownJobStatusError) {
        throw new InternalServerErrorException(
          `Unknown job status: ${error.message}`
        );
      }

      throw new InternalServerErrorException('Failed to get job result');
    }
  }

  @Get('queues/metrics')
  async getQueueMetrics() {
    try {
      return await this.workersService.getQueueMetrics();
    } catch (error) {
      logger.error('Failed to get queue metrics:', error);
      throw new InternalServerErrorException('Failed to get queue metrics');
    }
  }
}
