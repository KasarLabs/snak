import { exec } from 'child_process';
import { promisify } from 'util';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { checkScarbInstalled, getScarbInstallInstructions } from './environment.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export const initProject = async (
  agent: StarknetAgentInterface,
  params: { name: string }
) => {
  try {
    const isScarbInstalled = await checkScarbInstalled();
    if (!isScarbInstalled) {
      return JSON.stringify({
        status: 'failure',
        error: await getScarbInstallInstructions(),
      });
    }

    const { stdout, stderr } = await execAsync(`scarb init --name ${params.name}`);
    
    return JSON.stringify({
      status: 'success',
      message: `Project ${params.name} initialized successfully`,
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    throw new Error(`Failed to initialize scarb project: ${error.message}`);
  }
};

export const buildProject = async (
  agent: StarknetAgentInterface,
  params: { path?: string }
) => {
  try {
    const isScarbInstalled = await checkScarbInstalled();
    if (!isScarbInstalled) {
      return JSON.stringify({
        status: 'failure',
        error: await getScarbInstallInstructions(),
      });
    }

    const workingDir = params.path || process.cwd();
    const { stdout, stderr } = await execAsync('scarb build', { cwd: workingDir });
    
    return JSON.stringify({
      status: 'success',
      message: 'Project built successfully',
      output: stdout,
      errors: stderr || undefined,
    });
  } catch (error) {
    throw new Error(`Failed to build scarb project: ${error.message}`);
  }
};

export const addDependency = async (
  agent: StarknetAgentInterface,
  params: { 
    package: string;
    version?: string;
    git?: string;
    path?: string;
  }
) => {
  try {
    const isScarbInstalled = await checkScarbInstalled();
    if (!isScarbInstalled) {
      return JSON.stringify({
        status: 'failure',
        error: await getScarbInstallInstructions(),
      });
    }

    const workingDir = params.path || process.cwd();
    let command = `scarb add ${params.package}`;
    
    if (params.version) {
      command += ` --version ${params.version}`;
    }
    
    if (params.git) {
      command += ` --git ${params.git}`;
    }
    
    const { stdout, stderr } = await execAsync(command, { cwd: workingDir });
    
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