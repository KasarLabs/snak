import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import { placePixel } from '../actions/placePixel';
import { placePixelSchema } from '../schema';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'place_pixel',
    plugins: 'art-peace',
    description: 'Places a pixel, all parameters are optional',
    schema: placePixelSchema,
    execute: placePixel,
  });
};
