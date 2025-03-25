// __test__/scarb/execute.spec.ts
import { executeProgram } from '../../src/actions/executeProgram.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWorkspacePath } from '../../src/utils/path.js';
import { resolveContractPath } from '../../src/utils/path.js';

const execAsync = promisify(exec);

describe('Execute Program Tests', () => {
  const agent = createMockStarknetAgent();

  afterAll(async () => {
    try {
      const workspacePath = getWorkspacePath();

      await execAsync(`rm -rf ${workspacePath}/execute_test_*`);
      console.log('Projets de test nettoyés avec succès');
    } catch (error) {
      console.error('Erreur lors du nettoyage des projets:', error);
    }
  }, 10000);

  it('should successfully execute a simple Cairo program', async () => {
    const projectName = 'execute_test_1';
    const contractPaths = ['src/contract/program.cairo'];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
    });

    const parsedResult = JSON.parse(result);
    console.log('Execution result:', parsedResult);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract executed successfully');
    expect(parsedResult.executionId).toBeTruthy();
    expect(parsedResult.output).toContain('987'); // Expected output of fib(16)

    const projectDir = path.join('./src/workspace', projectName);
    const projectExists = await fs
      .access(projectDir)
      .then(() => true)
      .catch(() => false);
    expect(projectExists).toBe(true);
  }, 180000);

  it('should execute a Cairo program with custom function and arguments', async () => {
    const projectName = 'execute_test_2';
    const contractPaths = ['src/contract/program2.cairo'];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      executableFunction: 'fib',
      arguments: '8',
    });

    const parsedResult = JSON.parse(result);
    console.log('Execution result with custom function:', parsedResult);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.executionId).toBeDefined();
    expect(parsedResult.output).toContain('21'); // Expected output of fib(8)
  }, 180000);

  it('should handle multiple program files and specify executable', async () => {
    const projectName = 'execute_test_3';
    const contractPaths = [
      'src/contract/program.cairo',
      'src/contract/program2.cairo',
    ];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      executableName: 'program2',
      executableFunction: 'fib',
      arguments: '5',
    });

    const parsedResult = JSON.parse(result);
    console.log('Execution with multiple files:', parsedResult);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.output).toContain('5'); // Expected output of fib(5)
  }, 180000);

  it('should fail with multiple programs and no executable name', async () => {
    const projectName = 'execute_test_5';
    const contractPaths = [
      'src/contract/program.cairo',
      'src/contract/program2.cairo',
    ];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      // Missing executable name with multiple programs
    });

    const parsedResult = JSON.parse(result);
    console.log('Result with missing executable name:', parsedResult);

    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toContain(
      'Multiple contracts require an executable name'
    );
  });

  it('should fail when referencing non-existent file', async () => {
    const projectName = 'execute_test_6';
    const contractPaths = ['src/contract/non_existent_file.cairo'];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
    });

    const parsedResult = JSON.parse(result);
    console.log('Result with non-existent file:', parsedResult);

    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toContain(
      'Impossible de résoudre le chemin du contrat'
    );
  });

  it('should fail when calling non-existent function', async () => {
    const projectName = 'execute_test_7';
    const contractPaths = ['src/contract/program.cairo'];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      executableFunction: 'non_existent_function',
    });

    const parsedResult = JSON.parse(result);
    console.log('Result with non-existent function:', parsedResult);

    expect(parsedResult.status).toBe('failure');
    // The error might vary, but it should be a failure
    expect(parsedResult.status).toBe('failure');
  }, 180000);

  it('should execute a program with standalone mode (default)', async () => {
    const projectName = 'execute_test_standalone';
    const contractPaths = ['src/contract/program.cairo'];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      // mode not specified, should default to standalone
    });

    const parsedResult = JSON.parse(result);
    console.log('Standalone execution result:', parsedResult);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract executed successfully');
    expect(parsedResult.executionId).toBeTruthy(); // Should have execution ID
    expect(parsedResult.tracePath).toBeUndefined(); // Should not have trace path
  }, 180000);

  it('should execute a program with bootloader mode', async () => {
    const projectName = 'execute_test_bootloader';
    const contractPaths = ['src/contract/program.cairo'];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      mode: 'bootloader', // Explicitly request bootloader mode
    });

    const parsedResult = JSON.parse(result);
    console.log('Bootloader execution result:', parsedResult);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract executed successfully');
    expect(parsedResult.executionId).toBeUndefined(); // Should not have execution ID
    expect(parsedResult.tracePath).toBeTruthy(); // Should have trace path
    expect(parsedResult.tracePath).toContain('cairo_pie.zip'); // Should point to cairo_pie.zip
  }, 180000);

  it('should execute a program with arguments in bootloader mode', async () => {
    const projectName = 'execute_test_bootloader_args';
    const contractPaths = ['src/contract/program2.cairo'];

    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      executableFunction: 'fib',
      arguments: '10',
      mode: 'bootloader',
    });

    const parsedResult = JSON.parse(result);
    console.log('Bootloader execution with arguments result:', parsedResult);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.tracePath).toBeTruthy();
    expect(parsedResult.output).toContain('55'); // Expected output of fib(10)
  }, 180000);

  it('should validate both execution modes with the same program', async () => {
    const projectName = 'execute_test_both_modes';
    const contractPaths = ['src/contract/program.cairo'];

    // First execute in standalone mode
    const standaloneResult = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      mode: 'standalone',
    });

    const parsedStandaloneResult = JSON.parse(standaloneResult);
    expect(parsedStandaloneResult.status).toBe('success');
    expect(parsedStandaloneResult.executionId).toBeTruthy();

    // Then execute the same program in bootloader mode
    const bootloaderResult = await executeProgram(agent, {
      projectName: `${projectName}_bl`, // Use different project name to avoid conflicts
      programPaths: contractPaths,
      dependencies: [],
      mode: 'bootloader',
    });

    const parsedBootloaderResult = JSON.parse(bootloaderResult);
    expect(parsedBootloaderResult.status).toBe('success');
    expect(parsedBootloaderResult.tracePath).toBeTruthy();

    // The actual program output should be the same in both modes
    expect(parsedStandaloneResult.output).toContain('987'); // Expected output of fib(16)
    expect(parsedBootloaderResult.output).toContain('987'); // Expected output of fib(16)
  }, 180000);

  it('should throw an error when target function is not found', async () => {
    const projectName = 'execute_test_missing_function';
    const contractPaths = ['src/contract/program3.cairo']; // This contains only fib function

    // Try to execute with a non-existent function
    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies: [],
      executableFunction: 'non_existent_function', // This function doesn't exist
    });

    const parsedResult = JSON.parse(result);
    console.log('Result with non-existent function in program3:', parsedResult);

    // Check that execution failed with the expected error
    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toContain('not found'); // Error message should indicate function wasn't found
  }, 180000);
});
