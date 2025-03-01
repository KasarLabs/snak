"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schema_1 = require("../schema");
const twitter_1 = require("../actions/twitter");
const twitter_read_1 = require("../actions/twitter_read");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'create_twitter_post',
        plugins: 'twitter',
        description: 'Create new X/Twitter post',
        schema: schema_1.createTwitterpostSchema,
        execute: twitter_1.createTwitterpost,
    });
    StarknetToolRegistry.push({
        name: 'reply_twitter_tweet',
        plugins: 'twitter',
        description: 'Reply to specific X/Twitter post by ID',
        schema: schema_1.ReplyTweetSchema,
        execute: twitter_1.ReplyTweet,
    });
    StarknetToolRegistry.push({
        name: 'get_last_tweet',
        plugins: 'twitter',
        description: 'Get most recent post from specified X/Twitter account',
        schema: schema_1.getLastUserXTweetSchema,
        execute: twitter_read_1.getLastUserTweet,
    });
    StarknetToolRegistry.push({
        name: 'get_last_tweets_options',
        plugins: 'twitter',
        description: 'Get specified number of posts matching search query',
        schema: schema_1.getLastTweetsOptionsSchema,
        execute: twitter_read_1.getLastTweetsOptions,
    });
    StarknetToolRegistry.push({
        name: 'create_and_post_twitter_thread',
        plugins: 'twitter',
        description: 'Create and publish X/Twitter thread',
        schema: schema_1.createAndPostTwitterThreadSchema,
        execute: twitter_1.createAndPostTwitterThread,
    });
    StarknetToolRegistry.push({
        name: 'follow_twitter_from_username',
        plugins: 'twitter',
        description: 'Follow X/Twitter user by username',
        schema: schema_1.FollowXUserFromUsernameSchema,
        execute: twitter_1.FollowXUserFromUsername,
    });
    StarknetToolRegistry.push({
        name: 'get_twitter_profile_from_username',
        plugins: 'twitter',
        description: 'Get full X/Twitter profile data by username',
        schema: schema_1.getTwitterProfileFromUsernameSchema,
        execute: twitter_read_1.getTwitterProfileFromUsername,
    });
    StarknetToolRegistry.push({
        name: 'get_twitter_user_id_from_username',
        plugins: 'twitter',
        description: 'Get X/Twitter user ID from username',
        schema: schema_1.getTwitterUserIdFromUsernameSchema,
        execute: twitter_read_1.getTwitterUserIdFromUsername,
    });
    StarknetToolRegistry.push({
        name: 'get_last_tweet_and_replies_from_user',
        plugins: 'twitter',
        description: 'Get recent X/Twitter posts and replies from user',
        schema: schema_1.getLastTweetsAndRepliesFromUserSchema,
        execute: twitter_read_1.getLastTweetsAndRepliesFromUser,
    });
    StarknetToolRegistry.push({
        name: 'get_last_tweet_from_user',
        plugins: 'twitter',
        description: 'Get recent X/Twitter posts from user',
        schema: schema_1.getLastTweetsFromUserSchema,
        execute: twitter_read_1.getLastTweetsFromUser,
    });
    StarknetToolRegistry.push({
        name: 'get_own_twitter_account_info',
        plugins: 'twitter',
        description: 'Get current account profile data',
        execute: twitter_read_1.getOwnTwitterAccountInfo,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map