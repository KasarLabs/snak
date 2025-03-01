import {
  getLastTweetsAndRepliesFromUserParams,
  getLastTweetsFromUserParams,
  getLastTweetsOptionsParams,
  getLastUserXTweetParams,
  getTwitterProfileFromUsernameParams,
  getTwitterUserIdFromUsernameParams,
} from '../schema/index';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { TweetType } from '../types/twitter_types';

/**
 * Retrieves the latest tweet from a specified user
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {getLastUserXTweetParams} params - Parameters containing the account name to fetch from
 * @returns {Promise<{status: string, post_id?: string, post_text?: string, error?: any}>} The latest tweet information or error
 * @throws {Error} When not in CREDENTIALS mode or client is undefined
 */
export const getLastUserTweet = async (
  agent: StarknetAgentInterface,
  params: getLastUserXTweetParams
) => {
  try {
    console.log('GetLastUserTweet');
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }

    const lastestTweet = await twitter_client.getLatestTweet(
      params.account_name
    );
    if (!lastestTweet) {
      throw new Error('Error trying to get the latest tweet');
    }
    return {
      status: 'success',
      post_id: lastestTweet.id,
      post_text: lastestTweet.text,
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
 * Searches tweets based on specific query and maximum tweet count
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {getLastTweetsOptionsParams} params - Parameters containing search query and maximum tweets to fetch
 * @returns {Promise<{status: string, result?: TweetType[], error?: any}>} Collection of matching tweets or error
 * @throws {Error} When not in CREDENTIALS mode or client is undefined
 */
export const getLastTweetsOptions = async (
  agent: StarknetAgentInterface,
  params: getLastTweetsOptionsParams
) => {
  try {
    console.log('GetLastTweetsOptions');
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    const collectedTweets: TweetType[] = [];

    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }
    const tweets = twitter_client.searchTweets(params.query, params.maxTeets);
    for await (const tweet of tweets) {
      const tweet_type: TweetType = {
        id: tweet.id as string,
        content: tweet.text as string,
      };
      console.log(tweet.id);
      console.log(tweet.text);
      collectedTweets.push(tweet_type);
    }
    console.log(collectedTweets);
    return {
      status: 'success',
      result: collectedTweets,
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
 * Retrieves information about the authenticated Twitter account set in .env
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @returns {Promise<{status: string, my_account_username?: string, error?: any}>} Account information or error
 * @throws {Error} When not in CREDENTIALS mode or client is undefined
 */
export const getOwnTwitterAccountInfo = async (
  agent: StarknetAgentInterface
) => {
  try {
    console.log('getOwnTwitterAccountInfo');
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }

    const my_twitter_account = await twitter_client.me();
    console.log(my_twitter_account);
    return {
      status: 'success',
      my_account_username: my_twitter_account,
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
 * Fetches recent tweets from a specified user
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {getLastTweetsFromUserParams} params - Parameters containing username and optional tweet limit
 * @returns {Promise<{status: string, tweets?: TweetType[], error?: any}>} Collection of user's tweets or error
 * @throws {Error} When not in CREDENTIALS mode or client is undefined
 */
export const getLastTweetsFromUser = async (
  agent: StarknetAgentInterface,
  params: getLastTweetsFromUserParams
) => {
  console.log('getLastTweetsFromUser');
  try {
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }
    const tweets = params.maxTweets
      ? twitter_client.getTweets(params.username, params.maxTweets)
      : twitter_client.getTweets(params.username);
    const collectedTweets: TweetType[] = [];
    for await (const tweet of tweets) {
      const tweet_type: TweetType = {
        id: tweet.id as string,
        content: tweet.text as string,
      };
      collectedTweets.push(tweet_type);
    }

    return {
      status: 'success',
      tweets: collectedTweets,
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
 * Retrieves recent tweets and replies from a specified user
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {getLastTweetsAndRepliesFromUserParams} params - Parameters containing username and optional tweet limit
 * @returns {Promise<{status: string, tweets?: TweetType[], error?: any}>} Collection of user's tweets and replies or error
 * @throws {Error} When not in CREDENTIALS mode or client is undefined
 */
export const getLastTweetsAndRepliesFromUser = async (
  agent: StarknetAgentInterface,
  params: getLastTweetsAndRepliesFromUserParams
) => {
  try {
    console.log('getLastTweetsAndRepliesFromUser');
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }
    const tweets = params.maxTweets
      ? twitter_client.getTweetsAndReplies(params.username, params.maxTweets)
      : twitter_client.getTweetsAndReplies(params.username);

    const collectedTweets: TweetType[] = [];
    for await (const tweet of tweets) {
      const tweet_type: TweetType = {
        id: tweet.id as string,
        content: tweet.text as string,
      };
      collectedTweets.push(tweet_type);
    }

    return {
      status: 'success',
      tweets: collectedTweets,
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
 * Gets Twitter user ID from a username
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {getTwitterUserIdFromUsernameParams} params - Parameters containing the username to look up
 * @returns {Promise<{status: string, user_id?: string, error?: any}>} User ID information or error
 * @throws {Error} When not in CREDENTIALS mode or client is undefined
 */
export const getTwitterUserIdFromUsername = async (
  agent: StarknetAgentInterface,
  params: getTwitterUserIdFromUsernameParams
) => {
  try {
    console.log('getTwitterUserIdFromUsername');
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }
    const userId = await twitter_client.getUserIdByScreenName(params.username);
    return {
      status: 'success',
      user_id: userId,
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
 * Retrieves Twitter profile information from a username
 * @param {StarknetAgentInterface} agent - The Starknet agent instance containing Twitter authentication
 * @param {getTwitterProfileFromUsernameParams} params - Parameters containing the username to fetch profile for
 * @returns {Promise<{status: string, user_id?: any, error?: any}>} Profile information or error
 * @throws {Error} When not in CREDENTIALS mode, client is undefined, or account doesn't exist
 */
export const getTwitterProfileFromUsername = async (
  agent: StarknetAgentInterface,
  params: getTwitterProfileFromUsernameParams
) => {
  try {
    console.log('geTwitterUserIdFromUsername');
    if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
      throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
    }
    const twitter_client =
      agent.getTwitterManager().twitter_scraper?.twitter_client;
    if (!twitter_client) {
      throw new Error('twitter_client is undefined');
    }
    const userId = await twitter_client.getProfile(params.username);
    if (!userId) {
      throw new Error(`Account don't exist`);
    }
    return {
      status: 'success',
      user_id: userId,
    };
  } catch (error) {
    console.log(error);
    return {
      status: 'failure',
      error: error,
    };
  }
};
