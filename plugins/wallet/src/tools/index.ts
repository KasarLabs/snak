import { getBalanceSchema } from '@/schema/index.ts';
import {
  StarknetAgentInterface,
  StarknetTool,
} from '../../../../agents/src/index.ts';
import { getBalance } from '@/actions/getBalance.ts';

export const registerTools = (
  StarknetToolRegistry: StarknetTool[],
  agent?: StarknetAgentInterface
) => {
  StarknetToolRegistry.push({
    name: 'getBalance',
    plugins: 'wallet',
    description: 'Retrieve the balance of a Starkent address',
    schema: getBalanceSchema,
    execute: getBalance,
  });
};
