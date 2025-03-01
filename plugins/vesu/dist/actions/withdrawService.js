"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawEarnPosition = exports.withdrawService = exports.WithdrawEarnService = void 0;
const starknet_1 = require("starknet");
const zod_1 = require("zod");
const interfaces_1 = require("../interfaces");
const index_1 = require("../constants/index");
const num_1 = require("../utils/num");
const contracts_1 = require("../utils/contracts");
class WithdrawEarnService {
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
    async getTokenBalance(baseToken, walletAddress) {
        const tokenContract = (0, contracts_1.getErc20Contract)(baseToken.address);
        return await tokenContract
            .balanceOf(walletAddress)
            .then(num_1.toBN)
            .catch((err) => {
            console.error(new Error(`Failed to get balance of ${baseToken.address}`));
            return 0n;
        });
    }
    async approveVTokenCalls(assetAddress, vTokenAddress, amount) {
        const tokenContract = (0, contracts_1.getErc20Contract)(assetAddress);
        const approveCall = tokenContract.populateTransaction.approve(vTokenAddress, amount);
        return approveCall;
    }
    async withdrawEarnTransaction(params, agent) {
        try {
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const pool = await this.getPool(index_1.GENESIS_POOLID);
            const collateralPoolAsset = pool.assets.find((a) => a.symbol.toLocaleUpperCase() ===
                params.withdrawTokenSymbol.toLocaleUpperCase());
            if (!collateralPoolAsset) {
                throw new Error('Collateral asset not found in pool');
            }
            console.log('collateralPoolAsset.decimals===', collateralPoolAsset.decimals);
            const vtokenContract = (0, contracts_1.getVTokenContract)(collateralPoolAsset.vToken.address);
            const vTokenShares = await this.getTokenBalance(collateralPoolAsset.vToken, account.address);
            const credentials = agent.getAccountCredentials();
            const provider = agent.getProvider();
            const wallet = new starknet_1.Account(provider, credentials.accountPublicKey, credentials.accountPrivateKey);
            const redeemVTokenCall = await vtokenContract.populateTransaction.redeem((0, num_1.toU256)(vTokenShares), account.address, account.address);
            const tx = await wallet.execute([
                {
                    contractAddress: redeemVTokenCall.contractAddress,
                    entrypoint: redeemVTokenCall.entrypoint,
                    calldata: redeemVTokenCall.calldata,
                },
            ]);
            console.log('approval initiated. Transaction hash:', tx.transaction_hash);
            await provider.waitForTransaction(tx.transaction_hash);
            const transferResult = {
                status: 'success',
                symbol: params.withdrawTokenSymbol,
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
exports.WithdrawEarnService = WithdrawEarnService;
const withdrawService = (agent, walletAddress) => {
    if (!walletAddress) {
        throw new Error('Wallet address not configured');
    }
    return new WithdrawEarnService(agent, walletAddress);
};
exports.withdrawService = withdrawService;
const withdrawEarnPosition = async (agent, params) => {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
    console.log('hello withdraw', accountAddress);
    try {
        const withdrawEarn = (0, exports.withdrawService)(agent, accountAddress);
        const result = await withdrawEarn.withdrawEarnTransaction(params, agent);
        return JSON.stringify(result);
    }
    catch (error) {
        console.error('Detailed withdraw error:', error);
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
exports.withdrawEarnPosition = withdrawEarnPosition;
//# sourceMappingURL=withdrawService.js.map