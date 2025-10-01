export class ServerError extends Error {
  errorCode: string;
  statusCode: number;
  originalError?: Error;

  constructor(errorCode: string, originalError?: Error) {
    const errorMessage = errorMap.get(errorCode) || 'Unknown error';
    super(errorMessage);
    this.name = 'ServerError';
    this.errorCode = errorCode;

    const codePrefix = errorCode.substring(0, 3);
    switch (codePrefix) {
      case 'E01':
        this.statusCode = 404; // Not Found
        break;
      case 'E02':
        this.statusCode = 500; // Internal Server Error for DB operations
        break;
      case 'E03':
        this.statusCode = 500; // Internal Server Error for agent execution
        break;
      case 'E04':
        this.statusCode = 400; // Bad Request for validation errors
        break;
      case 'E05':
        this.statusCode = 500; // Internal Server Error for data retrieval
        break;
      case 'E06':
        this.statusCode = 403; // Forbidden for auth errors
        break;
      case 'E07':
        this.statusCode = 500; // Internal Server Error for system errors
        break;
      default:
        this.statusCode = 500; // Default to 500
    }

    this.originalError = originalError;
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

const errorMap: Map<string, string> = new Map([
  // E01 : Resource not found errors
  ['E01TA400', 'Agent not found'],
  ['E01TA410', 'Conversation not found'],
  ['E01TA420', 'Message not found'],
  ['E01TA430', 'Resource not found'],

  // E02 : Database operation errors
  ['E02TA100', 'Database read operation failed'],
  ['E02TA110', 'Agent already exists'],
  ['E02TA120', 'Agent creation failed'],
  ['E02TA130', 'Agent deletion failed'],
  ['E02TA140', 'Agent conversation not found'],
  ['E02TA150', 'Agent conversation creation failed'],
  ['E02TA160', 'Agent conversation deletion failed'],
  ['E02TA200', 'Agent operation failed'],
  ['E02TA300', 'Agent deletion operation failed'],

  // E03 : Agent execution errors
  ['E03TA100', 'Agent execution failed'],
  ['E03TA110', 'Agent request processing failed'],
  ['E03TA120', 'Agent response generation failed'],
  ['E03TA200', 'Agent execution timed out'],

  // E04 : Input validation errors
  ['E04TA100', 'Invalid agent configuration'],
  ['E04TA110', 'Invalid conversation parameters'],
  ['E04TA120', 'Invalid request format'],

  // E05 : Data retrieval errors
  ['E05TA100', 'Failed to retrieve data'],
  ['E05TA110', 'Failed to retrieve conversations'],
  ['E05TA120', 'Failed to retrieve messages'],
  ['E05TA130', 'Failed to retrieve agents'],

  // E06 : Authentication/Authorization errors
  ['E06TA100', 'Unauthorized access to agent'],
  ['E06TA110', 'Unauthorized access to conversation'],

  // E07 : System errors
  ['E07TA100', 'Internal server error'],
  ['E07TA110', 'Service unavailable'],
  ['E07TA120', 'Metrics recording failed'],
]);

// ============================================
// GRAPH ERROR CLASS
// ============================================

/**
 * Graph error codes follow the pattern: E08[Component][Sequence]
 * E08: Graph execution errors
 * Component codes:
 *   - GI: Graph Initialization (E08GI)
 *   - GC: Graph Configuration (E08GC)
 *   - NE: Node Execution (E08NE)
 *   - MM: Memory Management (E08MM)
 *   - MI: Model Invocation (E08MI)
 *   - TE: Tool Execution (E08TE)
 *   - HI: Human Interaction (E08HI)
 *   - DB: Database Operations (E08DB)
 *   - RT: Routing (E08RT)
 *   - ST: State Management (E08ST)
 *   - TO: Timeout (E08TO)
 *   - VL: Validation (E08VL)
 *   - PR: Parsing (E08PR)
 */

export class GraphError extends Error {
  errorCode: string;
  statusCode: number;
  errorType: GraphErrorType;
  source: string;
  timestamp: number;
  originalError?: Error;
  context?: Record<string, any>;

  constructor(
    errorCode: string,
    source: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    const errorMessage = graphErrorMap.get(errorCode) || 'Unknown graph error';
    super(errorMessage);
    this.name = 'GraphError';
    this.errorCode = errorCode;
    this.source = source;
    this.timestamp = Date.now();
    this.originalError = originalError;
    this.context = context;

    // Determine error type based on error code
    this.errorType = this.determineErrorType(errorCode);

    // Map error codes to HTTP status codes
    const codePrefix = errorCode.substring(0, 5); // E08XX
    switch (codePrefix) {
      case 'E08GI': // Graph Initialization
      case 'E08GC': // Graph Configuration
      case 'E08ST': // State Management
        this.statusCode = 500; // Internal Server Error
        break;
      case 'E08NE': // Node Execution
      case 'E08MM': // Memory Management
      case 'E08MI': // Model Invocation
      case 'E08TE': // Tool Execution
      case 'E08DB': // Database Operations
        this.statusCode = 500; // Internal Server Error
        break;
      case 'E08HI': // Human Interaction
        this.statusCode = 408; // Request Timeout (waiting for human)
        break;
      case 'E08TO': // Timeout
        this.statusCode = 504; // Gateway Timeout
        break;
      case 'E08VL': // Validation
      case 'E08PR': // Parsing
        this.statusCode = 422; // Unprocessable Entity
        break;
      case 'E08RT': // Routing
        this.statusCode = 500; // Internal Server Error
        break;
      default:
        this.statusCode = 500; // Default to 500
    }

    Object.setPrototypeOf(this, GraphError.prototype);
  }

  /**
   * Determines the GraphErrorType enum based on error code
   */
  private determineErrorType(errorCode: string): GraphErrorType {
    const typeMap: Record<string, GraphErrorType> = {
      E08GI: 'execution_error',
      E08GC: 'validation_error',
      E08NE: 'execution_error',
      E08MM: 'memory_error',
      E08MI: 'execution_error',
      E08TE: 'tool_error',
      E08HI: 'execution_error',
      E08DB: 'execution_error',
      E08RT: 'execution_error',
      E08ST: 'execution_error',
      E08TO: 'timeout_error',
      E08VL: 'validation_error',
      E08PR: 'validation_error',
    };

    const prefix = errorCode.substring(0, 5);
    return typeMap[prefix] || 'unknown_error';
  }

  /**
   * Converts GraphError to GraphErrorType interface
   */
  toGraphErrorType(): {
    type: GraphErrorType;
    hasError: boolean;
    message: string;
    source: string;
    timestamp: number;
  } {
    return {
      type: this.errorType,
      hasError: true,
      message: this.message,
      source: this.source,
      timestamp: this.timestamp,
    };
  }

  /**
   * Creates a detailed error message including context
   */
  toDetailedString(): string {
    let details = `[${this.name}] ${this.errorCode}: ${this.message}\n`;
    details += `Source: ${this.source}\n`;
    details += `Timestamp: ${new Date(this.timestamp).toISOString()}\n`;

    if (this.context && Object.keys(this.context).length > 0) {
      details += `Context: ${JSON.stringify(this.context, null, 2)}\n`;
    }

    if (this.originalError) {
      details += `Original Error: ${this.originalError.message}\n`;
      if (this.originalError.stack) {
        details += `Stack: ${this.originalError.stack}\n`;
      }
    }

    return details;
  }
}

/**
 * Type definition for graph error types matching GraphErrorTypeEnum
 */
type GraphErrorType =
  | 'task_error'
  | 'tool_error'
  | 'task_aborted'
  | 'execution_error'
  | 'validation_error'
  | 'memory_error'
  | 'manager_error'
  | 'blocked_task'
  | 'wrong_number_of_tools'
  | 'timeout_error'
  | 'unknown_error';

const graphErrorMap: Map<string, string> = new Map([
  // E08GI: Graph Initialization Errors (100-199)
  ['E08GI100', 'Graph initialization failed'],
  ['E08GI110', 'Checkpointer initialization failed'],
  ['E08GI120', 'Compiled graph creation failed'],
  ['E08GI130', 'Graph workflow build failed'],
  ['E08GI140', 'Agent configuration missing during initialization'],
  ['E08GI150', 'Database initialization failed for graph'],
  ['E08GI160', 'Tools list initialization failed'],
  ['E08GI170', 'RAG agent initialization failed'],

  // E08GC: Graph Configuration Errors (200-299)
  ['E08GC200', 'Invalid graph configuration'],
  ['E08GC210', 'Agent configuration is required but missing'],
  ['E08GC220', 'User request configuration is required but missing'],
  ['E08GC230', 'Thread ID configuration missing'],
  ['E08GC240', 'Invalid memory size configuration'],
  ['E08GC250', 'Invalid recursion limit configuration'],
  ['E08GC260', 'Invalid execution timeout configuration'],
  ['E08GC270', 'Configurable annotation validation failed'],

  // E08NE: Node Execution Errors (300-399)
  ['E08NE300', 'Node execution failed'],
  ['E08NE310', 'Task manager node execution failed'],
  ['E08NE320', 'Task executor node execution failed'],
  ['E08NE330', 'Memory orchestrator node execution failed'],
  ['E08NE340', 'Task verifier node execution failed'],
  ['E08NE350', 'Human handler node execution failed'],
  ['E08NE360', 'End graph node execution failed'],
  ['E08NE370', 'Max steps reached in node execution'],
  ['E08NE380', 'Node execution aborted'],

  // E08MM: Memory Management Errors (400-499)
  ['E08MM400', 'Memory management operation failed'],
  ['E08MM410', 'Short-term memory (STM) update failed'],
  ['E08MM420', 'Long-term memory (LTM) update failed'],
  ['E08MM430', 'Episodic memory creation failed'],
  ['E08MM440', 'Semantic memory creation failed'],
  ['E08MM450', 'Holistic memory creation failed'],
  ['E08MM460', 'Memory retrieval failed'],
  ['E08MM470', 'Memory state initialization failed'],
  ['E08MM480', 'Memory parsing failed'],
  ['E08MM490', 'Memory embedding generation failed'],

  // E08MI: Model Invocation Errors (500-599)
  ['E08MI500', 'Model invocation failed'],
  ['E08MI510', 'Model returned no response'],
  ['E08MI520', 'Model invocation timeout'],
  ['E08MI530', 'Model binding with tools failed'],
  ['E08MI540', 'Invalid model response format'],
  ['E08MI550', 'Model not found in configuration'],
  ['E08MI560', 'Token limit exceeded'],
  ['E08MI570', 'Model API error'],
  ['E08MI580', 'Model streaming failed'],

  // E08TE: Tool Execution Errors (600-699)
  ['E08TE600', 'Tool execution failed'],
  ['E08TE610', 'Tool not found'],
  ['E08TE620', 'Invalid tool arguments'],
  ['E08TE630', 'Tool execution timeout'],
  ['E08TE640', 'Wrong number of tool calls'],
  ['E08TE650', 'Core tool execution failed'],
  ['E08TE660', 'Tool result parsing failed'],
  ['E08TE670', 'Tool validation failed'],
  ['E08TE680', 'Multiple tool calls when single expected'],

  // E08HI: Human Interaction Errors (700-799)
  ['E08HI700', 'Human interaction failed'],
  ['E08HI710', 'No current task available for human input'],
  ['E08HI720', 'No human input received'],
  ['E08HI730', 'Invalid human handler step'],
  ['E08HI740', 'Unknown human handler source'],
  ['E08HI750', 'Human interrupt timeout'],
  ['E08HI760', 'Human input validation failed'],

  // E08DB: Database Operation Errors (800-899)
  ['E08DB800', 'Graph database operation failed'],
  ['E08DB810', 'Checkpoint save failed'],
  ['E08DB820', 'Checkpoint retrieval failed'],
  ['E08DB830', 'Memory database operation timeout'],
  ['E08DB840', 'State snapshot retrieval failed'],
  ['E08DB850', 'Database connection pool not initialized'],
  ['E08DB860', 'Memory upsert operation failed'],
  ['E08DB870', 'Database transaction failed'],

  // E08RT: Routing Errors (900-999)
  ['E08RT900', 'Graph routing failed'],
  ['E08RT910', 'Invalid routing target'],
  ['E08RT920', 'Conditional routing failed'],
  ['E08RT930', 'Subgraph routing failed'],
  ['E08RT940', 'Skip validation routing error'],
  ['E08RT950', 'Unknown routing source'],

  // E08ST: State Management Errors (1000-1099)
  ['E08ST1000', 'Graph state management failed'],
  ['E08ST1010', 'State initialization failed'],
  ['E08ST1020', 'State snapshot creation failed'],
  ['E08ST1030', 'State update failed'],
  ['E08ST1040', 'Invalid state transition'],
  ['E08ST1050', 'Current task not found in state'],
  ['E08ST1060', 'State validation failed'],
  ['E08ST1070', 'State cleanup failed'],

  // E08TO: Timeout Errors (1100-1199)
  ['E08TO1100', 'Graph operation timeout'],
  ['E08TO1110', 'Model invocation timeout'],
  ['E08TO1120', 'Tool execution timeout'],
  ['E08TO1130', 'Database operation timeout'],
  ['E08TO1140', 'Memory retrieval timeout'],
  ['E08TO1150', 'Node execution timeout'],
  ['E08TO1160', 'Human interaction timeout'],

  // E08VL: Validation Errors (1200-1299)
  ['E08VL1200', 'Graph validation failed'],
  ['E08VL1210', 'Task validation failed'],
  ['E08VL1220', 'Step validation failed'],
  ['E08VL1230', 'Tool call validation failed'],
  ['E08VL1240', 'Configuration validation failed'],
  ['E08VL1250', 'Input validation failed'],
  ['E08VL1260', 'Output validation failed'],
  ['E08VL1270', 'Schema validation failed'],

  // E08PR: Parsing Errors (1300-1399)
  ['E08PR1300', 'Graph parsing failed'],
  ['E08PR1310', 'Task parsing failed'],
  ['E08PR1320', 'Thought parsing failed'],
  ['E08PR1330', 'Tool call parsing failed'],
  ['E08PR1340', 'Memory parsing failed'],
  ['E08PR1350', 'Message parsing failed'],
  ['E08PR1360', 'JSON parsing failed'],
  ['E08PR1370', 'XML parsing failed'],
]);

export { graphErrorMap };
export default ServerError;
