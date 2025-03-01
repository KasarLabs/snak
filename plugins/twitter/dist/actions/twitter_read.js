"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTwitterProfileFromUsername = exports.getTwitterUserIdFromUsername = exports.getLastTweetsAndRepliesFromUser = exports.getLastTweetsFromUser = exports.getOwnTwitterAccountInfo = exports.getLastTweetsOptions = exports.getLastUserTweet = void 0;
const getLastUserTweet = async (agent, params) => {
    try {
        console.log('GetLastUserTweet');
        if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
            throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
        }
        const twitter_client = agent.getTwitterManager().twitter_scraper?.twitter_client;
        if (!twitter_client) {
            throw new Error('twitter_client is undefined');
        }
        const lastestTweet = await twitter_client.getLatestTweet(params.account_name);
        if (!lastestTweet) {
            throw new Error('Error trying to get the latest tweet');
        }
        return {
            status: 'success',
            post_id: lastestTweet.id,
            post_text: lastestTweet.text,
        };
    }
    catch (error) {
        console.log(error);
        return {
            status: 'failure',
            error: error,
        };
    }
};
exports.getLastUserTweet = getLastUserTweet;
const getLastTweetsOptions = async (agent, params) => {
    try {
        console.log('GetLastTweetsOptions');
        if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
            throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
        }
        const twitter_client = agent.getTwitterManager().twitter_scraper?.twitter_client;
        const collectedTweets = [];
        if (!twitter_client) {
            throw new Error('twitter_client is undefined');
        }
        const tweets = twitter_client.searchTweets(params.query, params.maxTeets);
        for await (const tweet of tweets) {
            const tweet_type = {
                id: tweet.id,
                content: tweet.text,
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
    }
    catch (error) {
        console.log(error);
        return {
            status: 'failure',
            error: error,
        };
    }
};
exports.getLastTweetsOptions = getLastTweetsOptions;
const getOwnTwitterAccountInfo = async (agent) => {
    try {
        console.log('getOwnTwitterAccountInfo');
        if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
            throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
        }
        const twitter_client = agent.getTwitterManager().twitter_scraper?.twitter_client;
        if (!twitter_client) {
            throw new Error('twitter_client is undefined');
        }
        const my_twitter_account = await twitter_client.me();
        console.log(my_twitter_account);
        return {
            status: 'success',
            my_account_username: my_twitter_account,
        };
    }
    catch (error) {
        console.log(error);
        return {
            status: 'failure',
            error: error,
        };
    }
};
exports.getOwnTwitterAccountInfo = getOwnTwitterAccountInfo;
const getLastTweetsFromUser = async (agent, params) => {
    console.log('getLastTweetsFromUser');
    try {
        if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
            throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
        }
        const twitter_client = agent.getTwitterManager().twitter_scraper?.twitter_client;
        if (!twitter_client) {
            throw new Error('twitter_client is undefined');
        }
        const tweets = params.maxTweets
            ? twitter_client.getTweets(params.username, params.maxTweets)
            : twitter_client.getTweets(params.username);
        const collectedTweets = [];
        for await (const tweet of tweets) {
            const tweet_type = {
                id: tweet.id,
                content: tweet.text,
            };
            collectedTweets.push(tweet_type);
        }
        return {
            status: 'success',
            tweets: collectedTweets,
        };
    }
    catch (error) {
        console.log(error);
        return {
            status: 'failure',
            error: error,
        };
    }
};
exports.getLastTweetsFromUser = getLastTweetsFromUser;
const getLastTweetsAndRepliesFromUser = async (agent, params) => {
    try {
        console.log('getLastTweetsAndRepliesFromUser');
        if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
            throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
        }
        const twitter_client = agent.getTwitterManager().twitter_scraper?.twitter_client;
        if (!twitter_client) {
            throw new Error('twitter_client is undefined');
        }
        const tweets = params.maxTweets
            ? twitter_client.getTweetsAndReplies(params.username, params.maxTweets)
            : twitter_client.getTweetsAndReplies(params.username);
        const collectedTweets = [];
        for await (const tweet of tweets) {
            const tweet_type = {
                id: tweet.id,
                content: tweet.text,
            };
            collectedTweets.push(tweet_type);
        }
        return {
            status: 'success',
            tweets: collectedTweets,
        };
    }
    catch (error) {
        console.log(error);
        return {
            status: 'failure',
            error: error,
        };
    }
};
exports.getLastTweetsAndRepliesFromUser = getLastTweetsAndRepliesFromUser;
const getTwitterUserIdFromUsername = async (agent, params) => {
    try {
        console.log('getTwitterUserIdFromUsername');
        if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
            throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
        }
        const twitter_client = agent.getTwitterManager().twitter_scraper?.twitter_client;
        if (!twitter_client) {
            throw new Error('twitter_client is undefined');
        }
        const userId = await twitter_client.getUserIdByScreenName(params.username);
        return {
            status: 'success',
            user_id: userId,
        };
    }
    catch (error) {
        console.log(error);
        return {
            status: 'failure',
            error: error,
        };
    }
};
exports.getTwitterUserIdFromUsername = getTwitterUserIdFromUsername;
const getTwitterProfileFromUsername = async (agent, params) => {
    try {
        console.log('geTwitterUserIdFromUsername');
        if (agent.getTwitterAuthMode() != 'CREDENTIALS') {
            throw new Error('You need to be in CREDENTIALS twitter_auth_mode');
        }
        const twitter_client = agent.getTwitterManager().twitter_scraper?.twitter_client;
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
    }
    catch (error) {
        console.log(error);
        return {
            status: 'failure',
            error: error,
        };
    }
};
exports.getTwitterProfileFromUsername = getTwitterProfileFromUsername;
//# sourceMappingURL=twitter_read.js.map