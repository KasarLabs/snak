interface Account {
  privateKey: string;
  publicAddress: string;
}

interface TestAccounts {
  account1: Account;
  account2: Account;
  account3: Account;
}

interface EnvConfig {
  STARKNET_RPC_URL: string;
  accounts: TestAccounts;
}

export const loadTestConfig = (): EnvConfig => {
  const config: EnvConfig = {
    STARKNET_RPC_URL: 'http://127.0.0.1:5050',
    accounts: {
      account1: {
        privateKey:
          '0x00000000000000000000000000000000b137668388dbe9acdfa3bc734cc2c469',
        publicAddress:
          '0x034ba56f92265f0868c57d3fe72ecab144fc96f97954bbbc4252cef8e8a979ba',
      },
      account2: {
        privateKey:
          '0x00000000000000000000000000000000e8c2801d899646311100a661d32587aa',
        publicAddress:
          '0x02939f2dc3f80cc7d620e8a86f2e69c1e187b7ff44b74056647368b5c49dc370',
      },
      account3: {
        privateKey:
          '0x000000000000000000000000000000007b2e5d0e627be6ce12ddc6fd0f5ff2fb',
        publicAddress:
          '0x025a6c9f0c15ef30c139065096b4b8e563e6b86191fd600a4f0616df8f22fb77',
      },
    },
  };

  return config;
};

export const setupTestEnvironment = () => {
  const config = loadTestConfig();

  process.env.STARKNET_RPC_URL = config.STARKNET_RPC_URL;

  process.env.STARKNET_PRIVATE_KEY = config.accounts.account1.privateKey;
  process.env.STARKNET_PUBLIC_ADDRESS = config.accounts.account1.publicAddress;

  process.env.STARKNET_PRIVATE_KEY_2 = config.accounts.account2.privateKey;
  process.env.STARKNET_PUBLIC_ADDRESS_2 =
    config.accounts.account2.publicAddress;

  process.env.STARKNET_PRIVATE_KEY_3 = config.accounts.account3.privateKey;
  process.env.STARKNET_PUBLIC_ADDRESS_3 =
    config.accounts.account3.publicAddress;
};
