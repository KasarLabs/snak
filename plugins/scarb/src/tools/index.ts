import { installScarb } from '../actions/installScarb.js';
import { compileContract } from '../actions/buildProgram.js';
import { executeProgram } from '../actions/executeProgram.js';
import { proveProgram } from '../actions/proveProgram.js';
import { verifyProgram } from '../actions/verifyProgram.js';

import {
  executeProgramSchema,
  proveProgramSchema,
  verifyProgramSchema,
  installScarbSchema,
  compileContractSchema,
} from '../schema/schema.js';
import { StarknetAgentInterface, StarknetTool, logger } from '@snakagent/core';
import { scarbQueries } from '@snakagent/database/queries';

export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  agent: StarknetAgentInterface
) => {
  try {
  } catch (error) {
    const scarb = new scarbQueries(agent.getDatabaseCredentials());
    const db = agent.getDatabase();
    if (db.has('scarb')) {
      throw new Error('Scarb database already exists');
    }
    db.set('scarb', scarb);
    agent.setDatabase(db);
    logger.error('Failed to initialize scarb db: ', error);
    throw error;
  }

  StarknetToolRegistry.push({
    name: 'scarb_install',
    description: 'Install the latest version of Scarb if not already installed',
    plugins: 'scarb',
    schema: installScarbSchema,
    execute: installScarb,
  });

  StarknetToolRegistry.push({
    name: 'scarb_compile_contract',
    description: `
      DESCRIPTION: Compile contracts or program of an existing project using Scarb.
      TRIGGER: Only call when the user explicitly asks to compile contracts or program.
      PARAMETERS: Requires a project name.
      SUCCESS: After successful compilation, consider this task complete. 
      FAILURE: After 2 failed attempts, report the error and stop retrying.
    `,
    plugins: 'scarb',
    schema: compileContractSchema,
    execute: compileContract,
  });

  StarknetToolRegistry.push({
    name: 'scarb_execute_program',
    description: `
      DESCRIPTION: Execute a Cairo program function of an existing project using Scarb.
      TRIGGER: Only call when the user explicitly asks to execute a Cairo program function.
      PARAMETERS: Requires a project name and a program name.
      SUCCESS: After successful execution, consider this task complete. 
      FAILURE: After 2 failed attempts, report the error and stop retrying.
    `,
    plugins: 'scarb',
    schema: executeProgramSchema,
    execute: executeProgram,
  });

  StarknetToolRegistry.push({
    name: 'scarb_prove_program',
    description: `
      DESCRIPTION: Generate a proof for a Cairo program execution of an existing project using Scarb.
      TRIGGER: Only call when the user explicitly asks to generate a proof for a Cairo program execution.
      PARAMETERS: Requires a project name and a program name.
      SUCCESS: After successful proof generation, consider this task complete. 
      FAILURE: After 2 failed attempts, report the error and stop retrying.
    `,
    plugins: 'scarb',
    schema: proveProgramSchema,
    execute: proveProgram,
  });

  StarknetToolRegistry.push({
    name: 'scarb_verify_program',
    description: `
      DESCRIPTION: Verify a proof for a Cairo program execution of a project using Scarb.
      TRIGGER: Only call when the user explicitly asks to verify a proof for a Cairo program execution.
      PARAMETERS: Requires a project name and a program name.
      SUCCESS: After successful verification, consider this task complete. 
      FAILURE: After 2 failed attempts, report the error and stop retrying.
    `,
    plugins: 'scarb',
    schema: verifyProgramSchema,
    execute: verifyProgram,
  });
};
