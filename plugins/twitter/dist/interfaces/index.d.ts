import { TwitterApi } from 'twitter-api-v2';
import { Scraper } from 'agent-twitter-client';
export interface TwitterApiConfig {
    twitter_api: string;
    twitter_api_secret: string;
    twitter_access_token: string;
    twitter_access_token_secret: string;
    twitter_api_client: TwitterApi;
}
export interface TwitterScraperConfig {
    twitter_client: Scraper;
    twitter_id: string;
    twitter_username: string;
}
export interface TwitterInterface {
    twitter_scraper?: TwitterScraperConfig;
    twitter_api?: TwitterApiConfig;
}
