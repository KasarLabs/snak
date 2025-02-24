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
    STARKNET_RPC_URL: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/twNPk5lDPh5t6m0WV6eoXdAD2VfIN0-b',
    accounts: {
      account1: {
        privateKey:
          '0x07167da24fa2d77abebc915',
        publicAddress:
          '0x06889CE7127025749Ab8c2F63c4ba26f972b16530B9aCee3255e59055c0B8CFd',
      },
      account2: {
        privateKey:
          '0x0391d8914c062b82ff2d2',
        publicAddress:
          '0x023663bBA9C5Ff71586301a9fB8aB6DAFFb23F8132941ccb6EBdc45DE1Aa3cB3',
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
