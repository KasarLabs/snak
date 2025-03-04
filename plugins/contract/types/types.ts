import { Uint256, Call, Account } from 'starknet';

export interface TransactionResult {
  status: 'success' | 'failure';
  tokenId?: string;
  from?: string;
  to?: string;
  operator?: string;
  approved?: boolean;
  transactionHash?: string;
  error?: string;
  step?: string;
}

/**
 * V3 transaction execution arguments
 * @property {Call} call
 * @property {Account} account
 */
export interface ExecuteV3Args {
  call: Call;
  account: Account;
}