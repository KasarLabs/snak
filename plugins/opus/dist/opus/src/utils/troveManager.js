"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTroveManager = exports.TroveManager = void 0;
const starknet_1 = require("starknet");
const ethers_1 = require("ethers");
const schemas_1 = require("../schemas");
const contracts_1 = require("./contracts");
const erc20_1 = require("../../../token/src/constants/erc20");
const FORGE_FEE_PAID_EVENT_IDENTIFIER = 'opus::core::shrine::shrine::ForgeFeePaid';
const TROVE_OPENED_EVENT_IDENTIFIER = 'opus::core::abbot::abbot::TroveOpened';
class TroveManager {
    constructor(agent, walletAddress) {
        this.agent = agent;
        this.walletAddress = walletAddress;
    }
    async initialize() {
        const chainId = await this.agent.getProvider().getChainId();
        this.shrine = (0, contracts_1.getShrineContract)(chainId);
        this.abbot = (0, contracts_1.getAbbotContract)(chainId);
        this.sentinel = (0, contracts_1.getSentinelContract)(chainId);
        this.yangs = (await this.sentinel.get_yang_addresses()).map((yang) => starknet_1.num.toBigInt(yang));
    }
    async getUserTroves(params) {
        await this.initialize();
        try {
            const troves = await this.abbot.get_user_trove_ids(params.user);
            const formattedTroves = troves.map((troveId) => {
                return troveId.toString();
            });
            const getUserTrovesResult = {
                status: 'success',
                troves: formattedTroves,
            };
            return getUserTrovesResult;
        }
        catch (error) {
            console.error('Detailed get user troves error:', error);
            if (error instanceof Error) {
                console.error('Error type:', error.constructor.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            return {
                status: 'failure',
            };
        }
    }
    async getBorrowFee() {
        await this.initialize();
        try {
            const borrowFee = schemas_1.wadSchema.safeParse(await this.shrine.get_forge_fee_pct());
            const borrowFeePct = (0, ethers_1.formatUnits)(borrowFee.data.value, 16);
            const getBorrowFeeResult = {
                status: 'success',
                borrow_fee: `${borrowFeePct}%`,
            };
            return getBorrowFeeResult;
        }
        catch (error) {
            console.error('Detailed get borrow fee error:', error);
            if (error instanceof Error) {
                console.error('Error type:', error.constructor.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            return {
                status: 'failure',
            };
        }
    }
    async getTroveHealth(params) {
        await this.initialize();
        try {
            const troveHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
            const getTroveHealthResult = {
                status: 'success',
                debt: troveHealth.data?.debt.formatted,
                value: troveHealth.data?.value.formatted,
                ltv: troveHealth.data?.ltv.formatted,
                threshold: troveHealth.data?.threshold.formatted,
            };
            return getTroveHealthResult;
        }
        catch (error) {
            console.error('Detailed get trove health error:', error);
            if (error instanceof Error) {
                console.error('Error type:', error.constructor.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            return {
                status: 'failure',
            };
        }
    }
    getBorrowFeeFromEvent(txReceipt) {
        const shrineEvents = this.shrine.parseEvents(txReceipt);
        const forgeFeePaidEvent = schemas_1.forgeFeePaidEventSchema.safeParse(shrineEvents.find((event) => FORGE_FEE_PAID_EVENT_IDENTIFIER in event)[FORGE_FEE_PAID_EVENT_IDENTIFIER]);
        return [
            forgeFeePaidEvent.data.fee.formatted,
            forgeFeePaidEvent.data.fee_pct.formatted,
        ];
    }
    async parseMaxBorrowFeePctWithCheck(borrowFeePct) {
        const maxBorrowFeePct = (0, ethers_1.parseUnits)(borrowFeePct.slice(0, -1), 16);
        const currentBorrowFeePct = schemas_1.wadSchema.safeParse(await this.shrine.get_forge_fee_pct());
        if (maxBorrowFeePct < currentBorrowFeePct.data.value) {
            throw new Error(`Max borrow fee of ${borrowFeePct} is lower than current: ${currentBorrowFeePct.data.formatted}%`);
        }
        return maxBorrowFeePct;
    }
    async parseAssetBalanceInput(assetBalanceInput) {
        const collateralAddress = erc20_1.tokenAddresses[assetBalanceInput.symbol];
        if (collateralAddress === undefined) {
            throw new Error(`Unknown token symbol ${assetBalanceInput.symbol}`);
        }
        if (!this.yangs.includes(starknet_1.num.toBigInt(collateralAddress))) {
            throw new Error(`${collateralAddress} is not a valid collateral`);
        }
        const asset = (0, contracts_1.getErc20Contract)(collateralAddress);
        const collateralDecimals = await asset.decimals();
        const collateralAmount = (0, ethers_1.parseUnits)(assetBalanceInput.amount, collateralDecimals);
        const assetBalance = {
            address: collateralAddress,
            amount: collateralAmount,
        };
        return assetBalance;
    }
    async prepareCollateralDeposits(collaterals) {
        const assetBalances = [];
        const approveAssetsCalls = [];
        await Promise.all(collaterals.map(async (collateral) => {
            const assetBalance = await this.parseAssetBalanceInput(collateral);
            assetBalances.push(assetBalance);
            const asset = (0, contracts_1.getErc20Contract)(assetBalance.address);
            const gate = await this.sentinel.get_gate_address(assetBalance.address);
            const approveCall = asset.populateTransaction.approve(gate, assetBalance.amount);
            approveAssetsCalls.push({
                contractAddress: approveCall.contractAddress,
                entrypoint: approveCall.entrypoint,
                calldata: approveCall.calldata,
            });
        }));
        return [assetBalances, approveAssetsCalls];
    }
    async openTroveTransaction(params, agent) {
        await this.initialize();
        try {
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const [assetBalances, approveAssetsCalls] = await this.prepareCollateralDeposits(params.collaterals);
            const borrowAmount = (0, ethers_1.parseUnits)(params.borrowAmount, 18);
            const maxBorrowFeePct = await this.parseMaxBorrowFeePctWithCheck(params.maxBorrowFeePct);
            const openTroveCall = await this.abbot.populateTransaction.open_trove(assetBalances, { val: borrowAmount }, { val: maxBorrowFeePct });
            const tx = await account.execute([
                ...approveAssetsCalls,
                {
                    contractAddress: openTroveCall.contractAddress,
                    entrypoint: openTroveCall.entrypoint,
                    calldata: openTroveCall.calldata,
                },
            ]);
            const provider = agent.getProvider();
            const txReceipt = await provider.waitForTransaction(tx.transaction_hash);
            let troveId;
            let borrowFeePaid;
            let borrowFeePct;
            if (txReceipt.isSuccess()) {
                const abbotEvents = this.abbot.parseEvents(txReceipt);
                const troveOpenedEvent = abbotEvents.find((event) => TROVE_OPENED_EVENT_IDENTIFIER in event)[TROVE_OPENED_EVENT_IDENTIFIER];
                const parsedTroveOpenedEvent = schemas_1.troveOpenedEventSchema.safeParse(troveOpenedEvent);
                troveId = parsedTroveOpenedEvent.data.trove_id.toString();
                [borrowFeePaid, borrowFeePct] = this.getBorrowFeeFromEvent(txReceipt);
            }
            const openTroveResult = {
                status: 'success',
                trove_id: troveId,
                borrow_fee: borrowFeePaid,
                borrow_fee_pct: borrowFeePct,
                transaction_hash: tx.transaction_hash,
            };
            return openTroveResult;
        }
        catch (error) {
            console.error('Detailed open trove error:', error);
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
    async depositTransaction(params, agent) {
        await this.initialize();
        try {
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const [assetBalances, approveAssetsCalls] = await this.prepareCollateralDeposits([params.collateral]);
            const depositCall = await this.abbot.populateTransaction.deposit(params.troveId, assetBalances[0]);
            const beforeHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
            const tx = await account.execute([
                ...approveAssetsCalls,
                {
                    contractAddress: depositCall.contractAddress,
                    entrypoint: depositCall.entrypoint,
                    calldata: depositCall.calldata,
                },
            ]);
            const provider = agent.getProvider();
            const txReceipt = await provider.waitForTransaction(tx.transaction_hash);
            let afterHealth;
            if (txReceipt.isSuccess()) {
                afterHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
            }
            const depositResult = {
                status: 'success',
                trove_id: params.troveId.toString(),
                before_value: beforeHealth.data?.value.formatted,
                after_value: afterHealth?.data?.value.formatted,
                before_ltv: beforeHealth.data?.ltv.formatted,
                after_ltv: afterHealth?.data?.ltv.formatted,
                transaction_hash: tx.transaction_hash,
            };
            return depositResult;
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
    async withdrawTransaction(params, agent) {
        await this.initialize();
        try {
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const assetBalance = await this.parseAssetBalanceInput(params.collateral);
            const depositCall = await this.abbot.populateTransaction.withdraw(params.troveId, assetBalance);
            const beforeHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
            const tx = await account.execute([
                {
                    contractAddress: depositCall.contractAddress,
                    entrypoint: depositCall.entrypoint,
                    calldata: depositCall.calldata,
                },
            ]);
            const provider = agent.getProvider();
            const txReceipt = await provider.waitForTransaction(tx.transaction_hash);
            let afterHealth;
            if (txReceipt.isSuccess()) {
                afterHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
            }
            const withdrawResult = {
                status: 'success',
                trove_id: params.troveId.toString(),
                before_value: beforeHealth.data?.value.formatted,
                after_value: afterHealth?.data?.value.formatted,
                before_ltv: beforeHealth.data?.ltv.formatted,
                after_ltv: afterHealth?.data?.ltv.formatted,
                transaction_hash: tx.transaction_hash,
            };
            return withdrawResult;
        }
        catch (error) {
            console.error('Detailed withdraw error:', error);
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
    async borrowTransaction(params, agent) {
        await this.initialize();
        try {
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const borrowAmount = (0, ethers_1.parseUnits)(params.amount, 18);
            const maxBorrowFeePct = await this.parseMaxBorrowFeePctWithCheck(params.maxBorrowFeePct);
            const borrowCall = await this.abbot.populateTransaction.forge(params.troveId, { val: borrowAmount }, { val: maxBorrowFeePct });
            const beforeHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
            const tx = await account.execute([
                {
                    contractAddress: borrowCall.contractAddress,
                    entrypoint: borrowCall.entrypoint,
                    calldata: borrowCall.calldata,
                },
            ]);
            const provider = agent.getProvider();
            const txReceipt = await provider.waitForTransaction(tx.transaction_hash);
            let afterHealth;
            let borrowFeePaid;
            let borrowFeePct;
            if (txReceipt.isSuccess()) {
                afterHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
                [borrowFeePaid, borrowFeePct] = this.getBorrowFeeFromEvent(txReceipt);
            }
            const borrowResult = {
                status: 'success',
                trove_id: params.troveId.toString(),
                amount: borrowAmount.toString(),
                borrow_fee: borrowFeePaid,
                borrow_fee_pct: borrowFeePct,
                before_debt: beforeHealth.data?.debt.formatted,
                after_debt: afterHealth?.data?.debt.formatted,
                before_ltv: beforeHealth.data?.ltv.formatted,
                after_ltv: afterHealth?.data?.ltv.formatted,
                transaction_hash: tx.transaction_hash,
            };
            return borrowResult;
        }
        catch (error) {
            console.error('Detailed borrow error:', error);
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
    async repayTransaction(params, agent) {
        await this.initialize();
        try {
            const account = new starknet_1.Account(this.agent.contractInteractor.provider, this.walletAddress, this.agent.getAccountCredentials().accountPrivateKey);
            const repayAmount = (0, ethers_1.parseUnits)(params.amount, 18);
            const repayCall = await this.abbot.populateTransaction.melt(params.troveId, { val: repayAmount });
            const beforeHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
            const tx = await account.execute([
                {
                    contractAddress: repayCall.contractAddress,
                    entrypoint: repayCall.entrypoint,
                    calldata: repayCall.calldata,
                },
            ]);
            const provider = agent.getProvider();
            const txReceipt = await provider.waitForTransaction(tx.transaction_hash);
            let afterHealth;
            if (txReceipt.isSuccess()) {
                afterHealth = schemas_1.healthSchema.safeParse(await this.shrine.get_trove_health(params.troveId));
            }
            const repayResult = {
                status: 'success',
                trove_id: params.troveId.toString(),
                amount: repayAmount.toString(),
                before_debt: beforeHealth.data?.debt.formatted,
                after_debt: afterHealth?.data?.debt.formatted,
                before_ltv: beforeHealth.data?.ltv.formatted,
                after_ltv: afterHealth?.data?.ltv.formatted,
                transaction_hash: tx.transaction_hash,
            };
            return repayResult;
        }
        catch (error) {
            console.error('Detailed repay error:', error);
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
exports.TroveManager = TroveManager;
const createTroveManager = (agent, walletAddress) => {
    if (!walletAddress) {
        throw new Error('Wallet address not configured');
    }
    const service = new TroveManager(agent, walletAddress);
    return service;
};
exports.createTroveManager = createTroveManager;
//# sourceMappingURL=troveManager.js.map