import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { AtlanticRes, VerifierParam } from '../types/Atlantic';
import { ATLANTIC_URL, DASHBOARD_URL } from '../constants/atlantic';
import { promises as fs } from 'fs';
import { ValidationError, NotFoundError } from '@starknet-agent-kit/server';
import { validateJson } from '../utils/validateJson';
import { getFilename } from '../utils/getFilename';
/**
 * Verifies a proof using the Atlantic service.
 *
 * @param agent - The Starknet agent interface.
 * @param param - The Atlantic parameters, including the filename.
 * @returns A Promise that resolves to a JSON string containing the status and URL or error message.
 */
export const verifyProofService = async (
  agent: StarknetAgentInterface,
  param: VerifierParam
) => {
  try {
    const filename = param.filename;
    if (!filename) {
      throw new Error('No filename found.');
    }

    if (!param.memoryVerification) {
      throw new NotFoundError('Memory Verification is empty');
    }

    const fullName = await getFilename(filename);

    let buffer;
    try {
      buffer = await fs.readFile(fullName, 'utf-8');
      if (!(await validateJson(buffer))) {
        throw new ValidationError("The file isn't an json type.");
      }
    } catch (error) {
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

    const res = await fetch(
      `${ATLANTIC_URL}/v1/l2/atlantic-query/proof-verification?apiKey=${apiKey}`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
        },
        body: formData,
      }
    );
    let url;
    if (res.status) {
      const data: AtlanticRes = await res.json();
      if (typeof data.atlanticQueryId === 'undefined') {
        throw new Error(
          'Received an undefined response from the external API.'
        );
      }
      url = `${DASHBOARD_URL}${data.atlanticQueryId}`;
    }
    return JSON.stringify({
      status: 'success',
      url: url,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
