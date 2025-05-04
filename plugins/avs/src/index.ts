import * as actions from './actions/verifyProof';

export const plugin = {
  name: 'avs',
  description:
    'Provides AVS (Availability and Validity Scheme) proof verification for Starknet',
  actions,
};
