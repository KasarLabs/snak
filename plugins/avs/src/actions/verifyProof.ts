import { RpcProvider, Contract, CallData } from 'starknet';
import { StarknetAgentInterface } from '../../../../agents/src/index.ts';
import { verifierABI } from '../abis/verifierABI.ts';
import { ProofVerifier, VerifyProofInput } from '../types/index.ts';
import { STARK_VERIFIER_CONTRACT_ADDRESS } from '../constants/index.ts';

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
