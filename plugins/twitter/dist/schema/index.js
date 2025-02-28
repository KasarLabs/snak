"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAndPostTwitterThreadSchema = exports.getLastTweetsFromUserSchema = exports.getLastTweetsAndRepliesFromUserSchema = exports.getTwitterUserIdFromUsernameSchema = exports.getTwitterProfileFromUsernameSchema = exports.FollowXUserFromUsernameSchema = exports.getLastTweetsOptionsSchema = exports.ReplyTweetSchema = exports.getLastUserXTweetSchema = exports.createTwitterpostSchema = void 0;
const zod_1 = require("zod");
exports.createTwitterpostSchema = zod_1.z.object({
    post: zod_1.z.string().describe('This is the string you want to post on X'),
});
exports.getLastUserXTweetSchema = zod_1.z.object({
    account_name: zod_1.z
        .string()
        .describe('This is the account_name you want to get the latest tweet'),
});
exports.ReplyTweetSchema = zod_1.z.object({
    tweet_id: zod_1.z.string().describe('The tweet id you want to reply'),
    response_text: zod_1.z
        .string()
        .describe('This is the response you will send to the tweet'),
});
exports.getLastTweetsOptionsSchema = zod_1.z.object({
    query: zod_1.z
        .string()
        .describe('The search query . Any Twitter-compatible query format can be used'),
    maxTeets: zod_1.z.number().describe('The max tweets you want to get'),
    reply: zod_1.z
        .boolean()
        .describe('If you want to include replyed tweet in your request'),
});
exports.FollowXUserFromUsernameSchema = zod_1.z.object({
    username: zod_1.z.string().describe('The username you want to follow'),
});
exports.getTwitterProfileFromUsernameSchema = zod_1.z.object({
    username: zod_1.z.string().describe('The username you want to get the profile'),
});
exports.getTwitterUserIdFromUsernameSchema = zod_1.z.object({
    username: zod_1.z.string().describe('The username you want get the user_id'),
});
exports.getLastTweetsAndRepliesFromUserSchema = zod_1.z.object({
    username: zod_1.z
        .string()
        .describe('The username you want to get last tweets and replies'),
    maxTweets: zod_1.z
        .number()
        .describe('The number of tweets/replies you want to get from a User')
        .optional(),
});
exports.getLastTweetsFromUserSchema = zod_1.z.object({
    username: zod_1.z.string().describe('The username you want to get last tweets'),
    maxTweets: zod_1.z
        .number()
        .describe('The number of tweets you want to get from a User')
        .optional(),
});
exports.createAndPostTwitterThreadSchema = zod_1.z.object({
    thread: zod_1.z
        .array(zod_1.z.string())
        .describe('This is the array of where every index of this array contain a part of your thread'),
});
//# sourceMappingURL=index.js.map