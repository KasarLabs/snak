import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { VerifierParam } from '../types/Atlantic';
export declare const verifyProofService: (agent: StarknetAgentInterface, param: VerifierParam) => Promise<string>;
