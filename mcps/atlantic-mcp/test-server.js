#!/usr/bin/env node

// Simple test script to verify the atlantic MCP server
const { spawn } = require('child_process');
const path = require('path');

// Start the MCP server
const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Test message to send to the server
const testMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

// Send test message
serverProcess.stdin.write(JSON.stringify(testMessage) + '\n');

// Handle server response
serverProcess.stdout.on('data', (data) => {
  console.log('Server response:', data.toString());
  serverProcess.kill();
});

// Handle server errors
serverProcess.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Handle server exit
serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('Test timeout - killing server');
  serverProcess.kill();
}, 5000);
