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

export default ServerError;
