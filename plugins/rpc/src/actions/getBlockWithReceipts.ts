import { BlockIdParams } from '../schema/index.js';
import { SnakAgentInterface } from '@snakagent/core';

export const getBlockWithReceipts = async (
  agent: SnakAgentInterface,
  params: BlockIdParams
) => {
  try {
    const provider = agent.getProvider();
    const blockId = params?.blockId ?? 'latest';
    const block = await provider.getBlockWithReceipts(blockId);
    return JSON.stringify({
      status: 'success',
      block,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
