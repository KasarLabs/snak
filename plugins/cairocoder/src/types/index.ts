/**
 * Represents the response from the Cairo code generation API
 */
export interface CairoCodeGenerationResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    logprobs: any;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
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