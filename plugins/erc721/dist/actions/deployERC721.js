"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployERC721Contract = void 0;
const starknet_1 = require("starknet");
const contractManager_1 = require("../utils/contractManager");
const constant_1 = require("../constant/constant");
const deploy_1 = require("../abis/deploy");
const deployERC721Contract = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const account = new starknet_1.Account(provider, accountCredentials?.accountPublicKey, accountCredentials?.accountPrivateKey);
        const contractManager = new contractManager_1.ContractManager(account);
        const response = await contractManager.deployContract(constant_1.ERC721_CLASSHASH, deploy_1.DEPLOY_ERC721_ABI, {
            name: params.name,
            symbol: params.symbol,
            base_uri: params.baseUri,
            total_supply: params.totalSupply,
            recipient: accountCredentials?.accountPublicKey,
        });
        return JSON.stringify({
            status: 'success',
            transactionHash: response.transactionHash,
            contractAddress: response.contractAddress,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.deployERC721Contract = deployERC721Contract;
//# sourceMappingURL=deployERC721.js.map