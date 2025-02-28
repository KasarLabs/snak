"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMemecoin = void 0;
const starknet_1 = require("starknet");
const unruggableFactory_1 = require("../abis/unruggableFactory");
const constants_1 = require("../constants");
const isMemecoin = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const contract = new starknet_1.Contract(unruggableFactory_1.FACTORY_ABI, constants_1.FACTORY_ADDRESS, provider);
        const result = await contract.is_memecoin(params.contractAddress);
        return JSON.stringify({
            status: 'success',
            isMemecoin: result,
        });
    }
    catch (error) {
        console.error('Error checking memecoin status:', error);
        return JSON.stringify({
            status: 'failed',
            error: error.message,
        });
    }
};
exports.isMemecoin = isMemecoin;
//# sourceMappingURL=isMemecoin.js.map