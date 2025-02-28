import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import {
  borrowTroveSchema,
  collateralActionSchema,
  getTroveHealthSchema,
  getUserTrovesSchema,
  openTroveSchema,
  repayTroveSchema,
} from '../schemas';
import { openTrove } from '../actions/openTrove';
import {
  getBorrowFee,
  getTroveHealth,
  getUserTroves,
} from '../actions/getters';
import { depositTrove } from '../actions/depositTrove';
import { withdrawTrove } from '../actions/withdrawTrove';
import { borrowTrove } from '../actions/borrowTrove';
import { repayTrove } from '../actions/repayTrove';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'open_trove',
    plugins: 'opus',
    description: 'Open a Trove on Opus',
    schema: openTroveSchema,
    execute: openTrove,
  });

  StarknetToolRegistry.push({
    name: 'get_user_troves',
    plugins: 'opus',
    description: 'Get trove IDs for an address on Opus',
    schema: getUserTrovesSchema,
    execute: getUserTroves,
  });

  StarknetToolRegistry.push({
    name: 'get_trove_health',
    plugins: 'opus',
    description: 'Get the health of a trove on Opus',
    schema: getTroveHealthSchema,
    execute: getTroveHealth,
  });

  StarknetToolRegistry.push({
    name: 'get_borrow_fee',
    plugins: 'opus',
    description: 'Get the current borrow fee for Opus',
    execute: getBorrowFee,
  });

  StarknetToolRegistry.push({
    name: 'deposit_trove',
    plugins: 'opus',
    description: 'Deposit collateral to a Trove on Opus',
    schema: collateralActionSchema,
    execute: depositTrove,
  });

  StarknetToolRegistry.push({
    name: 'withdraw_trove',
    plugins: 'opus',
    description: 'Withdraw collateral from a Trove on Opus',
    schema: collateralActionSchema,
    execute: withdrawTrove,
  });

  StarknetToolRegistry.push({
    name: 'borrow_trove',
    plugins: 'opus',
    description: 'Borrow CASH for a Trove on Opus',
    schema: borrowTroveSchema,
    execute: borrowTrove,
  });

  StarknetToolRegistry.push({
    name: 'repay_trove',
    plugins: 'opus',
    description: 'Repay CASH for a Trove on Opus',
    schema: repayTroveSchema,
    execute: repayTrove,
  });
};
