import { Account, DeployAccountContractPayload } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { EstimateAccountDeployFeeParams } from '../../transaction/types/estimate';

/**
 * Estimates the fee required to deploy a Starknet account contract
 * @param {EstimateAccountDeployFeeParams} params - Parameters for fee estimation
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @returns {Promise<string>} JSON string with estimation result or error
 * @throws {Error} If account address is not configured
 */
export const estimateAccountDeployFee = async (
  params: EstimateAccountDeployFeeParams,
  agent: StarknetAgentInterface
) => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const accountAddress = accountCredentials?.accountPublicKey;
    const accountPrivateKey = accountCredentials?.accountPrivateKey;
    if (!accountAddress) {
      throw new Error('Account address not configured');
    }

    const account = new Account(provider, accountAddress, accountPrivateKey);

    const invocations: DeployAccountContractPayload[] = params.payloads.map(
      (payload) => {
        return {
          classHash: payload.classHash,
          constructorCalldata: payload.constructorCalldata ?? [],
          addressSalt: payload.addressSalt,
          contractAddress: payload.contractAddress,
        };
      }
    );
    const estimatedFee = await account.estimateAccountDeployFee(invocations[0]);
    return JSON.stringify({
      status: 'success',
      maxFee: estimatedFee.suggestedMaxFee.toString(),
      overallFee: estimatedFee.overall_fee.toString(),
      gasPrice: estimatedFee.gas_price.toString(),
      gasUsage: estimatedFee.gas_consumed.toString(),
      unit: 'wei',
      resourceBounds: {
        l1_gas: {
          maxAmount: estimatedFee.resourceBounds.l1_gas.max_amount.toString(),
          maxPricePerUnit:
            estimatedFee.resourceBounds.l1_gas.max_price_per_unit.toString(),
        },
        l2_gas: {
          maxAmount: estimatedFee.resourceBounds.l2_gas.max_amount.toString(),
          maxPricePerUnit:
            estimatedFee.resourceBounds.l2_gas.max_price_per_unit.toString(),
        },
      },
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
