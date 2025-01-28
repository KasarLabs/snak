import { Body, Controller, OnModuleInit, Post } from '@nestjs/common';
import { StarknetAgent } from '../lib/agent/starknetAgent';
import { ConfigurationService } from '../config/configuration';
import { WalletService } from './services/wallet.service';

@Controller('wallet')
export class WalletController implements OnModuleInit {
  private agent: StarknetAgent;

  constructor(
    private readonly walletService: WalletService,
    private readonly config: ConfigurationService
  ) {}

  onModuleInit() {
    this.agent = new StarknetAgent({
      provider: this.config.starknet.provider,
      accountPrivateKey: this.config.starknet.privateKey,
      accountPublicKey: this.config.starknet.publicKey,
      aiModel: this.config.ai.model,
      aiProvider: this.config.ai.provider,
      aiProviderApiKey: this.config.ai.apiKey,
      agent_mode: 'call_data',
    });
  }

  @Post('call_data')
  async handleUserCalldataRequest(@Body() userRequest: any) {
    return await this.walletService.handleUserCalldataRequest(
      this.agent,
      userRequest
    );
  }
}
