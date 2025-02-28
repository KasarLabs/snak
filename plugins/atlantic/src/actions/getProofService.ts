import { ATLANTIC_URL, DASHBOARD_URL } from '../constants/atlantic';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { AtlanticParam, AtlanticRes } from '../types/Atlantic';
import { promises as fs } from 'fs';
import { validateZip } from '../utils/validateZip';
import { getFilename } from '../utils/getFilename';

/**
 * Handles proof generation by sending a ZIP file to the Atlantic API.
 *
 * @param agent - The Starknet agent interface.
 * @param param - The Atlantic parameters, including the filename.
 * @returns A Promise that resolves to a JSON string containing the status and URL or an error message.
 */
export const getProofService = async (
  agent: StarknetAgentInterface,
  param: AtlanticParam
) => {
  try {
    const filename = param.filename;
    if (!filename) {
      throw new Error('No filename found.');
    }
    const fullName = await getFilename(filename);

    let buffer;
    try {
      buffer = await fs.readFile(fullName);
      if (!(await validateZip(buffer))) {
        throw new Error('Is not a zip file.');
      }
    } catch (error) {
      throw new Error(error.message);
    }

    const formData = new FormData();

    formData.append(
      'pieFile',
      new Blob([buffer], { type: 'application/zip' }),
      filename
    );
    formData.append('layout', 'recursive');
    formData.append('prover', 'starkware_sharp');

    const apiKey = process.env.ATLANTIC_API_KEY;
    if (!apiKey) {
      throw new Error('API key is missing in the environment variables.');
    }

    const res = await fetch(
      `${ATLANTIC_URL}/v1/proof-generation?apiKey=${apiKey}`,
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
