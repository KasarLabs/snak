import { defaultAgentConfiguration } from './helpers.js';
import { SnakClient } from './snak-client-http.js';
import { SnakConfig, UnitTestResult } from './types.js';
import chalk from 'chalk';
import ora from 'ora';

export class TestRunner {
  public client: SnakClient;
  private results: UnitTestResult[] = [];

  constructor(config: SnakConfig) {
    this.client = new SnakClient(config);
  }

  async runTest(testName: string, testFn: () => Promise<any>): Promise<UnitTestResult> {
    const spinner = ora(`Running ${testName}...`).start();
    const startTime = Date.now();

    try {
      const response = await testFn();
      const duration = Date.now() - startTime;
      
      spinner.succeed(chalk.green(`Success: ${testName} passed (${duration}ms)`));
      
      const result: UnitTestResult = {
        testName,
        success: true,
        durationMs: duration,
        response
      };
      
      this.results.push(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      spinner.fail(chalk.red(`Error: ${testName} failed (${duration}ms)`));
      
      const result: UnitTestResult = {
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
    console.log(chalk.blue.bold('\nStarting Snak API Tests\n'));

    // Health check
    await this.runTest('Health Check', () => this.client.healthCheck());

    // Agent tests
    await this.runTest('Get Agents List', () => this.client.getAgents());
    
    // Try to create a test agent based on the starknet-rpc agent example
    const testAgent = await this.runTest('Create Test Agent', () => 
      this.client.createAgent({
        agent: defaultAgentConfiguration('test-agent')
      })
    );

    if (testAgent.success && testAgent.response) {
      console.log('Success: Agent created successfully, response:', testAgent.response);
      
      const agents = await this.runTest('Get Agents List Again', () => 
        this.client.getAgents()
      );

      console.log('Agents:', agents);
      
      if (agents.success && agents.response && (agents.response as any).data && ((agents.response as any).data as any[]).length > 0) {
        console.log('Success: Found agents:', ((agents.response as any).data as any[]).length);
        const agentId = ((agents.response as any).data as any[])[0].id;
        
        console.log('Waiting 0.5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 500));
          
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
        console.log('Error: No agents found or agents list failed');
      }
    } else {
      console.log('Error: Agent creation failed or no response');
    }

    this.printSummary();
  }

  public printSummary(): void {
    console.log(chalk.blue.bold('\nTest Summary\n'));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.durationMs, 0);

    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.blue(`Total Duration: ${totalDuration}ms`));
    const successRate = this.results.length > 0 
     ? ((passed / this.results.length) * 100).toFixed(1) 
     : '0.0';
    console.log(chalk.blue(`Success Rate: ${successRate}%`));

    if (failed > 0) {
      console.log(chalk.red.bold('\nFailed Tests:'));
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(chalk.red(`  • ${result.testName}: ${result.error}`));
        });
    }

    console.log(chalk.blue.bold('\nAll tests completed!\n'));
  }

  getResults(): UnitTestResult[] {
    return this.results;
  }
}
