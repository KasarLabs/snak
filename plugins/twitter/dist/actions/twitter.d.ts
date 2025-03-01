import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { createAndPostTwitterThreadParams, creatTwitterPostParams, FollowXUserFromUsernameParams, ReplyTweetParams } from '../schema/index';
export declare const createTwitterpost: (agent: StarknetAgentInterface, params: creatTwitterPostParams) => Promise<{
    status: string;
    result?: undefined;
} | {
    status: string;
    result: import("twitter-api-v2").TweetV2PostTweetResult;
}>;
export declare const ReplyTweet: (agent: StarknetAgentInterface, params: ReplyTweetParams) => Promise<{
    status: string;
    tweet_id: string;
    response_text: string;
    error?: undefined;
} | {
    status: string;
    error: any;
    tweet_id?: undefined;
    response_text?: undefined;
}>;
export declare const createAndPostTwitterThread: (agent: StarknetAgentInterface, params: createAndPostTwitterThreadParams) => Promise<{
    status: string;
    error?: undefined;
} | {
    status: string;
    error: any;
}>;
export declare const FollowXUserFromUsername: (agent: StarknetAgentInterface, params: FollowXUserFromUsernameParams) => Promise<{
    status: string;
    error?: undefined;
} | {
    status: string;
    error: any;
}>;
