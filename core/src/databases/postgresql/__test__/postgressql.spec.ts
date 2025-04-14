import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PostgresAdaptater } from '../src/database.js';
import {
  PostgresDatabasePoolInterface,
  PostgresSchema,
} from '../src/interfaces/interfaces.js';
import pg from 'pg';

// Mock complet de pg
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

// Récupérer les fonctions mock pour faciliter les tests
const mockQuery = (pg as any).__mockQueryFn;
const mockEnd = (pg as any).__mockEndFn;

describe('PostgresAdaptater', () => {
  let adapter: PostgresAdaptater;

  const connectionParams: PostgresDatabasePoolInterface = {
    host: 'localhost',
    user: 'testuser',
    password: 'testpassword',
    database: 'testdb',
    port: 5432,
  };

  beforeEach(() => {
    // Réinitialiser les mocks avant chaque test
    jest.clearAllMocks();

    // Réinitialiser l'état des mocks
    mockQuery.mockReset();
    mockEnd.mockReset();

    // Créer une nouvelle instance d'adaptateur
    adapter = new PostgresAdaptater(connectionParams);
  });

  describe('constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(adapter['host']).toBe('localhost');
      expect(adapter['user']).toBe('testuser');
      expect(adapter['password']).toBe('testpassword');
      expect(adapter['database']).toBe('testdb');
      expect(adapter['port']).toBe(5432);
    });
  });

  describe('connectDatabase', () => {
    it('should connect successfully to the database', async () => {
      // Préparer le mock pour retourner une valeur de test
      mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });

      const result = await adapter.connectDatabase();

      expect(pg.Pool).toHaveBeenCalledWith({
        host: 'localhost',
        user: 'testuser',
        password: 'testpassword',
        database: 'testdb',
        port: 5432,
      });

      expect(mockQuery).toHaveBeenCalledWith('SELECT NOW()');
      expect(result).toBe(adapter);
    });
  });

  describe('createSchema', () => {
    beforeEach(async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await adapter.connectDatabase();
      mockQuery.mockReset();
    });

    it('should create a schema', async () => {
      // Arrange
      const schema: PostgresSchema = {
        name: 'test_schema',
      };

      // Act
      const result = await adapter.createSchema(schema);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('CREATE SCHEMA test_schema;');
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });

    it('should create a schema with parameters IF NOT EXISTS', async () => {
      // Arrange
      const schema: PostgresSchema = {
        name: 'test_schema',
        if_not_exist: true,
      };

      // Act
      const result = await adapter.createSchema(schema);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        'CREATE SCHEMA IF NOT EXISTS test_schema;'
      );
      expect(result.status).toEqual('success');
    });

    it('should handle errors : 42P06', async () => {
      // Arrange
      const schema: PostgresSchema = {
        name: 'test_schema',
      };

      // Simuler une erreur PostgreSQL
      const pgError = new Error('Schema already exists');
      (pgError as any).code = '42P06';
      mockQuery.mockRejectedValueOnce(pgError);

      // Act
      const result = await adapter.createSchema(schema);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('CREATE SCHEMA test_schema;');
      expect(result.status).toEqual('error');
      expect(result.code).toEqual('42P06');
    });

    it('Should handle when databse is not connected', async () => {
      // Arrange
      const schema: PostgresSchema = {
        name: 'test_schema',
      };

      // @ts-expect-error Accessing a private property for testing
      adapter.pool = undefined;

      // Act
      const result = await adapter.createSchema(schema);

      // Assert
      expect(mockQuery).not.toHaveBeenCalled();
      expect(result.status).toEqual('error');
      expect(result.error_message).toEqual(
        new Error('Error database not connected.')
      );
    });
  });
  describe('createSchema', () => {
    beforeEach(async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      await adapter.connectDatabase();
      mockQuery.mockReset();
    });

    it('should create a schema', async () => {
      // Arrange
      const schema: PostgresSchema = {
        name: 'test_schema',
      };

      // Act
      const result = await adapter.createSchema(schema);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith('CREATE SCHEMA test_schema;');
      expect(result.status).toEqual('success');
      expect(result.code).toEqual('0000');
    });
  });
});
