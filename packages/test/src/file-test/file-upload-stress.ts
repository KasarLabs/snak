import { TestRunner } from '../test-runner.js';
import { SnakConfig } from '../types.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const port = process.env.SERVER_PORT || '3002';
const config: SnakConfig = {
  baseUrl: `http://localhost:${port}`,
  userId: process.env.SNAK_USER_ID,
  apiKey: process.env.SERVER_API_KEY,
};

function generateLargeFileContent(file_size: number): string {
  const targetSize = file_size * 1024;
  let largeContent = 'This is a large test file.\n'.repeat(2000); // ~50KB
  while (largeContent.length < targetSize) {
    largeContent += 'This is a large test file.\n'.repeat(2000);
  }
  
  return largeContent.slice(0, targetSize);
}

async function testFileStress() {
  console.log(chalk.blue.bold('🚀 File Upload Stress Test\n'));
  console.log(chalk.yellow('Testing: 8 concurrent file uploads of ~250KB each\n'));

  const testRunner = new TestRunner(config);

  await testRunner.runTest('Health Check', () => testRunner.client.healthCheck());

  // Create agents for each test scenario
  const agentIds: string[] = [];
  const nb_files_array = [1, 3, 6, 9];
  const file_sizes = [10, 75, 150, 350]; // KB
  
  for (let i = 0; i < nb_files_array.length; i++) {
    const nbFiles = nb_files_array[i];
    const agentName = `File Stress Test ${nbFiles} Files`;
    
    console.log(chalk.blue(`🤖 Creating agent for ${nbFiles} files test...`));
    
    const createResult = await testRunner.runTest(`Create Agent for ${nbFiles} Files Test`, () => 
      testRunner.client.createAgent({
        agent: {
          name: agentName,
          group: 'test',
          description: `Agent for stress testing ${nbFiles} concurrent file uploads`,
          lore: [
            'I am designed to handle high-volume file uploads and processing.',
            'My purpose is to test system performance under load.',
            'I help validate concurrent file processing capabilities.'
          ],
          objectives: [
            'Test concurrent file upload performance',
            'Validate system stability under load',
            'Measure processing times for large files',
            'Ensure proper resource management'
          ],
          knowledge: [
            'I understand high-load scenarios and performance testing',
            'I know how to measure system performance metrics',
            'I can validate concurrent processing capabilities',
            'I am familiar with stress testing methodologies'
          ],
          interval: 0,
          plugins: [],
          memory: { enabled: false, shortTermMemorySize: 0, memorySize: 0 },
          rag: { enabled: true, embeddingModel: 'Xenova/all-MiniLM-L6-v2' },
          mode: 'interactive'
        }
      })
    );

    if (!createResult.success) {
      console.log(chalk.red(`❌ Failed to create agent for ${nbFiles} files test.`));
      return;
    }

    const agentsResult = await testRunner.runTest('Get Agents List', () => 
      testRunner.client.getAgents()
    );

    if (!agentsResult.success || !agentsResult.response) {
      console.log(chalk.red('❌ Failed to get agents list.'));
      return;
    }

    const agentsList = Array.isArray(agentsResult.response) 
      ? agentsResult.response 
      : agentsResult.response.data || [];

    const stressAgent = agentsList.find((agent: any) => agent.name === agentName);
    if (!stressAgent) {
      console.log(chalk.red(`❌ Agent ${agentName} not found in agents list.`));
      return;
    }

    agentIds.push(stressAgent.id);
    console.log(chalk.green(`✅ Created agent for ${nbFiles} files test: ${stressAgent.id}`));
  }

  for (let i = 0; i < nb_files_array.length; i++) {
    const nb_files = nb_files_array[i];
    const agentId = agentIds[i];
    
    console.log(chalk.blue(`\n🧪 Testing ${nb_files} files with agent: ${agentId}`))
    
    for (const file_size of file_sizes) {
  
      console.log(chalk.blue(`Generating ${nb_files} large files (~${file_size} KB each)`));
      const files = [];
      const content = generateLargeFileContent(file_size);
      for (let j = 0; j < nb_files; j++) {
        const buffer = Buffer.from(content, 'utf-8');
        files.push({
          buffer,
          filename: `stress-test-file-${j}.txt`,
          size: buffer.length
        });
      }
    
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
      const startTime = Date.now();
    
      const uploadPromises = files.map((file, index) => 
        testRunner.runTest(`Upload Large File ${index + 1}`, () => 
          testRunner.client.uploadFile(agentId, file.buffer, file.filename)
        )
      );
    
      try {
        const results = await Promise.all(uploadPromises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;
      
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const avgTimePerFile = totalTime / files.length;
        const throughput = (totalSize / 1024) / (totalTime / 1000); // KB/s
      
        console.log(chalk.blue(`Total time: ${totalTime}ms`));
        console.log(chalk.blue(`Average time per file: ${Math.round(avgTimePerFile)}ms`));
      
        if (failed > 0) {
          console.log(chalk.red('\n❌ Failed uploads:'));
          results.forEach((result, index) => {
            if (!result.success) {
              console.log(chalk.red(`  • File ${index + 1}: ${result.error}`));
            }
          });
        }
      
        await testRunner.runTest('List Files After Stress Test', () => 
          testRunner.client.listFiles(agentId)
        );
      
      } catch (error) {
        console.log(chalk.red('❌ Stress test failed:', error));
      }
    }
  }

  // Cleanup - Delete all test agents
  console.log(chalk.blue('\n🧹 Cleaning up test agents...'));
  for (let i = 0; i < agentIds.length; i++) {
    const agentId = agentIds[i];
    const nbFiles = nb_files_array[i];
    await testRunner.runTest(`Cleanup - Delete Agent for ${nbFiles} Files Test`, () => 
      testRunner.client.deleteAgent(agentId)
    );
  }

  testRunner.printSummary();
}

if (require.main === module) {
  testFileStress().catch(console.error);
}
