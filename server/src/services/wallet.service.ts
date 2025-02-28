import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration';
import {
  AgentCredentialsError,
  AgentValidationError,
} from '../../common/errors';
import { IAgent } from '../interfaces/agent.interface';
import { AgentRequestDTO } from '../dto/agents';
import { IWalletService } from '../interfaces/wallet-service.inferface';
import Anthropic from '@anthropic-ai/sdk';
import { Model } from '@anthropic-ai/sdk/resources';

@Injectable()
export class WalletService implements IWalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly config: ConfigurationService) {}

  async handleUserCalldataRequest(
    agent: IAgent,
    userRequest: AgentRequestDTO
  ): Promise<any> {
    try {
      const status = await this.getAgentStatus(agent);
      if (!status.isReady) {
        throw new AgentCredentialsError('Agent is not properly configured');
      }

      if (!(await agent.validateRequest(userRequest.request))) {
        throw new AgentValidationError('Invalid request format or parameters');
      }
      const result = await agent.execute_call_data(userRequest.request);
      return result;
    } catch (error: any) {
      return error;
    }
  }

  async HandleOutputIAParsing(userRequest: AgentRequestDTO): Promise<any> {
    try {
      const request = `Your are an AI Assistant that have for objectives :
       You will receive JSON format, I want you to extract all data you can and write a response clear.
       For the format response : 
       -  Very important You only send me back the response without any explication
       -  If its a success add ✅ if its a failure add ❌ at the start
       -  If you got a transaction_hash, display it in last and do https://starkscan.co/tx/{transaction_hash} 

       example you receive "{\\"status\\":\\"success\\",\\"transaction_type\\":\\"READ\\",\\"balance\\":\\"0.001217909843430357\\"}"\n' you return 'Your Read Transaction is succesful you balance is 0.00121.
       This is your the data you need to parse :${userRequest.request}`;

      const anthropic = new Anthropic({
        apiKey: process.env.AI_PROVIDER_API_KEY, // defaults to process.env["ANTHROPIC_API_KEY"]
      });

      const msg = await anthropic.messages.create({
        model: process.env.AI_MODEL as Model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: request }],
      });

      if ('text' in msg.content[0]) {
        console.log(msg.content[0].text);
        return msg.content[0].text;
      }
      return '';
    } catch (error) {
      return error;
    }
  }

  async getAgentStatus(agent: IAgent): Promise<{
    isReady: boolean;
    walletConnected: boolean;
    apiKeyValid: boolean;
  }> {
    try {
      const credentials = agent.getAccountCredentials();
      const model = agent.getModelCredentials();

      return {
        isReady: Boolean(credentials && model.aiProviderApiKey),
        walletConnected: Boolean(credentials.accountPrivateKey),
        apiKeyValid: Boolean(model.aiProviderApiKey),
      };
    } catch (error) {
      this.logger.error('Error checking agent status', error);
      return {
        isReady: false,
        walletConnected: false,
        apiKeyValid: false,
      };
    }
  }
}
