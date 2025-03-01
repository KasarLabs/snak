import { TwitterApi } from 'twitter-api-v2';
import { Scraper } from 'agent-twitter-client';

/**
 * Configuration for Twitter API authentication and client setup
 * @interface TwitterApiConfig
 * @param {string} twitter_api - The Twitter API key for authentication
 * @param {string} twitter_api_secret - The Twitter API secret key
 * @param {string} twitter_access_token - OAuth access token
 * @param {string} twitter_access_token_secret - OAuth access token secret
 * @param {TwitterApi} twitter_api_client - Initialized Twitter API client instance
 */
export interface TwitterApiConfig {
  twitter_api: string;
  twitter_api_secret: string;
  twitter_access_token: string;
  twitter_access_token_secret: string;
  twitter_api_client: TwitterApi;
}

/**
 * Configuration for Twitter scraping functionality
 * @interface TwitterScraperConfig
 * @param {Scraper} twitter_client - The Twitter scraper client instance
 * @param {string} twitter_id - Unique identifier of the Twitter account
 * @param {string} twitter_username - Username of the Twitter account
 */
export interface TwitterScraperConfig {
  twitter_client: Scraper;
  twitter_id: string;
  twitter_username: string;
}

/**
 * Main Twitter interface combining API and Scraper configurations
 * @interface TwitterInterface
 * @param {TwitterScraperConfig} [twitter_scraper] - Optional scraper configuration
 * @param {TwitterApiConfig} [twitter_api] - Optional API configuration
 */
export interface TwitterInterface {
  twitter_scraper?: TwitterScraperConfig;
  twitter_api?: TwitterApiConfig;
}
