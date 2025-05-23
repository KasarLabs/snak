import { BlockIdParams } from '../schema/index.js';
import { SnakAgentInterface } from '@snakagent/core';

export const getBlockStateUpdate = async (
  agent: SnakAgentInterface,
  params: BlockIdParams
) => {
  const provider = agent.getProvider();

  try {
    const blockId = params?.blockId ?? 'latest';
    const block = await provider.getBlockStateUpdate(blockId);
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
