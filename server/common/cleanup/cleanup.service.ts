import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private uploadDir: string = '';
  private readonly maxAge = 60 * 60 * 1000; // 1h

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCleanup() {
    try {
      this.logger.log('Starting hourly cleanup...');
	  if (!this.uploadDir) {
		this.logger.log('No upload directory configured, cleanup skipped');
		return;
	  }

	  try {
		await fs.access(this.uploadDir);
	  } catch (error) {
		this.logger.log(`Upload directory does not exist: ${this.uploadDir}, cleanup skipped`);
		return;
	  }
      const now = Date.now();
      const files = await fs.readdir(this.uploadDir);

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);

        try {
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtime.getTime();

          if (fileAge > this.maxAge) {
            await fs.unlink(filePath);
            this.logger.log(`Deleted file: ${file}`);
          }
        } catch (err) {
          this.logger.error(`Error processing file ${file}:`, err);
        }
      }

      this.logger.log('Hourly cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup error:', error);
    }
  }

  onModuleInit() {
    const path = process.env.PATH_UPLOAD_DIR || '';
	this.uploadDir = path
	if (this.uploadDir) {
		this.logger.log(`Cleanup service initialized with upload directory: ${this.uploadDir}`);
	  } else {
		this.logger.log('Cleanup service initialized without upload directory (cleanup disabled)');
	  }
  }

  onModuleDestroy() {
    this.logger.log('Cleanup service shutdown');
  }
}
