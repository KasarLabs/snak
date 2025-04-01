import { readFile } from 'fs/promises';
import { readdirSync } from 'fs';
import { spawn } from 'child_process';
import colors from 'ansi-colors';
import ora from 'ora';
import {LocalRun} from './agents/index.js'

const getPackagesList = async (): Promise<string[]> => {
  try {
    const jsonData = await readFile('./package.json', 'utf8');
    const json = JSON.parse(jsonData);
    const workspaces: string[] = json.workspaces;
    let number_of_dependencies = Object.keys(json.dependencies).length;
    const number_of_workspaces = workspaces.length;
    if (!workspaces) {
      throw new Error('No workspaces found');
    }
    
    const expandedWorkspaces = [...workspaces];
    
    for (let i = 0; i < workspaces.length; i++) {
      const workspace = workspaces[i];
      if (workspace.endsWith('/*')) {
        const folderPath = workspace.replace('/*', '');
        const folder = readdirSync('./' + folderPath);
        
        const index = expandedWorkspaces.indexOf(workspace);
        if (index > -1) {
          expandedWorkspaces.splice(index, 1);
        }
        folder.forEach((element) => {
          expandedWorkspaces.push(`${folderPath}/${element}`);
        });
      }
    }
    
    const result = expandedWorkspaces.filter((element) => !element.endsWith('/*'));
    return result;
  } catch (e) {
    console.log(e);
    return [];
  }
};

const ProgressBarFunction = async (workspaces: string[]): Promise<void> => {
    const spinner = ora('Launch Snak Setup').start();
    let output: string = '';
    const ls = spawn('pnpm', ['turbo', 'run', 'build']);
  
    ls.stdout.on('data', (data) => {
      output = data.toString();
      spinner.text = 'Build in progress';
      spinner.color = 'yellow';
    });
  
    return new Promise((resolve, reject) => {
      ls.on('close', (code) => {
        if (code === 0) {
          spinner.succeed('Build completed successfully');
          spinner.stop();
          console.log(colors.green('Build completed successfully'));
          resolve();
        } else {
          spinner.fail(`Build failed with code ${code}`);
          console.error(output);
          console.log(colors.red(`Build failed with code ${code}`));
          reject(new Error(`Build process failed with code ${code}`));
        }
      });
    });
  };

export const InkDemo = async () => {
  
}

const main = async (): Promise<void> => {
  const workspace = await getPackagesList();
  await ProgressBarFunction(workspace);
  //const value = await LocalRun();
};

main().catch(err => console.error(err));