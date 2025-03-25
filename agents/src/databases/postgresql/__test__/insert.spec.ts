import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresAdaptater } from '../src/database.js';
import {
  PostgresDatabasePoolInterface,
  insertOptionInterface,
  PostgresTables,
} from '../src/interfaces/interfaces.js';
import pg from 'pg';

// Complete mock of pg module
jest.mock('pg', () => {
  const mockQueryFn = jest.fn();
  const mockEndFn = jest.fn();

  return {
    Pool: jest.fn().mockImplementation(() => {
      return {
        query: mockQueryFn,
        end: mockEndFn,
      };
    }),
    __mockQueryFn: mockQueryFn,
    __mockEndFn: mockEndFn,
  };
});

// Retrieve mock functions for easier testing
const mockQuery = (pg as any).__mockQueryFn;
const mockEnd = (pg as any).__mockEndFn;

describe('PostgresAdaptater - insert', () => {
  let adapter: PostgresAdaptater;

  const connectionParams: PostgresDatabasePoolInterface = {
    host: 'localhost',
    user: 'testuser',
    password: 'testpassword',
    database: 'testdb',
    port: 5432,
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Reset mock state
    mockQuery.mockReset();
    mockEnd.mockReset();

    // Create a new adapter instance
    adapter = new PostgresAdaptater(connectionParams);
  });

  describe('insert', () => {
    beforeEach(async () => {
      // Simulate a successful connection before each test
      mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await adapter.connectDatabase();
      mockQuery.mockReset(); // Reset call history after connection
    });

    it('should insert a record with string values', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('name', 'John Doe');
      fieldsMap.set('email', 'john@example.com');

      const TablesfieldsMap = new Map<string, string>();
      TablesfieldsMap.set('name', 'VARCHAR(255) NOT NULL');
      TablesfieldsMap.set('email', 'VARCHAR(255) NOT NULL');

      const table: PostgresTables = {
        table_name: 'users',
        fields: TablesfieldsMap,
      };
      await adapter.createTable(table);

      const options: insertOptionInterface = {
        table_name: 'users',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE users ( name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO users ( name, email ) VALUES ( 'John Doe', 'john@example.com' );"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should insert a record with numeric values', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('product_id', 123);
      fieldsMap.set('quantity', 5);
      fieldsMap.set('price', 19.99);

      const TablesfieldsMap = new Map<string, string>();
      TablesfieldsMap.set('product_id', 'INTEGER NOT NULL');
      TablesfieldsMap.set('quantity', 'INTEGER NOT NULL');
      TablesfieldsMap.set('price', 'DECIMAL(10,2) NOT NULL');

      const table: PostgresTables = {
        table_name: 'order_items',
        fields: TablesfieldsMap,
      };
      await adapter.createTable(table);

      const options: insertOptionInterface = {
        table_name: 'order_items',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE order_items ( product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, price DECIMAL(10,2) NOT NULL );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO order_items ( product_id, quantity, price ) VALUES ( 123, 5, 19.99 );'
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should insert a record with mixed value types', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('name', 'Product XYZ');
      fieldsMap.set('price', 29.95);
      fieldsMap.set('in_stock', true);
      fieldsMap.set('description', 'This is a product description');

      const TablesfieldsMap = new Map<string, string>();
      TablesfieldsMap.set('name', 'VARCHAR(255) NOT NULL');
      TablesfieldsMap.set('price', 'DECIMAL(10,2) NOT NULL');
      TablesfieldsMap.set('in_stock', 'BOOLEAN DEFAULT TRUE');
      TablesfieldsMap.set('description', 'TEXT');

      const table: PostgresTables = {
        table_name: 'products',
        fields: TablesfieldsMap,
      };
      await adapter.createTable(table);

      const options: insertOptionInterface = {
        table_name: 'products',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE products ( name VARCHAR(255) NOT NULL, price DECIMAL(10,2) NOT NULL, in_stock BOOLEAN DEFAULT TRUE, description TEXT );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO products ( name, price, in_stock, description ) VALUES ( 'Product XYZ', 29.95, true, 'This is a product description' );"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should insert a record with DEFAULT values', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('name', 'New User');
      fieldsMap.set('created_at', 'DEFAULT');

      const TablesfieldsMap = new Map<string, string>();
      TablesfieldsMap.set('name', 'VARCHAR(255) NOT NULL');
      TablesfieldsMap.set('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

      const table: PostgresTables = {
        table_name: 'users',
        fields: TablesfieldsMap,
      };
      await adapter.createTable(table);

      const options: insertOptionInterface = {
        table_name: 'users',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE users ( name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO users ( name, created_at ) VALUES ( 'New User', DEFAULT );"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should insert a record with an alias specified', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('name', 'Jane Smith');

      const TablesfieldsMap = new Map<string, string>();
      TablesfieldsMap.set('name', 'VARCHAR(255) NOT NULL');

      const table: PostgresTables = {
        table_name: 'users',
        fields: TablesfieldsMap,
      };
      await adapter.createTable(table);

      const options: insertOptionInterface = {
        table_name: 'users',
        ALIAS: 'u',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE users ( name VARCHAR(255) NOT NULL );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO users AS u ( name ) VALUES ( 'Jane Smith' );"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should handle an empty fields map', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();

      const options: insertOptionInterface = {
        table_name: 'users',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).not.toHaveBeenCalled();
      expect(result.status).toEqual('error');
      // The implementation might vary, but generally inserting with no fields is an error
    });

    it('should properly escape string values with quotes', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('name', "O'Reilly");
      fieldsMap.set('description', 'Product with "quotes"');

      const TablesfieldsMap = new Map<string, string>();
      TablesfieldsMap.set('name', 'VARCHAR(255) NOT NULL');
      TablesfieldsMap.set('description', 'TEXT');

      const table: PostgresTables = {
        table_name: 'products',
        fields: TablesfieldsMap,
      };
      await adapter.createTable(table);

      const options: insertOptionInterface = {
        table_name: 'products',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE products ( name VARCHAR(255) NOT NULL, description TEXT );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO products ( name, description ) VALUES ( 'O''Reilly', 'Product with \"quotes\"' );"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should handle PostgreSQL errors during insert', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('email', 'duplicate@example.com');

      const TablesfieldsMap = new Map<string, string>();
      TablesfieldsMap.set('email', 'VARCHAR(255) UNIQUE NOT NULL');

      const table: PostgresTables = {
        table_name: 'users',
        fields: TablesfieldsMap,
      };
      await adapter.createTable(table);

      // Insert a first record to create the duplicate situation
      const firstInsertMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      firstInsertMap.set('email', 'duplicate@example.com');

      await adapter.insert({
        table_name: 'users',
        fields: firstInsertMap,
      });

      // Simulate a PostgreSQL error for the second insert
      const pgError = new Error(
        'duplicate key value violates unique constraint'
      );
      (pgError as any).code = '23505'; // unique_violation error code
      mockQuery.mockRejectedValueOnce(pgError);

      const options: insertOptionInterface = {
        table_name: 'users',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE users ( email VARCHAR(255) UNIQUE NOT NULL );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO users ( email ) VALUES ( 'duplicate@example.com' );"
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        3,
        "INSERT INTO users ( email ) VALUES ( 'duplicate@example.com' );"
      );
      expect(result.status).toEqual('error');
      expect(result.code).toEqual('23505');
    });

    it('should handle the case when database is not connected', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('name', 'Test User');

      const options: insertOptionInterface = {
        table_name: 'users',
        fields: fieldsMap,
      };

      // Simulate disconnected database
      // @ts-expect-error - Accessing a private property for testing
      adapter.pool = undefined;

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).not.toHaveBeenCalled();
      expect(result.status).toEqual('error');
      expect(result.error_message).toEqual(
        new Error('Error database not connected.')
      );
    });

    it('should handle NULL values correctly', async () => {
      // Arrange
      const fieldsMap = new Map<
        string,
        string | number | boolean | null | Array<string>
      >();
      fieldsMap.set('name', 'Test User');
      fieldsMap.set('phone', null);

      const TablesfieldsMap = new Map<string, string>();
      TablesfieldsMap.set('name', 'VARCHAR(255) NOT NULL');
      TablesfieldsMap.set('phone', 'VARCHAR(20)'); // Nullable field

      const table: PostgresTables = {
        table_name: 'users',
        fields: TablesfieldsMap,
      };
      await adapter.createTable(table);

      const options: insertOptionInterface = {
        table_name: 'users',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.insert(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE users ( name VARCHAR(255) NOT NULL, phone VARCHAR(20) );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO users ( name, phone ) VALUES ( 'Test User', NULL );"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });
  });
});
