import { TestRunner } from './test-runner.js';
import { SnakConfig } from './types.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const port = process.env.SERVER_PORT || '3002';
const config: SnakConfig = {
  baseUrl: `http://localhost:${port}`,
  userId: process.env.SNAK_USER_ID,
  apiKey: process.env.SERVER_API_KEY,
};

async function main() {
  console.log(chalk.blue.bold('Snak API Test Suite\n'));
  if (!port) {
    console.error(chalk.red('Error: SERVER_PORT is required'));
    process.exit(1);
  }

  console.log(chalk.blue(`Testing against: ${config.baseUrl}`));
  if (config.userId) {
    console.log(chalk.blue(`User ID: ${config.userId}`));
  }
  console.log('');

  const testRunner = new TestRunner(config);

  try {
    await testRunner.runAllTests();
    
    const results = testRunner.getResults();
    const failedTests = results.filter(r => !r.success);
    
    if (failedTests.length > 0) {
      console.log(chalk.yellow('\nWarning: Some tests failed. Check the output above for details.'));
      process.exit(1);
    } else {
      console.log(chalk.green('\nSuccess: All tests passed successfully!'));
      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red('\nError: Test suite crashed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
