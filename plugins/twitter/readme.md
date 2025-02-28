<div align="center">
<img src="https://github.com/user-attachments/assets/a93c49d5-3259-4dc9-b508-c3688dc99162" width="250" height="250" alt="new-twitter-x-logo">
</div>

# Twitter Integration with Agent-Kit

This integration allows you to connect Twitter to your agent using either the [Twitter API](https://developer.x.com/en/docs/x-api) or the [Twitter-scraper](https://github.com/elizaOS/agent-twitter-client) from Agent-Kit. Follow the instructions below to set up your Twitter account.

## Setup Using Twitter API

1. **Create Developer Account :**<br />

- Ensure you have a Twitter account
- Visit the [Developer Platform](https://developer.x.com/en/docs/x-api)
- Get your API credentials
- Follow this [guide](https://developer.x.com/en/support/x-api/developer-account1) if you need help creating your developer account

2. **Configure .env File**

   ```sh
   TWITTER_AUTH_MODE = "API" # API mode

   #Your CREDENTIALS you get from the Developer Platform

   TWITTER_API="YOUR_TWITTER_API"
   TWITTER_API_SECRET="YOUR_TWITTER_API_SECRET"
   TWITTER_ACCESS_TOKEN="YOUR_TWITTER_ACCESS_TOKEN"
   TWITTER_ACCESS_TOKEN_SECRET="YOUR_TWITTER_ACCESS_TOKEN_SECRET"
   ```

3. **Initialize Twitter Manager**:<br />
   In your `StarknetAgent` class, initialize the Twitter manager by calling the `initializeTwitterManager()` function.

   ```typescript
   agent.initializeTwitterManager();
   ```

4. **Actions**<br />
   In API mode, you have access to the `create_twitter_post` action.

## Configuration via Twitter Scraper

1. **Configure .env File :**<br />

   ```sh
    TWITTER_AUTH_MODE = "CREDENTIALS" # API mode

    # Your Twitter Credentials

    TWITTER_USERNAME="YOUR_TWITTER_USERNAME"
    TWITTER_PASSWORD="YOUR_TWITTER_PASSWORD"
    TWITTER_EMAIL="YOUR_TWITTER_EMAIL"
   ```

2. **Initialize Twitter Manager**:<br />
   In your `StarknetAgent` class, initialize the Twitter manager by calling the `initializeTwitterManager()` function.

   ```typescript
   agent.initializeTwitterManager();
   ```

3. **Actions**<br />
   To see the complete list of available actions in credentials mode, visit [starkagent](https://www.starkagent.ai/plugins)

## Important Notes

- Choose the authentication mode (`API` or `CREDENTIALS`) based on your needs
- Verify that your credentials are properly configured in the `.env` file
- Check the official documentation for more details about API limitations
