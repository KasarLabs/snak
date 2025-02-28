"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSignatureTools = void 0;
const schema_1 = require("../schemas/schema");
const transferFrom_1 = require("../actions/transferFrom");
const approve_1 = require("../actions/approve");
const setApprovalForAll_1 = require("../actions/setApprovalForAll");
const safeTransferFrom_1 = require("../actions/safeTransferFrom");
const registerSignatureTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'erc721_transferFromSignature',
        description: 'Return transferFrom json transaction for ERC721 NFT',
        schema: schema_1.transferFromSchema,
        execute: transferFrom_1.transferFromSignature,
    });
    StarknetToolRegistry.push({
        name: 'erc721_approveSignature',
        description: 'Return approve json transaction for ERC721 NFT',
        schema: schema_1.approveSchema,
        execute: approve_1.approveSignature,
    });
    StarknetToolRegistry.push({
        name: 'erc721_setApprovalForAllSignature',
        description: 'Return setApprovalForAll json transaction for ERC721 NFT',
        schema: schema_1.setApprovalForAllSchema,
        execute: setApprovalForAll_1.setApprovalForAllSignature,
    });
    StarknetToolRegistry.push({
        name: 'erc721_safeTransferFromSignature',
        description: 'Return safeTransferFrom json transaction for ERC721 NFT',
        schema: schema_1.safeTransferFromSchema,
        execute: safeTransferFrom_1.safeTransferFromSignature,
    });
};
exports.registerSignatureTools = registerSignatureTools;
//# sourceMappingURL=signature_tools.js.map