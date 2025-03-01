"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeV3Transaction = exports.getV3DetailsPayload = exports.validateAndFormatParams = exports.formatTokenAmount = exports.validateTokenAddress = exports.formatBalance = exports.getTokenDecimals = void 0;
exports.validateToken = validateToken;
const starknet_1 = require("starknet");
const constant_1 = require("../constant/constant");
const starknet_2 = require("starknet");
const types_1 = require("../types/types");
const interact_1 = require("../abis/interact");
const getTokenDecimals = (symbol) => {
    const stablecoinSymbols = ['USDC', 'USDT'];
    const decimals = stablecoinSymbols.includes(symbol.toUpperCase()) ? 6 : 18;
    return decimals;
};
exports.getTokenDecimals = getTokenDecimals;
const formatBalance = (rawBalance, decimals) => {
    try {
        const balanceStr = typeof rawBalance === 'bigint'
            ? rawBalance.toString()
            : String(rawBalance);
        if (!balanceStr || balanceStr === '0') {
            return '0';
        }
        if (balanceStr.length <= decimals) {
            const zeros = '0'.repeat(decimals - balanceStr.length);
            const formattedBalance = `0.${zeros}${balanceStr}`;
            return formattedBalance;
        }
        const decimalPosition = balanceStr.length - decimals;
        const wholePart = balanceStr.slice(0, decimalPosition) || '0';
        const fractionalPart = balanceStr.slice(decimalPosition);
        const formattedBalance = `${wholePart}.${fractionalPart}`;
        return formattedBalance;
    }
    catch (error) {
        return '0';
    }
};
exports.formatBalance = formatBalance;
const validateTokenAddress = (symbol) => {
    const tokenAddress = constant_1.tokenAddresses[symbol];
    if (!tokenAddress) {
        throw new Error(`Token ${symbol} not supported. Available tokens: ${Object.keys(constant_1.tokenAddresses).join(', ')}`);
    }
    return tokenAddress;
};
exports.validateTokenAddress = validateTokenAddress;
const formatTokenAmount = (amount, decimals) => {
    const [whole, fraction = ''] = amount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0');
    return whole + paddedFraction;
};
exports.formatTokenAmount = formatTokenAmount;
const validateAndFormatParams = (address, amount, decimals) => {
    try {
        if (!address) {
            throw new Error('Address is required');
        }
        const formattedAddress = (0, starknet_1.validateAndParseAddress)(address);
        if (!amount) {
            throw new Error('Amount is required');
        }
        const formattedAmount = (0, exports.formatTokenAmount)(amount, decimals);
        const formattedAmountUint256 = starknet_2.uint256.bnToUint256(formattedAmount);
        return {
            address: formattedAddress,
            amount: formattedAmountUint256,
        };
    }
    catch (error) {
        throw new Error(`Parameter validation failed: ${error.message}`);
    }
};
exports.validateAndFormatParams = validateAndFormatParams;
const getV3DetailsPayload = () => {
    const maxL1Gas = 2000n;
    const maxL1GasPrice = 100000n * 10n ** 9n;
    return {
        version: 3,
        maxFee: 10n ** 16n,
        feeDataAvailabilityMode: starknet_1.RPC.EDataAvailabilityMode.L1,
        tip: 10n ** 14n,
        paymasterData: [],
        resourceBounds: {
            l1_gas: {
                max_amount: starknet_1.num.toHex(maxL1Gas),
                max_price_per_unit: starknet_1.num.toHex(maxL1GasPrice),
            },
            l2_gas: {
                max_amount: starknet_1.num.toHex(0n),
                max_price_per_unit: starknet_1.num.toHex(0n),
            },
        },
    };
};
exports.getV3DetailsPayload = getV3DetailsPayload;
const executeV3Transaction = async ({ call, account, }) => {
    const { transaction_hash } = await account.execute(call, (0, exports.getV3DetailsPayload)());
    const receipt = await account.waitForTransaction(transaction_hash);
    if (!receipt.isSuccess()) {
        throw new Error('Transaction confirmed but failed');
    }
    return transaction_hash;
};
exports.executeV3Transaction = executeV3Transaction;
async function validateToken(provider, assetSymbol, assetAddress) {
    if (!assetSymbol && !assetAddress) {
        throw new Error('Either asset symbol or asset address is required');
    }
    let address = '', symbol = '', decimals = 0;
    if (assetSymbol) {
        symbol = assetSymbol.toUpperCase();
        address = (0, exports.validateTokenAddress)(symbol);
        if (!address) {
            throw new Error(`Token ${symbol} not supported`);
        }
        decimals = types_1.DECIMALS[symbol] || types_1.DECIMALS.DEFAULT;
    }
    else if (assetAddress) {
        address = (0, starknet_1.validateAndParseAddress)(assetAddress);
        try {
            const contract = new starknet_1.Contract(interact_1.INTERACT_ERC20_ABI, address, provider);
            const rawSymbol = await contract.symbol();
            const decimalsBigInt = await contract
                .decimals()
                .catch(() => types_1.DECIMALS.DEFAULT);
            symbol = starknet_1.shortString.decodeShortString(rawSymbol);
            decimals =
                typeof decimalsBigInt === 'bigint'
                    ? Number(decimalsBigInt)
                    : decimalsBigInt;
        }
        catch (error) {
            console.warn(`Error retrieving token info: ${error.message}`);
        }
    }
    return {
        address,
        symbol,
        decimals,
    };
}
//# sourceMappingURL=utils.js.map