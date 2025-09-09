import { TestRunner } from '../test-runner.js';
import { SnakConfig, JobStatus, QueueMetrics } from '../types.js';
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
  const targetSize = file_size * 1024;
  const baseString = 'This is a large test file for stress testing the new job queue system.\n';
  const baseLength = Buffer.byteLength(baseString);
  const repetitions = Math.ceil(targetSize / baseLength);
  const largeContent = baseString.repeat(repetitions);
  const buffer = Buffer.from(largeContent);
  return buffer.subarray(0, targetSize).toString();
}

async function waitForJobCompletion(
  testRunner: TestRunner,
  jobId: string,
  maxWaitTime: number = 600000,
  pollInterval: number = 10000
): Promise<JobStatus | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await testRunner.client.getJobStatus(jobId);
      console.log(chalk.yellow(`Job status: ${status.status}`));
      // Job is completed (success or failure)
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Error checking job status: ${error}`));
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return null; // Timeout
}

async function getQueueMetrics(testRunner: TestRunner): Promise<QueueMetrics[]> {
  try {
    return await testRunner.client.getQueueMetrics();
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Could not fetch queue metrics: ${error}`));
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
  console.log(chalk.blue.bold('🚀 File Upload Stress Test v2 - Job Queue System\n'));
  console.log(chalk.yellow('Testing: Concurrent file uploads with job queue monitoring\n'));

  const testRunner = new TestRunner(config);
  const testResults: TestResult[] = [];

  await testRunner.runTest('Health Check', () => testRunner.client.healthCheck());

  // Test configurations
  const testScenarios = [
    { name: 'Medium Load', files: 10, sizes: [100, 500] }, // KB
    { name: 'Heavy Load', files: 50, sizes: [1024] },
    { name: 'Mixed Load', files: 20, sizes: [50, 200, 500, 1024] },
  ];

  // Create a single agent for all tests
  console.log(chalk.blue('🤖 Creating stress test agent...'));
  
  const createResult = await testRunner.runTest('Create Stress Test Agent', () => 
    testRunner.client.createAgent({
      agent: {
        name: 'File Stress Test Agent v2',
        group: 'test',
        description: 'Agent for stress testing file uploads with job queue system',
        lore: [
          'I am designed to handle high-volume file uploads with job queue processing.',
          'My purpose is to test system performance under load with the new worker system.',
          'I help validate concurrent file processing capabilities with job tracking.'
        ],
        objectives: [
          'Test concurrent file upload performance with job queues',
          'Validate system stability under load with worker monitoring',
          'Measure processing times for large files through job completion',
          'Ensure proper resource management and queue handling'
        ],
        knowledge: [
          'I understand high-load scenarios and performance testing with job queues',
          'I know how to measure system performance metrics and queue health',
          'I can validate concurrent processing capabilities with job tracking',
          'I am familiar with stress testing methodologies for distributed systems'
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
    console.log(chalk.red('❌ Failed to create stress test agent.'));
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
    : (agentsResult.response as any).data || [];

  const stressAgent = agentsList.find((agent: any) => agent.name === 'File Stress Test Agent v2');
  if (!stressAgent) {
    console.log(chalk.red('❌ Stress test agent not found in agents list.'));
    return;
  }

  const agentId = stressAgent.id;
  console.log(chalk.green(`✅ Created stress test agent: ${agentId}`));

  // Run test scenarios
  for (const scenario of testScenarios) {
    console.log(chalk.blue(`\n🧪 Testing ${scenario.name}: ${scenario.files} files`));
    
    for (const fileSize of scenario.sizes) {
      const testName = `${scenario.name} - ${fileSize}KB files`;
      console.log(chalk.blue(`\n📁 Testing ${scenario.files} files of ~${fileSize}KB each`));
      
      const startTime = Date.now();
      const jobIds: string[] = [];
      
      // Generate test files
      const files = [];
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
      
      // Upload files and collect job IDs
      const uploadPromises = files.map(async (file, index) => {
        const result = await uploadFileWithJobTracking(
          testRunner,
          agentId,
          file.buffer,
          file.filename
        );
        
        if (result.success && result.jobId) {
          jobIds.push(result.jobId);
          console.log(chalk.green(`  ✅ File ${index + 1} uploaded, job ID: ${result.jobId}`));
        } else {
          console.log(chalk.red(`  ❌ File ${index + 1} upload failed: ${result.error}`));
        }
        
        return result;
      });
      
      await Promise.all(uploadPromises);
      const uploadTime = Date.now() - startTime;
      
      // Wait for all jobs to complete
      console.log(chalk.blue(`⏳ Waiting for ${jobIds.length} jobs to complete...`));
      await new Promise(resolve => setTimeout(resolve, 10000));
      const jobCompletionPromises = jobIds.map(async (jobId, index) => {
        const jobStatus = await waitForJobCompletion(testRunner, jobId, 600_000); // 600s timeout
        
        if (jobStatus) {
          if (jobStatus.status === 'completed') {
            console.log(chalk.green(`  ✅ Job ${index + 1} (${jobId}) completed successfully`));
          } else {
            console.log(chalk.red(`  ❌ Job ${index + 1} (${jobId}) failed: ${jobStatus.error || 'Unknown error'}`));
          }
        } else {
          console.log(chalk.yellow(`  ⚠️  Job ${index + 1} (${jobId}) timed out`));
        }
        
        return jobStatus;
      });
      
      const jobStatuses = await Promise.all(jobCompletionPromises);
      const totalTime = Date.now() - startTime;
      
      // Get final queue metrics
      const finalMetrics = await getQueueMetrics(testRunner);
      
      // Calculate metrics
      const successfulJobs = jobStatuses.filter(status => status?.status === 'completed').length;
      const failedJobs = jobStatuses.filter(status => status?.status === 'failed').length;
      const avgProcessingTime = totalTime / files.length;
      const throughput = (totalSize / 1024) / (totalTime / 1000); // KB/s
      
      // Store test result
      const testResult: TestResult = {
        testName,
        success: successfulJobs === files.length,
        duration: totalTime,
        jobIds,
        queueMetrics: finalMetrics,
        throughput,
        avgProcessingTime,
        error: failedJobs > 0 ? `${failedJobs} jobs failed` : undefined
      };
      
      testResults.push(testResult);
      
      // Print test summary
      console.log(chalk.blue(`\n📊 Test Summary for ${testName}:`));
      console.log(chalk.blue(`  • Total time: ${totalTime}ms`));
      console.log(chalk.blue(`  • Upload time: ${uploadTime}ms`));
      console.log(chalk.blue(`  • Processing time: ${totalTime - uploadTime}ms`));
      console.log(chalk.blue(`  • Average time per file: ${Math.round(avgProcessingTime)}ms`));
      console.log(chalk.blue(`  • Throughput: ${throughput.toFixed(2)} KB/s`));
      console.log(chalk.blue(`  • Successful jobs: ${successfulJobs}/${files.length}`));
      console.log(chalk.blue(`  • Failed jobs: ${failedJobs}/${files.length}`));
      
      if (finalMetrics.length > 0) {
        console.log(chalk.blue(`  • Queue metrics:`));
        finalMetrics.forEach(metric => {
          console.log(chalk.blue(`    - ${metric.queueName}: waiting=${metric.waiting}, active=${metric.active}, completed=${metric.completed}, failed=${metric.failed}`));
        });
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print overall summary
  console.log(chalk.blue.bold('\n📈 Overall Test Summary:'));
  console.log(chalk.blue('='.repeat(50)));
  
  testResults.forEach(result => {
    const status = result.success ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    console.log(chalk.blue(`${status} ${result.testName}`));
    console.log(chalk.blue(`  Duration: ${result.duration}ms, Throughput: ${result.throughput.toFixed(2)} KB/s`));
    if (result.error) {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  });
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.success).length;
  const avgThroughput = testResults.reduce((sum, r) => sum + r.throughput, 0) / totalTests;
  
  console.log(chalk.blue(`\n📊 Final Statistics:`));
  console.log(chalk.blue(`  • Tests passed: ${passedTests}/${totalTests}`));
  console.log(chalk.blue(`  • Average throughput: ${avgThroughput.toFixed(2)} KB/s`));
  console.log(chalk.blue(`  • Total jobs processed: ${testResults.reduce((sum, r) => sum + r.jobIds.length, 0)}`));

  // Cleanup
  console.log(chalk.blue('\n🧹 Cleaning up stress test agent...'));
  await testRunner.runTest('Cleanup - Delete Stress Test Agent', () => 
    testRunner.client.deleteAgent(agentId)
  );

  testRunner.printSummary();
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
