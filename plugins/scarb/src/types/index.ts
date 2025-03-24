export interface ExecuteContractParams {
  projectDir: string;
  formattedExecutable: string;
  arguments?: string;
  target: string;
}

export interface ProveProjectParams {
  projectDir: string;
  executionId: string;
}

export interface VerifyProjectParams {
  projectDir: string;
  proofPath: string;
}

export interface ScarbBaseParams {
  projectName: string;
  filePaths?: string[];
}

export interface TomlSection {
  sectionTitle: string;
  valuesObject: Record<string, any>;
}

export interface CairoProgram {
  name: string;
  source_code: string;
}

export interface Dependency {
  name: string;
  version?: string;
  git?: string;
}

export interface ProjectData {
  id: number;
  name: string;
  type: 'contract' | 'cairo_program';
  programs: CairoProgram[];
  dependencies: Dependency[];
  proof?: string;
  verified?: boolean;
}
