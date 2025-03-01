import { TransactionReceipt, TransactionStatus } from 'starknet';
import { BaseUtilityClass } from '@starknet-agent-kit/agents';

export class TransactionMonitor implements BaseUtilityClass {
  constructor(
    public provider: any,
    private readonly pollingInterval: number = 5000
  ) {}

  async waitForTransaction(
    txHash: string,
    callback?: (status: TransactionStatus) => void
  ): Promise<TransactionReceipt> {
    let receipt: TransactionReceipt;

    while (true) {
      try {
        receipt = await this.provider.getTransactionReceipt(txHash);

        if (callback) {
          const status = await this.provider.getTransactionStatus(txHash);
          callback(status);
        }

        if (
          receipt.finality_status === 'ACCEPTED_ON_L2' ||
          receipt.finality_status === 'ACCEPTED_ON_L1'
        ) {
          break;
        }

        if (receipt.execution_status === 'REVERTED') {
          throw new Error(`Transaction ${txHash} was reverted`);
        }

        await new Promise((resolve) =>
          setTimeout(resolve, this.pollingInterval)
        );
      } catch (error) {
        if (error.message.includes('Transaction hash not found')) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.pollingInterval)
          );
          continue;
        }
        throw error;
      }
    }

    return receipt;
  }

  async getTransactionEvents(txHash: string): Promise<Event[]> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt.events || [];
    } catch (error) {
      throw new Error(`Failed to get transaction events: ${error.message}`);
    }
  }

  async watchEvents(
    fromBlock: number,
    toBlock: number | 'latest' = 'latest',
    callback: (events: Event[]) => void
  ): Promise<void> {
    let currentBlock = fromBlock;

    while (true) {
      try {
        const latestBlock =
          toBlock === 'latest' ? await this.provider.getBlockNumber() : toBlock;

        if (currentBlock > latestBlock) {
          break;
        }

        const block = await this.provider.getBlockWithTxs(currentBlock);
        const events: Event[] = [];

        for (const tx of block.transactions) {
          if (tx.transaction_hash) {
            const receipt = await this.provider.getTransactionReceipt(
              tx.transaction_hash
            );
            if (receipt.events) {
              events.push(...receipt.events);
            }
          }
        }

        if (events.length > 0) {
          callback(events);
        }

        currentBlock++;
        await new Promise((resolve) =>
          setTimeout(resolve, this.pollingInterval)
        );
      } catch (error) {
        console.error('Error watching events:', error);
        await new Promise((resolve) =>
          setTimeout(resolve, this.pollingInterval)
        );
      }
    }
  }

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      return await this.provider.getTransactionStatus(txHash);
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }
}
