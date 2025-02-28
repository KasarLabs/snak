import { z } from 'zod';

export const createTwitterpostSchema = z.object({
  post: z.string().describe('This is the string you want to post on X'),
});

export const getLastUserXTweetSchema = z.object({
  account_name: z
    .string()
    .describe('This is the account_name you want to get the latest tweet'),
});

export const ReplyTweetSchema = z.object({
  tweet_id: z.string().describe('The tweet id you want to reply'),
  response_text: z
    .string()
    .describe('This is the response you will send to the tweet'),
});

export const getLastTweetsOptionsSchema = z.object({
  query: z
    .string()
    .describe(
      'The search query . Any Twitter-compatible query format can be used'
    ),
  maxTeets: z.number().describe('The max tweets you want to get'),
  reply: z
    .boolean()
    .describe('If you want to include replyed tweet in your request'),
});

export const FollowXUserFromUsernameSchema = z.object({
  username: z.string().describe('The username you want to follow'),
});

export const getTwitterProfileFromUsernameSchema = z.object({
  username: z.string().describe('The username you want to get the profile'),
});

export const getTwitterUserIdFromUsernameSchema = z.object({
  username: z.string().describe('The username you want get the user_id'),
});

export const getLastTweetsAndRepliesFromUserSchema = z.object({
  username: z
    .string()
    .describe('The username you want to get last tweets and replies'),
  maxTweets: z
    .number()
    .describe('The number of tweets/replies you want to get from a User')
    .optional(),
});

export const getLastTweetsFromUserSchema = z.object({
  username: z.string().describe('The username you want to get last tweets'),
  maxTweets: z
    .number()
    .describe('The number of tweets you want to get from a User')
    .optional(),
});

export const createAndPostTwitterThreadSchema = z.object({
  thread: z
    .array(z.string())
    .describe(
      'This is the array of where every index of this array contain a part of your thread'
    ),
});

export type getLastUserXTweetParams = z.infer<typeof getLastUserXTweetSchema>;
export type ReplyTweetParams = z.infer<typeof ReplyTweetSchema>;
export type getLastTweetsOptionsParams = z.infer<
  typeof getLastTweetsOptionsSchema
>;
export type FollowXUserFromUsernameParams = z.infer<
  typeof FollowXUserFromUsernameSchema
>;
export type getTwitterProfileFromUsernameParams = z.infer<
  typeof getTwitterProfileFromUsernameSchema
>;
export type getTwitterUserIdFromUsernameParams = z.infer<
  typeof getTwitterUserIdFromUsernameSchema
>;
export type getLastTweetsAndRepliesFromUserParams = z.infer<
  typeof getLastTweetsAndRepliesFromUserSchema
>;
export type getLastTweetsFromUserParams = z.infer<
  typeof getLastTweetsFromUserSchema
>;
export type createAndPostTwitterThreadParams = z.infer<
  typeof createAndPostTwitterThreadSchema
>;
export type creatTwitterPostParams = z.infer<typeof createTwitterpostSchema>;
