import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

/**
 * Deletes a program from a project
 * @param agent The StarkNet agent
 * @param projectId The project ID
 * @param programName The name of the program to delete
 * @returns Promise resolving to true if deleted successfully
 */
export const deleteProgram = async (
    agent: StarknetAgentInterface,
    projectId: number,
    programName: string
  ): Promise<boolean> => {
    try {
      const database = agent.getDatabaseByName('scarb_db');
      if (!database) {
        throw new Error('Database not found');
      }
  
      const existingProgram = await database.select({
        SELECT: ['id'],
        FROM: ['program'],
        WHERE: [`project_id = ${projectId}`, `name = '${programName}'`]
      });
  
      if (!existingProgram.query || existingProgram.query.rows.length === 0) {
        throw new Error(`Program ${programName} not found in project ${projectId}`);
      }
  
      await database.delete({
        table_name: 'program',
        ONLY: true,
        WHERE: [`name = '${programName}'`]
      });
  
      console.log(`Program ${programName} deleted from project ${projectId}`);
      return true;
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * Deletes a dependency from a project
   * @param agent The StarkNet agent
   * @param projectId The project ID
   * @param dependencyName The name of the dependency to delete
   * @returns Promise resolving to true if deleted successfully
   */
  export const deleteDependency = async (
    agent: StarknetAgentInterface,
    projectId: number,
    dependencyName: string
  ): Promise<boolean> => {
    try {
      const database = agent.getDatabaseByName('scarb_db');
      if (!database) {
        throw new Error('Database not found');
      }
  
      // Check if dependency exists
      const existingDep = await database.select({
        SELECT: ['id'],
        FROM: ['dependency'],
        WHERE: [`project_id = ${projectId}`, `name = '${dependencyName}'`]
      });
  
      if (!existingDep.query || existingDep.query.rows.length === 0) {
        throw new Error(`Dependency ${dependencyName} not found in project ${projectId}`);
      }
  
      // Delete dependency
      await database.delete({
        table_name: 'dependency',
        ONLY: true,
        WHERE: [`project_id = ${projectId}`, `name = '${dependencyName}'`]
      });
  
      console.log(`Dependency ${dependencyName} deleted from project ${projectId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting dependency ${dependencyName}:`, error);
      throw error;
    }
  };
  
/**
 * Deletes an entire project and all its associated data
 * @param agent The StarkNet agent
 * @param projectId The project ID
 * @param projectName The name of the project to delete
 * @returns Promise resolving to true if deleted successfully
 */
export const deleteProject = async (
    agent: StarknetAgentInterface,
    projectName: string
  ): Promise<boolean> => {
    try {
        const database = agent.getDatabaseByName('scarb_db');
        if (!database) {
          throw new Error('Database not found');
        }
      
        const projectResult = await database.delete({
          table_name: 'project',
          ONLY: false,
          WHERE: [`name = '${projectName}'`]
        });
        
        
        if (projectResult.status !== 'success') {
          throw new Error(`Failed to delete project "${projectName}"`);
        }
        
        console.log(`Project ${projectName} deleted successfully`);
        return true;
      } catch (error) {
        console.error(`Error deleting project ${projectName}:`, error);
        throw error;
      }
  };