import { TestRunner } from '../test-runner.js';
import { SnakConfig, JobStatus, QueueMetrics } from '../types.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const port = process.env.SERVER_PORT || '3002';

function generateUserId(scenarioName: string, fileIndex: number): string {
  return randomUUID();
}

function createConfigForFile(scenarioName: string, fileIndex: number): SnakConfig {
  return {
  baseUrl: `http://localhost:${port}`,
    userId: generateUserId(scenarioName, fileIndex),
  apiKey: process.env.SERVER_API_KEY,
};
}

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  jobIds: string[];
  queueMetrics: QueueMetrics[];
  throughput: number; // KB/s
  avgProcessingTime: number; // ms
  error?: string;
}

function generateLargeFileContent(file_size: number): string {
  if (file_size <= 0) {
    throw new Error('File size must be a positive number');
  }
  const targetSize = file_size * 1024;
  const baseStrings = [
    'This is a large test file for stress testing the new job queue system.\n',
    'The file ingestion service should handle this content properly.\n',
    'We are testing concurrent file upload processing with job tracking.\n',
    'Performance metrics will be collected during this stress test.\n',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco.\n',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse.\n'
  ];
  
  let content = '';
  let currentSize = 0;
  let stringIndex = 0;
  
  while (currentSize < targetSize) {
    const nextString = baseStrings[stringIndex % baseStrings.length];
    const nextStringSize = Buffer.byteLength(nextString);
    
    if (currentSize + nextStringSize <= targetSize) {
      content += nextString;
      currentSize += nextStringSize;
    } else {
      // Add partial string to reach exact target size
      const remainingSize = targetSize - currentSize;
      const partialString = nextString.substring(0, remainingSize);
      content += partialString;
      break;
    }
    
    stringIndex++;
  }
  
  return content;
}

async function waitForJobCompletion(
  testRunner: TestRunner,
  jobId: string,
  maxWaitTime: number = 60000,
  pollInterval: number = 100
): Promise<JobStatus | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await testRunner.client.getJobStatus(jobId);
      // Job is completed (success or failure)
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }
    } catch (error) {
      console.log(chalk.yellow(`Warning: Error checking job status: ${error}`));
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return null;
}

async function verifyFileInDatabase(
  testRunner: TestRunner,
  agentId: string,
  filename: string,
  maxRetries: number = 20,
  retryDelay: number = 2500
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileList = await testRunner.client.listFiles(agentId);
      const uploadedFile = fileList.find(f => f.originalName === filename);
      
      if (uploadedFile) {
        return true;
      } else {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.log(chalk.red(`    Error: File ${filename} NOT found after ${maxRetries} attempts`));
          return false;
        }
      }
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(chalk.yellow(`    Warning: Error checking file list (${attempt}/${maxRetries}): ${error}`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.log(chalk.red(`    Error: Failed to verify file ${filename}: ${error}`));
        return false;
      }
    }
  }
  
  return false;
}

async function getQueueMetrics(testRunner: TestRunner): Promise<QueueMetrics[]> {
  try {
    return await testRunner.client.getQueueMetrics();
  } catch (error) {
    console.log(chalk.yellow(`Warning: Could not fetch queue metrics: ${error}`));
    return [];
  }
}

async function uploadFileWithJobTracking(
  testRunner: TestRunner,
  agentId: string,
  fileBuffer: Buffer,
  filename: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const response = await testRunner.client.uploadFile(agentId, fileBuffer, filename);
    return { success: true, jobId: response.jobId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function testFileStressWithJobQueue() {
  console.log(chalk.blue.bold('File Upload Stress Test v2 - Job Queue System\n'));
  console.log(chalk.yellow('Testing: Concurrent file uploads with job queue monitoring\n'));

  const testResults: TestResult[] = [];

  // Test configurations
  const testScenarios = [
    { name: '1 User', files: 1, sizes: [10, 75, 150, 350] }, // KB
    { name: '3 Users', files: 3, sizes: [10, 75, 150, 350] },
    { name: '6 Users', files: 6, sizes: [10, 75, 150, 350] },
    { name: '9 Users', files: 9, sizes: [10, 75, 150, 350] }
  ];

  // Health check with default config
  const defaultConfig = createConfigForFile('default', 0);
  const defaultTestRunner = new TestRunner(defaultConfig);
  await defaultTestRunner.runTest('Health Check', () => defaultTestRunner.client.healthCheck());

  // Run test scenarios
  for (const scenario of testScenarios) {
    console.log(chalk.blue(`\nTesting ${scenario.name}: ${scenario.files} files with ${scenario.files} different users`));
    
    const scenarioCreatedAgents: { testRunner: TestRunner; agentId: string; userId: string }[] = [];
    
    for (const fileSize of scenario.sizes) {
      const testName = `${scenario.name} - ${fileSize}KB files`;
      console.log(chalk.blue(`\nTesting ${scenario.files} files of ~${fileSize}KB each with ${scenario.files} different users`));
      
      const startTime = Date.now();
      const jobIds: string[] = [];
      
      // Generate test files
      const files: Array<{ buffer: Buffer; filename: string; size: number }> = [];
      const content = generateLargeFileContent(fileSize);
      for (let i = 0; i < scenario.files; i++) {
        const buffer = Buffer.from(content, 'utf-8');
        files.push({
          buffer,
          filename: `stress-test-v2-${scenario.name.toLowerCase().replace(' ', '-')}-${fileSize}kb-${i}.txt`,
          size: buffer.length
        });
      }
      
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      // Create users and agents for each file
      console.log(chalk.blue(`Creating ${scenario.files} users and agents...`));
      const agentCreationPromises = files.map(async (file, index) => {
        const fileConfig = createConfigForFile(scenario.name, index);
        const fileTestRunner = new TestRunner(fileConfig);
        
        const uniqueAgentName = `FileStressTest-${scenario.name.replace(/\s+/g, '')}-User${index + 1}-${Date.now()}`;
        const createResult = await fileTestRunner.runTest(`Create Agent for User ${index + 1}`, () => 
          fileTestRunner.client.createAgent({
            agent: {
              name: uniqueAgentName,
              group: 'test',
              description: `Agent for stress testing file uploads - ${scenario.name} - User ${index + 1}`,
              lore: [
                `I am designed to handle file uploads for user ${index + 1} in ${scenario.name}.`,
                'My purpose is to test system performance under concurrent user load.',
                'I help validate multi-user file processing capabilities.'
              ],
              objectives: [
                'Test concurrent file upload performance with multiple users',
                'Validate system stability under multi-user load',
                'Measure processing times for files from different users',
                'Ensure proper resource management across users'
              ],
              knowledge: [
                'I understand multi-user scenarios and concurrent processing',
                'I know how to handle file uploads from different users',
                'I can validate system performance under user load',
                'I am familiar with stress testing methodologies for multi-user systems'
              ],
              interval: 0,
              mode: 'interactive',
              memory: {
                enabled: true,
                memorySize: 10,
                shortTermMemorySize: 10
              },
              rag: {
                enabled: true,
                embeddingModel: 'Xenova/all-MiniLM-L6-v2'
              },
              plugins: []
            }
          })
        );

        if (!createResult.success) {
          console.log(chalk.red(`  Error: Failed to create agent for user ${index + 1}: ${createResult.error}`));
          return null;
        }

        const agentsResult = await fileTestRunner.runTest(`Get Agents List for User ${index + 1}`, () => 
          fileTestRunner.client.getAgents()
        );

        if (!agentsResult.success || !agentsResult.response) {
          console.log(chalk.red(`  Error: Failed to get agents list for user ${index + 1}`));
          return null;
        }

        const agentsList = Array.isArray(agentsResult.response) 
          ? agentsResult.response 
          : (agentsResult.response as any).data || [];

        const userAgent = agentsList.find((agent: any) => agent.name === uniqueAgentName);
        if (!userAgent) {
          console.log(chalk.red(`  Error: Agent not found for user ${index + 1}`));
          return null;
        }

        return {
          testRunner: fileTestRunner,
          agentId: userAgent.id,
          userId: fileConfig.userId
        };
      });
      
      const agentResults = await Promise.all(agentCreationPromises);
      const validAgents = agentResults.filter(agent => agent !== null) as { testRunner: TestRunner; agentId: string; userId: string }[];
      
      if (validAgents.length === 0) {
        console.log(chalk.red(`Error: No valid agents created for ${scenario.name}`));
        continue;
      }
      
      console.log(chalk.green(`  Success: Created ${validAgents.length} agents successfully`));
      
      scenarioCreatedAgents.push(...validAgents);
      
      console.log(chalk.blue(`Starting concurrent uploads with ${validAgents.length} users...`));
      const uploadPromises = files.map(async (file, index) => {
        if (index >= validAgents.length) {
          return { success: false, error: 'No agent available' };
        }
        
        const agent = validAgents[index];
        const result = await uploadFileWithJobTracking(
          agent.testRunner,
          agent.agentId,
          file.buffer,
          file.filename
        );
        
        if (result.success && result.jobId) {
          jobIds.push(result.jobId);
        }
        
        return { ...result, agent, fileIndex: index };
      });
      
      const uploadResults = await Promise.all(uploadPromises);
      const uploadTime = Date.now() - startTime;
      
      const successfulUploads = uploadResults.filter(r => r.success).length;
      const failedUploads = uploadResults.filter(r => !r.success).length;
      console.log(chalk.green(`  Success: Uploads completed: ${successfulUploads} successful, ${failedUploads} failed`));
      
      const jobToAgentMap = new Map();
      uploadResults.forEach(result => {
        if (result.success && 'jobId' in result && result.jobId && 'agent' in result && result.agent) {
          jobToAgentMap.set(result.jobId, result.agent);
        }
      });
      
      // Wait for all jobs to complete
      console.log(chalk.blue(`Waiting for ${jobIds.length} jobs to complete...`));
      const jobCompletionPromises = jobIds.map(async (jobId, index) => {
        const agent = jobToAgentMap.get(jobId);
        if (!agent) {
          console.log(chalk.red(`  Error: No agent found for job ${jobId}`));
          return null;
        }
        
        const jobStatus = await waitForJobCompletion(agent.testRunner, jobId, 60_000); // 600s timeout
        
        if (jobStatus) {
          if (jobStatus.status === 'completed') {
            const uploadResult = uploadResults.find(r => 'jobId' in r && r.jobId === jobId);
            const fileIndex = uploadResult && 'fileIndex' in uploadResult ? uploadResult.fileIndex : index;
            await verifyFileInDatabase(agent.testRunner, agent.agentId, files[fileIndex].filename, 50, 2500);
          }
        }
        
        return jobStatus;
      });
      
      const jobStatuses = await Promise.all(jobCompletionPromises);
      const totalTime = Date.now() - startTime;
      
      const completedJobs = jobStatuses.filter(status => status?.status === 'completed').length;
      const failedJobs = jobStatuses.filter(status => status?.status === 'failed').length;
      const timedOutJobs = jobStatuses.filter(status => !status).length;
      console.log(chalk.green(`  Success: Jobs completed: ${completedJobs} successful, ${failedJobs} failed, ${timedOutJobs} timed out`));
      
      const finalMetrics = await getQueueMetrics(validAgents[0].testRunner);
      
      // Calculate metrics
      const avgProcessingTime = totalTime / files.length;
      const throughput = (totalSize / 1024) / (totalTime / 1000); // KB/s
      
      // Store test result
      const testResult: TestResult = {
        testName,
        success: completedJobs === files.length,
        duration: totalTime,
        jobIds,
        queueMetrics: finalMetrics,
        throughput,
        avgProcessingTime,
        error: failedJobs > 0 ? `${failedJobs} jobs failed` : undefined
      };
      
      testResults.push(testResult);
      
      // Verify all files are actually stored for each agent
      console.log(chalk.blue(`\nVerifying file storage...`));
      let totalFilesStored = 0;
      for (const agent of validAgents) {
        try {
          const fileList = await agent.testRunner.client.listFiles(agent.agentId);
          const agentFileCount = fileList.length || 0;
          totalFilesStored += agentFileCount;
        } catch (error) {
          console.log(chalk.red(`  • Agent: Failed to list files - ${error}`));
        }
      }
      console.log(chalk.green(`  Success: Total files stored: ${totalFilesStored}`));

      console.log(chalk.blue(`\n${testName}:`));
      console.log(chalk.blue(`  • Time: ${totalTime}ms | Throughput: ${throughput.toFixed(2)} KB/s`));
      console.log(chalk.blue(`  • Average time per file: ${(totalTime / files.length).toFixed(2)}ms`));
      console.log(chalk.blue(`  • Success: ${completedJobs}/${files.length} | Files stored: ${totalFilesStored}`));
      
      if (finalMetrics.length > 0) {
        finalMetrics.forEach(metric => {
          console.log(chalk.blue(`  • Queue ${metric.queueName}: w=${metric.waiting} a=${metric.active} c=${metric.completed} f=${metric.failed}`));
        });
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(chalk.blue(`\nCleaning up ${scenarioCreatedAgents.length} agents...`));
    const cleanupPromises = scenarioCreatedAgents.map(async (agent: { testRunner: TestRunner; agentId: string; userId: string }, index: number) => {
      try {
        await agent.testRunner.runTest(`Cleanup - Delete Agent ${index + 1}`, () => 
          agent.testRunner.client.deleteAgent(agent.agentId)
        );
        return { success: true, index };
      } catch (error) {
        console.log(chalk.red(`  Error: Failed to cleanup agent ${index + 1}: ${error}`));
        return { success: false, index, error };
      }
    });
    
    const cleanupResults = await Promise.all(cleanupPromises);
    const successfulCleanups = cleanupResults.filter(r => r.success).length;
    const failedCleanups = cleanupResults.filter(r => !r.success).length;
    console.log(chalk.green(`  Success: Cleanup completed: ${successfulCleanups} successful, ${failedCleanups} failed`));
  }

  console.log(chalk.blue.bold('\nOverall Test Summary:'));
  console.log(chalk.blue('='.repeat(50)));
  
  testResults.forEach(result => {
    const status = result.success ? chalk.green('PASS') : chalk.red('FAIL');
    console.log(chalk.blue(`${status} ${result.testName}`));
    console.log(chalk.blue(`  Duration: ${result.duration}ms, Throughput: ${result.throughput.toFixed(2)} KB/s`));
    if (result.error) {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  });
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.success).length;
  const avgThroughput = testResults.reduce((sum, r) => sum + r.throughput, 0) / totalTests;
  
  const totalJobsCreated = testResults.reduce((sum, r) => sum + r.jobIds.length, 0);
  const totalJobsSuccessful = testResults.reduce((sum, r) => {
    return sum + (r.success ? r.jobIds.length : 0);
  }, 0);
  
  console.log(chalk.blue(`\nFinal Statistics:`));
  console.log(chalk.blue(`  • Tests passed: ${passedTests}/${totalTests}`));
  console.log(chalk.blue(`  • Average throughput: ${avgThroughput.toFixed(2)} KB/s`));
  console.log(chalk.blue(`  • Total jobs created: ${totalJobsCreated}`));
  console.log(chalk.blue(`  • Total jobs successful: ${totalJobsSuccessful}`));

  defaultTestRunner.printSummary();
}

if (require.main === module) {
  testFileStressWithJobQueue()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red('Test execution failed:'), error);
      process.exit(1);
    });
}
