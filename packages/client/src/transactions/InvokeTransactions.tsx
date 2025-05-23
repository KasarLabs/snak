import { TransactionResponse } from '@/interfaces/snakagents';
import { InvokeTransaction } from '@/types/snakAgents';

export const handleInvokeTransactions = (
  response: TransactionResponse
): InvokeTransaction[] => {
  console.log(response);
  return response.results.map((item) => {
    console.log('Transaction processed:', JSON.stringify(item.transactions));

    return {
      contractAddress: item.transactions.contractAddress,
      entrypoint: item.transactions.entrypoint,
      calldata: item.transactions.calldata,
    };
  });
};
