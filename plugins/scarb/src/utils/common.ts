import { checkScarbInstalled } from './install.js';
import { resolveContractPath } from './path.js';
import { initProject } from './command.js';
import {
  addSeveralDependancies,
  isProjectInitialized,
  addTomlSection,
  getProjectDir,
  cleanLibCairo,
  processContractForExecution,
  importContract
} from './preparation.js';
export interface ScarbBaseParams {
  projectName: string;
  filePaths?: string[];
}

/**
 * Setup a base Scarb project and handle common initialization steps
 */
export async function setupScarbProject(
  params: ScarbBaseParams
): Promise<string> {
  try {
    await checkScarbInstalled();

    const projectDir = await getProjectDir(params.projectName);

    const isInitialized = await isProjectInitialized(projectDir);
    if (!isInitialized) {
      await initProject({ name: params.projectName, projectDir });
    }
    
    return projectDir;
  } catch (error) {
      throw new Error('Error setting up Scarb project: ' + error.message);
  }
}


export interface Dependency {
    name: string;
    version?: string;
    git?: string;
  }
  
  export interface TomlSection {
    sectionTitle: string;
    valuesObject: Record<string, any>;
  }
  
  /**
   * Configure le fichier TOML avec plusieurs sections et dépendances
   * 
   * @param projectDir Répertoire du projet
   * @param sections Sections TOML à ajouter
   * @param dependencies Dépendances à ajouter
   * @param requiredDependencies Dépendances obligatoires spécifiques à l'action
   */
  export async function setupToml(
    projectDir: string,
    sections: TomlSection[],
    dependencies?: Dependency[],
    requiredDependencies?: Dependency[]
  ): Promise<void> {
    for (const section of sections) {
      await addTomlSection({
        workingDir: projectDir,
        sectionTitle: section.sectionTitle,
        valuesObject: section.valuesObject
      });
    }
    await addSeveralDependancies(requiredDependencies || [], projectDir);
    await addSeveralDependancies(dependencies || [], projectDir);
  }

  export interface cairoProgram {
    name: string;
    source_code: string; 
  } 

  export async function setupSrc(
    projectDir: string,
    programs: cairoProgram[],
    formattedExecutable?: string
  ): Promise<void> {
    await cleanLibCairo(projectDir);
    
    if (formattedExecutable) {
      const parts = formattedExecutable.split('::');
      const executableFunctionName = parts[2] || 'main';

      for (const program of programs) {
        await processContractForExecution(
          program.source_code,
          program.name,
          projectDir,
          executableFunctionName
        );
      }
    } else {
      for (const program of programs) {
        await importContract(
          program.source_code,
          program.name,
          projectDir
        );
      }
    }
  }