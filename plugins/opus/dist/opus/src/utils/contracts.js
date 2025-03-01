"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShrineContract = exports.getSentinelContract = exports.getAbbotContract = exports.getErc20Contract = void 0;
const starknet_1 = require("starknet");
const abbotAbi_1 = require("../abis/abbotAbi");
const erc20Abi_1 = require("../abis/erc20Abi");
const shrineAbi_1 = require("../abis/shrineAbi");
const sentinelAbi_1 = require("../abis/sentinelAbi");
const constants_1 = require("../constants");
const getErc20Contract = (address) => {
    const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    return new starknet_1.Contract(erc20Abi_1.erc20Abi, address, provider).typedv2(erc20Abi_1.erc20Abi);
};
exports.getErc20Contract = getErc20Contract;
const getAbbotContract = (chainId) => {
    const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const address = (0, constants_1.getOpusContractAddress)({ chainId, contractName: 'abbot' });
    return new starknet_1.Contract(abbotAbi_1.abbotAbi, address, provider).typedv2(abbotAbi_1.abbotAbi);
};
exports.getAbbotContract = getAbbotContract;
const getSentinelContract = (chainId) => {
    const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const address = (0, constants_1.getOpusContractAddress)({ chainId, contractName: 'sentinel' });
    return new starknet_1.Contract(sentinelAbi_1.sentinelAbi, address, provider).typedv2(sentinelAbi_1.sentinelAbi);
};
exports.getSentinelContract = getSentinelContract;
const getShrineContract = (chainId) => {
    const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const address = (0, constants_1.getOpusContractAddress)({ chainId, contractName: 'shrine' });
    return new starknet_1.Contract(shrineAbi_1.shrineAbi, address, provider).typedv2(shrineAbi_1.shrineAbi);
};
exports.getShrineContract = getShrineContract;
//# sourceMappingURL=contracts.js.map