// __test__/scarb/prove.spec.ts
import { proveProgram } from '../../src/actions/proveProgram.js';
import { executeProgram } from '../../src/actions/executeProgram.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWorkspacePath } from '../../src/utils/path.js';

const execAsync = promisify(exec);

describe('Prove Program Tests', () => {
  const agent = createMockStarknetAgent();
  const baseProjectName = 'prove_test';
  let testCounter = 1;
  
  function getUniqueProjectName() {
    return `${baseProjectName}_${testCounter++}`;
  }
  
  afterAll(async () => {
    try {
      const workspacePath = getWorkspacePath();
      // Nettoyer tous les projets de test créés
      await execAsync(`rm -rf ${workspacePath}/${baseProjectName}_*`);
      console.log('Projets de test nettoyés avec succès');
    } catch (error) {
      console.error('Erreur lors du nettoyage des projets:', error);
    }
  }, 10000);

  it('should successfully prove a simple Cairo program execution', async () => {
    const projectName = getUniqueProjectName();
    
    // Exécuter le programme
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: ['src/contract/program.cairo'],
      dependencies: []
    });
    
    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');
    expect(parsedExecResult.executionId).toBeTruthy();
    
    // Prouver l'exécution
    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      executionId: parsedExecResult.executionId
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    console.log('Prove result:', parsedProveResult);
    
    expect(parsedProveResult.status).toBe('success');
    expect(parsedProveResult.message).toBe('Contract execution proved successfully');
    expect(parsedProveResult.proofPath).toBeTruthy();
  }, 180000);

  it('should handle program with more complex computation', async () => {
    const projectName = getUniqueProjectName();
    
    // Exécuter un programme avec un calcul plus complexe
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: ['src/contract/program2.cairo'],
      dependencies: [],
      executableFunction: 'fib',
      arguments: '25' // Calcul plus complexe
    });
    
    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');
    
    // Prouver l'exécution
    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      executionId: parsedExecResult.executionId
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    
    expect(parsedProveResult.status).toBe('success');
    expect(parsedProveResult.proofPath).toBeTruthy();
  }, 300000); // Temps plus long pour un calcul plus complexe

  it('should fail with invalid execution ID', async () => {
    const projectName = getUniqueProjectName();
    
    // Initialiser le projet d'abord avec une exécution valide
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: ['src/contract/program.cairo'],
      dependencies: []
    });
    
    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');
    
    // Essayer de prouver avec un ID d'exécution invalide
    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      executionId: 'invalid_execution_id'
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    
    expect(parsedProveResult.status).toBe('failure');
    expect(parsedProveResult.error).toBeTruthy();
  }, 180000);

  it('should fail with non-existent project', async () => {
    // Essayer de prouver un projet qui n'existe pas
    const proveResult = await proveProgram(agent, {
      projectName: 'non_existent_project',
      executionId: '12345'
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    
    expect(parsedProveResult.status).toBe('failure');
    expect(parsedProveResult.error).toBeTruthy();
  });

  it('should handle multiple programs in the project', async () => {
    const projectName = getUniqueProjectName();
    
    // Exécuter avec plusieurs programmes dans le projet
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: [
        'src/contract/program.cairo',
        'src/contract/program2.cairo'
      ],
      dependencies: [],
      executableName: 'program',
      executableFunction: 'main'
    });
    
    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');
    
    // Prouver l'exécution
    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      executionId: parsedExecResult.executionId
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    
    expect(parsedProveResult.status).toBe('success');
    expect(parsedProveResult.proofPath).toBeTruthy();
  }, 240000);
});