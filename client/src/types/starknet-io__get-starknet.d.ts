// Declaration file for @starknet-io/get-starknet

declare module '@starknet-io/get-starknet' {
  import { ConnectedStarknetWindowObject } from 'starknet';

  export interface ConnectOptions {
    modalOptions?: {
      theme?: 'light' | 'dark' | 'system';
      modalWalletListOptions?: {
        showPreAuthorizedWalletsFirst?: boolean;
        showAllWallets?: boolean;
      };
    };
    modalMode?: 'alwaysAsk' | 'silentMode';
    modalTheme?: 'light' | 'dark' | 'system';
    starknetVersion?: 'v4' | 'v5';
  }

  export function connect(
    options?: ConnectOptions
  ): Promise<ConnectedStarknetWindowObject>;
  export function disconnect(options?: {
    clearLastWallet?: boolean;
  }): Promise<void>;
}

declare module '@starknet-io/get-starknet-core' {
  import {
    StarknetWindowObject,
    ConnectedStarknetWindowObject,
  } from 'starknet';

  export interface GetWalletOptions {
    include?: string[];
    exclude?: string[];
  }

  export interface WalletProvider {
    id: string;
    name: string;
    icon: string;
    downloads?: {
      chrome?: string;
      firefox?: string;
      edge?: string;
      opera?: string;
      brave?: string;
      mobile?: string;
    };
  }

  export function getAvailableWallets(
    options?: GetWalletOptions
  ): Promise<StarknetWindowObject[]>;
  export function getPreAuthorizedWallets(
    options?: GetWalletOptions
  ): Promise<StarknetWindowObject[]>;
  export function getDiscoveryWallets(
    options?: GetWalletOptions
  ): Promise<WalletProvider[]>;
  export function getLastConnectedWallet(): Promise<StarknetWindowObject | null>;
  export function enable(
    wallet: StarknetWindowObject,
    options?: {
      starknetVersion?: 'v4' | 'v5';
    }
  ): Promise<ConnectedStarknetWindowObject>;
  export function disconnect(options?: {
    clearLastWallet?: boolean;
  }): Promise<void>;
}
