import { StarknetTool } from '@snakagent/core';
import { placePixel } from '../actions/placePixel.js';
import { placePixelSchema } from '../schema/index.js';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'place_pixel',
    plugins: 'art-peace',
    description: 'Places a pixel, all parameters are optional',
    schema: placePixelSchema,
    execute: placePixel,
  });
};
