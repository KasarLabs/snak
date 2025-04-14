import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresAdaptater } from '../src/database.js';
import {
  PostgresDatabasePoolInterface,
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

describe('PostgresAdaptater - createTable', () => {
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

  describe('createTable', () => {
    beforeEach(async () => {
      // Simulate a successful connection before each test
      mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await adapter.connectDatabase();
      mockQuery.mockReset(); // Reset call history after connection
    });

    it('should create a table with basic fields', async () => {
      // Arrange
      const fieldsMap = new Map<string, string>();
      fieldsMap.set('id', 'SERIAL PRIMARY KEY');
      fieldsMap.set('name', 'VARCHAR(255) NOT NULL');
      fieldsMap.set('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

      const table: PostgresTables = {
        table_name: 'users',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.createTable(table);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'CREATE TABLE users ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );'
      );
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should create a table with schema specified', async () => {
      // Arrange
      const fieldsMap = new Map<string, string>();
      fieldsMap.set('id', 'SERIAL PRIMARY KEY');
      fieldsMap.set('email', 'VARCHAR(255) UNIQUE');

      const table: PostgresTables = {
        table_name: 'customers',
        schema: 'shop',
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.createTable(table);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'CREATE TABLE shop.customers ( id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE );'
      );
      expect(result.status).toEqual('success');
    });

    it('should create a table with IF NOT EXISTS option', async () => {
      // Arrange
      const fieldsMap = new Map<string, string>();
      fieldsMap.set('id', 'SERIAL PRIMARY KEY');
      fieldsMap.set('amount', 'DECIMAL(10,2)');

      const table: PostgresTables = {
        table_name: 'orders',
        if_not_exist: true,
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.createTable(table);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'CREATE TABLE IF NOT EXISTS orders ( id SERIAL PRIMARY KEY, amount DECIMAL(10,2) );'
      );
      expect(result.status).toEqual('success');
    });

    it('should create a table with schema and IF NOT EXISTS option', async () => {
      // Arrange
      const fieldsMap = new Map<string, string>();
      fieldsMap.set('id', 'SERIAL PRIMARY KEY');
      fieldsMap.set('product_id', 'INTEGER');
      fieldsMap.set('quantity', 'INTEGER');

      const table: PostgresTables = {
        table_name: 'order_items',
        schema: 'shop',
        if_not_exist: true,
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.createTable(table);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'CREATE TABLE IF NOT EXISTS shop.order_items ( id SERIAL PRIMARY KEY, product_id INTEGER, quantity INTEGER );'
      );
      expect(result.status).toEqual('success');
    });

    it('should handle a table with no fields', async () => {
      // Arrange
      const table: PostgresTables = {
        table_name: 'empty_table',
        fields: new Map<string, string>(),
      };

      // Act
      const result = await adapter.createTable(table);

      // Assert
      expect(result.status).toEqual('error');
      // The implementation might vary, but generally creating a table with no fields is an error
    });

    it('should handle PostgreSQL errors when creating a table', async () => {
      // Arrange
      const fieldsMap = new Map<string, string>();
      fieldsMap.set('id', 'SERIAL PRIMARY KEY');

      const table: PostgresTables = {
        table_name: 'already_exists',
        fields: fieldsMap,
      };

      // Simulate a PostgreSQL error
      const pgError = new Error('Relation already exists');
      (pgError as any).code = '42P07'; // relation_already_exists error code
      mockQuery.mockRejectedValueOnce(pgError);

      // Act
      const result = await adapter.createTable(table);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'CREATE TABLE already_exists ( id SERIAL PRIMARY KEY );'
      );
      expect(result.status).toEqual('error');
      expect(result.code).toEqual('42P07');
    });

    it('should handle the case when database is not connected', async () => {
      // Arrange
      const fieldsMap = new Map<string, string>();
      fieldsMap.set('id', 'SERIAL PRIMARY KEY');

      const table: PostgresTables = {
        table_name: 'test_table',
        fields: fieldsMap,
      };

      // Simulate disconnected database
      // @ts-expect-error - Accessing a private property for testing
      adapter.pool = undefined;

      // Act
      const result = await adapter.createTable(table);

      // Assert
      expect(mockQuery).not.toHaveBeenCalled();
      expect(result.status).toEqual('error');
      expect(result.error_message).toEqual(
        new Error('Error database not connected.')
      );
    });

    it('should create a table with complex field definitions', async () => {
      // Arrange
      const fieldsMap = new Map<string, string>();
      fieldsMap.set(' id', 'SERIAL PRIMARY KEY ');
      fieldsMap.set(' name', 'VARCHAR(255) NOT NULL ');
      fieldsMap.set(' description', 'TEXT ');
      fieldsMap.set(' price', 'DECIMAL(10,2) NOT NULL CHECK (price > 0) ');
      fieldsMap.set(' created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ');
      fieldsMap.set(' updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ');
      fieldsMap.set(' status', "VARCHAR(20) DEFAULT 'active' ");

      const table: PostgresTables = {
        table_name: 'products',
        schema: 'inventory',
        if_not_exist: true,
        fields: fieldsMap,
      };

      // Act
      const result = await adapter.createTable(table);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS inventory.products')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(' id SERIAL PRIMARY KEY ')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(' name VARCHAR(255) NOT NULL ')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(' description TEXT ')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          ' price DECIMAL(10,2) NOT NULL CHECK (price > 0) '
        )
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          ' created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP '
        )
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          ' updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP '
        )
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(" status VARCHAR(20) DEFAULT 'active' ")
      );
      expect(result.status).toEqual('success');
    });
  });
});
