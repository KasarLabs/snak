import { z } from 'zod';
import { AgentProfileSchema } from './common.schemas.js';

// Main schema for creating an agent (only profile and prompts_id allowed)
export const CreateAgentSchema = z
  .object({
    profile: AgentProfileSchema.describe(
      'Agent profile configuration (required)'
    ),
    prompts_id: z
      .string()
      .uuid()
      .optional()
      .describe('Existing prompts configuration identifier (optional)'),
  })
  .strict();

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
