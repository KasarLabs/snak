import { Contract, RpcProvider } from 'starknet';
import { Address } from '../interfaces/index.js';
import { vTokenAbi } from '../abis/vTokenAbi.js';
import { singletonAbi } from '../abis/singletonAbi.js';
import { extensionAbi } from '../abis/extensionAbi.js';
import { erc20Abi } from '../abis/erc20Abi.js';

export const getErc20Contract = (address: Address) => {
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  return new Contract(erc20Abi, address, provider).typedv2(erc20Abi);
};
export const getVTokenContract = (address: Address) => {
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  return new Contract(vTokenAbi, address, provider).typedv2(vTokenAbi);
};

export const getSingletonContract = (address: Address) => {
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  return new Contract(singletonAbi, address, provider).typedv2(singletonAbi);
};
export const getExtensionContract = (address: Address) => {
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  return new Contract(extensionAbi, address, provider).typedv2(extensionAbi);
};
