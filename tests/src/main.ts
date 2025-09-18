import { TestRunner } from './test-runner.js';
import chalk from 'chalk';
import { createConfigForUser } from './helpers.js';

const config = createConfigForUser();

async function main() {
  console.log(chalk.blue.bold('Snak API Test Suite\n'));

  console.log(chalk.blue(`Testing against: ${config.baseUrl}`));
  if (config.userId) {
    console.log(chalk.blue(`User ID: ${config.userId}`));
  }

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
