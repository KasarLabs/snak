import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresAdaptater } from '../src/database.js';
import {
  PostgresDatabasePoolInterface,
  deleteOptionInterface,
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

describe('PostgresAdaptater - update and delete operations', () => {
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

  describe('delete', () => {
    beforeEach(async () => {
      // Simulate a successful connection before each test
      mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await adapter.connectDatabase();
      mockQuery.mockReset();
    });

    it('should delete records with basic WHERE clause', async () => {
      // Arrange
      // First create a table
      const tableFieldsMap = new Map<string, string>();
      tableFieldsMap.set('id', 'SERIAL PRIMARY KEY');
      tableFieldsMap.set('name', 'VARCHAR(255) NOT NULL');
      tableFieldsMap.set('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

      const table: PostgresTables = {
        table_name: 'users',
        fields: tableFieldsMap,
      };
      await adapter.createTable(table);

      // Define delete options
      const options: deleteOptionInterface = {
        table_name: 'users',
        ONLY: false,
        WHERE: ["created_at < '2023-01-01'"],
      };

      // Act
      const result = await adapter.delete(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE users ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "DELETE FROM users WHERE created_at < '2023-01-01';"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should delete records with ONLY option', async () => {
      // Arrange
      // First create a table
      const tableFieldsMap = new Map<string, string>();
      tableFieldsMap.set('id', 'SERIAL PRIMARY KEY');
      tableFieldsMap.set('status', 'VARCHAR(20) NOT NULL');

      const table: PostgresTables = {
        table_name: 'orders',
        fields: tableFieldsMap,
      };
      await adapter.createTable(table);

      // Define delete options
      const options: deleteOptionInterface = {
        table_name: 'orders',
        ONLY: true,
        WHERE: ["status = 'cancelled'"],
      };

      // Act
      const result = await adapter.delete(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE orders ( id SERIAL PRIMARY KEY, status VARCHAR(20) NOT NULL );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "DELETE FROM ONLY orders WHERE status = 'cancelled';"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should delete records with alias', async () => {
      // Arrange
      // First create a table
      const tableFieldsMap = new Map<string, string>();
      tableFieldsMap.set('id', 'SERIAL PRIMARY KEY');
      tableFieldsMap.set('is_active', 'BOOLEAN DEFAULT TRUE');

      const table: PostgresTables = {
        table_name: 'products',
        fields: tableFieldsMap,
      };
      await adapter.createTable(table);

      // Define delete options
      const options: deleteOptionInterface = {
        table_name: 'products',
        ONLY: false,
        ALIAS: 'p',
        WHERE: ['p.is_active = false'],
      };

      // Act
      const result = await adapter.delete(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE products ( id SERIAL PRIMARY KEY, is_active BOOLEAN DEFAULT TRUE );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM products AS p WHERE p.is_active = false;'
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should delete records with USING clause', async () => {
      // Arrange
      // First create tables
      const ordersFieldsMap = new Map<string, string>();
      ordersFieldsMap.set('id', 'SERIAL PRIMARY KEY');
      ordersFieldsMap.set('customer_id', 'INTEGER');

      const ordersTable: PostgresTables = {
        table_name: 'orders',
        fields: ordersFieldsMap,
      };
      await adapter.createTable(ordersTable);

      const customersFieldsMap = new Map<string, string>();
      customersFieldsMap.set('id', 'SERIAL PRIMARY KEY');
      customersFieldsMap.set('status', 'VARCHAR(20)');

      const customersTable: PostgresTables = {
        table_name: 'customers',
        fields: customersFieldsMap,
      };
      await adapter.createTable(customersTable);

      // Define delete options
      const options: deleteOptionInterface = {
        table_name: 'orders',
        ONLY: false,
        USING: ['customers'],
        WHERE: [
          'orders.customer_id = customers.id',
          "customers.status = 'inactive'",
        ],
      };

      // Act
      const result = await adapter.delete(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE orders ( id SERIAL PRIMARY KEY, customer_id INTEGER );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        'CREATE TABLE customers ( id SERIAL PRIMARY KEY, status VARCHAR(20) );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        3,
        "DELETE FROM orders USING customers WHERE orders.customer_id = customers.id AND customers.status = 'inactive';"
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should delete all records when no WHERE clause is provided', async () => {
      // Arrange
      // First create a table
      const tableFieldsMap = new Map<string, string>();
      tableFieldsMap.set('id', 'SERIAL PRIMARY KEY');
      tableFieldsMap.set('data', 'TEXT');

      const table: PostgresTables = {
        table_name: 'temp_logs',
        fields: tableFieldsMap,
      };
      await adapter.createTable(table);

      // Define delete options
      const options: deleteOptionInterface = {
        table_name: 'temp_logs',
        ONLY: false,
      };

      // Act
      const result = await adapter.delete(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE temp_logs ( id SERIAL PRIMARY KEY, data TEXT );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(2, 'DELETE FROM temp_logs;');
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should handle PostgreSQL errors during delete', async () => {
      // Arrange
      // First create a table with foreign key constraints
      const tableFieldsMap = new Map<string, string>();
      tableFieldsMap.set('id', 'SERIAL PRIMARY KEY');
      tableFieldsMap.set('name', 'VARCHAR(255) NOT NULL');

      const table: PostgresTables = {
        table_name: 'categories',
        fields: tableFieldsMap,
      };
      await adapter.createTable(table);

      // Define delete options
      const options: deleteOptionInterface = {
        table_name: 'categories',
        ONLY: false,
        WHERE: ['id = 1'],
      };

      // Simulate a PostgreSQL error
      const pgError = new Error(
        'update or delete on table "categories" violates foreign key constraint'
      );
      (pgError as any).code = '23503'; // foreign_key_violation error code
      mockQuery.mockRejectedValueOnce(pgError);

      // Act
      const result = await adapter.delete(options);

      // Assert
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        'CREATE TABLE categories ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL );'
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM categories WHERE id = 1;'
      );
      expect(result.status).toEqual('error');
      expect(result.code).toEqual('23503');
    });

    it('should handle the case when database is not connected', async () => {
      // Arrange
      const options: deleteOptionInterface = {
        table_name: 'users',
        ONLY: false,
        WHERE: ['id = 1'],
      };

      // Simulate disconnected database
      // @ts-ignore - Accessing a private property for testing
      adapter.pool = undefined;

      // Act
      const result = await adapter.delete(options);

      // Assert
      expect(mockQuery).not.toHaveBeenCalled();
      expect(result.status).toEqual('error');
      expect(result.error_message).toEqual(
        new Error('Error database not connected.')
      );
    });
  });
});
