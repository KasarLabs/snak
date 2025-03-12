// __test__/scarb/compile.spec.ts
import { executeProgram } from '../../src/actions/executeProgram.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Tests de la fonction compileContract', () => {
  const agent = createMockStarknetAgent();

  it('devrait compiler un contrat Cairo simple', async () => {
    // Définir les paramètres
    const projectName = 'project_0';
    const contractPaths = [
      'src/contract/program.cairo',
    ];
    const dependencies : any[] = [];
    
    // Appeler la fonction de compilation
    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies
    });
    
    // Analyser le résultat
    const parsedResult = JSON.parse(result);
    console.log('Résultat de l\'execution:', parsedResult);
    
    expect(parsedResult.status).toBe('success');
    
    const projectDir = path.join('./src/workspace', projectName);
    const projectExists = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(projectExists).toBe(true);
    
  }, 180000);

  it('devrait compiler un contrat Cairo simple avec des arguments et une fonction precise', async () => {
    // Définir les paramètres
    const projectName = 'project_2';
    const contractPaths = [
      'src/contract/program2.cairo',
      'src/contract/program.cairo'
    ];
    const dependencies : any[] = [];
    
    // Appeler la fonction de compilation
    const result = await executeProgram(agent, {
      projectName,
      programPaths: contractPaths,
      dependencies,
      executableFunction: 'fib',
      arguments: '1',
      executableName: 'program2'
    });
    
    // Analyser le résultat
    const parsedResult = JSON.parse(result);
    console.log('Résultat de l\'execution:', parsedResult);
    
    expect(parsedResult.status).toBe('success');
    
    const projectDir = path.join('./src/workspace', projectName);
    const projectExists = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(projectExists).toBe(true);
    
  }, 180000);
});