import { QueryBuilder } from './queryBuilder.js';
import {
  deleteOptionInterface,
  dropSchemaOptionInterface,
  dropTableOptionInterface,
  insertOptionInterface,
  PostgresDatabasePoolInterface,
  PostgresSchema,
  PostgresTables,
  QueryResponseInterface,
  selectOptionInterface,
  updateOptionInterface,
} from './interfaces/interfaces.js';
import { getError } from './types/error.js';
import pg from 'pg';
const { Pool } = pg; /**
 * PostgreSQL adapter for database operations
 * @property {string} host - Database server hostname
 * @property {string} user - Username for authentication
 * @property {string} password - Password for authentication
 * @property {string} database - Database name
 * @property {number} port - Port number for the connection
 * @property {Pool} pool - Connection pool for the database
 * @property {PostgresTables[]} tables - Array of tables in the database
 */
export class PostgresAdaptater {
  private host: string;
  private user: string;
  private password: string;
  private database: string;
  private port: number;
  private pool: pg.Pool;
  private tables: PostgresTables[] = [];

  /**
   * Creates a new PostgreSQL adapter instance
   * @param {PostgresDatabasePoolInterface} params - Connection parameters
   */
  constructor(params: PostgresDatabasePoolInterface) {
    this.host = params.host;
    this.user = params.user;
    this.password = params.password;
    this.database = params.database;
    this.port = params.port;
  }

  /**
   * Establishes a connection to the database
   * @returns {Promise<PostgresAdaptater | undefined>} The adapter instance or undefined if connection fails
   */
  public connectDatabase = async (): Promise<PostgresAdaptater | undefined> => {
    const pool = new Pool({
      host: this.host,
      user: this.user,
      password: this.password,
      database: this.database,
      port: this.port,
    });

    this.pool = pool;
    try {
      await pool.query('SELECT NOW()');
    } catch (error) {
      console.log(error);
      return undefined;
    }
    return this;
  };

  /**
   * Creates a new database
   * @param {string} database_name - Name of the database to create
   * @returns {Promise<boolean>} True if database was created successfully, false otherwise
   */

  public createDatabase = async (database_name: string): Promise<boolean> => {
    if (this.pool === undefined) {
      throw new Error('Error database not connected.');
    }
    if (database_name === undefined) {
      throw new Error('Error database_name is undefined.');
    }
    try {
      // console.log(`CREATE DATABASE ${database_name};`);
      const create_db = await this.pool.query(
        `CREATE DATABASE ${database_name};`
      );
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === '42P04') {
          console.warn('Database already exist. Skip creation.');
          return true;
        }
      }
      return false;
    }
  };

  /**
   * Closes the database connection
   */
  public closeDatabase = async () => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      await this.pool.end();
    } catch (error) {
      console.error('Error closing database connection:', error);
      throw error;
    }
  };

  /**
   * Creates a new schema in the database
   * @param {PostgresSchema} schema - Schema configuration
   * @returns {Promise<QueryResult | undefined>} Query result or undefined if operation fails
   */
  public createSchema = async (
    schema: PostgresSchema
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      let commandline = 'CREATE SCHEMA ';
      if (schema != undefined && schema.if_not_exist === true) {
        commandline = commandline + 'IF NOT EXISTS ';
      }
      commandline = commandline + schema.name + ';';
      const schema_result = await this.pool.query(commandline);

      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: schema_result,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Drops a schema from the database
   * @param {dropSchemaOptionInterface} options - Schema drop options
   * @returns {Promise<QueryResult | undefined>} Query result or undefined if operation fails
   */ public dropSchema = async (
    options: dropSchemaOptionInterface
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (!options.schema_name) {
        throw new Error('Error schema_name is undefined.');
      }

      const queryBuilder = new QueryBuilder();
      queryBuilder
        .append('DROP SCHEMA')
        .appendIf(options.if_exists || false, 'IF EXISTS')
        .append(options.schema_name)
        .appendIf(options.cascade || false, 'CASCADE')
        .appendIf(options.restrict || false, 'RESTRICT');

      const query = queryBuilder.build();
      const drop_schema_result = await this.pool.query(query);
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: drop_schema_result,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Creates a new table in the database
   * @param {PostgresTables} tables - Table configuration
   * @returns {Promise<QueryResult | string | undefined>} Query result, message, or undefined if operation fails
   */
  public createTable = async (
    tables: PostgresTables
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (tables === undefined) {
        throw new Error('Error tables is undefined.');
      }
      if (tables.fields.size === 0) {
        throw new Error('Error fields is empty.');
      }

      const fullTableName = tables.schema
        ? `${tables.schema}.${tables.table_name}`
        : tables.table_name;

      const queryBuilder = new QueryBuilder();
      queryBuilder.append('CREATE TABLE');
      if (tables.if_not_exist === true) {
        queryBuilder.append('IF NOT EXISTS');
      }
      queryBuilder.append(fullTableName);
      queryBuilder.append('(');
      const fields: Array<string> = [];
      tables.fields.forEach((value, key) => {
        fields.push(key + ' ' + value);
      });
      queryBuilder.append(fields.join(', '));
      queryBuilder.append(')');
      const query = queryBuilder.build();
      this.tables.push(tables);
      const result_create_table = await this.pool.query(query);
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: result_create_table,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Adds an existing table to the adapter's table list
   * @param {PostgresTables} table - Table configuration
   */
  public async addExistingTable(table: PostgresTables) {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (this.tables.find((table) => table.table_name === table.table_name)) {
        throw new Error('Error table already exists.');
      }
      this.tables.push(table);
    } catch (error) {}
  }

  /**
   * Drops a table from the database
   * @param {dropTableOptionInterface} options - Table drop options
   * @returns {Promise<QueryResult | undefined>} Query result or undefined if operation fails
   */
  public dropTable = async (
    options: dropTableOptionInterface
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (!options.table_name) {
        throw new Error('Error table_name is undefined');
      }

      const queryBuilder = new QueryBuilder();
      const fullTableName = options.schema_name
        ? `${options.schema_name}.${options.table_name}`
        : options.table_name;
      queryBuilder
        .append('DROP TABLE')
        .appendIf(options.if_exists || false, 'IF EXISTS')
        .append(fullTableName)
        .appendIf(options.cascade || false, 'CASCADE')
        .appendIf(options.restrict || false, 'RESTRICT');

      const query = queryBuilder.build();
      const drop_table_result = await this.pool.query(query);
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: drop_table_result,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Drops a database
   * @param {string} database_name - Name of the database to drop
   * @returns {Promise<QueryResult | undefined>} Query result or undefined if operation fails
   */
  public dropDatabase = async (
    database_name: string
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (this.database === database_name) {
        throw new Error(`You can't delete the current database.`);
      }
      const delete_db = await this.pool.query(`DROP DATABASE ${this.database}`);
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: delete_db,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Inserts data into a table
   * @param {insertOptionInterface} options - Insert options
   * @returns {Promise<QueryResult | undefined>} Query result or undefined if operation fails
   */
  public insert = async (
    options: insertOptionInterface,
    values?: Array<any>
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (options.table_name === undefined) {
        throw new Error('Error table_name is undefined.');
      }
      const table = this.tables.find(
        (table) => table.table_name === options.table_name
      );
      if (table === undefined) {
        throw new Error('Error table not found.');
      }
      const queryBuilder = new QueryBuilder();
      const fullTableName = table.schema
        ? `${table.schema}.${options.table_name}`
        : options.table_name;

      queryBuilder.append('INSERT INTO').append(fullTableName);

      if (options.ALIAS) {
        queryBuilder.append('AS ' + options.ALIAS);
      }
      queryBuilder
        .append('(')
        .appendJoinedList(Array.from(options.fields.keys()))
        .append(')');

      queryBuilder
        .append('VALUES')
        .append('(')
        .appendJoinedListType(Array.from(options.fields.values()))
        .append(')');

      const query = queryBuilder.build();

      let insert_result;
      if (!values) {
        insert_result = await this.pool.query(query);
      } else {
        insert_result = await this.pool.query(query, values);
      }
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: insert_result,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Selects data from a table
   * @param {selectOptionInterface} options - Select options
   * @returns {Promise<QueryResult | undefined>} Query result or undefined if operation fails
   */
  public select = async (
    options: selectOptionInterface,
    values?: Array<any>
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (!options.FROM) {
        throw new Error('Error table_names is undefined.');
      }

      const full_table_names = options.FROM.map((table_name) => {
        const table = this.tables.find(
          (table) => table.table_name === table_name
        );
        if (table === undefined) {
          throw new Error('Error table not found.');
        }
        return table.schema ? `${table.schema}.${table_name}` : table_name;
      });
      const queryBuilder = new QueryBuilder();
      queryBuilder.append('SELECT ');
      queryBuilder.appendJoinedList(options.SELECT);
      queryBuilder.append('FROM ');
      queryBuilder.appendJoinedList(full_table_names);
      if (options.ALIAS) {
        queryBuilder.append('AS ' + options.ALIAS);
      }
      if (options.WHERE) {
        queryBuilder.append('WHERE ').appendJoinedList(options.WHERE, ' AND ');
      }

      const query = queryBuilder.build();
      let select_result;

      if (!values) {
        select_result = await this.pool.query(query);
      } else {
        select_result = await this.pool.query(query, values);
      }
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: select_result,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Updates data in a table
   * @param {string} table_name - Name of the table to update
   * @param {updateOptionInterface} options - Update options
   */
  public update = async (
    options: updateOptionInterface,
    values?: Array<any>
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (options.table_name === undefined) {
        throw new Error('Error table_name is undefined.');
      }
      const table = this.tables.find(
        (table) => table.table_name === options.table_name
      );
      if (table === undefined) {
        throw new Error('Error table not found.');
      }
      const queryBuilder = new QueryBuilder();
      const fullTableName = table.schema
        ? `${table.schema}.${options.table_name}`
        : options.table_name;

      queryBuilder
        .append('UPDATE')
        .appendIf(options.ONLY, 'ONLY')
        .append(fullTableName);

      if (options.ALIAS) {
        queryBuilder.append('AS ' + options.ALIAS);
      }

      queryBuilder.append('SET');
      queryBuilder.appendJoinedListType(options.SET);

      if (options.FROM) {
        queryBuilder.append('FROM').appendJoinedList(options.FROM);
      }

      if (options.WHERE) {
        queryBuilder.append('WHERE').appendJoinedList(options.WHERE, ' AND ');
      }

      const query = queryBuilder.build();
      let update_result;
      if (!values) {
        update_result = await this.pool.query(query);
      } else {
        update_result = await this.pool.query(query, values);
      }
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: update_result,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Deletes data from a table
   * @param {deleteOptionInterface} options - Delete options
   */
  public delete = async (
    options: deleteOptionInterface,
    values?: Array<any>
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }
      if (options.table_name === undefined) {
        throw new Error('Error table_name is undefined.');
      }
      const table = this.tables.find(
        (table) => table.table_name === options.table_name
      );
      if (table === undefined) {
        throw new Error('Error table not found.');
      }
      const queryBuilder = new QueryBuilder();
      const fullTableName = table.schema
        ? `${table.schema}.${options.table_name}`
        : options.table_name;
      queryBuilder
        .append('DELETE FROM')
        .appendIf(options.ONLY, 'ONLY')
        .append(fullTableName);
      if (options.ALIAS) {
        queryBuilder.append('AS ' + options.ALIAS);
      }
      if (options.USING) {
        queryBuilder.append('USING').appendJoinedList(options.USING);
      }
      if (options.WHERE) {
        queryBuilder.append('WHERE').appendJoinedList(options.WHERE, ' AND ');
      }
      const query = queryBuilder.build();
      let delete_result;
      if (!values) {
        delete_result = await this.pool.query(query);
      } else {
        delete_result = await this.pool.query(query, values);
      }
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: delete_result,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  public query = async (
    query: string,
    values?: Array<any>
  ): Promise<QueryResponseInterface> => {
    try {
      if (this.pool === undefined) {
        throw new Error('Error database not connected.');
      }

      let query_result;
      if (!values) {
        query_result = await this.pool.query(query);
      } else {
        query_result = await this.pool.query(query, values);
      }
      const queryResponse: QueryResponseInterface = {
        status: 'success',
        code: '0000',
        query: query_result,
      };
      return queryResponse;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const error_message = getError(error.code);
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: error.code,
          error_message: error_message,
        };
        return queryResponse;
      } else {
        const queryResponse: QueryResponseInterface = {
          status: 'error',
          code: '-1',
          error_message: error,
        };
        return queryResponse;
      }
    }
  };

  /**
   * Gets the name of the current database
   * @returns {string} The database name
   */
  getDatabaseName = (): string => {
    return this.database;
  };
}
