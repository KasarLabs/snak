import { StarknetTool, StarknetAgentInterface } from '@hijox/core';
import {
  generateCairoCodeSchema,
  fixCairoCodeSchema,
  registerProjectSchema,
  deleteProgramSchema,
  deleteDependencySchema,
  deleteProjectSchema,
  addDependencySchema,
  addProgramSchema,
  listProjectsSchema,
} from '../schema/schema.js';
import { generateCairoCode } from '../actions/generateCairoCode.js';
import { fixCairoCode } from '../actions/fixCairoCode.js';
import { registerProject } from '../actions/registerProject.js';
import {
  deleteProgramAction,
  deleteDependencyAction,
  deleteProjectAction,
} from '../actions/deleteItemProject.js';
import { addDependencyAction, addProgramAction } from '../actions/addItem.js';
import { listProjects } from '../actions/listProjects.js';
import { scarbQueries, Postgres } from '@hijox/database/queries';

export const initializeTools = async (
  _agent: StarknetAgentInterface
): Promise<void> => {
  try {
    const scarb = new scarbQueries(_agent.getDatabaseCredentials());
    const db = _agent.getDatabase();
    if (db.has('scarb')) {
      throw new Error('Scarb database already exists');
    }
    db.set('scarb', scarb);
    _agent.setDatabase(db);
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  _agent: StarknetAgentInterface
) => {
  StarknetToolRegistry.push({
    name: 'cairocoder_generate_code',
    plugins: 'cairocoder',
    description: `
      DESCRIPTION: Generate Cairo code using AI and add it to the database within a project.
      TRIGGER: Only call when the user explicitly asks to generate or create Cairo code.
      PARAMETERS: Requires a prompt, program name and project name.
      SUCCESS: After successful generation, consider this task complete. 
      FAILURE: After 2 failed attempts, report the error and stop retrying.
      DO NOT automatically compile, execute, or otherwise process the generated code unless explicitly requested.
    `,
    schema: generateCairoCodeSchema as any,
    execute: generateCairoCode,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_fix_code',
    plugins: 'cairocoder',
    description:
      'Fix Cairo code using AI and update it in the database within a project. Requires the name of an existing program and an error description. No need to check if the project exists.',
    schema: fixCairoCodeSchema as any,
    execute: fixCairoCode,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_register_project',
    description:
      'Register new Cairo project in the database, only when explicitly asked in the command. Requires a project name.',
    plugins: 'cairocoder',
    schema: registerProjectSchema as any,
    execute: registerProject,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_delete_program',
    description:
      'Delete programs from a Cairo project in the database. Requires a project name and a list of program names.',
    plugins: 'cairocoder',
    schema: deleteProgramSchema as any,
    execute: deleteProgramAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_delete_dependency',
    description:
      'Delete dependencies from a Cairo project in the database. Requires a project name and a list of dependency names.',
    plugins: 'cairocoder',
    schema: deleteDependencySchema as any,
    execute: deleteDependencyAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_delete_project',
    description:
      'Delete several Cairo projects and all their data from the database. Requires a list of project names.',
    plugins: 'cairocoder',
    schema: deleteProjectSchema as any,
    execute: deleteProjectAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_add_dependency',
    description:
      'Add dependencies to an existing Cairo project in the database. Requires a project name and a list of dependency names.',
    plugins: 'cairocoder',
    schema: addDependencySchema as any,
    execute: addDependencyAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_add_program',
    description:
      'Add programs to an existing Cairo project in the database. Requires a project name and a list of program paths.',
    plugins: 'cairocoder',
    schema: addProgramSchema as any,
    execute: addProgramAction,
  });

  StarknetToolRegistry.push({
    name: 'cairocoder_list_projects',
    description:
      'List all Cairo projects stored in the database with their names.',
    plugins: 'cairocoder',
    schema: listProjectsSchema as any,
    execute: listProjects,
  });
};
