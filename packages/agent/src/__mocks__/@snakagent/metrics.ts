export const metrics = {
  agentConnect: jest.fn(),
  agentDisconnect: jest.fn(),
  agentToolUseCount: jest.fn(),
  agentMsgCount: jest.fn(),
  agentResponseTimeMeasure: jest.fn(),
  dbResponseTime: jest.fn(),
  userAgentConnect: jest.fn(),
  userAgentDisconnect: jest.fn(),
  userTokenUsage: jest.fn(),
  recordAgentTokenUsage: jest.fn(),
  setUserActiveAgents: jest.fn(),
  metrics: jest.fn().mockResolvedValue('mock metrics'),
  contentType: 'text/plain; version=0.0.4; charset=utf-8',
};

export default metrics;
