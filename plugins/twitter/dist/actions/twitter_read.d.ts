import { getLastTweetsAndRepliesFromUserParams, getLastTweetsFromUserParams, getLastTweetsOptionsParams, getLastUserXTweetParams, getTwitterProfileFromUsernameParams, getTwitterUserIdFromUsernameParams } from '../schema/index';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { TweetType } from '../types/twitter_types';
export declare const getLastUserTweet: (agent: StarknetAgentInterface, params: getLastUserXTweetParams) => Promise<{
    status: string;
    post_id: string | undefined;
    post_text: string | undefined;
    error?: undefined;
} | {
    status: string;
    error: any;
    post_id?: undefined;
    post_text?: undefined;
}>;
export declare const getLastTweetsOptions: (agent: StarknetAgentInterface, params: getLastTweetsOptionsParams) => Promise<{
    status: string;
    result: TweetType[];
    error?: undefined;
} | {
    status: string;
    error: any;
    result?: undefined;
}>;
export declare const getOwnTwitterAccountInfo: (agent: StarknetAgentInterface) => Promise<{
    status: string;
    my_account_username: import("agent-twitter-client").Profile | undefined;
    error?: undefined;
} | {
    status: string;
    error: any;
    my_account_username?: undefined;
}>;
export declare const getLastTweetsFromUser: (agent: StarknetAgentInterface, params: getLastTweetsFromUserParams) => Promise<{
    status: string;
    tweets: TweetType[];
    error?: undefined;
} | {
    status: string;
    error: any;
    tweets?: undefined;
}>;
export declare const getLastTweetsAndRepliesFromUser: (agent: StarknetAgentInterface, params: getLastTweetsAndRepliesFromUserParams) => Promise<{
    status: string;
    tweets: TweetType[];
    error?: undefined;
} | {
    status: string;
    error: any;
    tweets?: undefined;
}>;
export declare const getTwitterUserIdFromUsername: (agent: StarknetAgentInterface, params: getTwitterUserIdFromUsernameParams) => Promise<{
    status: string;
    user_id: string;
    error?: undefined;
} | {
    status: string;
    error: any;
    user_id?: undefined;
}>;
export declare const getTwitterProfileFromUsername: (agent: StarknetAgentInterface, params: getTwitterProfileFromUsernameParams) => Promise<{
    status: string;
    user_id: import("agent-twitter-client").Profile;
    error?: undefined;
} | {
    status: string;
    error: any;
    user_id?: undefined;
}>;
