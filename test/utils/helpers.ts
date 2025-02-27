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
    STARKNET_RPC_URL: '',
    accounts: {
      account1: {
        privateKey:
          '',
        publicAddress:
          '0x06889CE7127025749Ab8c2F63c4ba26f972b16530B9aCee3255e59055c0B8CFd',
      },
      account2: {
        privateKey:
          '',
        publicAddress:
          '0x023663bBA9C5Ff71586301a9fB8aB6DAFFb23F8132941ccb6EBdc45DE1Aa3cB3',
      },
      account3: {
        privateKey:
          '0x00000000000000000000000000000000a20a02f0ac53692d144b20cb371a60d7',
        publicAddress:
          '0x049dfb8ce986e21d354ac93ea65e6a11f639c1934ea253e5ff14ca62eca0f38e',
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
