import { SignatureTool } from '@starknet-agent-kit/agents';
import { placePixelSchema } from '../schema/index.js';
import { placePixelSignature } from '../actions/placePixel.js';

export const registerSignatureTools = (
  StarknetToolRegistry: SignatureTool[]
) => {
  StarknetToolRegistry.push({
    name: 'place_pixel',
    description: 'Places a pixel, all parameters are optional',
    schema: placePixelSchema,
    execute: placePixelSignature,
  });
};
