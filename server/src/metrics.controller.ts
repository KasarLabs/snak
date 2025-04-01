import { Controller, OnModuleInit, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { metrics, contentType } from '@starknet-agent-kit/agents/metrics.js';

@Controller('metrics')
export class MetricsController implements OnModuleInit {
  onModuleInit() {}

  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    res.header('Content-Type', contentType);
    res.send(await metrics());
  }
}
