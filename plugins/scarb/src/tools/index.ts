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
import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';


export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  agent: StarknetAgentInterface
) => {
  StarknetToolRegistry.push({
    name: 'scarb_install',
    description: 'Install the latest version of Scarb if not already installed',
    plugins: 'scarb',
    schema: installScarbSchema,
    execute: installScarb,
  });

  StarknetToolRegistry.push({
    name: 'scarb_compile_contract',
    description: 'Compile contracts or program of an existing project using Scarb',
    plugins: 'scarb',
    schema: compileContractSchema,
    execute: compileContract,
  });

  StarknetToolRegistry.push({
    name: 'scarb_execute_program',
    description: 'Execute a Cairo program function of an existing project using Scarb',
    plugins: 'scarb',
    schema: executeProgramSchema,
    execute: executeProgram,
  });

  StarknetToolRegistry.push({
    name: 'scarb_prove_program',
    description: 'Generate a proof for a Cairo program execution of an existing project using Scarb',
    plugins: 'scarb',
    schema: proveProgramSchema,
    execute: proveProgram,
  });

  StarknetToolRegistry.push({
    name: 'scarb_verify_program',
    description: 'Verify a proof for a Cairo program execution of a project using Scarb',
    plugins: 'scarb',
    schema: verifyProgramSchema,
    execute: verifyProgram,
  });
};
