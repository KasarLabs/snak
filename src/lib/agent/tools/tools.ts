import { tool } from '@langchain/core/tools';
import {
  CreateOZAccount,
  CreateArgentAccount,
} from '../method/core/account/createAccount';
import {
  DeployArgentAccount,
  DeployOZAccount,
} from '../method/core/account/deployAccount';
import { transfer } from '../method/core/token/transfer';
import {
  simulateDeployAccountTransaction,
  simulateInvokeTransaction,
  simulateDeployTransaction,
  simulateDeclareTransaction,
} from '../method/core/transaction/simulateTransaction';
import { getOwnBalance, getBalance } from '../method/core/token/getBalances';
import { getBlockNumber } from '../method/core/rpc/getBlockNumber';
import { getBlockTransactionCount } from '../method/core/rpc/getBlockTransactionCount';
import { getStorageAt } from '../method/core/rpc/getStorageAt';
import { getClassAt } from '../method/core/rpc/getClassAt';
import { getClassHashAt } from '../method/core/rpc/getClassHash';
import {
  getOwnBalanceSchema,
  getBalanceSchema,
  DeployArgentAccountSchema,
  getStorageAtSchema,
  swapSchema,
  DeployOZAccountSchema,
  blockIdSchema,
  transactionHashSchema,
  blockIdAndContractAddressSchema,
  simulateInvokeTransactionSchema,
  simulateDeployAccountTransactionSchema,
  simulateDeployTransactionSchema,
  simulateDeclareTransactionSchema,
  routeSchema,
  createMemecoinSchema,
  launchOnEkuboSchema,
  contractAddressSchema,
  getClassAtSchema,
  getClassHashAtSchema,
  Transferschema,
  createTwitterpostSchema,
  CoinGeckoCheckTokenPriceSchema,
  GetLastUserXTweetSchema,
  ReplyTweetSchema,
  getLastTweetsOptionsSchema,
  createAndPostTwitterThreadSchema,
  FollowXUserFromUsernameSchema,
  getTwitterProfileFromUsernameSchema,
  getTwitterUserIdFromUsernameSchema,
  getLastTweetsAndRepliesFromUserSchema,
  getLastTweetsFromUserSchema,
} from '../schema/schema';
import { swapTokens } from '../method/avnu/swapService';
import { getRoute } from '../method/avnu/fetchRouteService';
import { getSpecVersion } from '../method/core/rpc/getSpecVersion';
import { getBlockWithTxHashes } from '../method/core/rpc/getBlockWithTxHashes';
import { getBlockWithReceipts } from '../method/core/rpc/getBlockWithReceipts';
import { getTransactionStatus } from '../method/core/rpc/getTransactionStatus';
import { getClass } from '../method/core/rpc/getClass';
import { getChainId } from '../method/core/rpc/getChainId';
import { getSyncingStats } from '../method/core/rpc/getSyncingStats';
import { isMemecoin } from '../method/unruggable/isMemecoin';
import { getLockedLiquidity } from '../method/unruggable/getLockedLiquidity';
import { launchOnEkubo } from '../method/unruggable/launchOnEkubo';
import { RpcProvider } from 'starknet';
import { AccountManager } from '../method/core/account/utils/AccountManager';
import { TransactionMonitor } from '../method/core/transaction/utils/TransactionMonitor';
import { ContractInteractor } from '../method/core/contract/utils/ContractInteractor';

import { createMemecoin } from '../method/unruggable/createMemecoin';
import {
  GetBalanceParams,
  GetOwnBalanceParams,
} from '../method/core/token/types/balance';
import {
  createAndPostTwitterThread,
  createTwitterpost,
  FollowXUserFromUsername,
  ReplyTweet,
} from '../method/Twitter/twitter';
import { Limit } from '../limit';
import {
  CoinGeckoCheckApiListSupportedTokens,
  CoinGeckoCheckApiServerStatus,
  CoinGeckoCheckTokenPrice,
  CoinGeckoTrendingSearchList,
} from '../method/coingecko/coingecko';
import {
  getLastTweetsAndRepliesFromUser,
  getLastTweetsFromUser,
  getLastTweetsOptions,
  GetLastUserTweet,
  getOwnTwitterAccountInfo,
  getTwitterProfileFromUsername,
  getTwitterUserIdFromUsername,
} from '../method/Twitter/twitter_read';
import { TwitterInterface } from '../method/Twitter/interface/twitter-interface';

export interface StarknetAgentInterface {
  getAccountCredentials: () => {
    accountPublicKey: string;
    accountPrivateKey: string;
  };
  getModelCredentials: () => {
    aiModel: string;
    aiProviderApiKey: string;
  };
  getSignature: () => {
    signature: string;
  };
  getProvider: () => RpcProvider;
  accountManager: AccountManager;
  transactionMonitor: TransactionMonitor;
  contractInteractor: ContractInteractor;
  getLimit: () => Limit;
  getTwitterAuthMode: () => 'API' | 'CREDIDENTIALS' | undefined;
  getTwitterManager: () => TwitterInterface;
}

interface StarknetTool<P = any> {
  name: string;
  description: string;
  schema?: object;
  responseFormat?: string;
  execute: (agent: StarknetAgentInterface, params: P) => Promise<unknown>;
}

export class StarknetToolRegistry {
  private static tools: StarknetTool[] = [];

  static registerTool<P>(tool: StarknetTool<P>): void {
    this.tools.push(tool);
  }

  static createTools(agent: StarknetAgentInterface) {
    return this.tools.map(({ name, description, schema, execute }) =>
      tool(async (params: any) => execute(agent, params), {
        name,
        description,
        ...(schema && { schema }),
      })
    );
  }

  static createAllowedTools(
    agent: StarknetAgentInterface,
    allowed_tools: string[]
  ) {
    const filteredTools = this.tools.filter((tool) =>
      allowed_tools.includes(tool.name)
    );
    let tools = this.tools.filter((tool) => allowed_tools.includes(tool.name));
    return tools.map(({ name, description, schema, execute }) =>
      tool(async (params: any) => execute(agent, params), {
        name,
        description,
        ...(schema && { schema }),
      })
    );
  }
}

export const registerTools = () => {
  // Register balance tools
  StarknetToolRegistry.registerTool<GetOwnBalanceParams>({
    name: 'get_own_balance',
    description: 'Get the balance of an asset in your wallet',
    schema: getOwnBalanceSchema,
    execute: getOwnBalance,
  });

  StarknetToolRegistry.registerTool<GetBalanceParams>({
    name: 'get_balance',
    description: 'Get the balance of an asset for a given wallet address',
    schema: getBalanceSchema,
    execute: getBalance,
  });

  // Register account creation and deployment tools
  StarknetToolRegistry.registerTool({
    name: 'CreateOZAccount',
    description: 'Create Open Zeppelin account',
    execute: CreateOZAccount,
  });

  StarknetToolRegistry.registerTool({
    name: 'DeployOZ',
    description: 'Deploy a OZ Account',
    schema: DeployOZAccountSchema,
    execute: DeployOZAccount,
  });

  StarknetToolRegistry.registerTool({
    name: 'CreateArgentAccount',
    description: 'Create Account account',
    execute: CreateArgentAccount,
  });

  StarknetToolRegistry.registerTool({
    name: 'DeployArgent',
    description: 'Deploy a Argent Account',
    schema: DeployArgentAccountSchema,
    execute: DeployArgentAccount,
  });

  // Register blockchain query tools
  StarknetToolRegistry.registerTool({
    name: 'get_block_number',
    description: 'Get the current block number from the Starknet network',
    execute: getBlockNumber,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_block_transaction_count',
    description: 'Get the number of transactions in a specific block',
    schema: blockIdSchema,
    execute: getBlockTransactionCount,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_storage_at',
    description: 'Get the storage value at a specific slot for a contract',
    schema: getStorageAtSchema,
    execute: getStorageAt,
  });

  // Register contract-related tools
  StarknetToolRegistry.registerTool({
    name: 'get_class',
    description:
      'Retrieve the complete class definition of a contract at a specified address and block',
    schema: blockIdAndContractAddressSchema,
    execute: getClass,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_class_at',
    description:
      'Fetch the class definition of a contract at a specific address in the latest state',
    schema: getClassAtSchema,
    execute: getClassAt,
  });

  // Register DeFi tools
  StarknetToolRegistry.registerTool({
    name: 'swap_tokens',
    description: 'Swap a specified amount of one token for another token',
    schema: swapSchema,
    execute: swapTokens,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_route',
    description: 'Get a specific route for swapping tokens',
    schema: routeSchema,
    execute: getRoute,
  });

  // Register transaction tools
  StarknetToolRegistry.registerTool({
    name: 'transfer',
    description: 'Transfer ERC20 tokens to a specific address',
    schema: Transferschema,
    execute: transfer,
  });

  // Simulate transactions
  StarknetToolRegistry.registerTool({
    name: 'simulate_transaction',
    description: 'Simulate a transaction without executing it',
    schema: simulateInvokeTransactionSchema,
    execute: simulateInvokeTransaction,
  });

  // Register memecoin tools
  StarknetToolRegistry.registerTool({
    name: 'create_memecoin',
    description: 'Create a new memecoin using the Unruggable Factory',
    schema: createMemecoinSchema,
    execute: createMemecoin,
  });

  StarknetToolRegistry.registerTool({
    name: 'launch_on_ekubo',
    description: 'Launch a memecoin on Ekubo DEX with concentrated liquidity',
    schema: launchOnEkuboSchema,
    execute: launchOnEkubo,
  });

  // Register utility tools
  StarknetToolRegistry.registerTool({
    name: 'get_chain_id',
    description:
      'Retrieve the unique identifier (chain ID) of the Starknet network',
    execute: getChainId,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_syncing_status',
    description: 'Retrieve the syncing status of the Starknet node',
    execute: getSyncingStats,
  });

  // Add remaining tools from createTools2
  StarknetToolRegistry.registerTool({
    name: 'get_class_hash',
    description:
      'Retrieve the unique class hash for a contract at a specific address',
    schema: getClassHashAtSchema,
    execute: getClassHashAt,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_spec_version',
    description: 'Get the current spec version from the Starknet RPC provider',
    execute: getSpecVersion,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_block_with_tx_hashes',
    description:
      'Retrieve the details of a block, including transaction hashes',
    schema: blockIdSchema,
    execute: getBlockWithTxHashes,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_block_with_receipts',
    description: 'Fetch block details with transaction receipts',
    schema: blockIdSchema,
    execute: getBlockWithReceipts,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_transaction_status',
    description: 'Fetch transaction status by hash',
    schema: transactionHashSchema,
    execute: getTransactionStatus,
  });

  // Transaction tools
  StarknetToolRegistry.registerTool({
    name: 'simulate_deploy_account_transaction',
    description: 'Simulate Deploy Account transaction',
    schema: simulateDeployAccountTransactionSchema,
    execute: simulateDeployAccountTransaction,
  });

  StarknetToolRegistry.registerTool({
    name: 'simulate_deploy_transaction',
    description: 'Simulate Deploy transaction',
    schema: simulateDeployTransactionSchema,
    execute: simulateDeployTransaction,
  });

  StarknetToolRegistry.registerTool({
    name: 'simulate_declare_transaction',
    description: 'Simulate Declare transaction',
    schema: simulateDeclareTransactionSchema,
    execute: simulateDeclareTransaction,
  });

  // Utility tools
  StarknetToolRegistry.registerTool({
    name: 'is_memecoin',
    description: 'Check if address is a memecoin',
    schema: contractAddressSchema,
    execute: isMemecoin,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_locked_liquidity',
    description: 'Get locked liquidity info for token',
    schema: contractAddressSchema,
    execute: getLockedLiquidity,
  });
  // Twitter Tools
  StarknetToolRegistry.registerTool({
    name: 'create_twitter_post',
    description: 'Create new X/Twitter post',
    schema: createTwitterpostSchema,
    execute: createTwitterpost,
  });

  StarknetToolRegistry.registerTool({
    name: 'reply_twitter_tweet',
    description: 'Reply to specific X/Twitter post by ID',
    schema: ReplyTweetSchema,
    execute: ReplyTweet,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_last_tweet',
    description: 'Get most recent post from specified X/Twitter account',
    schema: GetLastUserXTweetSchema,
    execute: GetLastUserTweet,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_last_tweets_options',
    description: 'Get specified number of posts matching search query',
    schema: getLastTweetsOptionsSchema,
    execute: getLastTweetsOptions,
  });

  StarknetToolRegistry.registerTool({
    name: 'create_and_post_twitter_thread',
    description: 'Create and publish X/Twitter thread',
    schema: createAndPostTwitterThreadSchema,
    execute: createAndPostTwitterThread,
  });

  StarknetToolRegistry.registerTool({
    name: 'follow_twitter_from_username',
    description: 'Follow X/Twitter user by username',
    schema: FollowXUserFromUsernameSchema,
    execute: FollowXUserFromUsername,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_twitter_profile_from_username',
    description: 'Get full X/Twitter profile data by username',
    schema: getTwitterProfileFromUsernameSchema,
    execute: getTwitterProfileFromUsername,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_twitter_user_id_from_username',
    description: 'Get X/Twitter user ID from username',
    schema: getTwitterUserIdFromUsernameSchema,
    execute: getTwitterUserIdFromUsername,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_last_tweet_and_replies_from_user',
    description: 'Get recent X/Twitter posts and replies from user',
    schema: getLastTweetsAndRepliesFromUserSchema,
    execute: getLastTweetsAndRepliesFromUser,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_last_tweet_from_user',
    description: 'Get recent X/Twitter posts from user',
    schema: getLastTweetsFromUserSchema,
    execute: getLastTweetsFromUser,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_own_twitter_account_info',
    description: 'Get current account profile data',
    execute: getOwnTwitterAccountInfo,
  });
};
registerTools();

// Initialize tools

export const createTools = (agent: StarknetAgentInterface) => {
  return StarknetToolRegistry.createTools(agent);
};

export const createAllowedTools = (
  agent: StarknetAgentInterface,
  allowed_tools: string[]
) => {
  return StarknetToolRegistry.createAllowedTools(agent, allowed_tools);
};

export default StarknetToolRegistry;
