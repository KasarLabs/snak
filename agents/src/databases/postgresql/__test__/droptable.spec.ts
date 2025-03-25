import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresAdaptater } from '../src/database.js';
import {
  PostgresDatabasePoolInterface,
  dropTableOptionInterface,
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

describe('PostgresAdaptater - dropTable', () => {
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

  describe('dropTable', () => {
    beforeEach(async () => {
      // Simulate a successful connection before each test
      mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await adapter.connectDatabase();
      mockQuery.mockReset(); // Reset call history after connection
    });

    it('should drop a table with default options', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'users',
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('DROP TABLE users;');
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should drop a table with schema specified', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'customers',
        schema_name: 'shop',
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('DROP TABLE shop.customers;');
      expect(result.status).toEqual('success');
    });

    it('should drop a table with IF EXISTS option', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'orders',
        if_exists: true,
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('DROP TABLE IF EXISTS orders;');
      expect(result.status).toEqual('success');
    });

    it('should drop a table with CASCADE option', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'categories',
        cascade: true,
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('DROP TABLE categories CASCADE;');
      expect(result.status).toEqual('success');
    });

    it('should drop a table with RESTRICT option', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'products',
        restrict: true,
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('DROP TABLE products RESTRICT;');
      expect(result.status).toEqual('success');
    });

    it('should drop a table with combined options (schema and IF EXISTS)', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'orders',
        schema_name: 'shop',
        if_exists: true,
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP TABLE IF EXISTS shop.orders;'
      );
      expect(result.status).toEqual('success');
    });

    it('should drop a table with combined options (IF EXISTS and CASCADE)', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'users',
        if_exists: true,
        cascade: true,
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP TABLE IF EXISTS users CASCADE;'
      );
      expect(result.status).toEqual('success');
    });

    it('should drop a table with all options combined', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'products',
        schema_name: 'inventory',
        if_exists: true,
        cascade: true,
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP TABLE IF EXISTS inventory.products CASCADE;'
      );
      expect(result.status).toEqual('success');
    });

    it('should prioritize CASCADE over RESTRICT when both are provided', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'users',
        cascade: true,
        restrict: true,
      };

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP TABLE users CASCADE RESTRICT;'
      );
      expect(result.status).toEqual('success');
    });

    it('should handle PostgreSQL errors when dropping a table', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'nonexistent_table',
      };

      // Simulate a PostgreSQL error
      const pgError = new Error('Table does not exist');
      (pgError as any).code = '42P01'; // undefined_table error code
      mockQuery.mockRejectedValueOnce(pgError);

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('DROP TABLE nonexistent_table;');
      expect(result.status).toEqual('error');
      expect(result.code).toEqual('42P01');
    });

    it('should handle the case when database is not connected', async () => {
      // Arrange
      const options: dropTableOptionInterface = {
        table_name: 'test_table',
      };

      // Simulate disconnected database
      // @ts-expect-error - Accessing a private property for testing
      adapter.pool = undefined;

      // Act
      const result = await adapter.dropTable(options);

      // Assert
      expect(mockQuery).not.toHaveBeenCalled();
      expect(result.status).toEqual('error');
      expect(result.error_message).toEqual(
        new Error('Error database not connected.')
      );
    });
  });
});
