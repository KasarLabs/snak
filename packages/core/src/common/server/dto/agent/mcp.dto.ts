import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

/**
 * Request to get a specific agent's MCP config
 */
export class GetAgentMcpsRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;
}

/**
 * Request to get all MCP server of a specific agent
 */
export class AgentMCPRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  mcp_id: string;
}

/**
 * Request to update the value of one secret in a given MCP server
 */
export class UpdateMcpEnvValueRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  mcp_id: string;

  @IsNotEmpty()
  @IsString()
  secret_name: string;

  @IsNotEmpty()
  @IsString()
  secret_value: string;
}

/**
 * Request to rename a secret key in an MCP config
 */
export class UpdateMcpEnvNameRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  mcp_id: string;

  @IsNotEmpty()
  @IsString()
  old_name: string;

  @IsNotEmpty()
  @IsString()
  new_name: string;
}

/**
 * Request to replace --key value or --profile with a new value
 */
export class UpdateMcpValueRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  mcp_id: string;

  @IsNotEmpty()
  @IsString()
  new_value: string;
}

/**
 * Request to delete multiple MCP servers
 */
export class DeleteMultipleMcpServersRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsArray()
  @ArrayNotEmpty()
  mcp_ids: string[];
}

/**
 * Request to add one or more new MCP servers
 */
export class AddMcpServerRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[] | string;
      env?: Record<string, string>;
      [key: string]: any;
    }
  >;
}

/**
 * Request to update an entire agent's MCP server object
 */
export class UpdateAgentMcpDTO {
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsNotEmpty()
  mcp_servers: Record<string, any>; // Replace Record<string, McpServerConfig>
}
