import { StarknetAgentInterface, StarknetTool } from '@hijox/core';
import { placePixel } from '../actions/placePixel.js';
import { placePixelSchema } from '../schema/index.js';

export const registerTools = (
  StarknetToolRegistry: StarknetTool[],
  agent?: StarknetAgentInterface
) => {
  StarknetToolRegistry.push({
    name: 'place_pixel',
    plugins: 'art-peace',
    description: 'Places a pixel, all parameters are optional',
    schema: placePixelSchema,
    execute: placePixel,
  });
};
