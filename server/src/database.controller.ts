import { Body, Controller, OnModuleInit, Post } from '@nestjs/common';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pkg from 'pg';
import { logger } from '@hijox/core';
const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

@Controller('database')
export class DatabaseController implements OnModuleInit {
  private database: pkg.Pool;

  constructor() {}

  async onModuleInit() {
    this.database = await new Pool({
      host: process.env.POSTGRES_HOST,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: 'chat_pool_db',
      port: Number(process.env.POSTGRES_PORT),
    });
  }

  @Post('insert_into_table')
  async insertIntoTable(@Body() data: { table: string; fields: string[] }) {
    try {
      logger.info(`INSERT INTO ${data.table} VALUES(${data.fields.join(',')})`);
      await this.database.query(
        `INSERT INTO ${data.table} VALUES(${data.fields.join(',')})`
      );
      return {
        status: 'success',
      };
    } catch (error) {
      logger.error(error);
      return {
        status: 'error',
      };
    }
  }
}
