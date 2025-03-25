// __test__/scarb/compile.spec.ts
import { compileContract } from '../../src/actions/buildContract.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWorkspacePath } from '../../src/utils/path.js';

const execAsync = promisify(exec);

describe('Tests de la fonction compileContract', () => {
  const agent = createMockStarknetAgent();

  afterAll(async () => {
    try {
      const workspacePath = getWorkspacePath();

      await execAsync(`rm -rf ${workspacePath}/project_*`);
      console.log('Projets de test nettoyés avec succès');
    } catch (error) {
      console.error('Erreur lors du nettoyage des projets:', error);
    }
  }, 10000);

  it('devrait compiler un contrat Cairo simple', async () => {
    const projectName = 'project_5';
    const contractPaths = [
      'src/contract/test2.cairo',
      'src/contract/test.cairo',
    ];
    const dependencies: any[] = [
      {
        name: 'openzeppelin',
        version: '1.0.0',
      },
    ];

    const result = await compileContract(agent, {
      projectName,
      contractPaths,
      dependencies,
    });

    const parsedResult = JSON.parse(result);
    console.log('Résultat de la compilation:', parsedResult);

    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract compiled successfully');

    const projectDir = path.join('./src/workspace', projectName);
    const projectExists = await fs
      .access(projectDir)
      .then(() => true)
      .catch(() => false);
    expect(projectExists).toBe(true);

    expect(parsedResult.casmFiles.length).toBeGreaterThan(0);
    expect(parsedResult.sierraFiles.length).toBeGreaterThan(0);
  }, 180000);
  it('should handle missing scarb installation', async () => {
    // Mock checkScarbInstalled to return false for this test
    jest
      .spyOn(require('../../src/utils/install.js'), 'checkScarbInstalled')
      .mockResolvedValueOnce(false);

    const projectName = 'project_no_scarb';
    const contractPaths = ['src/contract/test.cairo'];

    const result = await compileContract(agent, {
      projectName,
      contractPaths,
    });

    const parsedResult = JSON.parse(result);
    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toBeTruthy();
  }, 10000);

  it('should handle compilation with no dependencies', async () => {
    const projectName = 'project_no_deps';
    const contractPaths = ['src/contract/program3.cairo'];

    const result = await compileContract(agent, {
      projectName,
      contractPaths,
      // No dependencies provided
    });

    const parsedResult = JSON.parse(result);
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract compiled successfully');

    // Verify project setup and file generation
    const projectDir = path.join('./src/workspace', projectName);
    const projectExists = await fs
      .access(projectDir)
      .then(() => true)
      .catch(() => false);
    expect(projectExists).toBe(true);
  }, 180000);

  it('should reuse existing project when available', async () => {
    // First create a project
    const projectName = 'project_reuse';
    const initialPaths = ['src/contract/program.cairo'];

    await compileContract(agent, {
      projectName,
      contractPaths: initialPaths,
    });

    // Spy on initProject to verify it's not called again
    const initProjectSpy = jest.spyOn(
      require('../../src/utils/command.js'),
      'initProject'
    );

    // Compile again with the same project name but different contracts
    const result = await compileContract(agent, {
      projectName,
      contractPaths: ['src/contract/program2.cairo'],
    });

    const parsedResult = JSON.parse(result);

    // Verify compilation success
    expect(parsedResult.status).toBe('success');

    // Verify that initProject wasn't called
    expect(initProjectSpy).not.toHaveBeenCalled();
  }, 240000);

  it('should handle git dependencies', async () => {
    const projectName = 'project_git_deps';
    const contractPaths = ['src/contract/test.cairo'];
    const dependencies = [
      {
        name: 'openzeppelin',
        git: 'https://github.com/OpenZeppelin/cairo-contracts.git',
        version: '1.0.0',
      },
    ];

    const result = await compileContract(agent, {
      projectName,
      contractPaths,
      dependencies,
    });

    const parsedResult = JSON.parse(result);
    expect(parsedResult.status).toBe('success');
    expect(parsedResult.message).toBe('Contract compiled successfully');
  }, 180000);

  it('should handle non-existent contract path', async () => {
    const projectName = 'project_missing_contract';
    const contractPaths = ['src/contract/non_existent.cairo'];

    // Mock resolveContractPath to throw an error
    jest
      .spyOn(require('../../src/utils/path.js'), 'resolveContractPath')
      .mockImplementationOnce(() => {
        throw new Error('Impossible de résoudre le chemin du contrat');
      });

    const result = await compileContract(agent, {
      projectName,
      contractPaths,
    });

    const parsedResult = JSON.parse(result);
    expect(parsedResult.status).toBe('failure');
    expect(parsedResult.error).toContain(
      'Impossible de résoudre le chemin du contrat'
    );
  }, 10000);
});
