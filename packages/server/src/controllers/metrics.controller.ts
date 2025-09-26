import { Controller, OnModuleInit, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { metrics } from '@snakagent/metrics';
import { logger } from '@snakagent/core';

@Controller('metrics')
export class MetricsController implements OnModuleInit {
  onModuleInit() {}

  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    logger.info('metrics called');
    res.header('Content-Type', metrics.contentType);
    res.send(await metrics.metrics());
  }
}
