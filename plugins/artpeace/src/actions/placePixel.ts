import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { Account, constants, Contract } from 'starknet';
import { artpeaceAbi } from '../abis/artpeaceAbi';
import { artpeaceAddr } from '../constants/artpeace';
import { ArtpeaceHelper } from '../utils/helper';
import { placePixelParam } from '../schema';
import { Checker } from '../utils/checker';

/**
 * Places pixels on a Starknet canvas using the Artpeace contract
 * @param agent Interface for interacting with Starknet blockchain
 * @param input Object containing array of pixel parameters
 * @returns JSON string with transaction status and hash(es)
 */
export const placePixel = async (
  agent: StarknetAgentInterface,
  input: { params: placePixelParam[] }
) => {
  try {
    const { params } = input;
    const credentials = agent.getAccountCredentials();
    const provider = agent.getProvider();
    const account = new Account(
      provider,
      credentials.accountPublicKey,
      credentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );
    const artpeaceContract = new Contract(artpeaceAbi, artpeaceAddr, provider);
    const checker = new Checker(params[0].canvasId);
    const id = await checker.checkWorld();
    await checker.getColors();

    const txHash = [];
    for (const param of params) {
      const { position, color } = await ArtpeaceHelper.validateAndFillDefaults(
        param,
        checker
      );
      const timestamp = Math.floor(Date.now() / 1000);

      artpeaceContract.connect(account);
      const call = artpeaceContract.populate('place_pixel', {
        canvas_id: id,
        pos: position,
        color: color,
        now: timestamp,
      });

      const res = await account.execute(call);
      await provider.waitForTransaction(res.transaction_hash);
      txHash.push(res.transaction_hash);
    }

    return JSON.stringify({
      status: 'success',
      transaction_hash: txHash,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      error: {
        code: 'PLACE_PIXEL_DATA_ERROR',
        message: error.message || 'Failed to place a pixel',
      },
    });
  }
};

/**
 * Generates the transaction signature data for placing pixels on Artpeace contract
 * @param input Object containing array of pixel parameters
 * @returns JSON string with transaction data or error response
 */
export const placePixelSignature = async (input: {
  params: placePixelParam[];
}) => {
  try {
    const { params } = input;
    const checker = new Checker(params[0].canvasId);
    const id = await checker.checkWorld();
    await checker.getColors();
    let timestamp = Math.floor(Date.now() / 1000);

    const results = [];
    for (const param of params) {
      if (param.color === '255') continue;
      const { position, color } = await ArtpeaceHelper.validateAndFillDefaults(
        param,
        checker
      );

      const call = {
        status: 'success',
        transactions: {
          contractAddress: artpeaceAddr,
          entrypoint: 'place_pixel',
          calldata: [id, position, color, timestamp],
        },
      };

      timestamp = timestamp + 5;
      results.push({
        status: 'success',
        transactions: {
          ...call,
        },
      });
    }
    return JSON.stringify({ transaction_type: 'INVOKE', results });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      error: {
        code: 'PLACE_PIXEL_CALL_DATA_ERROR',
        message: error.message || 'Failed to generate place_pixel call data',
      },
    });
  }
};
