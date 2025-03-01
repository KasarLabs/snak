import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { getAllowanceSchema, getMyGivenAllowanceSchema, getAllowanceGivenToMeSchema } from '../schemas/schema';
export declare const getAllowance: (agent: StarknetAgentInterface, params: z.infer<typeof getAllowanceSchema>) => Promise<string>;
export declare const getMyGivenAllowance: (agent: StarknetAgentInterface, params: z.infer<typeof getMyGivenAllowanceSchema>) => Promise<string>;
export declare const getAllowanceGivenToMe: (agent: StarknetAgentInterface, params: z.infer<typeof getAllowanceGivenToMeSchema>) => Promise<string>;
