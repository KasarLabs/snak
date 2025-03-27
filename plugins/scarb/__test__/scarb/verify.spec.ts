// __test__/scarb/verify.spec.ts
import { proveProgram } from '../../src/actions/proveProgram.js';
import { executeProgram } from '../../src/actions/executeProgram.js';
import { verifyProgram } from '../../src/actions/verifyProgram.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWorkspacePath } from '../../src/utils/path.js';

const execAsync = promisify(exec);

describe('Verify Program Tests', () => {
  const agent = createMockStarknetAgent();
  const baseProjectName = 'verify_test';
  let testCounter = 1;

  function getUniqueProjectName() {
    return `${baseProjectName}_${testCounter++}`;
  }

  afterAll(async () => {
    try {
      const workspacePath = getWorkspacePath();

      await execAsync(`rm -rf ${workspacePath}/${baseProjectName}_*`);
      console.log('Projets de test nettoyés avec succès');
    } catch (error) {
      console.error('Erreur lors du nettoyage des projets:', error);
    }
  }, 10000);

  it('should successfully verify a valid proof', async () => {
    const projectName = getUniqueProjectName();

    const execResult = await executeProgram(agent, {
      projectName: projectName,
      programPaths: ['src/Program/program.cairo'],
      dependencies: [],
    });

    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');

    const proveResult = await proveProgram(agent, {
      projectName: projectName,
    });

    const parsedProveResult = JSON.parse(proveResult);
    expect(parsedProveResult.status).toBe('success');
    expect(parsedProveResult.proofPath).toBeTruthy();

    const verifyResult = await verifyProgram(agent, {
      projectName: projectName,
    });

    const parsedVerifyResult = JSON.parse(verifyResult);
    console.log('Verification result:', parsedVerifyResult);

    expect(parsedVerifyResult.status).toBe('success');
    expect(parsedVerifyResult.message).toBe('Proof verified successfully');
  }, 240000);

  it('should verify proof for a program with arguments', async () => {
    const projectName = getUniqueProjectName();

    const execResult = await executeProgram(agent, {
      projectName: projectName,
      programPaths: ['src/Program/program2.cairo'],
      dependencies: [],
      executableFunction: 'fib',
      arguments: '10',
    });

    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');

    const proveResult = await proveProgram(agent, {
      projectName: projectName,
    });

    const parsedProveResult = JSON.parse(proveResult);
    expect(parsedProveResult.status).toBe('success');

    const verifyResult = await verifyProgram(agent, {
      projectName: projectName,
    });

    const parsedVerifyResult = JSON.parse(verifyResult);

    expect(parsedVerifyResult.status).toBe('success');
  }, 240000);

  it('should fail verification with invalid proof path', async () => {
    const projectName = getUniqueProjectName();

    const execResult = await executeProgram(agent, {
      projectName: projectName,
      programPaths: ['src/Program/program.cairo'],
      dependencies: [],
    });

    const verifyResult = await verifyProgram(agent, {
      projectName: projectName,
      proofPath: '/invalid/path/to/proof.json',
    });

    const parsedVerifyResult = JSON.parse(verifyResult);

    expect(parsedVerifyResult.status).toBe('failure');
    expect(parsedVerifyResult.error).toBeTruthy();
  }, 180000);

  it('should fail verification with non-existent project', async () => {
    const verifyResult = await verifyProgram(agent, {
      projectName: 'non_existent_project',
      proofPath: '/path/to/proof.json',
    });

    const parsedVerifyResult = JSON.parse(verifyResult);

    expect(parsedVerifyResult.status).toBe('failure');
  });

  it('should verify proof for a complex program', async () => {
    const projectName = getUniqueProjectName();

    const execResult = await executeProgram(agent, {
      projectName: projectName,
      programPaths: ['src/Program/program2.cairo'],
      dependencies: [],
      executableFunction: 'fib',
      arguments: '20',
    });

    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');

    const proveResult = await proveProgram(agent, {
      projectName: projectName,
    });

    const parsedProveResult = JSON.parse(proveResult);
    expect(parsedProveResult.status).toBe('success');

    const verifyResult = await verifyProgram(agent, {
      projectName: projectName,
    });

    const parsedVerifyResult = JSON.parse(verifyResult);

    expect(parsedVerifyResult.status).toBe('success');
  }, 300000);

  it('should verify proof for multiple files in the project', async () => {
    const projectName = getUniqueProjectName();

    const execResult = await executeProgram(agent, {
      projectName: projectName,
      programPaths: ['src/Program/program.cairo', 'src/Program/program2.cairo'],
      dependencies: [],
      executableName: 'program2',
      executableFunction: 'fib',
      arguments: '5',
    });

    const parsedExecResult = JSON.parse(execResult);
    expect(parsedExecResult.status).toBe('success');

    const proveResult = await proveProgram(agent, {
      projectName: projectName,
    });

    const parsedProveResult = JSON.parse(proveResult);
    expect(parsedProveResult.status).toBe('success');

    const verifyResult = await verifyProgram(agent, {
      projectName: projectName,
    });

    const parsedVerifyResult = JSON.parse(verifyResult);

    expect(parsedVerifyResult.status).toBe('success');
  }, 240000);
});
