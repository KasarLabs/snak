const errorMap: Map<string, string> = new Map([
  // E01 : General errors
  ['E01TA400', 'Agent not found'],

  // E02 : Create agent errors
  ['E02TA100', 'Agent already exists'],
  ['E02TA200', 'Agent creation failed'],

  // E03 : Agent execution errors
  ['E03TA100', 'Agent execution failed'],
  ['E03TA200', 'Agent execution timed out'],
]);

export default errorMap;
