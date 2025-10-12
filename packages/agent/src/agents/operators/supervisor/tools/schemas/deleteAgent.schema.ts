import { z } from 'zod';
import { SelectAgentSchema } from './common.schemas.js';

export const DeleteAgentSchema = SelectAgentSchema.extend({
  confirm: z
    .boolean()
    .optional()
    .default(true)
    .describe('Confirmation to proceed with deletion (defaults to true)'),
});
