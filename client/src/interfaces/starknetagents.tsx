/**
 * Represents an agent's response
 */
export interface AgentResponse {
  /** Response text */
  text: string;
  /** Timestamp of the response */
  timestamp: number;
  /** Indicates if the agent is typing */
  isTyping: boolean;
}

/**
 * Represents a transaction response
 */
export interface TransactionResponse {
  /** Transaction type */
  transaction_type: 'INVOKE';
  /** Transaction results */
  results: WalletApiResponse[];
}

/**
 * Details the Wallet API response
 */
export interface WalletApiResponse {
  /** Transaction status */
  status: 'success' | 'failure';
  /** Transaction details */
  transactions: {
    /** Contract address */
    contractAddress: string;
    /** Entry point */
    entrypoint: string;
    /** Call data */
    calldata: string[];
  };
  /** Additional data */
  additional_data?: {
    /** Asset symbol */
    assetSymbol: string;
    /** Asset amount */
    amount: string;
    /** Recipient address */
    recipientAddress?: string;
    /** Spender address */
    spenderAddress?: string;
  };
}
