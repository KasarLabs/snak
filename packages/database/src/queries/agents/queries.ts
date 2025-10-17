import {
  AgentConfig,
  AgentProfile,
  McpServerConfig,
  supervisorAgentConfig,
} from '@snakagent/core';
import { Postgres } from '../../database.js';

export namespace agents {
  /**
   * Agent avatar response data
   */
  export interface AgentAvatarData {
    id: string;
    avatar_mime_type: string;
  }

  /**
   * Model configuration data
   */
  export interface ModelConfig {
    provider: string;
    model_name: string;
    temperature: number;
    max_tokens: number;
  }

  /**
   * Prompts data
   */
  export interface PromptsData {
    task_executor_prompt: string;
    task_manager_prompt: string;
    task_verifier_prompt: string;
    task_memory_manager_prompt: string;
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Build WHERE clause for agent queries by ID or name
   * @param identifier - Agent ID or name
   * @param userId - User ID for ownership verification
   * @param searchBy - Search by 'id' or 'name'
   * @returns Object containing whereClause string and params array
   */
  function buildAgentWhereClause(
    identifier: string,
    userId: string,
    searchBy: 'id' | 'name'
  ): { whereClause: string; params: string[] } {
    if (searchBy === 'id') {
      return {
        whereClause: 'id = $1 AND user_id = $2',
        params: [identifier, userId],
      };
    } else {
      return {
        whereClause: '(profile).name = $1 AND user_id = $2',
        params: [identifier, userId],
      };
    }
  }

  /**
   * Generic function to query a single agent by identifier (ID or name)
   * @param identifier - Agent ID or name
   * @param userId - User ID for ownership verification
   * @param searchBy - Search by 'id' or 'name'
   * @param selectClause - SQL SELECT clause (fields to retrieve)
   * @returns Promise<T | null> where T is the result type
   */
  async function queryAgentByIdentifier<T>(
    identifier: string,
    userId: string,
    searchBy: 'id' | 'name',
    selectClause: string
  ): Promise<T | null> {
    const { whereClause, params } = buildAgentWhereClause(
      identifier,
      userId,
      searchBy
    );

    const query = new Postgres.Query(
      `SELECT ${selectClause}
       FROM agents
       WHERE ${whereClause}`,
      params
    );

    const result = await Postgres.query<T>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Build SELECT clause for agent queries
   * @param options - Configuration options for the SELECT clause
   * @returns SQL SELECT clause string
   */
  function buildAgentSelectClause(
    options: {
      includeUserId?: boolean;
      includeAvatar?: boolean;
      includePromptsId?: boolean;
    } = {}
  ): string {
    const {
      includeUserId = false,
      includeAvatar = false,
      includePromptsId = true,
    } = options;

    const fields = [
      'id',
      ...(includeUserId ? ['user_id'] : []),
      'row_to_json(profile) as profile',
      'mcp_servers',
      ...(includePromptsId ? ['prompts_id'] : []),
      'row_to_json(graph) as graph',
      'row_to_json(memory) as memory',
      'row_to_json(rag) as rag',
      'created_at',
      'updated_at',
    ];

    if (includeAvatar) {
      fields.push('avatar_image', 'avatar_mime_type');
    }

    return fields.join(',\n        ');
  }

  /**
   * Build SELECT clause with avatar URL encoding
   * Converts binary avatar_image to data URL format
   * @returns SQL SELECT clause string with avatar URL CASE statement
   */
  function buildAgentSelectWithAvatarUrl(): string {
    return `id,
        row_to_json(profile) as profile,
        mcp_servers as "mcp_servers",
        prompts_id,
        row_to_json(graph) as graph,
        row_to_json(memory) as memory,
        row_to_json(rag) as rag,
        CASE
          WHEN avatar_image IS NOT NULL AND avatar_mime_type IS NOT NULL
          THEN CONCAT('data:', avatar_mime_type, ';base64,', encode(avatar_image, 'base64'))
          ELSE NULL
        END as "avatarUrl",
        avatar_mime_type,
        created_at,
        updated_at`;
  }

  // ============================================================================
  // GET OPERATIONS - Retrieve agent data
  // ============================================================================

  /**
   * Get agent profile by identifier (ID or name)
   * @param identifier - Agent ID or name
   * @param userId - User ID for ownership verification
   * @param searchBy - Search by 'id' or 'name'
   * @returns Promise<{id: string, profile: AgentProfile} | null>
   */
  export async function getAgentProfile(
    identifier: string,
    userId: string,
    searchBy: 'id' | 'name'
  ): Promise<{ id: string; profile: AgentProfile } | null> {
    return queryAgentByIdentifier<{ id: string; profile: AgentProfile }>(
      identifier,
      userId,
      searchBy,
      'id, row_to_json(profile) as profile'
    );
  }

  /**
   * Get agent with MCP servers configuration by identifier (ID or name)
   * @param identifier - Agent ID or name
   * @param userId - User ID for ownership verification
   * @param searchBy - Search by 'id' or 'name'
   * @returns Promise<{id: string, profile: AgentProfile, mcp_servers: Record<string, McpServerConfig>} | null>
   */
  export async function getAgentWithMcp(
    identifier: string,
    userId: string,
    searchBy: 'id' | 'name'
  ): Promise<{
    id: string;
    profile: AgentProfile;
    mcp_servers: Record<string, McpServerConfig>;
  } | null> {
    return queryAgentByIdentifier<{
      id: string;
      profile: AgentProfile;
      mcp_servers: Record<string, McpServerConfig>;
    }>(
      identifier,
      userId,
      searchBy,
      'id, row_to_json(profile) as profile, mcp_servers'
    );
  }

  /**
   * Get complete agent data by identifier (ID or name) - includes all fields
   * @param identifier - Agent ID or name
   * @param userId - User ID for ownership verification
   * @param searchBy - Search by 'id' or 'name'
   * @returns Promise<AgentConfig.Input | null>
   */
  export async function getAgentComplete(
    identifier: string,
    userId: string,
    searchBy: 'id' | 'name'
  ): Promise<{ id: string; agentConfig: AgentConfig.Input } | null> {
    const result =
      await queryAgentByIdentifier<AgentConfig.OutputWithoutUserId>(
        identifier,
        userId,
        searchBy,
        buildAgentSelectClause({ includeUserId: true, includeAvatar: true })
      );

    if (result) {
      const { id, user_id, prompts_id, ...agentConfig } = result;
      return { id, agentConfig };
    }

    return null;
  }

  /**
   * Get agent by ID and user ID
   * @param agentId - Agent ID
   * @param userId - User ID for ownership verification
   * @returns Promise<AgentConfig.OutputWithoutUserId | null>
   */
  export async function getAgentById(
    agentId: string,
    userId: string
  ): Promise<AgentConfig.OutputWithoutUserId | null> {
    const query = new Postgres.Query(
      `SELECT ${buildAgentSelectClause({ includeAvatar: true })}
      FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, userId]
    );

    const result = await Postgres.query<AgentConfig.OutputWithoutUserId>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get all agents for a user with avatar URL
   * @param userId - User ID
   * @returns Promise<AgentConfig.OutputWithoutUserId[]>
   */
  export async function getAllAgentsByUser(
    userId: string
  ): Promise<AgentConfig.OutputWithoutUserId[]> {
    const query = new Postgres.Query(
      `SELECT ${buildAgentSelectWithAvatarUrl()}
      FROM agents
      WHERE user_id = $1`,
      [userId]
    );

    const result = await Postgres.query<AgentConfig.OutputWithoutUserId>(query);
    return result;
  }

  /**
   * List agents with filtering and pagination
   * @param userId - User ID
   * @param filters - Optional filters for group, mode, name_contains
   * @param limit - Optional limit for pagination
   * @param offset - Optional offset for pagination
   * @returns Promise<AgentConfig.OutputWithoutUserId[]>
   */
  export async function listAgents(
    userId: string,
    filters?: {
      group?: string;
      mode?: string;
      name_contains?: string;
    },
    limit?: number,
    offset?: number
  ): Promise<AgentConfig.OutputWithoutUserId[]> {
    let queryString = `SELECT ${buildAgentSelectWithAvatarUrl()}
      FROM agents
      WHERE user_id = $1`;

    const queryParams: (string | number)[] = [userId];
    let paramIndex = 2;

    // Add filters
    if (filters) {
      if (
        filters.group !== null &&
        filters.group !== undefined &&
        filters.group !== ''
      ) {
        queryString += ` AND (profile)."group" = $${paramIndex}`;
        queryParams.push(filters.group);
        paramIndex++;
      }

      if (
        filters.mode !== null &&
        filters.mode !== undefined &&
        filters.mode !== ''
      ) {
        queryString += ` AND mode = $${paramIndex}`;
        queryParams.push(filters.mode);
        paramIndex++;
      }

      if (
        filters.name_contains !== null &&
        filters.name_contains !== undefined &&
        filters.name_contains !== ''
      ) {
        queryString += ` AND (profile).name ILIKE $${paramIndex}`;
        queryParams.push(`%${filters.name_contains}%`);
        paramIndex++;
      }
    }

    // Add ordering
    queryString += ` ORDER BY created_at DESC`;

    // Add pagination
    if (limit !== undefined) {
      queryString += ` LIMIT $${paramIndex}`;
      queryParams.push(limit);
      paramIndex++;
    }

    if (offset !== undefined) {
      queryString += ` OFFSET $${paramIndex}`;
      queryParams.push(offset);
    }

    const query = new Postgres.Query(queryString, queryParams);

    const result = await Postgres.query<AgentConfig.OutputWithoutUserId>(query);
    return result;
  }

  /**
   * Get all agents (for initialization/syncing)
   * @returns Promise<Output[]>
   */
  export async function getAllAgents(): Promise<AgentConfig.Output[]> {
    const query = new Postgres.Query(`
      SELECT ${buildAgentSelectClause({ includeUserId: true, includeAvatar: true })}
      FROM agents
    `);

    const result = await Postgres.query<AgentConfig.Output>(query);
    return result;
  }

  /**
   * Select agents with custom WHERE clause
   * @param whereClause - WHERE clause for the query
   * @param params - Parameters for the query
   * @returns Promise<AgentConfig.Output[]>
   */
  export async function selectAgents(
    whereClause: string,
    params: any[]
  ): Promise<AgentConfig.Output[]> {
    const query = new Postgres.Query(
      `SELECT ${buildAgentSelectClause({ includeUserId: true, includeAvatar: true })}
       FROM agents WHERE ${whereClause}`,
      params
    );

    const result = await Postgres.query<AgentConfig.Output>(query);
    return result;
  }

  /**
   * Read a single agent by ID or name with all metadata
   * @param identifier - Agent ID or name
   * @param userId - User ID for ownership verification
   * @param searchBy - Whether to search by 'id' or 'name'
   * @returns Promise<AgentConfig.OutputWithoutUserId | null>
   */
  export async function readAgent(
    identifier: string,
    userId: string,
    searchBy: 'id' | 'name'
  ): Promise<AgentConfig.OutputWithoutUserId | null> {
    return queryAgentByIdentifier<AgentConfig.OutputWithoutUserId>(
      identifier,
      userId,
      searchBy,
      `id,
       row_to_json(profile) as profile,
       mcp_servers,
       prompts_id,
       row_to_json(graph) as graph,
       row_to_json(memory) as memory,
       row_to_json(rag) as rag,
       created_at,
       updated_at,
       avatar_mime_type,
       CASE
         WHEN avatar_image IS NOT NULL AND avatar_mime_type IS NOT NULL
         THEN CONCAT('data:', avatar_mime_type, ';base64,', encode(avatar_image, 'base64'))
         ELSE NULL
       END as avatar_image`
    );
  }

  /**
   * Check if agent exists and get profile information
   * @param agentId - Agent ID
   * @param userId - User ID for ownership verification
   * @returns Promise<{group: string, name: string} | null>
   */
  export async function getAgentProfileInfo(
    agentId: string,
    userId: string
  ): Promise<{ group: string; name: string } | null> {
    const query = new Postgres.Query(
      `SELECT (profile)."group" as "group", (profile).name as name
       FROM agents
       WHERE id = $1 AND user_id = $2`,
      [agentId, userId]
    );

    const result = await Postgres.query<{ group: string; name: string }>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Check if user has a supervisor agent
   * @param userId - User ID
   * @returns Promise<{id: string, name: string} | null>
   */
  export async function getSupervisorAgent(
    userId: string
  ): Promise<{ id: string; name: string } | null> {
    const query = new Postgres.Query(
      `SELECT id, (profile).name as name
       FROM agents
       WHERE user_id = $1 AND (profile)."group" = $2`,
      [userId, supervisorAgentConfig.profile.group]
    );

    const result = await Postgres.query<{ id: string; name: string }>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Generic function to get count of agents with optional WHERE clause
   * @param whereClause - Optional WHERE clause (without the WHERE keyword)
   * @param params - Optional parameters for the WHERE clause
   * @returns Promise<number>
   */
  async function getAgentsCount(
    whereClause?: string,
    params?: any[]
  ): Promise<number> {
    const queryString = whereClause
      ? `SELECT COUNT(*) as count FROM agents WHERE ${whereClause}`
      : `SELECT COUNT(*) as count FROM agents`;

    const query = new Postgres.Query(queryString, params || []);
    const result = await Postgres.query<{ count: string }>(query);
    return parseInt(result[0].count, 10);
  }

  /**
   * Get total count of all agents
   * @returns Promise<number>
   */
  export async function getTotalAgentsCount(): Promise<number> {
    return getAgentsCount();
  }

  /**
   * Get count of agents for a specific user
   * @param userId - User ID
   * @returns Promise<number>
   */
  export async function getUserAgentsCount(userId: string): Promise<number> {
    return getAgentsCount('user_id = $1', [userId]);
  }

  /**
   * Check if an agent name exists for a user in a group
   * Used for ensuring unique agent names
   * @param userId - User ID
   * @param baseName - Base agent name
   * @param group - Agent group
   * @returns Promise<{name: string} | null>
   */
  export async function checkAgentNameExists(
    userId: string,
    baseName: string,
  ): Promise<{ name: string } | null> {
    const query = new Postgres.Query(
      `SELECT (profile).name as name
       FROM agents
       WHERE user_id = $1
       AND ((profile).name = $3 OR (profile).name LIKE $3 || '-%')
       ORDER BY LENGTH((profile).name) DESC, (profile).name DESC
       LIMIT 1`,
      [userId, baseName]
    );

    const result = await Postgres.query<{ name: string }>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get messages from agents using the optimized function
   * @param agentId - Agent ID
   * @param threadId - Thread ID (optional)
   * @param userId - User ID
   * @param includeDeleted - Include deleted messages
   * @param limit - Limit number of messages
   * @param offset - Offset for pagination
   * @returns Promise<any[]>
   */
  export async function getMessagesOptimized(
    agentId: string,
    threadId: string | null,
    userId: string,
    includeDeleted: boolean,
    limit: number,
    offset: number
  ): Promise<any[]> {
    const query = new Postgres.Query(
      `SELECT * FROM get_messages_optimized($1::UUID,$2,$3::UUID,$4,$5,$6)`,
      [agentId, threadId, userId, includeDeleted, limit, offset]
    );

    const result = await Postgres.query<any>(query);
    return result;
  }

  /**
   * Get model configuration for a user
   * @param userId - User ID
   * @returns Promise<ModelConfig | null>
   */
  export async function getModelFromUser(
    userId: string
  ): Promise<ModelConfig | null> {
    const query = new Postgres.Query(
      `SELECT
        (model).model_provider as "provider",
        (model).model_name as "model_name",
        (model).temperature as "temperature",
        (model).max_tokens as "max_tokens"
      FROM models_config WHERE user_id = $1`,
      [userId]
    );

    const result = await Postgres.query<ModelConfig>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get prompts by ID
   * @param promptId - Prompt ID (UUID)
   * @returns Promise<PromptsData | null>
   */
  export async function getPromptsById(
    promptId: string
  ): Promise<PromptsData | null> {
    const query = new Postgres.Query(
      `SELECT json_build_object(
        'task_executor_prompt', task_executor_prompt,
        'task_manager_prompt', task_manager_prompt,
        'task_verifier_prompt', task_verifier_prompt,
        'task_memory_manager_prompt', task_memory_manager_prompt
      ) as prompts_json
       FROM prompts
       WHERE id = $1`,
      [promptId]
    );

    const result = await Postgres.query<{ prompts_json: PromptsData }>(query);
    return result.length > 0 ? result[0].prompts_json : null;
  }

  /**
   * Get existing prompts for a user
   * @param userId - User ID
   * @returns Promise<{id: string} | null>
   */
  export async function getExistingPromptsForUser(
    userId: string
  ): Promise<{ id: string } | null> {
    const query = new Postgres.Query(
      `SELECT id FROM prompts WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    const result = await Postgres.query<{ id: string }>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get agent MCP servers by ID and user ID
   * @param agentId - Agent ID
   * @param userId - User ID for ownership verification
   * @returns Promise<{id: string, mcp_servers: Record<string, McpServerConfig>} | null>
   */
  export async function getAgentMcpServers(
    agentId: string,
    userId: string
  ): Promise<{
    id: string;
    mcp_servers: Record<string, McpServerConfig>;
  } | null> {
    const query = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );

    const result = await Postgres.query<{
      id: string;
      mcp_servers: Record<string, McpServerConfig>;
    }>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get all agents MCP servers for a user
   * @param userId - User ID
   * @returns Promise<{id: string, mcp_servers: Record<string, McpServerConfig>}[]>
   */
  export async function getAllAgentsMcpServers(
    userId: string
  ): Promise<{ id: string; mcp_servers: Record<string, McpServerConfig> }[]> {
    const query = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );

    const result = await Postgres.query<{
      id: string;
      mcp_servers: Record<string, McpServerConfig>;
    }>(query);
    return result;
  }

  // ============================================================================
  // INSERT OPERATIONS - Create new agents and related data
  // ============================================================================

  /**
   * Insert a new agent using the insert_agent_from_json function
   * @param userId - User ID
   * @param agentConfig - Agent configuration JSON
   * @returns Promise<AgentConfig.Output | null>
   */
  export async function insertAgentFromJson(
    userId: string,
    agentConfig: AgentConfig.Input
  ): Promise<AgentConfig.Output | null> {
    const query = new Postgres.Query(
      `SELECT id, user_id, profile, mcp_servers, prompts_id, graph, memory, rag, created_at, updated_at, avatar_image, avatar_mime_type
          FROM insert_agent_from_json($1, $2)`,
      [userId, JSON.stringify(agentConfig)]
    );

    const result = await Postgres.query<AgentConfig.Output>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Create default model configuration for a user
   * @param userId - User ID
   * @param provider - Model provider
   * @param modelName - Model name
   * @param temperature - Temperature setting
   * @param maxTokens - Max tokens setting
   * @returns Promise<void>
   */
  export async function createModelConfig(
    userId: string,
    provider: string,
    modelName: string,
    temperature: number,
    maxTokens: number
  ): Promise<void> {
    const query = new Postgres.Query(
      'INSERT INTO models_config (user_id,model) VALUES ($1,ROW($2, $3, $4, $5)::model_config)',
      [userId, provider, modelName, temperature, maxTokens]
    );

    await Postgres.query(query);
  }

  /**
   * Create default prompts for a user
   * @param userId - User ID
   * @param taskExecutorPrompt - Task executor system prompt
   * @param taskManagerPrompt - Task manager system prompt
   * @param taskVerifierPrompt - Task verifier system prompt
   * @param taskMemoryManagerPrompt - Task memory manager system prompt
   * @param isPublic - Whether prompts are public
   * @returns Promise<string> - The created prompt ID
   */
  export async function createDefaultPrompts(
    userId: string,
    taskExecutorPrompt: string,
    taskManagerPrompt: string,
    taskVerifierPrompt: string,
    taskMemoryManagerPrompt: string,
    isPublic: boolean = false
  ): Promise<string> {
    const query = new Postgres.Query(
      `INSERT INTO prompts (
        user_id,
        task_executor_prompt,
        task_manager_prompt,
        task_verifier_prompt,
        task_memory_manager_prompt,
        public
      ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        userId,
        taskExecutorPrompt,
        taskManagerPrompt,
        taskVerifierPrompt,
        taskMemoryManagerPrompt,
        isPublic,
      ]
    );

    const result = await Postgres.query<{ id: string }>(query);
    if (result.length === 0) {
      throw new Error('Failed to create default prompts - no ID returned');
    }
    return result[0].id;
  }

  // ============================================================================
  // UPDATE OPERATIONS - Modify existing agents and related data
  // ============================================================================

  /**
   * Update agent MCP configuration and return only id and mcp_servers
   * @param agentId - Agent ID
   * @param userId - User ID for ownership verification
   * @param mcpServers - MCP servers configuration
   * @returns Promise<{id: string, mcp_servers: Record<string, McpServerConfig>} | null>
   */
  export async function updateAgentMcpServers(
    agentId: string,
    userId: string,
    mcpServers: Record<string, McpServerConfig>
  ): Promise<{
    id: string;
    mcp_servers: Record<string, McpServerConfig>;
  } | null> {
    const query = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [mcpServers, agentId, userId]
    );

    const result = await Postgres.query<{
      id: string;
      mcp_servers: Record<string, McpServerConfig>;
    }>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Update agent MCP configuration
   * @param agentId - Agent ID
   * @param userId - User ID for ownership verification
   * @param mcpServers - MCP servers configuration
   * @returns Promise<AgentConfig.Output | null>
   */
  export async function updateAgentMcp(
    agentId: string,
    userId: string,
    mcpServers: Record<string, McpServerConfig>
  ): Promise<AgentConfig.Output | null> {
    const query = new Postgres.Query(
      `UPDATE agents
       SET "mcp_servers" = $1::jsonb
       WHERE id = $2 AND user_id = $3
       RETURNING ${buildAgentSelectClause({ includeUserId: true, includeAvatar: true })}`,
      [mcpServers, agentId, userId]
    );

    const result = await Postgres.query<AgentConfig.Output>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Update agent configuration using the update_agent_complete function
   * @param agentId - Agent ID
   * @param userId - User ID for ownership verification
   * @param config - Complete agent configuration object
   * @returns Promise<{success: boolean, message: string, updated_agent_id: string, agent_data: AgentConfig.Output}>
   */
  export async function updateAgentComplete(
    agentId: string,
    userId: string,
    config: AgentConfig.InputWithOptionalParam
  ): Promise<{
    success: boolean;
    message: string;
    updated_agent_id: string;
    agent_data: AgentConfig.Output;
  }> {
    const query = new Postgres.Query(
      `SELECT success, message, updated_agent_id, agent_data
       FROM update_agent_complete($1::UUID, $2::UUID, $3::JSONB)`,
      [agentId, userId, JSON.stringify(config)]
    );

    const result = await Postgres.query<{
      success: boolean;
      message: string;
      updated_agent_id: string;
      agent_data: AgentConfig.Output;
    }>(query);
    return result[0];
  }

  /**
   * Update agent avatar
   * @param agentId - Agent ID
   * @param userId - User ID for ownership verification
   * @param buffer - Image buffer
   * @param mimetype - Image MIME type
   * @returns Promise<AgentAvatarData | null>
   */
  export async function updateAgentAvatar(
    agentId: string,
    userId: string,
    buffer: Buffer,
    mimetype: string
  ): Promise<AgentAvatarData | null> {
    const query = new Postgres.Query(
      `UPDATE agents
       SET avatar_image = $1, avatar_mime_type = $2
       WHERE id = $3 AND user_id = $4
       RETURNING id, avatar_mime_type`,
      [buffer, mimetype, agentId, userId]
    );

    const result = await Postgres.query<AgentAvatarData>(query);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Update model configuration for a user
   * @param userId - User ID
   * @param provider - Model provider
   * @param modelName - Model name
   * @param temperature - Temperature setting
   * @param maxTokens - Max tokens setting
   * @returns Promise<any>
   */
  export async function updateModelConfig(
    userId: string,
    provider: string,
    modelName: string,
    temperature: number,
    maxTokens: number
  ): Promise<any> {
    const query = new Postgres.Query(
      `UPDATE models_config SET model = ROW($1, $2, $3, $4)::model_config WHERE user_id = $5`,
      [provider, modelName, temperature, maxTokens, userId]
    );

    const result = await Postgres.query(query);
    return result;
  }

  // ============================================================================
  // DELETE OPERATIONS - Remove agents and related data
  // ============================================================================

  /**
   * Delete agent by ID
   * @param agentId - Agent ID
   * @param userId - User ID for ownership verification
   * @returns Promise<{id: string}> - Deleted agent ID
   */
  export async function deleteAgent(
    agentId: string,
    userId: string
  ): Promise<{ id: string } | null> {
    const query = new Postgres.Query(
      `DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING id`,
      [agentId, userId]
    );

    const result = await Postgres.query<{ id: string }>(query);
    return result.length > 0 ? result[0] : null;
  }
}
