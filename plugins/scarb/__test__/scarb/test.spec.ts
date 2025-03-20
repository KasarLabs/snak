// __test__/scarb/simple-init-test.spec.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { initializeProjectData } from '../../src/utils/db.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { PostgresAdaptater } from '@starknet-agent-kit/agents';

// Définir un type pour nos mocks qui correspond à la structure attendue
type MockDB = {
  select: jest.Mock;
  insert: jest.Mock;
  createTable: jest.Mock;
  addExistingTable: jest.Mock;
  update?: jest.Mock;
};

describe('Simple initializeProjectData Test', () => {
  // Créer l'agent et les mocks
  let agent: StarknetAgentInterface;
  let mockDb: MockDB;
  
  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();
    
    // Créer l'agent
    agent = createMockStarknetAgent();
    
    // Créer les mocks pour l'adaptateur Postgres
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      createTable: jest.fn(),
      addExistingTable: jest.fn(),
      update: jest.fn()
    };
    
    // Configuration des réponses
    mockDb.select.mockImplementation((params: { FROM: string[], SELECT: string[] }) => {
        // Déterminer quelle requête est en cours d'exécution
        if (params.FROM[0] === 'project') {
          if (params.SELECT[0] === 'id') {
            // Vérification si le projet existe ou récupération ID
            return { query: { rows: [{ id: 1 }] } };
          } else {
            // retrieveProjectData - info projet
            return { query: { rows: [{ id: 1, name: 'test_project', type: 'contract' }] } };
          }
        } else if (params.FROM[0] === 'program') {
          // Récupération des programmes
          return { query: { rows: [] } };
        } else if (params.FROM[0] === 'dependency') {
          // Récupération des dépendances
          return { query: { rows: [] } };
        }
        
        return { query: { rows: [] } };
      });
    
    mockDb.insert.mockReturnValue({ status: 'success' });
    mockDb.createTable.mockReturnValue({ status: 'success' });
    
    // Remplacer la méthode createDatabase - utiliser la technique appropriée pour le mock
    const origCreateDatabase = agent.createDatabase;
    agent.createDatabase = jest.fn(async (dbName: string) => {
      return mockDb as unknown as PostgresAdaptater;
    });
  });

  it('initialise correctement un nouveau projet', async () => {
    // Paramètres du test
    const projectName = 'test_project';
    const contractPaths = ['src/contract/test.cairo'];
    const dependencies = [{ name: 'openzeppelin', version: '1.0.0' }];

    // Appeler la fonction à tester
    const result = await initializeProjectData(agent, projectName, contractPaths, dependencies);
    console.log('Résultat de l\'initialisation:', result);
    // Vérifier les résultats de base
    expect(result).toBeDefined();
    expect(result.name).toBe(projectName);
    expect(result.id).toBe(1);
    
    // Vérifier que createDatabase a été appelé
    expect(agent.createDatabase).toHaveBeenCalledWith('scarb_db');
    
    // Vérifier qu'un projet a été inséré
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('retrieveProjectData récupère correctement les données du projet', async () => {
    // Configuration des données attendues
    const projectName = 'test_project';
    const expectedProject = {
      id: 1,
      name: projectName,
      type: 'contract',
      programs: [
        { name: 'program1', source_code: 'source_code1' },
        { name: 'program2', source_code: 'source_code2' }
      ],
      dependencies: [
        { name: 'dep1', version: '1.0.0' },
        { name: 'dep2', version: '2.0.0' }
      ]
    };
  
    // Configurer le mock pour retourner les données correctes
    mockDb.select.mockImplementation((params: { FROM: string[], SELECT: string[] }) => {
      if (params.FROM[0] === 'project') {
        return { query: { rows: [{ id: 1, name: projectName, type: 'contract' }] } };
      } else if (params.FROM[0] === 'program') {
        return { query: { rows: [
            { name: 'program1', source_code: 'source_code1' },
            { name: 'program2', source_code: 'source_code2' }
        ] } };
      } else if (params.FROM[0] === 'dependency') {
        return { query: { rows: [
            { name: 'dep1', version: '1.0.0' },
            { name: 'dep2', version: '2.0.0' }
        ] } };
      }
      return { query: { rows: [] } };
    });
  
    // Importer directement la fonction à tester
    const { retrieveProjectData } = require('../../src/utils/db.js');
    
    // Appeler la fonction
    const result = await retrieveProjectData(agent, projectName);
    
    // Vérifier le résultat
    expect(result).toEqual(expectedProject);
    expect(mockDb.select).toHaveBeenCalledTimes(3); // Devrait appeler select 3 fois
    expect(agent.createDatabase).toHaveBeenCalledWith('scarb_db');
  });
});