import { constants, Contract, RpcProvider } from 'starknet';
import { abbotAbi } from '../abis/abbotAbi';
import { erc20Abi } from '../abis/erc20Abi';
import { shrineAbi } from '../abis/shrineAbi';
import { sentinelAbi } from '../abis/sentinelAbi';
import { getOpusContractAddress } from '../constants';

export const getErc20Contract = (address: string) => {
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  return new Contract(erc20Abi, address, provider).typedv2(erc20Abi);
};

export const getAbbotContract = (chainId: constants.StarknetChainId) => {
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  const address = getOpusContractAddress({ chainId, contractName: 'abbot' });
  return new Contract(abbotAbi, address, provider).typedv2(abbotAbi);
};

export const getSentinelContract = (chainId: constants.StarknetChainId) => {
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  const address = getOpusContractAddress({ chainId, contractName: 'sentinel' });
  return new Contract(sentinelAbi, address, provider).typedv2(sentinelAbi);
};

export const getShrineContract = (chainId: constants.StarknetChainId) => {
  const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
  const address = getOpusContractAddress({ chainId, contractName: 'shrine' });
  return new Contract(shrineAbi, address, provider).typedv2(shrineAbi);
};
