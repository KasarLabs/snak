"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProofService = void 0;
const atlantic_1 = require("../constants/atlantic");
const fs_1 = require("fs");
const validateZip_1 = require("../utils/validateZip");
const getFilename_1 = require("../utils/getFilename");
const getProofService = async (agent, param) => {
    try {
        const filename = param.filename;
        if (!filename) {
            throw new Error('No filename found.');
        }
        const fullName = await (0, getFilename_1.getFilename)(filename);
        let buffer;
        try {
            buffer = await fs_1.promises.readFile(fullName);
            if (!(await (0, validateZip_1.validateZip)(buffer))) {
                throw new Error('Is not a zip file.');
            }
        }
        catch (error) {
            throw new Error(error.message);
        }
        const formData = new FormData();
        formData.append('pieFile', new Blob([buffer], { type: 'application/zip' }), filename);
        formData.append('layout', 'recursive');
        formData.append('prover', 'starkware_sharp');
        const apiKey = process.env.ATLANTIC_API_KEY;
        if (!apiKey) {
            throw new Error('API key is missing in the environment variables.');
        }
        const res = await fetch(`${atlantic_1.ATLANTIC_URL}/v1/proof-generation?apiKey=${apiKey}`, {
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
exports.getProofService = getProofService;
//# sourceMappingURL=getProofService.js.map