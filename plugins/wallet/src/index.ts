import * as actions from './actions/getBalance.ts';

export const plugin = {
  name: 'wallet',
  description: 'Provides wallet functionality for Starknet',
  actions,
};
