import { Contract, RpcProvider } from 'starknet';
import { Address } from '../../../vesu/interfaces/interface';
import { vTokenAbi } from 'src/lib/agent/method/vesu/abi/vTokenAbi';
import { singletonAbi } from 'src/lib/agent/method/vesu/abi/singletonAbi';
import { extensionAbi } from 'src/lib/agent/method/vesu/abi/extensionAbi';
import { erc20Abi } from 'src/lib/agent/method/vesu/abi/erc20Abi';

export const getErc20Contract = (address: Address) => {
  const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL });
  return new Contract(erc20Abi, address, provider).typedv2(erc20Abi);
};
export const getVTokenContract = (address: Address) => {
  const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL });
  return new Contract(vTokenAbi, address, provider).typedv2(vTokenAbi);
};

export const getSingletonContract = (address: Address) => {
  const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL });
  return new Contract(singletonAbi, address, provider).typedv2(singletonAbi);
};
export const getExtensionContract = (address: Address) => {
  const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL });
  return new Contract(extensionAbi, address, provider).typedv2(extensionAbi);
};
