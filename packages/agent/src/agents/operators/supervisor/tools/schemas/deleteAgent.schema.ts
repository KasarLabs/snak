import z from 'zod';
import { SelectAgentSchema } from './common.schemas.js';

export const DeleteAgentSchema = SelectAgentSchema.extend({
  confirm: z
    .boolean()
    .optional()
    .nullable()
    .describe(
      'Confirmation to proceed with deletion (automatically set to true when user clearly intends to delete)'
    ),
});
