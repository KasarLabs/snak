"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeV3Transaction = exports.getV3DetailsPayload = exports.validateAndFormatTokenId = exports.bigintToHex = void 0;
const starknet_1 = require("starknet");
const bigintToHex = (addressAsBigInt) => {
    let hexString = addressAsBigInt.toString(16);
    hexString = hexString.padStart(64, '0');
    hexString = '0x' + hexString;
    return hexString;
};
exports.bigintToHex = bigintToHex;
const validateAndFormatTokenId = (tokenId) => {
    try {
        return starknet_1.uint256.bnToUint256(tokenId);
    }
    catch (error) {
        throw new Error(`Invalid token ID: ${error.message}`);
    }
};
exports.validateAndFormatTokenId = validateAndFormatTokenId;
const getV3DetailsPayload = () => {
    const maxL1Gas = 5000n;
    const maxL1GasPrice = 1000000n * 10n ** 9n;
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
//# sourceMappingURL=utils.js.map