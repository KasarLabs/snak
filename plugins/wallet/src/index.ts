import * as actions from './actions/getBalance';

export const plugin = {
  name: 'wallet',
  description: 'Provides wallet functionality for Starknet',
  actions,
};
