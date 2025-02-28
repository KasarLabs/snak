"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateZip = void 0;
const validateZip = async (buffer) => {
    const zipSignature = [0x50, 0x4b, 0x03, 0x04];
    if (buffer.length < zipSignature.length) {
        return false;
    }
    return zipSignature.every((byte, index) => buffer[index] === byte);
};
exports.validateZip = validateZip;
//# sourceMappingURL=validateZip.js.map