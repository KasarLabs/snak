import { z } from 'zod';
import { RpcProvider, Contract, CallData } from 'starknet';
import { StarknetAgentInterface } from '../../../../agents/src/index';
export type ProofVerifier = (data: VerifyProofInput) => Promise<boolean>;
export const verifyProofSchema = z.object({
  blockHash: z
    .string()
    .startsWith('0x')
    .describe('The Starknet block hash to verify'),
  proof: z
    .object({
      programOutput: z
        .array(z.string())
        .describe('Program output for the STARK proof'),
      publicInput: z
        .array(z.string())
        .describe('Public inputs for verification'),
      proofParams: z
        .object({
          securityLevel: z.number().describe('Security level of the proof'),
          numQueries: z.number().describe('Number of queries in the proof'),
          blowupFactor: z
            .number()
            .describe('Blowup factor used in the proof generation'),
        })
        .describe('Parameters used in generating the proof'),
    })
    .describe('The STARK proof data'),
});

export type VerifyProofInput = z.infer<typeof verifyProofSchema>;

const STARK_VERIFIER_CONTRACT_ADDRESS =
  process.env.STARK_VERIFIER_CONTRACT_ADDRESS ||
  '0x041A78091D3F9A73AeFdE217E5C073C36AB3F0A76E82AEC4C99B5B0C61D793CC';

const verifierABI = [
  {
    inputs: [
      {
        name: 'block_hash',
        type: 'felt',
      },
      {
        name: 'program_outputs_len',
        type: 'felt',
      },
      {
        name: 'program_outputs',
        type: 'felt*',
      },
      {
        name: 'public_inputs_len',
        type: 'felt',
      },
      {
        name: 'public_inputs',
        type: 'felt*',
      },
      {
        name: 'security_level',
        type: 'felt',
      },
      {
        name: 'num_queries',
        type: 'felt',
      },
      {
        name: 'blowup_factor',
        type: 'felt',
      },
    ],
    name: 'verify_proof',
    outputs: [
      {
        name: 'is_valid',
        type: 'felt',
      },
    ],
    type: 'function',
  },
];

async function verifyStarkProof(data: VerifyProofInput): Promise<boolean> {
  const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL || '',
  });

  try {
    console.log(`Verifying STARK proof for block: ${data.blockHash}`);

    const verifierContract = new Contract(
      verifierABI,
      STARK_VERIFIER_CONTRACT_ADDRESS,
      provider
    );

    const calldata = CallData.compile({
      block_hash: data.blockHash,
      program_outputs_len: data.proof.programOutput.length,
      program_outputs: data.proof.programOutput,
      public_inputs_len: data.proof.publicInput.length,
      public_inputs: data.proof.publicInput,
      security_level: data.proof.proofParams.securityLevel,
      num_queries: data.proof.proofParams.numQueries,
      blowup_factor: data.proof.proofParams.blowupFactor,
    });

    const result = await verifierContract.call('verify_proof', calldata);

    const isValid = result !== BigInt(0);

    console.log(`Proof verification result: ${isValid ? 'Valid' : 'Invalid'}`);

    return isValid;
  } catch (error) {
    console.error('Error verifying STARK proof:', error);
    throw new Error(`Failed to verify proof for block ${data.blockHash}`);
  }
}

async function verifyBlockIntegrity(blockHash: string): Promise<boolean> {
  const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL || '',
  });

  try {
    const block = await provider.getBlock(blockHash);
    return (
      (block && block.status === 'ACCEPTED_ON_L1') ||
      block.status === 'ACCEPTED_ON_L2'
    );
  } catch (error) {
    console.error(`Error verifying block integrity for ${blockHash}:`, error);
    return false;
  }
}

export async function verifyProof(
  agent: StarknetAgentInterface,
  params: VerifyProofInput,
  customVerifyStarkProof?: ProofVerifier
) {
  const data = params;
  try {
    console.log('Starting AVS verification process...');

    const blockIsValid = await verifyBlockIntegrity(data.blockHash);
    if (!blockIsValid) {
      console.log(
        `Block ${data.blockHash} not found or not accepted on Starknet`
      );
      return {
        isValid: false,
        reason: 'Block not found or not accepted on Starknet',
        blockHash: data.blockHash,
      };
    }

    const proofIsValid = await (customVerifyStarkProof
      ? customVerifyStarkProof(data)
      : verifyStarkProof(data));

    return {
      isValid: proofIsValid,
      blockHash: data.blockHash,
      proofSummary: {
        programOutputSize: data.proof.programOutput.length,
        publicInputSize: data.proof.publicInput.length,
        securityLevel: data.proof.proofParams.securityLevel,
      },
    };
  } catch (error) {
    console.error('Error occured while verifyin proof', error);

    return {
      isValid: false,
      error: (error as Error).message,
      blockHash: data.blockHash || 'unknown',
    };
  }
}
