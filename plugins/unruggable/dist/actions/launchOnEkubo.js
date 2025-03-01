"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchOnEkubo = void 0;
const unruggableFactory_1 = require("../abis/unruggableFactory");
const constants_1 = require("../constants");
const starknet_1 = require("starknet");
const launchOnEkubo = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const contract = new starknet_1.Contract(unruggableFactory_1.FACTORY_ABI, constants_1.FACTORY_ADDRESS, provider);
        const launchParams = params.launchParams;
        const ekuboParams = params.ekuboParams;
        const paramsToSend = {
            memecoin_address: launchParams.memecoinAddress,
            transfer_restriction_delay: launchParams.transferRestrictionDelay,
            max_percentage_buy_launch: launchParams.maxPercentageBuyLaunch,
            quote_address: launchParams.quoteAddress,
            initial_holders: launchParams.initialHolders,
            initial_holders_amounts: launchParams.initialHoldersAmounts,
        };
        const ekuboPoolParams = {
            fee: ekuboParams.fee,
            tick_spacing: ekuboParams.tickSpacing,
            starting_price: {
                mag: ekuboParams.startingPrice.mag,
                sign: ekuboParams.startingPrice.sign,
            },
            bound: ekuboParams.bound,
        };
        const response = await contract.launch_on_ekubo(paramsToSend, ekuboPoolParams);
        return JSON.stringify({
            status: 'success',
            response,
        });
    }
    catch (error) {
        console.error('Error launching on Ekubo:', error);
        return JSON.stringify({
            status: 'failed',
            error: error.message,
        });
    }
};
exports.launchOnEkubo = launchOnEkubo;
//# sourceMappingURL=launchOnEkubo.js.map