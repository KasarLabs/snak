"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transfer_signature = exports.transfer = void 0;
const starknet_1 = require("starknet");
const erc20_1 = require("../constants/erc20");
const DECIMALS = {
    USDC: 6,
    USDT: 6,
    DEFAULT: 18,
};
const formatTokenAmount = (amount, decimals) => {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0');
    return whole + paddedFraction;
};
const transfer = async (agent, payloads) => {
    try {
        const credentials = agent.getAccountCredentials();
        const provider = agent.getProvider();
        const account = new starknet_1.Account(provider, credentials.accountPublicKey, credentials.accountPrivateKey);
        const tokenAddress = erc20_1.tokenAddresses[payloads.symbol];
        if (!tokenAddress) {
            throw new Error(`Token ${payloads.symbol} not supported`);
        }
        const decimals = DECIMALS[payloads.symbol] || DECIMALS.DEFAULT;
        const formattedAmount = formatTokenAmount(payloads.amount, decimals);
        const amountUint256 = starknet_1.uint256.bnToUint256(formattedAmount);
        const result = await account.execute({
            contractAddress: tokenAddress,
            entrypoint: 'transfer',
            calldata: [
                payloads.recipient_address,
                amountUint256.low,
                amountUint256.high,
            ],
        });
        console.log('transfer initiated. Transaction hash:', result.transaction_hash);
        await provider.waitForTransaction(result.transaction_hash);
        const transferResult = {
            status: 'success',
            amount: payloads.amount,
            symbol: payloads.symbol,
            recipients_address: payloads.recipient_address,
            transaction_hash: result.transaction_hash,
        };
        return JSON.stringify(transferResult);
    }
    catch (error) {
        console.error('transfer failed:', error);
        const transferResult = {
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
            step: 'transfer execution',
        };
        const result = JSON.stringify(transferResult);
        return result;
    }
};
exports.transfer = transfer;
const transfer_signature = async (input) => {
    try {
        const payloads = input.payloads;
        if (!Array.isArray(payloads)) {
            throw new Error('Payloads is not an Array');
        }
        const results = await Promise.all(payloads.map(async (payload) => {
            const tokenAddress = erc20_1.tokenAddresses[payload.symbol];
            if (!tokenAddress) {
                return {
                    status: 'error',
                    error: {
                        code: 'TOKEN_NOT_SUPPORTED',
                        message: `Token ${payload.symbol} not supported`,
                    },
                };
            }
            const decimals = DECIMALS[payload.symbol] || DECIMALS.DEFAULT;
            const formattedAmount = formatTokenAmount(payload.amount, decimals);
            const amountUint256 = starknet_1.uint256.bnToUint256(formattedAmount);
            return {
                status: 'success',
                transactions: {
                    contractAddress: tokenAddress,
                    entrypoint: 'transfer',
                    calldata: [
                        payload.recipient_address,
                        amountUint256.low,
                        amountUint256.high,
                    ],
                },
            };
        }));
        console.log('Results :', results);
        return JSON.stringify({ transaction_type: 'INVOKE', results });
    }
    catch (error) {
        console.error('Transfer call data failure:', error);
        return {
            status: 'error',
            error: {
                code: 'TRANSFER_CALL_DATA_ERROR',
                message: error.message || 'Failed to generate transfer call data',
            },
        };
    }
};
exports.transfer_signature = transfer_signature;
//# sourceMappingURL=transfer.js.map