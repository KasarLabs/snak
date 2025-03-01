"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchOnEkuboSchema = exports.createMemecoinSchema = exports.contractAddressSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.contractAddressSchema = zod_1.default.object({
    contractAddress: zod_1.default.string().describe('The address of the contract'),
});
exports.createMemecoinSchema = zod_1.default.object({
    owner: zod_1.default.string().describe('Owner address of the memecoin'),
    name: zod_1.default.string().describe('Name of the memecoin'),
    symbol: zod_1.default.string().describe('Symbol/ticker of the memecoin'),
    initialSupply: zod_1.default.string().describe('Initial supply of tokens (in wei)'),
    salt: zod_1.default
        .string()
        .optional()
        .describe('Optional salt for contract address generation'),
});
const launchParametersSchema = zod_1.default
    .object({
    memecoinAddress: zod_1.default
        .string()
        .regex(/^0x[0-9a-fA-F]{63,64}$/)
        .describe('Address of the memecoin contract to be launched'),
    transferRestrictionDelay: zod_1.default
        .number()
        .min(0)
        .describe('Time period in seconds during which transfers are restricted after launch. Example: 86400 for 24 hours'),
    maxPercentageBuyLaunch: zod_1.default
        .number()
        .min(1)
        .max(100)
        .describe('Maximum percentage of total supply that can be bought by a single address at launch. Range: 1-100'),
    quoteAddress: zod_1.default
        .string()
        .regex(/^0x[0-9a-fA-F]{63,64}$/)
        .describe('Address of the quote token (e.g., ETH) used for the trading pair'),
    initialHolders: zod_1.default
        .array(zod_1.default.string().regex(/^0x[0-9a-fA-F]{63,64}$/))
        .min(1)
        .describe('Array of addresses that will receive initial token distribution'),
    initialHoldersAmounts: zod_1.default
        .array(zod_1.default.string())
        .min(1)
        .describe('Array of token amounts (in wei) to be distributed to initial holders'),
})
    .refine((data) => data.initialHolders.length === data.initialHoldersAmounts.length, {
    message: 'Initial holders and amounts arrays must have the same length',
});
const ekuboPoolParametersSchema = zod_1.default.object({
    fee: zod_1.default
        .string()
        .refine((value) => {
        const fee = parseInt(value);
        return fee >= 1 && fee <= 10000;
    }, {
        message: 'Fee must be between 1 and 10000 basis points (0.01% to 100%)',
    })
        .describe('Pool fee in basis points. Example: "3000" for 0.3%'),
    tickSpacing: zod_1.default
        .string()
        .describe('Determines the granularity of price points in the pool. Common values: "60" for 0.3% pools'),
    startingPrice: zod_1.default.object({
        mag: zod_1.default
            .string()
            .describe('Magnitude of the starting price in wei. Example: "1000000000000000000" for 1.0'),
        sign: zod_1.default.boolean().describe('true for positive price, false for negative'),
    }),
    bound: zod_1.default
        .string()
        .describe('Defines the price range limit for the concentrated liquidity pool'),
});
exports.launchOnEkuboSchema = zod_1.default.object({
    launchParams: launchParametersSchema,
    ekuboParams: ekuboPoolParametersSchema,
});
//# sourceMappingURL=index.js.map