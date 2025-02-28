"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyProofService = void 0;
const atlantic_1 = require("../constants/atlantic");
const fs_1 = require("fs");
const server_1 = require("@starknet-agent-kit/server");
const validateJson_1 = require("../utils/validateJson");
const getFilename_1 = require("../utils/getFilename");
const verifyProofService = async (agent, param) => {
    try {
        const filename = param.filename;
        if (!filename) {
            throw new Error('No filename found.');
        }
        if (!param.memoryVerification) {
            throw new server_1.NotFoundError('Memory Verification is empty');
        }
        const fullName = await (0, getFilename_1.getFilename)(filename);
        let buffer;
        try {
            buffer = await fs_1.promises.readFile(fullName, 'utf-8');
            if (!(await (0, validateJson_1.validateJson)(buffer))) {
                throw new server_1.ValidationError("The file isn't an json type.");
            }
        }
        catch (error) {
            throw new Error(error.message);
        }
        const file = new File([buffer], filename, {
            type: 'application/json',
        });
        const formData = new FormData();
        formData.append('proofFile', file);
        formData.append('mockFactHash', 'false');
        formData.append('stoneVersion', 'stone6');
        formData.append('memoryVerification', param.memoryVerification);
        const apiKey = process.env.ATLANTIC_API_KEY;
        if (!apiKey) {
            throw new Error('API key is missing in the environment variables.');
        }
        const res = await fetch(`${atlantic_1.ATLANTIC_URL}/v1/l2/atlantic-query/proof-verification?apiKey=${apiKey}`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
            },
            body: formData,
        });
        let url;
        if (res.status) {
            const data = await res.json();
            if (typeof data.atlanticQueryId === 'undefined') {
                throw new Error('Received an undefined response from the external API.');
            }
            url = `${atlantic_1.DASHBOARD_URL}${data.atlanticQueryId}`;
        }
        return JSON.stringify({
            status: 'success',
            url: url,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.verifyProofService = verifyProofService;
//# sourceMappingURL=verifyProofService.js.map