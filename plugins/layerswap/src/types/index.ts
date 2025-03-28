export type NetworkType = 'starknet' | 'evm';

export enum LayerswapConstant {
  DEFAULT_API_BASE_URL = 'https://api.layerswap.io/api/v2',
  DEFAULT_API_KEY = 'rIIj14K0JTPP2OUrOv3atLw5MYgFYVUXpyGdZ6O+2fi5oJRXhw3G2fVPOYBWBJPvHe6vNKKcxhhhGtaYMlgJVw',
  DEFAULT_POLL_INTERVAL_MS = 10000,
  DEFAULT_MAX_POLL_ATTEMPTS = 30,
  HTTP_STATUS_OK = 200,
  HTTP_STATUS_ERROR = 500,
}

export enum SwapStatus {
  PENDING = 'user_transfer_pending',
  PROCESSING = 'ls_transfer_pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export interface Network {
  name: string;
  display_name: string;
  logo: string;
  chain_id: string;
  node_url: string;
  type: NetworkType;
  transaction_explorer_template: string;
  account_explorer_template: string;
  source_rank: number;
  destination_rank: number;
  token?: Token | null;
  metadata: {
    listing_date: string;
    watchdog_contract: string;
  };
  deposit_methods?: string[];
}

export interface Token {
  symbol: string;
  display_asset: string;
  logo: string;
  contract: string;
  decimals: number;
  price_in_usd: number;
  precision: number;
  listing_date: string;
  source_rank: number;
  destination_rank: number;
}

export interface SwapInput {
  source_network: string;
  source_token: string;
  destination_network: string;
  destination_token: string;
  source_address?: string;
  destination_address: string;
  amount: number;
  refuel?: boolean;
  reference_id?: string;
  use_deposit_address?: boolean;
}

export interface SwapResponseData {
  id: string;
  created_date: string;
  source_network: Network;
  source_token: Token;
  destination_network: Network;
  destination_token: Token;
  requested_amount: number;
  destination_address: string;
  status: string;
  fail_reason: string | null;
  use_deposit_address: boolean;
  metadata?: {
    sequence_number?: number;
  };
  transactions: any[];
  reference_id?: string;
  expires_at?: string;
  deposit_address?: string;
  input?: {
    transaction_id: string;
    from_address: string;
  };
  output?: {
    transaction_id: string;
    to_address: string;
  };
}

export interface SwapResponse {
  data: {
    deposit_actions?: DepositAction[];
    swap: SwapResponseData;
    quote?: QuoteResponse;
    refuel?: any;
    reward?: any;
  };
}

export interface DepositAction {
  type: string;
  to_address: string;
  amount: number;
  order: number;
  amount_in_base_units: string;
  network: Network;
  token: Token;
  fee_token: Token;
  call_data: string;
  token_address?: string;
  deposit_address?: string;
  function_name?: string;
  needs_approval?: boolean;
}

export interface QuoteResponse {
  source_network: Network | null;
  source_token: Token | null;
  destination_network: Network | null;
  destination_token: Token | null;
  receive_amount: number;
  min_receive_amount: number;
  blockchain_fee: number;
  service_fee: number;
  avg_completion_time: string;
  refuel_in_source: any | null;
  slippage: number;
  total_fee: number;
  total_fee_in_usd: number;
}
