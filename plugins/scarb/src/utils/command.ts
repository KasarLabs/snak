import { extractProofJsonPath, getExecutionNumber, getBootloaderTracePath } from './utils.js';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const initProject = async (
  params: { 
    name: string,
    projectDir: string
  }
) => {
  try {
    try {
      await fs.mkdir(params.projectDir, { recursive: true });
    } catch (error) {}

    const { stdout, stderr } = await execAsync(`scarb init --test-runner cairo-test`, { cwd: params.projectDir });
    
    return JSON.stringify({
      status: 'success',
      message: `Project ${params.name} initialized successfully`,
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.log(`error = ${error}`);
    throw new Error(`Failed to initialize scarb project: ${error.message}`);
  }
};

export const buildProject = async (
  params: { path: string }
) => {
  try {
    const { stdout, stderr } = await execAsync('scarb build', { cwd: params.path });

    return JSON.stringify({
      status: 'success',
      message: 'Project built successfully',
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    throw new Error(`Failed to compile project at ${params.path}: ${error.message}`);
  }
};


  export const cleanProject = async (
    params: { path: string }
  ) => {
    try {
      const { stdout, stderr } = await execAsync('scarb clean', { cwd: params.path });
      
      return JSON.stringify({
        status: 'success',
        message: 'Project cleaned successfully',
        output: stdout,
        errors: stderr || undefined,
      });
    } catch (error) {
      throw new Error(`Failed to clean project at ${params.path}: ${error.message}`);
    }
  };


export interface ExecuteContractParams {
  projectDir: string;
  formattedExecutable: string;
  arguments?: string;
  target: string;
}

export const executeProject = async (
  params: ExecuteContractParams
) => {
  try {
    const projectDir = params.projectDir;

    let command = `scarb execute --print-program-output --print-resource-usage --target ${params.target} --executable-function ${params.formattedExecutable}`;
    if (params.arguments) command += ` --arguments "${params.arguments}"`;
    const { stdout, stderr } = await execAsync(command, { cwd: projectDir });
    
    const executionId = params.target === 'standalone' ? getExecutionNumber(stdout) : undefined;
    const tracePath = params.target === 'bootloader' ? getBootloaderTracePath(stdout) : undefined;
    
    console.log(`Executed program in ${projectDir} with command: ${command}`);
    if (executionId) console.log(`Execution ID: ${executionId}`);
    if (tracePath) console.log(`Trace path: ${tracePath}`);

    return JSON.stringify({
      status: 'success',
      message: 'Program executed successfully',
      executionId: executionId,
      tracePath: tracePath,
      output: stdout,
      error: stderr || undefined,
    });
  } catch (error) {
    throw new Error(`Error executing program: ${error.message}`);
  }
};


export interface ProveProjectParams {
  projectDir: string;
  executionId: string;
}

export const proveProject = async (
  params: ProveProjectParams
) => {
  try {
    const command = `scarb prove --execution-id ${params.executionId}`;
    const { stdout, stderr } = await execAsync(command, { cwd: params.projectDir });
    
    const proofPath = extractProofJsonPath(stdout);
    if (!proofPath) {
      throw new Error("Could not locate proof.json file path in command output");
    }
    
    console.log(`Proved execution of the id ${params.executionId} in ${params.projectDir} with command: ${command}`);
    console.log("proofPath : ", proofPath);

    return JSON.stringify({
      status: 'success',
      message: 'Contract execution proved successfully',
      proofPath: proofPath,
      output: stdout,
      error: stderr || undefined,
    });
  } catch (error) {
    throw new Error(`Error proving program: ${error.message}`);
  }
};


export interface VerifyProjectParams {
  projectDir: string;
  proofPath: string;
}

export const verifyProject = async (
  params: VerifyProjectParams
) => {
  try {
    const command = `scarb verify --proof-file ${params.proofPath}`;
    const { stdout, stderr } = await execAsync(command, { cwd: params.projectDir });

    return JSON.stringify({
      status: 'success',
      message: 'Proof verified successfully',
      output: stdout,
      error: stderr || undefined,
    });
  } catch (error) {
    throw new Error(`Error verifying proof: ${error.message}`);
  }
};
