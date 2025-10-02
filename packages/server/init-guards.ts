import { initializeGuards, logger } from '@snakagent/core';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Initialize Guards IMMEDIATELY when this module is imported
// This must happen before any other modules that use getGuardValue
try {
  // Create a temporary ConfigService to get the guards config path
  const guardsConfigPath = path.resolve(
    process.cwd(),
    '../..',
    process.env.GUARDS_CONFIG_PATH || 'config/guards/default.guards.json'
  );

  initializeGuards(guardsConfigPath);
  logger.info(
    '[EARLY-INIT] Guards initialized successfully before all imports'
  );
} catch (error) {
  logger.error(
    '[EARLY-INIT] CRITICAL: Failed to initialize Guards early:',
    error
  );
  process.exit(1);
}
