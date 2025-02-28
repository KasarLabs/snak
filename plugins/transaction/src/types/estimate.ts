import { DeployAccountContractPayload } from 'starknet';

/**
 * Parameters for estimating account deployment fees
 * @property {string} accountAddress - Address of the account performing the deployment
 * @property {DeployAccountContractPayload[]} payloads - Array of contract deployment configurations
 */
export type EstimateAccountDeployFeeParams = {
  accountAddress: string;
  payloads: DeployAccountContractPayload[];
};
