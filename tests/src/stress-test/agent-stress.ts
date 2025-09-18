import { TestRunner } from '../test-runner.js';
import { QueueMetrics } from '../types.js';
import chalk from 'chalk';
import { createConfigForUser } from '../helpers.js';
import { createAgentWithTracking } from '../agents/creation.js';
import { CleanupAgent, cleanupAgents } from '../agents/cleanup.js';

interface AgentStressTestResult {
  testName: string;
  success: boolean;
  duration: number;
  agentsCreated: number;
  agentsVerified: number;
  agentsDeleted: number;
  queueMetrics: QueueMetrics[];
  throughput: number;
  avgProcessingTime: number;
  error?: string;
}

async function testAgentStressWithMultipleUsers() {
  console.log(chalk.blue.bold('Agent Stress Test - Multiple Users System\n'));
  console.log(chalk.yellow('Testing: Concurrent agent creation with multiple users\n'));

  const testResults: AgentStressTestResult[] = [];

  const repeat = 15;
  const testScenarios = [
    { name: '100 Users', users: 3, agentsPerUser: 3 },
  ];

  const defaultConfig = createConfigForUser();
  const defaultTestRunner = new TestRunner(defaultConfig);

  await defaultTestRunner.runTest('Health Check', () => defaultTestRunner.client.healthCheck());

  for (let i = 0; i < repeat; i++) {
    for (const scenario of testScenarios) {
      console.log(chalk.blue(`\nTesting ${scenario.name}: ${scenario.users} users with ${scenario.agentsPerUser} agents each`));

      const testName = `${scenario.name} - ${scenario.users * scenario.agentsPerUser} agents`;
      console.log(chalk.blue(`\nTesting ${scenario.users} users with ${scenario.agentsPerUser} agents each (${scenario.users * scenario.agentsPerUser} total agents)`));

      const startTime = Date.now();

      console.log(chalk.blue(`Creating ${scenario.users} users...`));
      const users: { testRunner: TestRunner; userIndex: number }[] = [];

      for (let userIndex = 0; userIndex < scenario.users; userIndex++) {
        const userConfig = createConfigForUser();
        const userTestRunner = new TestRunner(userConfig);
        users.push({ testRunner: userTestRunner, userIndex });
      }

      console.log(chalk.green(`  Success: Created ${scenario.users} users`));

      console.log(chalk.blue(`Creating ${scenario.users * scenario.agentsPerUser} agents in parallel...`));

      const agentCreationPromises: Promise<{ success: boolean; agentId?: string; agentName?: string; error?: string; userIndex: number; agentIndex: number }>[] = [];

      for (let userIndex = 0; userIndex < scenario.users; userIndex++) {
        const user = users[userIndex];
        for (let agentIndex = 0; agentIndex < scenario.agentsPerUser; agentIndex++) {
          const promise = createAgentWithTracking(user.testRunner, `StressTest-User${userIndex}-Agent${agentIndex}-${Date.now()}`)
            .then(result => ({ ...result, userIndex, agentIndex }))
            .catch(error => ({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error',
              userIndex,
              agentIndex
            }));
          agentCreationPromises.push(promise);
        }
      }

      // Wait for all agent creations to complete
      const agentResults = await Promise.all(agentCreationPromises);
      const creationTime = Date.now() - startTime;

      const successfulAgents = agentResults.filter(r => r.success);
      const failedAgents = agentResults.filter(r => !r.success);

      console.log(chalk.green(`  Success: Created ${successfulAgents.length} agents, ${failedAgents.length} failed`));

      if (successfulAgents.length > 0) {
        console.log(chalk.blue(`  Created agents:`));
        successfulAgents.forEach((agent, index) => {
          if (index < 5) {
            console.log(chalk.blue(`    • ${agent.agentName || 'Unknown'} (User ${agent.userIndex}, Agent ${agent.agentIndex})`));
          }
        });
        if (successfulAgents.length > 5) {
          console.log(chalk.blue(`    ... and ${successfulAgents.length - 5} more agents`));
        }
      }

      const scenarioCreatedAgents: { testRunner: TestRunner; agentId: string; agentName: string; userId: string; userIndex: number; agentIndex: number }[] = [];

      for (const result of successfulAgents) {
        const user = users[result.userIndex];
        scenarioCreatedAgents.push({
          testRunner: user.testRunner,
          agentId: result.agentId!,
          agentName: result.agentName || `Unknown-${result.userIndex}-${result.agentIndex}`,
          userId: user.testRunner.client['config'].userId || '',
          userIndex: result.userIndex,
          agentIndex: result.agentIndex
        });
      }

      // Verify all agents are in their respective user lists
      console.log(chalk.blue(`\nVerifying agents in user lists...`));

      await defaultTestRunner.runTest('Health Check', () => defaultTestRunner.client.healthCheck());

      // Calculate metrics
      const avgProcessingTime = creationTime / scenarioCreatedAgents.length;
      const throughput = scenarioCreatedAgents.length / (creationTime / 1000); // agents/second
      const agentsVerified = successfulAgents.length;
      // Store test result
      const testResult: AgentStressTestResult = {
        testName,
        success: successfulAgents.length === scenarioCreatedAgents.length,
        duration: creationTime,
        agentsCreated: scenarioCreatedAgents.length,
        agentsVerified,
        agentsDeleted: 0,
        queueMetrics: [],
        throughput,
        avgProcessingTime,
        error: agentsVerified < scenarioCreatedAgents.length ? `${scenarioCreatedAgents.length - agentsVerified} agents not verified` : undefined
      };

      testResults.push(testResult);

      console.log(chalk.blue(`\n${testName} ${i}:`));
      console.log(chalk.blue(`  • Time: ${creationTime}ms | Throughput: ${throughput.toFixed(2)} agents/s`));
      console.log(chalk.blue(`  • Average time per agent: ${(creationTime / scenarioCreatedAgents.length).toFixed(2)}ms`));
      console.log(chalk.blue(`  • Success: ${agentsVerified}/${scenarioCreatedAgents.length} | Agents verified: ${agentsVerified}`));


      // Cleanup: Delete all agents in parallel
      const cleanupAgentsData: CleanupAgent[] = scenarioCreatedAgents.map(agent => ({
        testRunner: agent.testRunner,
        agentId: agent.agentId,
        userId: agent.userId,
        userIndex: agent.userIndex,
        agentIndex: agent.agentIndex,
        agentName: agent.agentName
      }));

      const cleanupResult = await cleanupAgents(cleanupAgentsData, 'Agent Stress Test Cleanup');

      testResult.agentsDeleted = cleanupResult.successful;

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(chalk.blue.bold('\nOverall Test Summary:'));
  console.log(chalk.blue('='.repeat(50)));
  
  testResults.forEach(result => {
    const status = result.success ? chalk.green('PASS') : chalk.red('FAIL');
    console.log(chalk.blue(`${status} ${result.testName}`));
    console.log(chalk.blue(`  Duration: ${result.duration}ms, Throughput: ${result.throughput.toFixed(2)} agents/s`));
    console.log(chalk.blue(`  Agents: Created=${result.agentsCreated}, Verified=${result.agentsVerified}, Deleted=${result.agentsDeleted}`));
    if (result.error) {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  });
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.success).length;
  const avgThroughput = testResults.reduce((sum, r) => sum + r.throughput, 0) / totalTests;
  
  const totalAgentsCreated = testResults.reduce((sum, r) => sum + r.agentsCreated, 0);
  const totalAgentsVerified = testResults.reduce((sum, r) => sum + r.agentsVerified, 0);
  const totalAgentsDeleted = testResults.reduce((sum, r) => sum + r.agentsDeleted, 0);
  
  console.log(chalk.blue(`\nFinal Statistics:`));
  console.log(chalk.blue(`  • Tests passed: ${passedTests}/${totalTests}`));
  console.log(chalk.blue(`  • Average throughput: ${avgThroughput.toFixed(2)} agents/s`));
  console.log(chalk.blue(`  • Total agents created: ${totalAgentsCreated}`));
  console.log(chalk.blue(`  • Total agents verified: ${totalAgentsVerified}`));
  console.log(chalk.blue(`  • Total agents deleted: ${totalAgentsDeleted}`));

  defaultTestRunner.printSummary();
}

if (require.main === module) {
  testAgentStressWithMultipleUsers()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red('Test execution failed:'), error);
      process.exit(1);
    });
}
