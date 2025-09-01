import 'dotenv/config';
import { WorkerManager } from './worker-manager.js';
import { logger } from '@snakagent/core';

async function main() {
  const workerManager = new WorkerManager();

  try {
    logger.info('Starting Snak Workers...');
    await workerManager.start();

    logger.info('Workers are running.');

    setInterval(async () => {
      try {
        const metrics = await workerManager.getMetrics();
        logger.info('Queue Metrics:', JSON.stringify(metrics, null, 2));
      } catch (error) {
        logger.error('Failed to get metrics:', error);
      }
    }, 30000);
  } catch (error) {
    logger.error('❌ Failed to start workers:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

main();
