import { checkScarbInstalled } from './install.js';
import { initProject } from './workspace.js';
import {
  ScarbBaseParams,
  TomlSection,
  Dependency,
  CairoProgram,
} from '../types/index.js';
import {
  addSeveralDependancies as addSeveralDependencies,
  isProjectInitialized,
  addTomlSection,
  getProjectDir,
  cleanLibCairo,
  processContractForExecution,
  importContract,
} from './preparation.js';
import { scarb } from '@snak/database/queries';

/**
 * Set up a Scarb project
 * @param params The project name and file paths
 * @returns The project directory
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
    throw new Error(`Error setting up Scarb project: ${error.message}`);
  }
}

/**
 * Set up a Scarb project with TOML sections
 * @param projectDir The project directory
 * @param sections The TOML sections
 * @param dependencies The dependencies
 * @param requiredDependencies The required dependencies
 */
export async function setupToml(
  projectDir: string,
  sections: TomlSection[],
  dependencies?: scarb.Dependency[],
  requiredDependencies?: scarb.Dependency[]
): Promise<void> {
  for (const section of sections) {
    await addTomlSection({
      workingDir: projectDir,
      sectionTitle: section.sectionTitle,
      valuesObject: section.valuesObject,
    });
  }
  await addSeveralDependencies(requiredDependencies || [], projectDir);
  await addSeveralDependencies(dependencies || [], projectDir);
}

/**
 * Sets up the source code for a Scarb project
 * @param projectDir The project directory
 * @param programs The programs to setup
 * @param formattedExecutable The formatted executable
 */
export async function setupSrc(
  projectDir: string,
  programs: CairoProgram[],
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
      await importContract(program.source_code, program.name, projectDir);
    }
  }
}
