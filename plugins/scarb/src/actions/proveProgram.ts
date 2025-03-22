import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { checkScarbInstalled } from '../utils/install.js';
import { getProjectDir } from '../utils/preparation.js';
import { proveProject } from '../utils/command.js';
import { proveProgramSchema } from '../schema/schema.js';
import { executeProgram } from './executeProgram.js';
import { z } from 'zod';
import { saveProof } from '../utils/db_save.js';
import { retrieveProof } from '../utils/db_retrieve.js';
import { retrieveProjectData } from '../utils/db_init.js';
import * as fs from 'fs';
import * as path from 'path';
import { compareFiles } from '../utils/db_utils.js';

export const proveProgram = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof proveProgramSchema>
) => {
  try {
    await checkScarbInstalled();
    const projectData = await retrieveProjectData(agent, params.projectName);
    
    const execResult = await executeProgram(agent, { ...params, mode: 'standalone' });
    const parsedExecResult = JSON.parse(execResult);
    
    if (parsedExecResult.status !== 'success' || !parsedExecResult.executionId) {
      throw new Error(`Failed to execute program: ${parsedExecResult.error || 'Unknown error'}`);
    }
    console.log(`Program executed successfully with execution ID: ${parsedExecResult.executionId}`);

    const projectDir = await getProjectDir(params.projectName);

    const result = await proveProject({
      projectDir: projectDir,
      executionId: parsedExecResult.executionId,
    });

    const parsedResult = JSON.parse(result);
    
    // Chemin complet vers le fichier de preuve original
    const originalProofPath = path.join(projectDir, parsedResult.proofPath);
    console.log(`Original proof path: ${originalProofPath}`);

    // Sauvegarde de la preuve dans la base de données
    await saveProof(
      agent,
      projectData.id,
      projectDir,
      parsedResult.proofPath
    );

    // Récupération de la preuve depuis la base de données
    // const proof = await retrieveProof(agent, projectData.name);
    // console.log(`Proof retrieved successfully`);
    
    // // Création d'un fichier temporaire pour la preuve récupérée
    // const retrievedProofPath = path.join(projectDir, 'proof.json');
    // const proofContent = typeof proof === 'string' 
    //   ? proof
    //   : JSON.stringify(proof, null, 2);
    
    // fs.writeFileSync(retrievedProofPath, proofContent);
    // console.log(`Retrieved proof written to: ${retrievedProofPath}`);
    
    // Comparaison des deux fichiers
    // const areIdentical = compareFiles(originalProofPath, retrievedProofPath);
    // console.log(`Proof files are identical: ${areIdentical}`);
    
    // Nettoyage du fichier temporaire
    // fs.unlinkSync(retrievedProofPath);

    return JSON.stringify({
      status: 'success',
      message: 'Contract execution proved successfully',
      output: parsedResult.output,
      errors: parsedResult.errors,
      // proofsIdentical: areIdentical
    });
  } catch (error) {
    console.error("Error proving contract execution:", error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};