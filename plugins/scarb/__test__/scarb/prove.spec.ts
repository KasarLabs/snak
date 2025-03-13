import { proveContract } from '../../src/actions/proveContract.js';
import { executeProgram } from '../../src/actions/executeProgram.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';

describe('Tests de la fonction compileContract', () => {
  const agent = createMockStarknetAgent();

  it('devrait compiler un contrat Cairo simple', async () => {
    const projectName = 'project_123456';
    
    // Appeler la fonction de compilation
    const resultExec = await executeProgram(agent, {
      projectName : projectName, 
      programPaths: [
        'src/contract/program.cairo',
      ],
      dependencies: []
    });
    
    let parsedResult = JSON.parse(resultExec);
    expect(parsedResult.status).toBe('success');

    const resultProve = await proveContract(agent, {
      projectName: projectName,
      executionId: parsedResult.executionId
    });
    
    parsedResult = JSON.parse(resultProve);
    expect(parsedResult.status).toBe('success');
  }, 180000);
});