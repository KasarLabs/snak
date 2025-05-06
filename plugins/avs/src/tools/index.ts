import {
  StarknetAgentInterface,
  StarknetTool,
} from '../../../../agents/src/index.ts';
import { verifyProof } from '../actions/verifyProof.ts';
import { verifyProofSchema } from '../schema/verifyProofSchema.ts';

export const registerTools = (
  StarknetToolRegistry: StarknetTool[],
  agent?: StarknetAgentInterface
) => {
  StarknetToolRegistry.push({
    name: 'verifyProof',
    plugins: 'avs',
    description:
      'Verify a STARK proof for Starknet block data using the verifier contract. Returns whether the proof is valid along with block information.',
    schema: verifyProofSchema,
    execute: async (agent: StarknetAgentInterface, params: any) => {
      verifyProof(agent, params);
    },
  });
};
