import { SignatureTool } from '@snakagent/core';
import { placePixelSchema } from '../schema/index.js';
import { placePixelSignature } from '../actions/placePixel.js';

export const registerSignatureTools = (SnakToolRegistry: SignatureTool[]) => {
  SnakToolRegistry.push({
    name: 'place_pixel',
    description: 'Places a pixel, all parameters are optional',
    schema: placePixelSchema,
    execute: placePixelSignature,
  });
};
