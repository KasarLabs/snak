import { Account, Contract, RpcProvider } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { tokenAddresses } from '../constants/erc20';
import { GetBalanceParams, GetOwnBalanceParams } from '../types/balance';
import { ERC20_ABI } from '../abis/erc20Abi';

/**
 * Gets token decimals based on symbol
 * @param {string} symbol - Token symbol
 * @returns {number} Number of decimals
 */
const getTokenDecimals = (symbol: string): number => {
  const stablecoinSymbols = ['USDC', 'USDT'];
  const decimals = stablecoinSymbols.includes(symbol.toUpperCase()) ? 6 : 18;
  return decimals;
};

/**
 * Formats raw balance to human readable string
 * @param {bigint | string | number} rawBalance - Raw balance value
 * @param {string} symbol - Token symbol
 * @returns {string} Formatted balance
 */
const formatBalance = (
  rawBalance: bigint | string | number,
  symbol: string
): string => {
  try {
    const balanceStr =
      typeof rawBalance === 'bigint'
        ? rawBalance.toString()
        : String(rawBalance);

    if (!balanceStr || balanceStr === '0') {
      return '0';
    }

    const decimals = getTokenDecimals(symbol);

    if (balanceStr.length <= decimals) {
      const zeros = '0'.repeat(decimals - balanceStr.length);
      const formattedBalance = `0.${zeros}${balanceStr}`;
      return formattedBalance;
    }

    const decimalPosition = balanceStr.length - decimals;
    const wholePart = balanceStr.slice(0, decimalPosition) || '0';
    const fractionalPart = balanceStr.slice(decimalPosition);
    const formattedBalance = `${wholePart}.${fractionalPart}`;

    return formattedBalance;
  } catch (error) {
    console.error('Error formatting balance:', error);
    return '0';
  }
};

/**
 * Validates token symbol and returns address
 * @param {string} symbol - Token symbol to validate
 * @returns {string} Token address
 * @throws {Error} If token is not supported
 */
const validateTokenAddress = (symbol: string): string => {
  const tokenAddress = tokenAddresses[symbol];
  if (!tokenAddress) {
    throw new Error(
      `Token ${symbol} not supported. Available tokens: ${Object.keys(tokenAddresses).join(', ')}`
    );
  }
  return tokenAddress;
};

/**
 * Gets token balance for authenticated account
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {GetOwnBalanceParams} params - Balance request parameters
 * @returns {Promise<string>} JSON string with balance or error
 */
export const getOwnBalance = async (
  agent: StarknetAgentInterface,
  params: GetOwnBalanceParams
): Promise<string> => {
  try {
    if (!params?.symbol) {
      throw new Error('Symbol parameter is required');
    }

    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const accountAddress = accountCredentials?.accountPublicKey;
    const accountPrivateKey = accountCredentials?.accountPrivateKey;

    if (!accountAddress) {
      throw new Error('Wallet address not configured');
    }

    const account = new Account(provider, accountAddress, accountPrivateKey);
    const tokenAddress = validateTokenAddress(params.symbol);
    const tokenContract = new Contract(ERC20_ABI, tokenAddress, provider);

    const balanceResponse = await tokenContract.balanceOf(account.address);

    const balanceValue = balanceResponse;

    if (balanceValue === undefined || balanceValue === null) {
      throw new Error('No balance value received from contract');
    }

    const formattedBalance = formatBalance(balanceValue, params.symbol);

    return JSON.stringify({
      status: 'success',
      balance: formattedBalance,
    });
  } catch (error) {
    console.error('Error in getOwnBalance:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
};

/**
 * Gets token balance for any account
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {GetBalanceParams} params - Balance request parameters
 * @returns {Promise<string>} JSON string with balance or error
 */
export const getBalance = async (
  agent: StarknetAgentInterface,
  params: GetBalanceParams
): Promise<string> => {
  try {
    if (!params?.assetSymbol || !params?.accountAddress) {
      throw new Error('Both assetSymbol and address parameters are required');
    }

    const provider = agent.getProvider();

    const tokenAddress = validateTokenAddress(params.assetSymbol);
    const tokenContract = new Contract(ERC20_ABI, tokenAddress, provider);

    const balanceResponse = await tokenContract.balanceOf(
      params.accountAddress
    );

    if (!balanceResponse || typeof balanceResponse !== 'object') {
      throw new Error('Invalid balance response format from contract');
    }

    const balanceValue =
      typeof balanceResponse === 'object' && 'balance' in balanceResponse
        ? balanceResponse.balance
        : balanceResponse;

    const formattedBalance = formatBalance(balanceValue, params.assetSymbol);

    return JSON.stringify({
      status: 'success',
      balance: formattedBalance,
    });
  } catch (error) {
    console.error('Error in getBalance:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
};

/**
 * Gets token balance signature for any account
 * @param {GetBalanceParams} params - Balance request parameters
 * @returns {Promise<string>} JSON string with balance signature or error
 */
export const getBalanceSignature = async (
  params: GetBalanceParams
): Promise<string> => {
  try {
    if (!params?.assetSymbol || !params?.accountAddress) {
      throw new Error('Both assetSymbol and address parameters are required');
    }

    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });

    const tokenAddress = validateTokenAddress(params.assetSymbol);
    const tokenContract = new Contract(ERC20_ABI, tokenAddress, provider);

    const balanceResponse = await tokenContract.balanceOf(
      params.accountAddress
    );

    if (!balanceResponse || typeof balanceResponse !== 'bigint') {
      throw new Error('Invalid balance response format from contract');
    }

    const formattedBalance = formatBalance(balanceResponse, params.assetSymbol);
    return JSON.stringify({
      status: 'success',
      transaction_type: 'READ',
      balance: formattedBalance,
    });
  } catch (error) {
    console.error('Error in getBalance:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
};
