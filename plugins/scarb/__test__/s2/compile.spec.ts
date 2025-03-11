// __test__/scarb/compile.spec.ts
import { compileContract } from '../../src/actions/compileContract.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Tests de la fonction compileContract', () => {
  const agent = createMockStarknetAgent();
  let testDir: string;
  let contractPath: string;

  it('devrait compiler un contrat Cairo simple', async () => {
    // Définir les paramètres
    const projectName = 'test_project';
    const contractPath = 'src/contract/test.cairo';
    const dependencies = [
      {
        name: 'openzeppelin',
        version: '1.0.0'
      }
    ];
    
    // Appeler la fonction de compilation
    const result = await compileContract(agent, {
      projectName,
      contractPath,
      dependencies
    });
    
    // Analyser le résultat
    const parsedResult = JSON.parse(result);
    console.log('Résultat de la compilation:', parsedResult);
    
    // Vérifier que la compilation a réussi
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract compiled successfully');
    
    // Vérifier que le projet a été créé
    const projectDir = path.join('./workspace', projectName);
    const projectExists = await fs.access(projectDir).then(() => true).catch(() => false);
    expect(projectExists).toBe(true);
    
    // Vérifier que des fichiers ont été générés dans le répertoire target
    expect(parsedResult.generatedFiles.length).toBeGreaterThan(0);
    
  }, 180000); // 3 minutes de timeout pour la compilation
});