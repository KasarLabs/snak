import {
  extractProofJsonPath,
  getExecutionNumber,
  getBootloaderTracePath,
} from './utils.js';
import {
  ExecuteContractParams,
  ProveProjectParams,
  VerifyProjectParams,
} from '../types/index.js';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Initialize a new Scarb project
 * @param params The project name and directory
 * @returns The initialization results
 */
export const initProject = async (params: {
  name: string;
  projectDir: string;
}) => {
  try {
    try {
      await fs.mkdir(params.projectDir, { recursive: true });
    } catch (error) {}

    const { stdout, stderr } = await execAsync(
      `scarb init --test-runner cairo-test`,
      { cwd: params.projectDir }
    );

    return JSON.stringify({
      status: 'success',
      message: `Project ${params.name} initialized successfully`,
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.error(`Failed to initialize scarb project: ${error.message}`);
    throw error;
  }
};

/**
 * Build a Scarb project
 * @param params The project directory
 * @returns The build results
 */
export const buildProject = async (params: { path: string }) => {
  try {
    const { stdout, stderr } = await execAsync('scarb build', {
      cwd: params.path,
    });

    return JSON.stringify({
      status: 'success',
      message: 'Project built successfully',
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.error(
      `Failed to build project at ${params.path}: ${error.message}`
    );
    throw error;
  }
};

/**
 * Clean a Scarb project
 * @param params The project directory
 * @returns The clean results
 */
export const cleanProject = async (params: {
  path: string;
  removeDirectory?: boolean;
}) => {
  try {
    const { stdout, stderr } = await execAsync('scarb clean', {
      cwd: params.path,
    });
    if (params.removeDirectory) {
      await fs.rm(params.path, { recursive: true, force: true });
    }

    return JSON.stringify({
      status: 'success',
      message: params.removeDirectory
        ? 'Project cleaned and directory removed successfully'
        : 'Project cleaned successfully',
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.error(
      `Failed to clean project at ${params.path}: ${error.message}`
    );
    throw error;
  }
};

/**
 * Execute a Scarb project
 * @param params The project directory, target, executable function, and arguments
 * @returns The execution results
 */
export const executeProject = async (params: ExecuteContractParams) => {
  try {
    const projectDir = params.projectDir;

    let command = `scarb execute --print-program-output --print-resource-usage --target ${params.target} --executable-function ${params.formattedExecutable}`;
    if (params.arguments) command += ` --arguments "${params.arguments}"`;
    const { stdout, stderr } = await execAsync(command, { cwd: projectDir });

    const executionId =
      params.target === 'standalone' ? getExecutionNumber(stdout) : undefined;
    const tracePath =
      params.target === 'bootloader'
        ? getBootloaderTracePath(stdout)
        : undefined;

    return JSON.stringify({
      status: 'success',
      message: 'Program executed successfully',
      executionId: executionId,
      tracePath: tracePath,
      output: stdout,
      error: stderr || undefined,
    });
  } catch (error) {
    console.error(`Failed to execute program: ${error.message}`);
    throw error;
  }
};

/**
 * Prove a Scarb project execution
 * @param params The project directory and execution ID
 * @returns The proof results
 */
export const proveProject = async (params: ProveProjectParams) => {
  try {
    const command = `scarb prove --execution-id ${params.executionId}`;
    const { stdout, stderr } = await execAsync(command, {
      cwd: params.projectDir,
    });

    const proofPath = extractProofJsonPath(stdout);
    if (!proofPath) {
      throw new Error(
        'Could not locate proof.json file path in command output'
      );
    }

    return JSON.stringify({
      status: 'success',
      message: 'Contract execution proved successfully',
      proofPath: proofPath,
      output: stdout,
      error: stderr || undefined,
    });
  } catch (error) {
    console.error(`Failed to prove program: ${error.message}`);
    throw error;
  }
};

/**
 * Verify a Scarb project proof
 * @param params The project directory and proof path
 * @returns The verification results
 */
export const verifyProject = async (params: VerifyProjectParams) => {
  try {
    const command = `scarb verify --proof-file ${params.proofPath}`;
    const { stdout, stderr } = await execAsync(command, {
      cwd: params.projectDir,
    });

    return JSON.stringify({
      status: 'success',
      message: 'Proof verified successfully',
      output: stdout,
      error: stderr || undefined,
    });
  } catch (error) {
    console.error(`Failed to verify proof: ${error.message}`);
    throw error;
  }
};
