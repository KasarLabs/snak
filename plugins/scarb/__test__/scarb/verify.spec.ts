// __test__/scarb/verify.spec.ts
import { proveContract } from '../../src/actions/proveContract.js';
import { executeProgram } from '../../src/actions/executeProgram.js';
import { verifyContract } from '../../src/actions/verifyContract.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWorkspacePath } from '../../src/utils/path.js';

const execAsync = promisify(exec);

describe('Verify Contract Tests', () => {
  const agent = createMockStarknetAgent();
  const baseProjectName = 'verify_test';
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

  it('should successfully verify a valid proof', async () => {
    const projectName = getUniqueProjectName();
    
    // 1. Exécuter le programme
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: ['src/contract/program.cairo'],
      dependencies: []
    });
    
    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');
    
    // 2. Générer une preuve
    const proveResult = await proveContract(agent, {
      projectName: projectName,
      executionId: parsedExecResult.executionId
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    expect(parsedProveResult.status).toBe('success');
    expect(parsedProveResult.proofPath).toBeTruthy();
    
    // 3. Vérifier la preuve
    const verifyResult = await verifyContract(agent, {
      projectName: projectName,
      proofPath: parsedProveResult.proofPath
    });
    
    const parsedVerifyResult = JSON.parse(verifyResult);
    console.log('Verification result:', parsedVerifyResult);
    
    expect(parsedVerifyResult.status).toBe('success');
    expect(parsedVerifyResult.message).toBe('Proof verified successfully');
  }, 240000);

  it('should verify proof for a program with arguments', async () => {
    const projectName = getUniqueProjectName();
    
    // 1. Exécuter le programme avec des arguments
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: ['src/contract/program2.cairo'],
      dependencies: [],
      executableFunction: 'fib',
      arguments: '10'
    });
    
    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');
    
    // 2. Générer une preuve
    const proveResult = await proveContract(agent, {
      projectName: projectName,
      executionId: parsedExecResult.executionId
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    expect(parsedProveResult.status).toBe('success');
    
    // 3. Vérifier la preuve
    const verifyResult = await verifyContract(agent, {
      projectName: projectName,
      proofPath: parsedProveResult.proofPath
    });
    
    const parsedVerifyResult = JSON.parse(verifyResult);
    
    expect(parsedVerifyResult.status).toBe('success');
  }, 240000);

  it('should fail verification with invalid proof path', async () => {
    const projectName = getUniqueProjectName();
    
    // Initialiser d'abord un projet pour que le répertoire existe
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: ['src/contract/program.cairo'],
      dependencies: []
    });
    
    // Tenter de vérifier avec un chemin de preuve invalide
    const verifyResult = await verifyContract(agent, {
      projectName: projectName,
      proofPath: '/invalid/path/to/proof.json'
    });
    
    const parsedVerifyResult = JSON.parse(verifyResult);
    
    expect(parsedVerifyResult.status).toBe('failure');
    expect(parsedVerifyResult.error).toBeTruthy();
  }, 180000);

  it('should fail verification with non-existent project', async () => {
    // Tenter de vérifier dans un projet inexistant
    const verifyResult = await verifyContract(agent, {
      projectName: 'non_existent_project',
      proofPath: '/path/to/proof.json'
    });
    
    const parsedVerifyResult = JSON.parse(verifyResult);
    
    expect(parsedVerifyResult.status).toBe('failure');
  });

  it('should verify proof for a complex program', async () => {
    const projectName = getUniqueProjectName();
    
    // 1. Exécuter le programme avec un cas plus complexe
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: ['src/contract/program2.cairo'],
      dependencies: [],
      executableFunction: 'fib',
      arguments: '20'  // Calcul plus complexe
    });
    
    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');
    
    // 2. Générer une preuve
    const proveResult = await proveContract(agent, {
      projectName: projectName,
      executionId: parsedExecResult.executionId
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    expect(parsedProveResult.status).toBe('success');
    
    // 3. Vérifier la preuve
    const verifyResult = await verifyContract(agent, {
      projectName: projectName,
      proofPath: parsedProveResult.proofPath
    });
    
    const parsedVerifyResult = JSON.parse(verifyResult);
    
    expect(parsedVerifyResult.status).toBe('success');
  }, 300000); // Plus de temps pour un calcul plus complexe
  
  it('should verify proof for multiple files in the project', async () => {
    const projectName = getUniqueProjectName();
    
    // 1. Exécuter avec plusieurs fichiers dans le projet
    const execResult = await executeProgram(agent, {
      projectName: projectName, 
      programPaths: [
        'src/contract/program.cairo',
        'src/contract/program2.cairo'
      ],
      dependencies: [],
      executableName: 'program2',
      executableFunction: 'fib',
      arguments: '5'
    });
    
    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');
    
    // 2. Générer une preuve
    const proveResult = await proveContract(agent, {
      projectName: projectName,
      executionId: parsedExecResult.executionId
    });
    
    const parsedProveResult = JSON.parse(proveResult);
    expect(parsedProveResult.status).toBe('success');
    
    // 3. Vérifier la preuve
    const verifyResult = await verifyContract(agent, {
      projectName: projectName,
      proofPath: parsedProveResult.proofPath
    });
    
    const parsedVerifyResult = JSON.parse(verifyResult);
    
    expect(parsedVerifyResult.status).toBe('success');
  }, 240000);
});