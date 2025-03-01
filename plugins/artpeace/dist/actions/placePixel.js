"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placePixelSignature = exports.placePixel = void 0;
const starknet_1 = require("starknet");
const artpeaceAbi_1 = require("../abis/artpeaceAbi");
const artpeace_1 = require("../constants/artpeace");
const helper_1 = require("../utils/helper");
const checker_1 = require("../utils/checker");
const placePixel = async (agent, input) => {
    try {
        const { params } = input;
        const credentials = agent.getAccountCredentials();
        const provider = agent.getProvider();
        const account = new starknet_1.Account(provider, credentials.accountPublicKey, credentials.accountPrivateKey, undefined, starknet_1.constants.TRANSACTION_VERSION.V3);
        const artpeaceContract = new starknet_1.Contract(artpeaceAbi_1.artpeaceAbi, artpeace_1.artpeaceAddr, provider);
        const checker = new checker_1.Checker(params[0].canvasId);
        const id = await checker.checkWorld();
        await checker.getColors();
        const txHash = [];
        for (const param of params) {
            const { position, color } = await helper_1.ArtpeaceHelper.validateAndFillDefaults(param, checker);
            const timestamp = Math.floor(Date.now() / 1000);
            artpeaceContract.connect(account);
            const call = artpeaceContract.populate('place_pixel', {
                canvas_id: id,
                pos: position,
                color: color,
                now: timestamp,
            });
            const res = await account.execute(call);
            await provider.waitForTransaction(res.transaction_hash);
            txHash.push(res.transaction_hash);
        }
        return JSON.stringify({
            status: 'success',
            transaction_hash: txHash,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: {
                code: 'PLACE_PIXEL_DATA_ERROR',
                message: error.message || 'Failed to place a pixel',
            },
        });
    }
};
exports.placePixel = placePixel;
const placePixelSignature = async (input) => {
    try {
        const { params } = input;
        const checker = new checker_1.Checker(params[0].canvasId);
        const id = await checker.checkWorld();
        await checker.getColors();
        let timestamp = Math.floor(Date.now() / 1000);
        const results = [];
        for (const param of params) {
            if (param.color === '255')
                continue;
            const { position, color } = await helper_1.ArtpeaceHelper.validateAndFillDefaults(param, checker);
            const call = {
                status: 'success',
                transactions: {
                    contractAddress: artpeace_1.artpeaceAddr,
                    entrypoint: 'place_pixel',
                    calldata: [id, position, color, timestamp],
                },
            };
            timestamp = timestamp + 5;
            results.push({
                status: 'success',
                transactions: {
                    ...call,
                },
            });
        }
        return JSON.stringify({ transaction_type: 'INVOKE', results });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: {
                code: 'PLACE_PIXEL_CALL_DATA_ERROR',
                message: error.message || 'Failed to generate place_pixel call data',
            },
        });
    }
};
exports.placePixelSignature = placePixelSignature;
//# sourceMappingURL=placePixel.js.map