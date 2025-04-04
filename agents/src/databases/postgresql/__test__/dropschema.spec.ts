import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresAdaptater } from '../src/database.js';
import {
  PostgresDatabasePoolInterface,
  dropSchemaOptionInterface,
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

describe('PostgresAdaptater - dropSchema', () => {
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

  describe('dropSchema', () => {
    beforeEach(async () => {
      // Simulate a successful connection before each test
      mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await adapter.connectDatabase();
      mockQuery.mockReset(); // Reset call history after connection
    });

    it('should drop a schema with default options', async () => {
      // Arrange
      const options: dropSchemaOptionInterface = {
        schema_name: 'test_schema',
      };

      // Act
      const result = await adapter.dropSchema(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('DROP SCHEMA test_schema;');
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should drop a schema with IF EXISTS option', async () => {
      // Arrange
      const options: dropSchemaOptionInterface = {
        schema_name: 'test_schema',
        if_exists: true,
      };

      // Act
      const result = await adapter.dropSchema(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP SCHEMA IF EXISTS test_schema;'
      );
      expect(result.status).toEqual('success');
    });

    it('should drop a schema with CASCADE option', async () => {
      // Arrange
      const options: dropSchemaOptionInterface = {
        schema_name: 'test_schema',
        cascade: true,
      };

      // Act
      const result = await adapter.dropSchema(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP SCHEMA test_schema CASCADE;'
      );
      expect(result.status).toEqual('success');
    });

    it('should drop a schema with RESTRICT option', async () => {
      // Arrange
      const options: dropSchemaOptionInterface = {
        schema_name: 'test_schema',
        restrict: true,
      };

      // Act
      const result = await adapter.dropSchema(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP SCHEMA test_schema RESTRICT;'
      );
      expect(result.status).toEqual('success');
    });

    it('should drop a schema with combined options (IF EXISTS and CASCADE)', async () => {
      // Arrange
      const options: dropSchemaOptionInterface = {
        schema_name: 'test_schema',
        if_exists: true,
        cascade: true,
      };

      // Act
      const result = await adapter.dropSchema(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP SCHEMA IF EXISTS test_schema CASCADE;'
      );
      expect(result.status).toEqual('success');
    });

    it('should handle PostgreSQL errors', async () => {
      // Arrange
      const options: dropSchemaOptionInterface = {
        schema_name: 'test_schema',
      };

      // Simulate a PostgreSQL error
      const pgError = new Error('Schema does not exist');
      (pgError as any).code = '3F000'; // invalid_schema_name error code
      mockQuery.mockRejectedValueOnce(pgError);

      // Act
      const result = await adapter.dropSchema(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('DROP SCHEMA test_schema;');
      expect(result.status).toEqual('error');
      expect(result.code).toEqual('3F000');
    });

    it('should handle the case when database is not connected', async () => {
      // Arrange
      const options: dropSchemaOptionInterface = {
        schema_name: 'test_schema',
      };

      // Simulate disconnected database
      // @ts-expect-error - Accessing a private property for testing
      adapter.pool = undefined;

      // Act
      const result = await adapter.dropSchema(options);

      // Assert
      expect(mockQuery).not.toHaveBeenCalled();
      expect(result.status).toEqual('error');
      expect(result.error_message).toEqual(
        new Error('Error database not connected.')
      );
    });

    it('should prioritize CASCADE over RESTRICT when both are provided', async () => {
      // Arrange
      const options: dropSchemaOptionInterface = {
        schema_name: 'test_schema',
        cascade: true,
        restrict: true, // This should be ignored when cascade is true
      };

      // Act
      const result = await adapter.dropSchema(options);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'DROP SCHEMA test_schema CASCADE RESTRICT;'
      );
      expect(result.status).toEqual('success');
    });
  });
});
