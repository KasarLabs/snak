import { z } from 'zod';
import { normalizeNonNegativeNumber } from '../../utils/normalizeAgentValues.js';

export const ListAgentsSchema = z.object({
  filters: z
    .object({
      group: z
        .string()
        .optional()
        .describe(
          'Filter agents by specific group (use when user wants agents from a particular group)'
        ),
      mode: z
        .string()
        .optional()
        .describe(
          'Filter agents by execution mode (use when user wants agents with specific mode)'
        ),
      name_contains: z
        .string()
        .optional()
        .describe(
          'Filter agents whose names contain this text (use for partial name searches)'
        ),
    })
    .optional()
    .describe('Optional filters to narrow down the agent list'),
  limit: z
    .number()
    .optional()
    .transform(normalizeNonNegativeNumber)
    .describe(
      'Maximum number of agents to return (use when user specifies a limit)'
    ),
  offset: z
    .number()
    .optional()
    .transform(normalizeNonNegativeNumber)
    .describe('Number of agents to skip for pagination'),
});
