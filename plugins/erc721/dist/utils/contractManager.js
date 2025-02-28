"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractManager = void 0;
const starknet_1 = require("starknet");
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
class ContractManager {
    constructor(account) {
        this.account = account;
    }
    async loadContractCompilationFiles(sierraPath, casmPath) {
        try {
            this.compiledSierra = JSON.parse(fs.readFileSync(sierraPath).toString('ascii'));
            this.compiledCasm = JSON.parse(fs.readFileSync(casmPath).toString('ascii'));
        }
        catch (error) {
            throw new Error(`Failed to load contract files: ${error.message}`);
        }
    }
    async isContractDeclared() {
        try {
            const contractHash = starknet_1.hash.computeContractClassHash(this.compiledSierra);
            await this.account.getClassByHash(contractHash);
            return { isDeclared: true, classHash: contractHash };
        }
        catch (error) {
            return { isDeclared: false };
        }
    }
    async declareContract() {
        const { isDeclared, classHash } = await this.isContractDeclared();
        if (isDeclared && classHash) {
            return {
                transactionHash: '',
                classHash: classHash,
            };
        }
        try {
            const declarePayload = {
                contract: this.compiledSierra,
                casm: this.compiledCasm,
            };
            const declareResponse = await this.account.declareIfNot(declarePayload, (0, utils_1.getV3DetailsPayload)());
            await this.account.waitForTransaction(declareResponse.transaction_hash);
            return {
                transactionHash: declareResponse.transaction_hash,
                classHash: declareResponse.class_hash,
            };
        }
        catch (error) {
            throw new Error(`Failed to declare contract: ${error.message}`);
        }
    }
    async deployContract(classHash, abi, constructorArgs = []) {
        try {
            const contractCallData = new starknet_1.CallData(abi ? abi : this.compiledSierra.abi);
            const constructorCalldata = contractCallData.compile('constructor', constructorArgs);
            const deployPayload = {
                classHash,
                constructorCalldata: constructorCalldata,
            };
            const deployResponse = await this.account.deployContract(deployPayload, (0, utils_1.getV3DetailsPayload)());
            await this.account.waitForTransaction(deployResponse.transaction_hash);
            return {
                transactionHash: deployResponse.transaction_hash,
                contractAddress: deployResponse.contract_address,
            };
        }
        catch (error) {
            throw new Error(`Failed to deploy contract: ${error.message}`);
        }
    }
    async declareAndDeployContract(constructorArgs = []) {
        try {
            const contractCallData = new starknet_1.CallData(this.compiledSierra.abi);
            const constructorCalldata = contractCallData.compile('constructor', constructorArgs);
            const declareAndDeployPayload = {
                contract: this.compiledSierra,
                casm: this.compiledCasm,
                constructorCalldata: constructorCalldata,
            };
            const response = await this.account.declareAndDeploy(declareAndDeployPayload, (0, utils_1.getV3DetailsPayload)());
            await this.account.waitForTransaction(response.deploy.transaction_hash);
            return {
                declare: {
                    transactionHash: response.declare.transaction_hash,
                    classHash: response.declare.class_hash.toString(),
                },
                deploy: {
                    transactionHash: response.deploy.transaction_hash,
                    contractAddress: response.deploy.contract_address,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to declare and deploy contract: ${error.message}`);
        }
    }
    extractConstructorParams(abiObject) {
        const abi = abiObject ? abiObject : this.compiledSierra.abi;
        const constructorDef = abi.find((item) => item.type === 'constructor');
        if (!constructorDef ||
            !constructorDef.inputs ||
            !Array.isArray(constructorDef.inputs)) {
            return [];
        }
        return constructorDef.inputs.map((input) => ({
            name: input.name,
            type: input.type,
        }));
    }
}
exports.ContractManager = ContractManager;
//# sourceMappingURL=contractManager.js.map