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
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

@Controller('database')
export class DatabaseController implements OnModuleInit {
  private database: Pool;

  constructor() {}

  async onModuleInit() {
    console.log('Connecting to database');
    this.database = await new Pool({
      host: process.env.POSTGRES_HOST,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: 'chat_pool_db',
      port: Number(process.env.PORT),
    });
  }

  @Post('insert_into_table')
  async insertIntoTable(@Body() data: { table: string; fields: string[] }) {
    try {
      console.log(`INSERT INTO ${data.table} VALUES(${data.fields.join(',')})`);
      await this.database.query(
        `INSERT INTO ${data.table} VALUES(${data.fields.join(',')})`
      );
      return {
        status: 'success',
      };
    } catch (error) {
      console.log(error);
      return {
        status: 'error',
      };
    }
  }
}
