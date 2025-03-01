import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import {
  createAndPostTwitterThreadParams,
  creatTwitterPostParams,
  FollowXUserFromUsernameParams,
  ReplyTweetParams,
} from '../schema/index';

/**
 * Creates a new Twitter post using either credentials or API authentication
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {creatTwitterPostParams} params - Parameters containing the post content
 * @returns {Promise<{status: string, result?: any}>} Result object indicating success/failure and optional API response
 * @throws {Error} When neither Twitter API nor Account credentials are set
 */
export const createTwitterpost = async (
  agent: StarknetAgentInterface,
  params: creatTwitterPostParams
) => {
  try {
    const twitter_auth_mode = agent.getTwitterAuthMode();
    if (twitter_auth_mode === 'CREDENTIALS') {
      console.log('CREDENTIALS');
      const twitter_client =
        agent.getTwitterManager().twitter_scraper?.twitter_client;

      if (!twitter_client) {
        throw new Error('twitter_client is undefined');
      }

      await twitter_client.sendTweet(params.post);
      return {
        status: 'success',
      };
    }
    if (twitter_auth_mode === 'API') {
      console.log('API');
      const twitter_api_client = agent.getTwitterManager().twitter_api;

      if (!twitter_api_client) {
        throw new Error('twitter_api_client is undefined');
      }

      const result = await twitter_api_client.twitter_api_client.v2.tweet({
        text: params.post,
      });
      return {
        status: 'success',
        result: result,
      };
    } else {
      throw new Error(`You don't set Twitter API or Twitter Account`);
    }
  } catch (error) {
    console.log(error);
    return {
      status: 'failed',
    };
  }
};

/**
 * Replies to a specific tweet using Twitter credentials
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {ReplyTweetParams} params - Parameters containing the tweet ID to reply to and response text
 * @returns {Promise<{status: string, tweet_id?: string, response_text?: string, error?: any}>} Result object with operation status
 * @throws {Error} When not in CREDENTIALS mode or client is undefined
 */
export const ReplyTweet = async (
  agent: StarknetAgentInterface,
  params: ReplyTweetParams
) => {
  try {
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }
    await twitter_client.sendTweet(params.response_text, params.tweet_id);
    return {
      status: 'success',
      tweet_id: params.tweet_id,
      response_text: params.response_text,
    };
  } catch (error) {
    console.log(error);
    return {
      status: 'failure',
      error: error,
    };
  }
};

/**
 * Creates and posts a Twitter thread from an array of messages
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {createAndPostTwitterThreadParams} params - Parameters containing array of thread messages
 * @returns {Promise<{status: string, error?: any}>} Result object indicating thread posting status
 * @throws {Error} When thread is empty, not in CREDENTIALS mode, or client is undefined
 */
export const createAndPostTwitterThread = async (
  agent: StarknetAgentInterface,
  params: createAndPostTwitterThreadParams
) => {
  try {
    console.log('CreateTwitterThread');
    const thread_size = params.thread.length;
    if (thread_size <= 0) {
      throw new Error('Your array of thread is empty');
    }
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_scraper = agent.getTwitterManager().twitter_scraper;
    if (!twitter_scraper) {
      throw new Error('twitter_client is undefined');
    }
    const twitter_client = twitter_scraper?.twitter_client;
    for (const [index, thread] of params.thread.entries()) {
      if (index === 0) {
        await twitter_client.sendTweet(thread);
        console.log(`Thread part ${index} = ${thread}`);
        continue;
      }
      let last_tweet_id;
      let conversation_id;
      const tweets = twitter_client.getTweetsAndRepliesByUserId(
        twitter_scraper.twitter_id,
        10
      );
      let i = 0;
      for await (const tweet of tweets) {
        if (i === 0) {
          last_tweet_id = tweet.id;
          conversation_id = tweet.conversationId;
          i = 1;
          continue;
        }
        if (tweet.conversationId === conversation_id) {
          last_tweet_id = tweet.id;
          continue;
        }
      }

      await twitter_client.sendTweet(thread, last_tweet_id);
    }
    return {
      status: 'success',
    };
  } catch (error) {
    console.log(error);
    return {
      status: 'failure',
      error: error,
    };
  }
};

/**
 * Follows a Twitter user specified by username
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {FollowXUserFromUsernameParams} params - Parameters containing the username to follow
 * @returns {Promise<{status: string, error?: any}>} Result object indicating follow operation status
 * @throws {Error} When not in CREDENTIALS mode or client is undefined
 */
export const FollowXUserFromUsername = async (
  agent: StarknetAgentInterface,
  params: FollowXUserFromUsernameParams
) => {
  try {
    console.log('getXUserIdFromUsername');
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }
    await twitter_client.followUser(params.username);
    return {
      status: 'success',
    };
  } catch (error) {
    console.log(error);
    return {
      status: 'failure',
      error: error,
    };
  }
};
