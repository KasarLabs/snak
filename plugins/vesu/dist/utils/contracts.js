"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExtensionContract = exports.getSingletonContract = exports.getVTokenContract = exports.getErc20Contract = void 0;
const starknet_1 = require("starknet");
const vTokenAbi_1 = require("../abis/vTokenAbi");
const singletonAbi_1 = require("../abis/singletonAbi");
const extensionAbi_1 = require("../abis/extensionAbi");
const erc20Abi_1 = require("../abis/erc20Abi");
const getErc20Contract = (address) => {
    const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    return new starknet_1.Contract(erc20Abi_1.erc20Abi, address, provider).typedv2(erc20Abi_1.erc20Abi);
};
exports.getErc20Contract = getErc20Contract;
const getVTokenContract = (address) => {
    const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    return new starknet_1.Contract(vTokenAbi_1.vTokenAbi, address, provider).typedv2(vTokenAbi_1.vTokenAbi);
};
exports.getVTokenContract = getVTokenContract;
const getSingletonContract = (address) => {
    const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    return new starknet_1.Contract(singletonAbi_1.singletonAbi, address, provider).typedv2(singletonAbi_1.singletonAbi);
};
exports.getSingletonContract = getSingletonContract;
const getExtensionContract = (address) => {
    const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    return new starknet_1.Contract(extensionAbi_1.extensionAbi, address, provider).typedv2(extensionAbi_1.extensionAbi);
};
exports.getExtensionContract = getExtensionContract;
//# sourceMappingURL=contracts.js.map