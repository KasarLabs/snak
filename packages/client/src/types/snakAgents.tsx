/**
 * Defines an invocation transaction
 */
export type InvokeTransaction = {
  /** Target contract address */
  contractAddress: string;
  /** Transaction entry point */
  entrypoint: string;
  /** Transaction call data */
  calldata: string[];
};
