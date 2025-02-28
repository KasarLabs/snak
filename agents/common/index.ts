/**
 * AI service configuration
 * @property {string} apiKey - API key for the AI service
 * @property {string} aiModel - Model identifier to use
 * @property {string} aiProvider - Name of the AI service provider
 */
export type AiConfig = {
  aiProviderApiKey: string;
  aiModel: string;
  aiProvider: string;
};

import {
  ProviderInterface,
  RpcProvider,
  TransactionReceipt,
  TransactionStatus,
} from 'starknet';

/**
 * Base class for utility functions
 * @property {ProviderInterface} provider - The Starknet provider instance
 */
export interface BaseUtilityClass {
  provider: ProviderInterface;
}

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

import { Account, Contract, Call, CallData, hash, EstimateFee } from 'starknet';

/**
 * Result of a contract deployment
 * @property {string} transactionHash - Hash of the deployment transaction
 * @property {string | string[]} contractAddress - Address(es) of the deployed contract(s)
 */
export interface ContractDeployResult {
  transactionHash: string;
  contractAddress: string | string[];
}

/**
 * Result of a transaction operation
 * @property {('success'|'failure')} status - Status of the transaction
 * @property {string} [transactionHash] - Hash of the executed transaction
 * @property {string} [error] - Error message if transaction failed
 */
export interface TransactionResult {
  status: 'success' | 'failure';
  transactionHash?: string;
  contractAddress?: string;
  error?: string;
}

export class ContractInteractor implements BaseUtilityClass {
  constructor(public provider: any) {}

  async deployContract(
    account: Account,
    classHash: string,
    constructorCalldata: any[] = [],
    salt?: string
  ): Promise<ContractDeployResult> {
    try {
      const deployPayload = {
        classHash,
        constructorCalldata: CallData.compile(constructorCalldata),
        salt: salt || hash.getSelectorFromName(Math.random().toString()),
      };

      const { transaction_hash, contract_address } =
        await account.deploy(deployPayload);
      await this.provider.waitForTransaction(transaction_hash);

      return {
        transactionHash: transaction_hash,
        contractAddress: contract_address,
      };
    } catch (error) {
      throw new Error(`Failed to deploy contract: ${error.message}`);
    }
  }

  async estimateContractDeploy(
    account: Account,
    classHash: string,
    constructorCalldata: any[] = [],
    salt?: string
  ): Promise<EstimateFee> {
    try {
      const deployPayload = {
        classHash,
        constructorCalldata: CallData.compile(constructorCalldata),
        salt: salt || hash.getSelectorFromName(Math.random().toString()),
      };

      return account.estimateDeployFee(deployPayload);
    } catch (error) {
      throw new Error(`Failed to estimate contract deploy: ${error.message}`);
    }
  }

  async multicall(account: Account, calls: Call[]): Promise<TransactionResult> {
    try {
      const { transaction_hash } = await account.execute(calls);
      await this.provider.waitForTransaction(transaction_hash);

      return {
        status: 'success',
        transactionHash: transaction_hash,
      };
    } catch (error) {
      return {
        status: 'failure',
        error: error.message,
      };
    }
  }

  async estimateMulticall(
    account: Account,
    calls: Call[]
  ): Promise<EstimateFee> {
    try {
      return account.estimateInvokeFee(calls);
    } catch (error) {
      throw new Error(`Failed to estimate multicall: ${error.message}`);
    }
  }

  createContract(abi: any[], address: string, account?: Account): Contract {
    return new Contract(abi, address, account || this.provider);
  }

  async readContract(
    contract: Contract,
    method: string,
    args: any[] = []
  ): Promise<any> {
    try {
      return await contract.call(method, args);
    } catch (error) {
      throw new Error(`Failed to read contract: ${error.message}`);
    }
  }

  async writeContract(
    contract: Contract,
    method: string,
    args: any[] = []
  ): Promise<TransactionResult> {
    try {
      const { transaction_hash } = await contract.invoke(method, args);
      await this.provider.waitForTransaction(transaction_hash);

      return {
        status: 'success',
        transactionHash: transaction_hash,
      };
    } catch (error) {
      return {
        status: 'failure',
        error: error.message,
      };
    }
  }

  async estimateContractWrite(
    contract: Contract,
    method: string,
    args: any[] = []
  ): Promise<EstimateFee> {
    if (!contract.account) {
      throw new Error(
        'Contract must be connected to an account to estimate fees'
      );
    }

    try {
      return await contract.estimate(method, args);
    } catch (error) {
      throw new Error(`Failed to estimate contract write: ${error.message}`);
    }
  }

  formatTokenAmount(amount: string | number, decimals: number = 18): string {
    const value = typeof amount === 'string' ? amount : amount.toString();
    const [whole, fraction = ''] = value.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0');
    return whole + paddedFraction;
  }

  parseTokenAmount(amount: string, decimals: number = 18): string {
    const amountBigInt = BigInt(amount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = amountBigInt / divisor;
    const fractionPart = amountBigInt % divisor;
    const paddedFraction = fractionPart.toString().padStart(decimals, '0');
    return `${wholePart}.${paddedFraction}`;
  }
}

import { TwitterApi } from 'twitter-api-v2';
import { Scraper } from 'agent-twitter-client';

/**
 * Configuration for Twitter API authentication and client setup
 * @interface TwitterApiConfig
 * @param {string} twitter_api - The Twitter API key for authentication
 * @param {string} twitter_api_secret - The Twitter API secret key
 * @param {string} twitter_access_token - OAuth access token
 * @param {string} twitter_access_token_secret - OAuth access token secret
 * @param {TwitterApi} twitter_api_client - Initialized Twitter API client instance
 */
export interface TwitterApiConfig {
  twitter_api: string;
  twitter_api_secret: string;
  twitter_access_token: string;
  twitter_access_token_secret: string;
  twitter_api_client: TwitterApi;
}

/**
 * Configuration for Twitter scraping functionality
 * @interface TwitterScraperConfig
 * @param {Scraper} twitter_client - The Twitter scraper client instance
 * @param {string} twitter_id - Unique identifier of the Twitter account
 * @param {string} twitter_username - Username of the Twitter account
 */
export interface TwitterScraperConfig {
  twitter_client: Scraper;
  twitter_id: string;
  twitter_username: string;
}

/**
 * Main Twitter interface combining API and Scraper configurations
 * @interface TwitterInterface
 * @param {TwitterScraperConfig} [twitter_scraper] - Optional scraper configuration
 * @param {TwitterApiConfig} [twitter_api] - Optional API configuration
 */
export interface TwitterInterface {
  twitter_scraper?: TwitterScraperConfig;
  twitter_api?: TwitterApiConfig;
}

import TelegramBot from 'node-telegram-bot-api';

/**
 * Telegram Interface.
 *
 * @param {string} bot_token - Telegram bot authentication token
 * @param {string} public_url - Public URL for the webhook
 * @param {string} bot_port - Port number for the server to listen on
 * @param {TelegramBot} bot - Telegram bot instance
 */

export interface TelegramInterface {
  bot_token?: string;
  public_url?: string;
  bot_port?: number;
  bot?: TelegramBot;
}

export interface IAgent {
  /**
   * Executes the user request and returns the result
   * @param input The user's request string
   * @returns Promise resolving to the execution result
   * @throws AgentExecutionError if execution fails
   */
  execute(input: string): Promise<unknown>;

  /**
   * Executes the user request and returns the result
   * @param input The user's request string
   * @returns Promise resolving to the execution result
   * @throws AgentExecutionError if execution fails
   */
  execute_call_data(input: string): Promise<unknown>;

  /**
   * Executes agent autonomous the user request and returns the result
   * @param input The user's request string
   * @returns Promise resolving to the execution result
   * @throws AgentExecutionError if execution fails
   */
  execute_autonomous(): Promise<unknown>;

  /**
   * Validates the user request before execution
   * @param request The user's request string
   * @returns Promise<boolean> indicating if request is valid
   * @throws AgentValidationError if validation fails
   */
  validateRequest(request: string): Promise<boolean>;

  /**
   * Returns the agent's Starknet account credentials
   * @returns Starknet account credentials
   */
  getAccountCredentials(): {
    accountPrivateKey: string;
    accountPublicKey: string;
  };

  /**
   * Returns the agent's AI provider credentials
   * @returns AI provider credentials
   */
  getModelCredentials(): {
    aiModel: string;
    aiProviderApiKey: string;
  };

  getProvider(): RpcProvider;
}
