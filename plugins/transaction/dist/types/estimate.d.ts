import { DeployAccountContractPayload } from 'starknet';
export type EstimateAccountDeployFeeParams = {
    accountAddress: string;
    payloads: DeployAccountContractPayload[];
};
