import { z } from 'zod';
export declare const createTwitterpostSchema: z.ZodObject<{
    post: z.ZodString;
}, "strip", z.ZodTypeAny, {
    post: string;
}, {
    post: string;
}>;
export declare const getLastUserXTweetSchema: z.ZodObject<{
    account_name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    account_name: string;
}, {
    account_name: string;
}>;
export declare const ReplyTweetSchema: z.ZodObject<{
    tweet_id: z.ZodString;
    response_text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tweet_id: string;
    response_text: string;
}, {
    tweet_id: string;
    response_text: string;
}>;
export declare const getLastTweetsOptionsSchema: z.ZodObject<{
    query: z.ZodString;
    maxTeets: z.ZodNumber;
    reply: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    query: string;
    maxTeets: number;
    reply: boolean;
}, {
    query: string;
    maxTeets: number;
    reply: boolean;
}>;
export declare const FollowXUserFromUsernameSchema: z.ZodObject<{
    username: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
}, {
    username: string;
}>;
export declare const getTwitterProfileFromUsernameSchema: z.ZodObject<{
    username: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
}, {
    username: string;
}>;
export declare const getTwitterUserIdFromUsernameSchema: z.ZodObject<{
    username: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
}, {
    username: string;
}>;
export declare const getLastTweetsAndRepliesFromUserSchema: z.ZodObject<{
    username: z.ZodString;
    maxTweets: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    username: string;
    maxTweets?: number | undefined;
}, {
    username: string;
    maxTweets?: number | undefined;
}>;
export declare const getLastTweetsFromUserSchema: z.ZodObject<{
    username: z.ZodString;
    maxTweets: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    username: string;
    maxTweets?: number | undefined;
}, {
    username: string;
    maxTweets?: number | undefined;
}>;
export declare const createAndPostTwitterThreadSchema: z.ZodObject<{
    thread: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    thread: string[];
}, {
    thread: string[];
}>;
export type getLastUserXTweetParams = z.infer<typeof getLastUserXTweetSchema>;
export type ReplyTweetParams = z.infer<typeof ReplyTweetSchema>;
export type getLastTweetsOptionsParams = z.infer<typeof getLastTweetsOptionsSchema>;
export type FollowXUserFromUsernameParams = z.infer<typeof FollowXUserFromUsernameSchema>;
export type getTwitterProfileFromUsernameParams = z.infer<typeof getTwitterProfileFromUsernameSchema>;
export type getTwitterUserIdFromUsernameParams = z.infer<typeof getTwitterUserIdFromUsernameSchema>;
export type getLastTweetsAndRepliesFromUserParams = z.infer<typeof getLastTweetsAndRepliesFromUserSchema>;
export type getLastTweetsFromUserParams = z.infer<typeof getLastTweetsFromUserSchema>;
export type createAndPostTwitterThreadParams = z.infer<typeof createAndPostTwitterThreadSchema>;
export type creatTwitterPostParams = z.infer<typeof createTwitterpostSchema>;
