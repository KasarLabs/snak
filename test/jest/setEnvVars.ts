import { setupTestEnvironment } from '../utils/helpers';
import { RpcProvider } from 'starknet';
import { StarknetAgentInterface } from '../../src/lib/agent/tools/tools';
import { AccountManager } from 'src/lib/agent/plugins/core/account/utils/AccountManager';
import { TransactionMonitor } from 'src/lib/agent/plugins/core/transaction/utils/TransactionMonitor';
import { ContractInteractor } from 'src/lib/agent/plugins/core/contract/utils/ContractInteractor';
// import { TwitterInterface } from 'src/lib/agent/plugins/Twitter/interface/twitter-interface';
import { TelegramInterface } from 'src/lib/agent/plugins/telegram/interfaces';

setupTestEnvironment();

export const createMockStarknetAgent = (): StarknetAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/twNPk5lDPh5t6m0WV6eoXdAD2VfIN0-b' });
  const twitter_interface = {};
  const telegram_interface = {};
  const json_config = undefined;
  const twitter_auth_mode = undefined;

  return {
    getAccountCredentials: () => ({
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS,
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY,
    }),
    getModelCredentials: () => ({
      aiModel: '',
      aiProviderApiKey: '',
    }),
    getSignature: () => ({
      signature: '',
    }),
    getProvider: () => provider,
    accountManager: new AccountManager(provider),
    transactionMonitor: new TransactionMonitor(provider),
    contractInteractor: new ContractInteractor(provider),
    getTwitterAuthMode: () => twitter_auth_mode,
    getAgentConfig: () => json_config,
    getTwitterManager: () => twitter_interface,
    getTelegramManager: () => telegram_interface,
  };
};

export const createMockInvalidStarknetAgent = (): StarknetAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050' });
  const twitter_interface = {};
  const telegram_interface: TelegramInterface = {};
  const json_config = undefined;
  const twitter_auth_mode = undefined;

  return {
    getAccountCredentials: () => ({
      accountPublicKey: 'dlksjflkdsjf',
      accountPrivateKey: 'dsfahdskfgdsjkah',
    }),
    getModelCredentials: () => ({
      aiModel: '',
      aiProviderApiKey: '',
    }),
    getSignature: () => ({
      signature: '',
    }),
    getProvider: () => provider,
    accountManager: new AccountManager(provider),
    transactionMonitor: new TransactionMonitor(provider),
    contractInteractor: new ContractInteractor(provider),
    getTwitterAuthMode: () => twitter_auth_mode,
    getAgentConfig: () => json_config,
    getTwitterManager: () => twitter_interface,
    getTelegramManager: () => telegram_interface,
  };
};
