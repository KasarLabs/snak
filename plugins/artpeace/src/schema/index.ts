import { z } from 'zod';

export const placePixelParamSchema = z.object({
  canvasId: z
    .union([z.number(), z.string()])
    .optional()
    .default(0)
    .describe('The id or the unique name of the world to dispose the pixel'),
  xPos: z
    .number()
    .optional()
    .nullable()
    .describe('The position on x axe of the pixel'),
  yPos: z
    .number()
    .optional()
    .nullable()
    .describe('The position on y axe of the pixel'),
  color: z
    .string()
    .optional()
    .default('0')
    .describe('The color of the pixel by name or by hexadecimal'),
});

export const placePixelSchema = z.object({
  params: z
    .array(placePixelParamSchema)
    .describe(
      'Array of parameter to place one or multiple pixel, all parameters are optional'
    ),
});

export type placePixelParam = z.infer<typeof placePixelParamSchema>;
