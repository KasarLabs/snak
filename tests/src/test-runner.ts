import { SnakClient } from './snak-client-http.js';
import { SnakConfig, TestResult } from './types.js';
import chalk from 'chalk';
import ora from 'ora';

export class TestRunner {
  public client: SnakClient;
  private results: TestResult[] = [];

  constructor(config: SnakConfig) {
    this.client = new SnakClient(config);
  }

  async runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
    const spinner = ora(`Running ${testName}...`).start();
    const startTime = Date.now();

    try {
      const response = await testFn();
      const duration = Date.now() - startTime;
      
      spinner.succeed(chalk.green(`✅ ${testName} passed (${duration}ms)`));
      
      const result: TestResult = {
        testName,
        success: true,
        durationMs: duration,
        response
      };
      
      this.results.push(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      spinner.fail(chalk.red(`❌ ${testName} failed (${duration}ms)`));
      
      const result: TestResult = {
        testName,
        success: false,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.results.push(result);
      return result;
    }
  }

  async runAllTests(): Promise<void> {
    console.log(chalk.blue.bold('\n🧪 Starting Snak API Tests\n'));

    // Health check
    await this.runTest('Health Check', () => this.client.healthCheck());

    // Agent tests
    await this.runTest('Get Agents List', () => this.client.getAgents());
    
    // Try to create a test agent based on the starknet-rpc agent example
    const testAgent = await this.runTest('Create Test Agent', () => 
      this.client.createAgent({
        agent: {
          name: 'Test RPC Agent',
          group: 'test',
          description: 'A test agent created for testing purposes, based on the Starknet RPC agent configuration.',
          lore: [
            'I was created as a test agent to validate the Snak Agent creation system.',
            'Born from the need to test API endpoints and agent functionality.',
            'My purpose is to demonstrate that agent creation works correctly.'
          ],
          objectives: [
            'Validate that agent creation endpoints work properly.',
            'Test agent configuration and initialization.',
            'Demonstrate successful agent lifecycle management.',
            'Serve as a reference for other test agents.'
          ],
          knowledge: [
            'I have knowledge of the Snak Agent system architecture.',
            'I understand how to interact with the test environment.',
            'I can help validate API functionality and responses.',
            'I stay updated with the test requirements and specifications.'
          ],
          interval: 15000,
          plugins: ['rpc'],
          memory: {
            enabled: false,
            memorySize: 20,
            shortTermMemorySize: 15
          },
          rag: {
            enabled: true,
            embeddingModel: "Xenova/all-MiniLM-L6-v2"
          },
          mode: 'interactive'
        }
      })
    );

    if (testAgent.success && testAgent.response) {
      console.log('✅ Agent created successfully, response:', testAgent.response);
      
      const agents = await this.runTest('Get Agents List Again', () => 
        this.client.getAgents()
      );

      console.log('Agents:', agents);
      
      if (agents.success && agents.response && (agents.response as any).data && ((agents.response as any).data as any[]).length > 0) {
        console.log('✅ Found agents:', ((agents.response as any).data as any[]).length);
        const agentId = ((agents.response as any).data as any[])[0].id;
          
        await this.runTest('Send Agent Request', () => 
          this.client.sendAgentRequest({
            request: {
              content: 'Hello, this is a test message',
              agent_id: agentId
            }
          })
        );
        const testFileContent = 'This is a test file content for testing file upload functionality.';
        const testFileBuffer = Buffer.from(testFileContent, 'utf-8');
        
        await this.runTest('Upload Test File', () => 
          this.client.uploadFile(agentId, testFileBuffer, 'test.txt')
        );
        await this.runTest('List Files', () => 
          this.client.listFiles(agentId)
        );
        await this.runTest('Delete Test Agent', () => 
          this.client.deleteAgent(agentId)
        );
      } else {
        console.log('❌ No agents found or agents list failed');
      }
    } else {
      console.log('❌ Agent creation failed or no response');
    }

    this.printSummary();
  }

  public printSummary(): void {
    console.log(chalk.blue.bold('\n📊 Test Summary\n'));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.durationMs, 0);

    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.blue(`⏱️  Total Duration: ${totalDuration}ms`));
    const successRate = this.results.length > 0 
     ? ((passed / this.results.length) * 100).toFixed(1) 
     : '0.0';
    console.log(chalk.blue(`📈 Success Rate: ${successRate}%`));

    if (failed > 0) {
      console.log(chalk.red.bold('\n❌ Failed Tests:'));
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(chalk.red(`  • ${result.testName}: ${result.error}`));
        });
    }

    console.log(chalk.blue.bold('\n🎯 All tests completed!\n'));
  }

  getResults(): TestResult[] {
    return this.results;
  }
}
