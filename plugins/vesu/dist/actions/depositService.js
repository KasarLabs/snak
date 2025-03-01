"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.depositEarnPosition = exports.createDepositEarnService = exports.DepositEarnService = void 0;
const starknet_1 = require("starknet");
const zod_1 = require("zod");
const ethers_1 = require("ethers");
const interfaces_1 = require("../interfaces");
const index_1 = require("../constants/index");
const num_1 = require("../utils/num");
const contracts_1 = require("../utils/contracts");
class DepositEarnService {
    constructor(agent, walletAddress) {
        this.agent = agent;
        this.walletAddress = walletAddress;
    }
    async getTokenPrice(token, poolId, poolExtension) {
        const contract = (0, contracts_1.getExtensionContract)(poolExtension);
        try {
            const res = await contract.price(poolId, token.address);
            return res.is_valid && res.value
                ? { value: (0, num_1.toBN)(res.value), decimals: index_1.DEFAULT_DECIMALS }
                : undefined;
        }
        catch (err) {
            console.log('error', err);
            return undefined;
        }
    }
    async getPoolAssetsPrice(poolId, poolExtensionContractAddress, poolAssets) {
        return await Promise.all(poolAssets.map(async (asset) => {
            const [usdPrice] = await Promise.all([
                this.getTokenPrice(asset, poolId, poolExtensionContractAddress),
            ]);
            return {
                ...asset,
                usdPrice,
            };
        }));
    }
    async getPoolAssetsPriceAndRiskMdx(poolId, poolExtensionContractAddress, poolAssets) {
        return await Promise.all(poolAssets.map(async (asset) => {
            const [usdPrice, riskMdx] = await Promise.all([
                this.getTokenPrice(asset, poolId, poolExtensionContractAddress),
                Promise.resolve(undefined),
            ]);
            return {
                ...asset,
                risk: null,
                usdPrice,
            };
        }));
    }
    async getPool(poolId) {
        const data = await fetch(`${index_1.VESU_API_URL}/pools/${poolId}`).then((res) => res.json());
        const pool = zod_1.z
            .object({ data: interfaces_1.poolParser })
            .transform(({ data }) => data)
            .parse(data);
        const assets = await this.getPoolAssetsPriceAndRiskMdx(pool.id, pool.extensionContractAddress, pool.assets);
        return { ...pool, assets };
    }
    async approveVTokenCalls(assetAddress, vTokenAddress, amount) {
        const tokenContract = (0, contracts_1.getErc20Contract)(assetAddress);
        const approveCall = tokenContract.populateTransaction.approve(vTokenAddress, amount);
        return approveCall;
    }
    async depositEarnTransaction(params, agent) {
        try {
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const pool = await this.getPool(index_1.GENESIS_POOLID);
            const collateralPoolAsset = pool.assets.find((a) => a.symbol.toLocaleUpperCase() ===
                params.depositTokenSymbol.toLocaleUpperCase());
            if (!collateralPoolAsset) {
                throw new Error('Collateral asset not found in pool');
            }
            console.log('params.depositAmount:', params.depositAmount);
            const collateralAmount = (0, ethers_1.parseUnits)(params.depositAmount, collateralPoolAsset.decimals);
            const vtokenContract = (0, contracts_1.getVTokenContract)(collateralPoolAsset.vToken.address);
            const vTokenApproveCall = await this.approveVTokenCalls(collateralPoolAsset.address, collateralPoolAsset.vToken.address, collateralAmount);
            const depositVTokenCall = await vtokenContract.populateTransaction.deposit((0, num_1.toU256)(collateralAmount), account.address);
            const credentials = agent.getAccountCredentials();
            const provider = agent.getProvider();
            const wallet = new starknet_1.Account(provider, credentials.accountPublicKey, credentials.accountPrivateKey);
            const tx = await account.execute([
                {
                    contractAddress: vTokenApproveCall.contractAddress,
                    entrypoint: vTokenApproveCall.entrypoint,
                    calldata: vTokenApproveCall.calldata,
                },
                {
                    contractAddress: depositVTokenCall.contractAddress,
                    entrypoint: depositVTokenCall.entrypoint,
                    calldata: depositVTokenCall.calldata,
                },
            ]);
            console.log('approval initiated. Transaction hash:', tx.transaction_hash);
            await provider.waitForTransaction(tx.transaction_hash);
            const transferResult = {
                status: 'success',
                amount: params.depositAmount,
                symbol: params.depositTokenSymbol,
                recipients_address: account.address,
                transaction_hash: tx.transaction_hash,
            };
            return transferResult;
        }
        catch (error) {
            console.error('Detailed deposit error:', error);
            if (error instanceof Error) {
                console.error('Error type:', error.constructor.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            return {
                status: 'failure',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
exports.DepositEarnService = DepositEarnService;
const createDepositEarnService = (agent, walletAddress) => {
    if (!walletAddress) {
        throw new Error('Wallet address not configured');
    }
    return new DepositEarnService(agent, walletAddress);
};
exports.createDepositEarnService = createDepositEarnService;
const depositEarnPosition = async (agent, params) => {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
    try {
        const depositEarnService = (0, exports.createDepositEarnService)(agent, accountAddress);
        const result = await depositEarnService.depositEarnTransaction(params, agent);
        return JSON.stringify(result);
    }
    catch (error) {
        console.error('Detailed deposit error:', error);
        if (error instanceof Error) {
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.depositEarnPosition = depositEarnPosition;
//# sourceMappingURL=depositService.js.map