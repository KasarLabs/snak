import { TestRunner } from '../test-runner.js';
import { SnakConfig } from '../types.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();
if (!process.env.SNAK_USER_ID || !process.env.SERVER_API_KEY) {
  throw new Error('SNAK_USER_ID and SERVER_API_KEY must be set');
}

const port = process.env.SERVER_PORT || '3002';
const config: SnakConfig = {
  baseUrl: `http://localhost:${port}`,
  userId: process.env.SNAK_USER_ID,
  apiKey: process.env.SERVER_API_KEY,
};

async function testFiles() {
  console.log(chalk.blue.bold('Testing File Upload Endpoints\n'));

  const testRunner = new TestRunner(config);

  await testRunner.runTest('Health Check', () => testRunner.client.healthCheck());

  const createResult = await testRunner.runTest('Create Agent for File Testing', () => 
    testRunner.client.createAgent({~
      agent: {
        name: 'File Test Agent',
        group: 'test',
        description: 'Agent for testing file upload functionality',
        lore: [
          'I am a specialized test agent created to validate file upload and processing functionality.',
          'My purpose is to ensure that the file ingestion system works correctly.',
          'I help test various file formats and processing capabilities.'
        ],
        objectives: [
          'Test file upload via multipart form data',
          'Validate text chunking and processing',
          'Test metadata extraction and vector embedding generation',
          'Ensure RAG functionality works with uploaded files'
        ],
        knowledge: [
          'I understand file processing workflows',
          'I know how to handle different file formats (txt, json, csv, pdf, docx)',
          'I can validate chunking strategies and embedding generation',
          'I am familiar with vector storage and retrieval systems'
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
    console.log(chalk.red('Error: Failed to create test agent. Cannot proceed with file tests.'));
    return;
  }
  let agentId = '';
  try {
    const agentsResult = await testRunner.runTest('Get Agents List', () => 
      testRunner.client.getAgents()
    );

    if (!agentsResult.success || !agentsResult.response) {
      console.log(chalk.red('Error: Failed to get agents list. Cannot proceed with file tests.'));
      return;
    }

    const agentsList = (agentsResult.response as any[]) || [];

    if (agentsList.length === 0) {
      console.log(chalk.red('Error: No agents found in the list.'));
      return;
    }

    const fileTestAgent = agentsList.find((agent: any) => agent.name === 'File Test Agent');
    if (!fileTestAgent) {
      console.log(chalk.red('Error: File Test Agent not found in agents list.'));
      console.log(chalk.yellow('Available agents:'), agentsList.map((a: any) => a.name));
      return;
    }

    agentId = fileTestAgent.id;
    console.log(chalk.green(`Success: Using agent ID: ${agentId}`));

    const textContent = `This is a test document for file upload testing.

  It contains multiple lines and some special characters: éàçùñ

  The purpose of this file is to test the file ingestion system of Snak.

  Key features to test:
  - File upload via multipart form data
  - Text chunking and processing
  - Metadata extraction
  - Vector embedding generation

  This should be processed into multiple chunks for RAG functionality.`;

    const textBuffer = Buffer.from(textContent, 'utf-8');
    
    await testRunner.runTest('Upload Text File', () => 
      testRunner.client.uploadFile(agentId, textBuffer, 'test-document.txt')
    );

    const jsonContent = {
      "name": "Test Configuration",
      "version": "1.0.0",
      "settings": {
        "debug": true,
        "timeout": 30000,
        "features": ["file-upload", "rag", "embeddings"]
      },
      "agents": [
        {
          "id": "agent-1",
          "name": "Test Agent",
          "model": "gpt-4"
        }
      ]
    };

    const jsonBuffer = Buffer.from(JSON.stringify(jsonContent, null, 2), 'utf-8');

    await testRunner.runTest('Upload JSON File', () => 
      testRunner.client.uploadFile(agentId, jsonBuffer, 'config.json')
    );

    const csvContent = `name,age,city,country
John Doe,30,Paris,France
Jane Smith,25,London,UK
Bob Johnson,35,New York,USA
Alice Brown,28,Berlin,Germany`;

    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    await testRunner.runTest('Upload CSV File', () => 
      testRunner.client.uploadFile(agentId, csvBuffer, 'test-data.csv')
    );

    const largeContent = 'This is a large test file.\n'.repeat(20000); // ~500KB
    const largeBuffer = Buffer.from(largeContent, 'utf-8');

    await testRunner.runTest('Upload Large File', () => 
      testRunner.client.uploadFile(agentId, largeBuffer, 'large-test.txt')
    );

    await testRunner.runTest('List Uploaded Files', () => 
      testRunner.client.listFiles(agentId)
    );

    const specialContent = 'File with special characters in name';
    const specialBuffer = Buffer.from(specialContent, 'utf-8');

    await testRunner.runTest('Upload File with Special Characters', () => 
      testRunner.client.uploadFile(agentId, specialBuffer, 'test-file-éàçùñ.txt')
    );

    const longContent = 'A'.repeat(50000); // 50KB of 'A's
    const longBuffer = Buffer.from(longContent, 'utf-8');

    await testRunner.runTest('Upload Very Long File', () => 
      testRunner.client.uploadFile(agentId, longBuffer, 'very-long.txt')
    );

    await testRunner.runTest('Final File List', () => 
      testRunner.client.listFiles(agentId)
    );
  } finally {
    await testRunner.runTest('Cleanup - Delete Test Agent', () => 
      testRunner.client.deleteAgent(agentId)
    );
  }

  

  testRunner.printSummary();
}

if (require.main === module) {
  testFiles().catch(console.error);
}