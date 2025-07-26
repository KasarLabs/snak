#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

// Start the MCP server
const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send an initialize request
const initializeRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

console.log('Starting AVNU MCP Server...');
console.log('Sending initialize request...');

serverProcess.stdin.write(JSON.stringify(initializeRequest) + '\n');

serverProcess.stdout.on('data', (data) => {
  const response = data.toString().trim();
  console.log('Server response:', response);

  try {
    const parsed = JSON.parse(response);
    if (parsed.result) {
      console.log('✅ Server initialized successfully!');
      console.log('Server info:', parsed.result.serverInfo);
    }
  } catch (e) {
    console.log('Raw response:', response);
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Cleanup after 5 seconds
setTimeout(() => {
  console.log('Shutting down test...');
  serverProcess.kill();
  process.exit(0);
}, 5000);
