import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { placePixelParam } from '../schema';
export declare const placePixel: (agent: StarknetAgentInterface, input: {
    params: placePixelParam[];
}) => Promise<string>;
export declare const placePixelSignature: (input: {
    params: placePixelParam[];
}) => Promise<string>;
