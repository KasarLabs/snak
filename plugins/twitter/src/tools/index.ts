import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';

import {
  createTwitterpostSchema,
  createAndPostTwitterThreadSchema,
  ReplyTweetSchema,
  getLastTweetsAndRepliesFromUserSchema,
  getLastTweetsOptionsSchema,
  FollowXUserFromUsernameSchema,
  getTwitterProfileFromUsernameSchema,
  getTwitterUserIdFromUsernameSchema,
  getLastTweetsFromUserSchema,
  getLastUserXTweetSchema,
} from '../schema';

import {
  createTwitterpost,
  ReplyTweet,
  createAndPostTwitterThread,
  FollowXUserFromUsername,
} from '../actions/twitter';
import {
  getLastUserTweet,
  getLastTweetsOptions,
  getOwnTwitterAccountInfo,
  getLastTweetsFromUser,
  getLastTweetsAndRepliesFromUser,
  getTwitterUserIdFromUsername,
  getTwitterProfileFromUsername,
} from '../actions/twitter_read';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  // Twitter Tools
  StarknetToolRegistry.push({
    name: 'create_twitter_post',
    plugins: 'twitter',
    description: 'Create new X/Twitter post',
    schema: createTwitterpostSchema,
    execute: createTwitterpost,
  });

  StarknetToolRegistry.push({
    name: 'reply_twitter_tweet',
    plugins: 'twitter',
    description: 'Reply to specific X/Twitter post by ID',
    schema: ReplyTweetSchema,
    execute: ReplyTweet,
  });

  StarknetToolRegistry.push({
    name: 'get_last_tweet',
    plugins: 'twitter',
    description: 'Get most recent post from specified X/Twitter account',
    schema: getLastUserXTweetSchema,
    execute: getLastUserTweet,
  });

  StarknetToolRegistry.push({
    name: 'get_last_tweets_options',
    plugins: 'twitter',
    description: 'Get specified number of posts matching search query',
    schema: getLastTweetsOptionsSchema,
    execute: getLastTweetsOptions,
  });

  StarknetToolRegistry.push({
    name: 'create_and_post_twitter_thread',
    plugins: 'twitter',
    description: 'Create and publish X/Twitter thread',
    schema: createAndPostTwitterThreadSchema,
    execute: createAndPostTwitterThread,
  });

  StarknetToolRegistry.push({
    name: 'follow_twitter_from_username',
    plugins: 'twitter',
    description: 'Follow X/Twitter user by username',
    schema: FollowXUserFromUsernameSchema,
    execute: FollowXUserFromUsername,
  });

  StarknetToolRegistry.push({
    name: 'get_twitter_profile_from_username',
    plugins: 'twitter',
    description: 'Get full X/Twitter profile data by username',
    schema: getTwitterProfileFromUsernameSchema,
    execute: getTwitterProfileFromUsername,
  });

  StarknetToolRegistry.push({
    name: 'get_twitter_user_id_from_username',
    plugins: 'twitter',
    description: 'Get X/Twitter user ID from username',
    schema: getTwitterUserIdFromUsernameSchema,
    execute: getTwitterUserIdFromUsername,
  });

  StarknetToolRegistry.push({
    name: 'get_last_tweet_and_replies_from_user',
    plugins: 'twitter',
    description: 'Get recent X/Twitter posts and replies from user',
    schema: getLastTweetsAndRepliesFromUserSchema,
    execute: getLastTweetsAndRepliesFromUser,
  });

  StarknetToolRegistry.push({
    name: 'get_last_tweet_from_user',
    plugins: 'twitter',
    description: 'Get recent X/Twitter posts from user',
    schema: getLastTweetsFromUserSchema,
    execute: getLastTweetsFromUser,
  });

  StarknetToolRegistry.push({
    name: 'get_own_twitter_account_info',
    plugins: 'twitter',
    description: 'Get current account profile data',
    execute: getOwnTwitterAccountInfo,
  });
};
