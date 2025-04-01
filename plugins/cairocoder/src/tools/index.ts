import { StarknetTool, StarknetAgentInterface, PostgresAdaptater } from '@starknet-agent-kit/agents';
import { generateCairoCodeSchema, fixCairoCodeSchema, registerProjectSchema, deleteProgramSchema, deleteDependencySchema, deleteProjectSchema, addDependencySchema, addProgramSchema, listProjectsSchema } from '../schema/schema.js';
import { generateCairoCode } from '../actions/generateCairoCode.js';
import { fixCairoCode } from '../actions/fixCairoCode.js';
import { initializeDatabase } from '../utils/db_init.js';
import { registerProject } from '../actions/registerProject.js';
import { deleteProgramAction } from '../actions/deleteItemProject.js';
import { deleteDependencyAction } from '../actions/deleteItemProject.js';
import { deleteProjectAction } from '../actions/deleteItemProject.js';
import { addDependencyAction } from '../actions/addItem.js';
import { addProgramAction } from '../actions/addItem.js';
import { listProjects } from '../actions/listProjects.js';

export const initializeTools = async (
  agent: StarknetAgentInterface
): Promise<PostgresAdaptater | undefined> => {
  try {
    const res = await initializeDatabase(agent);
    return res;
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  agent: StarknetAgentInterface
) => {
  const database_instance = await initializeTools(agent);
  if (!database_instance) {
    console.error('Error while initializing database');
    return;
  }

  StarknetToolRegistry.push({
    name: 'cairocoder_generate_code',
    plugins: 'cairocoder',
    description: 'Generate Cairo code using AI and add it to the database within a project. Requires a prompt describing the code to be generated, a program name and the project name. No need to check if the project exists.',
    schema: generateCairoCodeSchema,
    execute: generateCairoCode,
  });
  
  // Add the new fixCairo tool
  StarknetToolRegistry.push({
    name: 'cairocoder_fix_code',
    plugins: 'cairocoder',
    description: 'Fix Cairo code using AI and update it in the database within a project. Requires the name of an existing program and an error description. No need to check if the project exists.',
    schema: fixCairoCodeSchema,
    execute: fixCairoCode,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_register_project',
    description: 'Register new Cairo project in the database, only when explicitly asked in the command. Requires a project name.',
    plugins: 'cairocoder',
    schema: registerProjectSchema,
    execute: registerProject,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_delete_program',
    description: 'Delete a program from a Cairo project in the database. Requires a program name.',
    plugins: 'cairocoder',
    schema: deleteProgramSchema,
    execute: deleteProgramAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_delete_dependency',
    description: 'Delete a dependency from a Cairo project in the database. Requires a dependency name.',
    plugins: 'cairocoder',
    schema: deleteDependencySchema,
    execute: deleteDependencyAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_delete_project',
    description: 'Delete an entire Cairo project and all its data from the database. Requires a project name.',
    plugins: 'cairocoder',
    schema: deleteProjectSchema,
    execute: deleteProjectAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_add_dependency',
    description: 'Add a dependency to an existing Cairo project in the database. Requires a dependency name.',
    plugins: 'cairocoder',
    schema: addDependencySchema,
    execute: addDependencyAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_add_program',
    description: 'Add a program to an existing Cairo project in the database. Requires a program name.',
    plugins: 'cairocoder',
    schema: addProgramSchema,
    execute: addProgramAction,
  });
  
  StarknetToolRegistry.push({
    name: 'cairocoder_list_projects',
    description: 'List all Cairo projects stored in the database with their names.',
    plugins: 'cairocoder',
    schema: listProjectsSchema,
    execute: listProjects,
  });
  
}; 