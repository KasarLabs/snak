// __test__/scarb/prove.spec.ts
import { proveProgram } from '../../src/actions/proveProgram.js';
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

    // Exécuter et prouver le programme en une seule étape
    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      programPaths: ['src/contract/program.cairo'],
      dependencies: [],
    });

    const parsedProveResult = JSON.parse(proveResult);
    console.log('Prove result:', parsedProveResult);

    expect(parsedProveResult.status).toBe('success');
    expect(parsedProveResult.message).toBe(
      'Program executed and proved successfully'
    );
    expect(parsedProveResult.executionId).toBeTruthy();
    expect(parsedProveResult.proofPath).toBeTruthy();
  }, 180000);

  it('should handle program with more complex computation', async () => {
    const projectName = getUniqueProjectName();

    // Exécuter et prouver un programme avec un calcul plus complexe
    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      programPaths: ['src/contract/program2.cairo'],
      dependencies: [],
      executableFunction: 'fib',
      arguments: '25', // Calcul plus complexe
    });

    const parsedProveResult = JSON.parse(proveResult);

    expect(parsedProveResult.status).toBe('success');
    expect(parsedProveResult.executionId).toBeTruthy();
    expect(parsedProveResult.proofPath).toBeTruthy();
  }, 300000); // Temps plus long pour un calcul plus complexe

  it('should handle multiple programs in the project', async () => {
    const projectName = getUniqueProjectName();

    // Exécuter et prouver avec plusieurs programmes dans le projet
    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      programPaths: [
        'src/contract/program.cairo',
        'src/contract/program2.cairo',
      ],
      dependencies: [],
      executableName: 'program',
      executableFunction: 'main',
    });

    const parsedProveResult = JSON.parse(proveResult);

    expect(parsedProveResult.status).toBe('success');
    expect(parsedProveResult.executionId).toBeTruthy();
    expect(parsedProveResult.proofPath).toBeTruthy();
  }, 240000);

  it('should properly handle execution errors', async () => {
    const projectName = getUniqueProjectName();

    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      programPaths: ['src/contract/program.cairo'],
      dependencies: [],
      arguments: 'invalid_argument_type',
    });

    const parsedProveResult = JSON.parse(proveResult);

    expect(parsedProveResult.status).toBe('failure');
    expect(parsedProveResult.error).toBeTruthy();
  }, 180000);

  it('should fail with invalid executable function name', async () => {
    const projectName = getUniqueProjectName();

    const proveResult = await proveProgram(agent, {
      projectName: projectName,
      programPaths: ['src/contract/program.cairo'],
      dependencies: [],
      executableFunction: 'non_existent_function',
    });

    const parsedProveResult = JSON.parse(proveResult);

    expect(parsedProveResult.status).toBe('failure');
    expect(parsedProveResult.error).toBeTruthy();
  }, 180000);
});
