import { StarknetAgentInterface } from "@starknet-agent-kit/agents";
import { addProgramSchema, addDependencySchema } from "../schema/schema.js";
import path from 'path';
import { z } from 'zod';
import { retrieveProjectData } from "../utils/db_init.js";
import { extractFile, addProgram, addDependency, resolveContractPath } from "../utils/db_add.js";


export const addProgramAction = async (
    agent: StarknetAgentInterface,
    params: z.infer<typeof addProgramSchema>
  ) => {
    try {
      console.log('\n➜ Adding program');

      const projectData = await retrieveProjectData(agent, params.projectName);
        
      for (const contractPath of params.programPaths) {
        const fileName = path.basename(contractPath);
        const sourceCode = await extractFile(contractPath);
        await addProgram(agent, projectData.id, fileName, sourceCode);
      }
  
      const updatedProject = await retrieveProjectData(agent, params.projectName);
  
      return JSON.stringify({
        status: 'success',
        message: `Programs added to project ${params.projectName}`,
        projectId: updatedProject.id,
        projectName: updatedProject.name,
        programsCount: updatedProject.programs.length,
      });
    } catch (error) {
      console.error('Error adding program:', error);
      return JSON.stringify({
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
  
  
  export const addDependencyAction = async (
    agent: StarknetAgentInterface,
    params: z.infer<typeof addDependencySchema>
  ) => {
    try {
      const projectData = await retrieveProjectData(agent, params.projectName);
  
      for (const dependency of params.dependencies) {
        await addDependency(agent, projectData.id, dependency);
      }
  
      const updatedProject = await retrieveProjectData(agent, params.projectName);
  
      return JSON.stringify({
        status: 'success',
        message: `Dependencies added to project ${params.projectName}`,
        projectId: updatedProject.id,
        projectName: updatedProject.name,
        dependenciesCount: updatedProject.dependencies.length,
      });
    } catch (error) {
      console.error('Error adding dependency:', error);
      return JSON.stringify({
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };