import { Call } from '@starknet-io/types-js';

function buildTransactionCall(data: {
  contractAddress?: string;
  entrypoint?: string;
  calldata?: any[];
}): Call | undefined {
  if (!data || !data.contractAddress || !data.entrypoint || !data.calldata) {
    return undefined;
  }
  return {
    contract_address: data.contractAddress,
    entry_point: data.entrypoint,
    calldata: data.calldata,
  };
}

export async function processTransactionCalls(
  calls: Array<{
    contractAddress?: string;
    entrypoint?: string;
    calldata?: any[];
  }>
): Promise<Call[]> {
  const validCalls = calls
    .map((call) => {
      const transactionCall = buildTransactionCall(call);
      return transactionCall;
    })
    .filter((call): call is Call => call !== undefined);

  if (validCalls.length === 0) {
    throw new Error(
      'No valid transactions found. At least one transaction is required.'
    );
  }

  return validCalls;
}
