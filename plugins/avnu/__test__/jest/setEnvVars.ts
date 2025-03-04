import { setupTestEnvironment } from '../utils/helper';
import { RpcProvider } from 'starknet';
import {
  StarknetAgentInterface,
  TransactionMonitor,
  ContractInteractor,
  TelegramInterface,
  TwitterInterface,
} from '@starknet-agent-kit/agents';

setupTestEnvironment();

export const createMockStarknetAgent = (): StarknetAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_7/Xj-rCxxzGcBnS3HwqOnBqO8TMa8NRGky' });
  const twitter_interface: TwitterInterface = {};
  const telegram_interface: TelegramInterface = {};
  const json_config = undefined;
  const twitter_auth_mode = undefined;

  return {
    getAccountCredentials: () => ({
      accountPublicKey:
        '0x049D0c2F881f9c8A7eE2a02fa46d681f8aca944d7f77E7d8A56ED6416d0a391c',
      accountPrivateKey:
        '0x051db6daaa54875ed46acebacecb600f3374d4cc4dc154021a1facba6f4c9b90',
    }),
    getModelCredentials: () => ({
      aiModel: '',
      aiProviderApiKey: '',
    }),
    getSignature: () => ({
      signature: '',
    }),
    getProvider: () => provider,
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
  const twitter_interface: TwitterInterface = {};
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
    transactionMonitor: new TransactionMonitor(provider),
    contractInteractor: new ContractInteractor(provider),
    getTwitterAuthMode: () => twitter_auth_mode,
    getAgentConfig: () => json_config,
    getTwitterManager: () => twitter_interface,
    getTelegramManager: () => telegram_interface,
  };
};
