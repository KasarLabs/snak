"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAY_DECIMALS = exports.WAD_DECIMALS = void 0;
exports.formatValue = formatValue;
const ethers_1 = require("ethers");
exports.WAD_DECIMALS = 18;
exports.RAY_DECIMALS = 27;
const CASES = {
    wad: exports.WAD_DECIMALS,
    ray: exports.RAY_DECIMALS,
};
function formatValue(value, type = 'wad', decimals) {
    return (0, ethers_1.formatUnits)(value, CASES[type] ?? decimals);
}
//# sourceMappingURL=format.js.map