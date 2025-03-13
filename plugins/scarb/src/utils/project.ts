import { exec } from 'child_process';
import { promisify } from 'util';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { checkScarbInstalled, getScarbInstallInstructions } from './environment.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export const initProject = async (
  agent: StarknetAgentInterface,
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
    
    console.log(`Project initialized: Project ${params.name} initialized successfully`);
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
  agent: StarknetAgentInterface,
  params: { path: string }
) => {
  try {
    const workingDir = params.path;
    console.log(`Building project in ${workingDir}`);
    const { stdout, stderr } = await execAsync('scarb build', { cwd: workingDir });
    
    console.log(`Project built successfully`);
    return JSON.stringify({
      status: 'success',
      message: 'Project built successfully',
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.log("error = ", error);
    throw new Error(`Failed to compile project at ${params.path}: ${error.message}`);
  }
};

export const addDependency = async (
  params: { 
    package: string;
    version?: string;
    git?: string;
    path?: string;
  }
) => {
  try {
    const workingDir = params.path || process.cwd();
    let command = `scarb add ${params.package}`;
    
    if (params.git) {
      command += ` --git ${params.git}`;
    }
    if (params.version) {
      if (params.git) 
        command += ` --tag ${params.version}`;
      else 
        command += `@${params.version}`;
    }
    
    const { stdout, stderr } = await execAsync(command, { cwd: workingDir });
    
    console.log(`Dependency ${params.package} added successfully`);
    return JSON.stringify({
      status: 'success',
      message: `Dependency ${params.package} added successfully`,
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    throw new Error(`Failed to add dependancie to scarb project: ${error.message}`);
  }
};

export const configureSierraAndCasm = async (
    agent: StarknetAgentInterface,
    params: {
      path?: string
    }
  ) => {
    try {
      const workingDir = params.path || process.cwd();
      const scarbTomlPath = path.join(workingDir, 'Scarb.toml');
      
      try {
        await fs.access(scarbTomlPath);
      } catch (error) {
        return JSON.stringify({
          status: 'failure',
          error: 'Scarb.toml not found. Initialize a project first.',
        });
      }
      
      let tomlContent = await fs.readFile(scarbTomlPath, 'utf8');
      if (!tomlContent.includes('[[target.starknet-contract]]')) {
        tomlContent += `\n\n[[target.starknet-contract]]\nsierra = true\ncasm = true`;
      } else {
        const targetRegex = /\[\[target\.starknet-contract\]\]([\s\S]*?)(\n\n|\n\[|$)/;
        const targetMatch = tomlContent.match(targetRegex);
        
        if (targetMatch) {
          let targetSection = targetMatch[1];
          let updatedSection = targetMatch[1];
          
          if (!targetSection.includes('sierra')) {
            updatedSection += '\nsierra = true';
          } else if (!targetSection.includes('sierra = true')) {
            updatedSection = updatedSection.replace(/sierra\s*=\s*false/, 'sierra = true');
          }
          
          if (!targetSection.includes('casm')) {
            updatedSection += '\ncasm = true';
          } else if (!targetSection.includes('casm = true')) {
            updatedSection = updatedSection.replace(/casm\s*=\s*false/, 'casm = true');
          }
          
          tomlContent = tomlContent.replace(
            targetRegex, 
            `[[target.starknet-contract]]${updatedSection}${targetMatch[2]}`
          );
        }
      }
      
      await fs.writeFile(scarbTomlPath, tomlContent, 'utf8');
      
      return JSON.stringify({
        status: 'success',
        message: 'Scarb.toml updated with starknet-contract target configuration',
        newConfig: tomlContent,
      });
    } catch (error) {
      throw new Error(`Failed to configure sierra and casm for scarb project: ${error.message}`);
    }
  };

  
  /**
   * Vérifie si un projet Scarb a déjà été initialisé dans le répertoire spécifié
   * @param projectDir Chemin vers le répertoire du projet
   * @returns Un booléen indiquant si le projet est déjà initialisé
   */
  export async function isProjectInitialized(projectDir: string): Promise<boolean> {
    try {
      const scarbTomlPath = path.join(projectDir, 'Scarb.toml');
      await fs.access(scarbTomlPath);
      console.log(`Project already initialized ${projectDir}`);
      return true;
    } catch (error) {
      // Le fichier n'existe pas, le projet n'est pas initialisé
      console.log(`Aucun projet existant dans ${projectDir}`);
      return false;
    }
  }


  export const cleanProject = async (
    agent: StarknetAgentInterface,
    params: { path: string }
  ) => {
    try {
      const isScarbInstalled = await checkScarbInstalled();
      if (!isScarbInstalled) {
        return JSON.stringify({
          status: 'failure',
          error: await getScarbInstallInstructions(),
        });
      }
  
      const workingDir = params.path;
      console.log(`Cleaning project in ${workingDir}`);
      
      const { stdout, stderr } = await execAsync('scarb clean', { cwd: workingDir });
      
      console.log(`Project cleaned successfully`);
      return JSON.stringify({
        status: 'success',
        message: 'Project cleaned successfully',
        output: stdout,
        errors: stderr || undefined,
      });
    } catch (error) {
      console.log("error = ", error);
      throw new Error(`Failed to clean project at ${params.path}: ${error.message}`);
    }
  };


export interface ExecuteContractParams {
  projectDir: string;
  formattedExecutable: string;
  arguments?: string;
}

export const executeProject = async (
  params: ExecuteContractParams
) => {
  try {
    const projectDir = params.projectDir;

    let command = `scarb execute --print-program-output --print-resource-usage --target standalone --executable-function ${params.formattedExecutable}`;
    if (params.arguments) command += ` --arguments "${params.arguments}"`;

    console.log(`Executing program in ${projectDir} with command: ${command}`);
    const { stdout, stderr } = await execAsync(command, { cwd: projectDir });
    
    const executionId = getExecutionNumber(stdout);
    
    console.log(`Program executed successfully`);
    console.log(`Execution ID: ${executionId}`);
    console.log("stout : ", stdout);
    console.log("stderr : ", stderr);

    return JSON.stringify({
      status: 'success',
      message: 'Program executed successfully',
      executionId: executionId,
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.error("Error executing program:", error);
    throw new Error(`Error executing program: ${error.message}`);
  }
};

/**
 * Extracts execution number from the "Saving output to:" line in Scarb output
 * @param {string} output - The stdout from scarb execute command
 * @returns {string|null} Just the execution number or null if not found
 */
export function getExecutionNumber(output : string) {
  // Look specifically for the "Saving output to:" line pattern
  const match = output.match(/Saving output to:.*\/execution(\d+)/);
  
  // Return just the number if found, otherwise null
  return match ? match[1] : null;
}

export interface ProveContractParams {
  projectDir: string;
  executionId: string;
}

export const proveProgram = async (
  params: ProveContractParams
) => {
  try {
    const projectDir = params.projectDir;

    let command = `scarb prove --execution-id ${params.executionId}`;

    console.log(`Proving execution of the id ${params.executionId} in ${projectDir} with command: ${command}`);
    const { stdout, stderr } = await execAsync(command, { cwd: projectDir });
    
    const proofPath = extractProofJsonPath(stdout);
    
    if (!proofPath) {
      throw new Error("Could not locate proof.json file path in command output");
    }
    
    // try {
    //   await fs.access(proofPath);
    // } catch (error) {
    //   throw new Error(`Proof file found in output but cannot be accessed: ${error.message}`);
    // }
    
    console.log(`Contract execution proved successfully`);
    console.log("stout : ", stdout);
    console.log("stderr : ", stderr);
    console.log("proofPath : ", proofPath);

    return JSON.stringify({
      status: 'success',
      message: 'Contract execution proved successfully',
      proofPath: proofPath,
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.error("Error proving contract execution:", error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};


export interface VerifyContractParams {
  projectDir: string;
  proofPath: string;
}

export const verifyProgram = async (
  params: VerifyContractParams
) => {
  try {
    const command = `scarb verify --proof-file ${params.proofPath}`;
    console.log(`Verifying proof with command: ${command}`);
    const { stdout, stderr } = await execAsync(command, { cwd: params.projectDir });
    
    const isVerified = stdout.includes('successfully');
    if (!isVerified) {
      throw new Error(`Proof verification failed: ${stderr}`);
    }

    return JSON.stringify({
      status: 'success',
      message: 'Proof verified successfully',
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    console.error("Error verifying proof:", error);
    throw new Error(`Error verifying proof: ${error.message}`);
  }
};

/**
 * Extracts the path to the proof.json file from scarb prove command output
 * @param {string} output - The stdout from scarb prove command
 * @returns {string|null} - The full path to the proof.json file or null if not found
 */
export function extractProofJsonPath(output : string) {
  // Look for the "Saving proof to:" line pattern
  const match = output.match(/Saving proof to:\s*(.*proof\.json)/);
  // Return the full path if found, otherwise null
  return match ? match[1].trim() : null;
}