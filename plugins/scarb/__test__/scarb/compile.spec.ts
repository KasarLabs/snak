// __test__/scarb/compile.spec.ts
import { compileContract } from '../../src/actions/buildContract.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Tests de la fonction compileContract', () => {
  const agent = createMockStarknetAgent();

  it('devrait compiler un contrat Cairo simple', async () => {
    // Définir les paramètres
    const projectName = 'project_5';
    const contractPaths = [
      'src/contract/test2.cairo',
      'src/contract/test.cairo'
    ];
    const dependencies : any[] = [
      {
        name: 'openzeppelin',
        version: '1.0.0'
      },
    ];
    
    // Appeler la fonction de compilation
    const result = await compileContract(agent, {
      projectName,
      contractPaths,
      dependencies
    });
    
    // Analyser le résultat
    const parsedResult = JSON.parse(result);
    console.log('Résultat de la compilation:', parsedResult);
    
    // Vérifier que la compilation a réussi
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract compiled successfully');
    
    // Vérifier que le projet a été créé
    const projectDir = path.join('./src/workspace', projectName);
    const projectExists = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(projectExists).toBe(true);
    
    // Vérifier que des fichiers ont été générés dans le répertoire target
    expect(parsedResult.casmFiles.length).toBeGreaterThan(0);
    expect(parsedResult.sierraFiles.length).toBeGreaterThan(0);
    
  }, 180000); // 3 minutes de timeout pour la compilation
});