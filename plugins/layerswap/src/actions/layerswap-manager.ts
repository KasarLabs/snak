import axios from 'axios';
import { Account, Provider, CallData, uint256 } from 'starknet';
import { ethers } from 'ethers';
import { GetSwapQuoteParams } from '../schema/index.js';
import { SwapInput, SwapResponse, DepositAction, SwapResponseData } from '../types/index.js';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { getLayerswapApiKey, getLayerswapBaseUrl } from '../utils/config.js';

/**
 * Manages Layerswap API interactions for bridging assets
 */
export class LayerswapManager {
  private baseUrl: string;
  private apiKey: string;
  private agent: StarknetAgentInterface;

  /**
   * Creates a new Layerswap Manager
   *
   * @param {StarknetAgentInterface} agent - Starknet agent with credentials
   */
  constructor(agent: StarknetAgentInterface) {
    this.agent = agent;
    this.apiKey = getLayerswapApiKey();
    this.baseUrl = getLayerswapBaseUrl();
  }

  /**
   * Gets the Starknet address from agent credentials
   *
   * @returns {string} - The Starknet address
   */
  getStarknetAddress(): string {
    const { accountPublicKey } = this.agent.getAccountCredentials();
    return accountPublicKey;
  }

  /**
   * Gets the Starknet private key from agent credentials
   *
   * @returns {string} - The Starknet private key
   */
  getStarknetPrivateKey(): string {
    const { accountPrivateKey } = this.agent.getAccountCredentials();
    return accountPrivateKey;
  }

  /**
   * Gets the Starknet Provider from agent
   *
   * @returns {Provider} - Starknet Provider instance
   */
  getProvider(): Provider {
    return this.agent.getProvider();
  }

  /**
   * Creates a Starknet Account instance for transaction execution
   *
   * @returns {Account} - Starknet Account instance
   */
  createAccount(): Account {
    const { accountPrivateKey, accountPublicKey } =
      this.agent.getAccountCredentials();
    const provider = this.getProvider();

    return new Account(provider, accountPublicKey, accountPrivateKey);
  }

  /**
   * Executes a transaction on the Starknet network
   *
   * @param {string} contractAddress - Contract address to interact with
   * @param {string} entrypoint - Contract function to call
   * @param {any} calldata - Arguments for the function call
   * @returns {Promise<any>} - Transaction result
   */
  async executeTransaction(
    contractAddress: string,
    entrypoint: string,
    calldata: any
  ): Promise<any> {
    const account = this.createAccount();

    return account.execute({
      contractAddress,
      entrypoint,
      calldata,
    });
  }

  /**
   * Executes a multicall on the Starknet network
   *
   * @param {any} calls - calldatas in array
   * @returns {Promise<any>} - Transaction result
   */
  async executeMultiCall(calls: any): Promise<any> {
    const account = this.createAccount();

    return account.execute(calls);
  }

  /**
   * Checks if the bridge route is supported and gets limits
   *
   * @param {string} sourceNetwork - Source network identifier
   * @param {string} sourceToken - Token to bridge
   * @param {string} destinationNetwork - Destination network identifier
   * @param {string} destinationToken - Destination token
   * @param {boolean} refuel - Whether to add gas on destination
   * @returns {Promise<{min_amount: number, max_amount: number}>} Min and max limits
   */
  async getLimits(
    sourceNetwork: string,
    sourceToken: string,
    destinationNetwork: string,
    destinationToken: string,
    refuel: boolean = false
  ): Promise<{ min_amount: number; max_amount: number }> {
    try {
      const response = await axios.get(`${this.baseUrl}/limits`, {
        params: {
          source_network: sourceNetwork,
          source_token: sourceToken,
          destination_network: destinationNetwork,
          destination_token: destinationToken,
          use_deposit_address: true,
          refuel,
        },
        headers: {
          'X-LS-APIKEY': this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error getting limits:', error);
      throw error;
    }
  }

  /**
   * Gets a quote for a swap
   *
   * @param {GetSwapQuoteParams} params - Quote parameters
   * @returns {Promise<any>} Quote details
   */
  async getQuote(params: GetSwapQuoteParams): Promise<any> {
    const {
      source_network,
      source_token,
      destination_network,
      destination_token,
      amount,
      refuel = false,
    } = params;

    // Build query parameters
    const queryParams = new URLSearchParams({
      source_network,
      source_token,
      destination_network,
      destination_token,
      amount: amount.toString(),
      refuel: refuel.toString(),
    });

    // Make the API request
    const response = await fetch(
      `${this.baseUrl}/quote?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'X-LS-APIKEY': this.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get quote: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }
  /**
   * Creates a new swap
   *
   * @param {SwapInput} swapInput - Swap creation parameters
   * @returns {Promise<SwapResponse>} Created swap details
   */
  async createSwap(swapInput: SwapInput): Promise<SwapResponse> {
    try {
      // Create a minimal payload with only required fields
      const payload = {
        source_network: swapInput.source_network,
        source_token: swapInput.source_token,
        destination_network: swapInput.destination_network,
        destination_token: swapInput.destination_token,
        destination_address: swapInput.destination_address,
        amount: swapInput.amount,
      };

      // // Add optional fields only if they are provided
      // if (swapInput.refuel !== undefined) {
      //   payload['refuel'] = swapInput.refuel;
      // }

      // if (swapInput.source_address) {
      //   payload['source_address'] = swapInput.source_address;
      // }

      // if (swapInput.reference_id) {
      //   payload['reference_id'] = swapInput.reference_id;
      // }

      // // The use_deposit_address might be causing issues, only add if needed and not false
      // if (swapInput.use_deposit_address === true) {
      //   payload['use_deposit_address'] = true;
      // }

      console.log(
        'Creating swap with payload:',
        JSON.stringify(payload, null, 2)
      );

      const response = await axios.post(`${this.baseUrl}/swaps`, payload, {
        headers: {
          'X-LS-APIKEY': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error creating swap:', error);
      // If the error has a response, log it for better debugging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Gets deposit actions for a swap
   *
   * @param {string} swapId - Swap identifier
   * @param {string} sourceAddress - Source address (required)
   * @returns {Promise<DepositAction[]>} Deposit instructions
   */
  async getDepositActions(
    swapId: string,
    sourceAddress: string
  ): Promise<DepositAction[]> {
    try {
      // Make sure we have a source address - it's required by the API
      if (!sourceAddress) {
        sourceAddress = this.getStarknetAddress();
      }

      // Remove 0x prefix if present to match API expectations
      const formattedAddress = sourceAddress.startsWith('0x')
        ? sourceAddress
        : `0x${sourceAddress}`;

      console.log(
        `Getting deposit actions for swap ${swapId} with source address ${formattedAddress}`
      );

      const response = await axios.get(
        `${this.baseUrl}/swaps/${swapId}/deposit_actions`,
        {
          params: {
            source_address: formattedAddress,
          },
          headers: {
            'X-LS-APIKEY': this.apiKey,
            Accept: 'application/json',
          },
        }
      );

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response format from deposit actions API');
      }

      return response.data.data;
    } catch (error) {
      console.error('Error getting deposit actions:', error);
      // Improve error logging with response details
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Gets the status of a swap
   *
   * @param {string} swapId - Swap identifier
   * @returns {Promise<SwapResponseData>} Current swap status
   */
  async getSwapStatus(swapId: string): Promise<SwapResponseData> {
    try {
      const response = await axios.get(`${this.baseUrl}/swaps/${swapId}`, {
        headers: {
          'X-LS-APIKEY': this.apiKey,
          Accept: 'application/json',
        },
      });

      // Check if the response has the expected structure
      if (!response.data || !response.data.data || !response.data.data.swap) {
        console.error(
          'Unexpected response format from swap status API:',
          response.data
        );
        throw new Error('Invalid response format from swap status API');
      }

      console.log("swapstatus response.data:", response.data)

      return response.data.data.swap;
    } catch (error) {
      console.error('Error getting swap status:', error);
      // Add more detailed error logging
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Gets swaps by reference ID
   *
   * @param {string} referenceId - Reference identifier
   * @returns {Promise<SwapResponse[]>} Matching swaps
   */
  async getSwapsByReferenceId(referenceId: string): Promise<SwapResponse[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/swaps`, {
        params: {
          reference_id: referenceId,
        },
        headers: {
          'X-LS-APIKEY': this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error getting swaps by reference ID:', error);
      throw error;
    }
  }

  /**
   * Executes an ETH transfer on Starknet
   *
   * @param {string} tokenAddress - ETH token contract address
   * @param {string} recipientAddress - Recipient address
   * @param {number} amount - Amount to transfer in ETH
   * @returns {Promise<any>} - Transaction result
   */
  async executeEthTransfer(
    tokenAddress: string,
    recipientAddress: string,
    amount: number
  ): Promise<any> {
    // Convert to wei (multiply by 10^18)
    const amountInWei = ethers.parseEther(amount.toString());
    const { low, high } = uint256.bnToUint256(amountInWei.toString());

    // Compile calldata using CallData.compile()
    const calldata = CallData.compile({
      recipient: recipientAddress,
      amount: [low, high],
    });

    // Execute the transaction
    return this.executeTransaction(tokenAddress, 'transfer', calldata);
  }
}
