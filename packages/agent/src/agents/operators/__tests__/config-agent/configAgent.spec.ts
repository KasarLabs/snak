import {
  ConfigurationAgent,
  ConfigurationAgentConfig,
} from '../../config-agent/configAgent.js';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { AgentType } from '../../../core/baseAgent.js';

jest.mock('../../../core/baseAgent.js', () => ({
  BaseAgent: jest.fn().mockImplementation(function(id: string, type: any, description?: string) {
    this.id = id;
    this.type = type;
    this.description = description;
  }),
  AgentType: {
    SUPERVISOR: 'supervisor',
    OPERATOR: 'operator',
    SNAK: 'snak',
  },
}));

jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockRegister = jest.fn();
const mockUnregister = jest.fn();
jest.mock('../../operatorRegistry.js', () => ({
  OperatorRegistry: {
    getInstance: jest.fn(() => ({
      register: mockRegister,
      unregister: mockUnregister,
    })),
  },
}));

const mockGetModels = jest.fn(() => ({
  fast: { invoke: jest.fn() },
  smart: { invoke: jest.fn() },
  cheap: { invoke: jest.fn() },
}));
jest.mock('../../modelSelector.js', () => ({
  ModelSelector: {
    getInstance: jest.fn(() => ({
      getModels: mockGetModels,
    })),
  },
}));

jest.mock('../../config-agent/configAgentTools.js', () => ({
  getConfigAgentTools: jest.fn(() => [
    { name: 'create_agent', description: 'Create a new agent', schema: {}, func: jest.fn() },
    { name: 'read_agent', description: 'Read an agent', schema: {}, func: jest.fn() },
  ]),
}));

jest.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: jest.fn(() => ({ invoke: jest.fn() })),
}));

jest.mock('../../../../prompt/configAgentPrompts.js', () => ({
  configurationAgentSystemPrompt: jest.fn(() => 'test system prompt'),
}));

describe('ConfigurationAgent', () => {
  let agent: ConfigurationAgent;
  let mockLogger: any;
  let mockModelSelector: any;
  let mockCreateReactAgent: any;
  let mockReactAgent: any;

  // Helpers
  const resp = (content: string) => ({ messages: [new AIMessage({ content })] });
  const mockInvoke = (content: string) => mockReactAgent.invoke.mockResolvedValue(resp(content));
  const mkHuman = (content: string, kwargs?: any) => {
    const msg = new HumanMessage(content);
    if (kwargs) msg.additional_kwargs = kwargs;
    return msg;
  };
  const mkAI = (content: string) => new AIMessage(content);
  
  const makeAgent = async (init = true, cfg?: ConfigurationAgentConfig) => {
    agent = new ConfigurationAgent(cfg);
    if (init) {
      mockModelSelector.getInstance.mockReturnValue({ getModels: mockGetModels });
      await agent.init();
    }
    return agent;
  };
  
  const expectSuccessMessage = (ai: AIMessage, content: string) => {
    expect(ai.content).toBe(content);
    expect(ai.additional_kwargs).toEqual({
      from: 'configuration-agent',
      final: true,
      success: true,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = require('@snakagent/core').logger;
    mockModelSelector = require('../../modelSelector.js').ModelSelector;
    mockCreateReactAgent = require('@langchain/langgraph/prebuilt').createReactAgent;
    mockReactAgent = { invoke: jest.fn() };
    mockCreateReactAgent.mockReturnValue(mockReactAgent);
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      agent = new ConfigurationAgent();
      expect(agent.id).toBe('configuration-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
      expect(agent.description).toContain('managing agent configurations');
    });

    it('should handle debug setting', () => {
      new ConfigurationAgent({ debug: false });
      expect(mockLogger.debug).not.toHaveBeenCalled();
      
      new ConfigurationAgent({ debug: true });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ConfigurationAgent initialized with')
      );
    });

    it('should create with custom model type', () => {
      agent = new ConfigurationAgent({ modelType: 'smart' });
      expect(agent.id).toBe('configuration-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
    });
  });

  describe('init', () => {
    it('should initialize successfully with default config', async () => {
      await makeAgent();
      expect(mockModelSelector.getInstance).toHaveBeenCalled();
      expect(mockCreateReactAgent).toHaveBeenCalledWith({
        llm: expect.any(Object),
        tools: expect.any(Array),
        stateModifier: 'test system prompt',
      });
      expect(mockRegister).toHaveBeenCalledWith('configuration-agent', agent);
    });

    it('should initialize with custom model type', async () => {
      await makeAgent(true, { modelType: 'smart' });
      expect(mockCreateReactAgent).toHaveBeenCalledWith({
        llm: expect.any(Object),
        tools: expect.any(Array),
        stateModifier: 'test system prompt',
      });
    });

    it.each([
      ['ModelSelector null', () => mockModelSelector.getInstance.mockReturnValue(null)],
      ['ModelSelector throw', () => mockModelSelector.getInstance.mockImplementation(() => { throw new Error('ModelSelector error'); })],
      ['createReactAgent throw', () => mockCreateReactAgent.mockImplementation(() => { throw new Error('React agent creation failed'); })],
    ])('should handle %s error', async (_, mockError) => {
      mockError();
      if (mockError.toString().includes('createReactAgent')) {
        mockModelSelector.getInstance.mockReturnValue({ getModels: mockGetModels });
      }
      agent = new ConfigurationAgent();
      
      await expect(agent.init()).rejects.toThrow(
        'ConfigurationAgent initialization failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('ConfigurationAgent initialization failed')
      );
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await makeAgent();
    });

    it.each([
      ['string', 'Create a new agent called test-agent'],
      ['BaseMessage', mkHuman('Update agent test-agent')],
      ['BaseMessage[]', [mkHuman('List all agents')]],
    ])('should execute with %s input successfully', async (_, input) => {
      mockInvoke('Operation completed');
      const result = await agent.execute(input);
      expectSuccessMessage(result, 'Operation completed');
    });

    it.each([
      ['config', 'some input', { originalUserQuery: 'Create a new agent' }],
      ['message kwargs', mkHuman('some content', { originalUserQuery: 'Delete agent test' }), undefined],
      ['first message in array', [mkHuman('first message', { originalUserQuery: 'First query' }), mkHuman('second message')], undefined],
    ])('should use originalUserQuery from %s', async (_, input, config) => {
      mockInvoke('Operation completed');
      const result = await agent.execute(input, false, config);
      expectSuccessMessage(result, 'Operation completed');
      
      const expectedContent = config?.originalUserQuery || 
        (input instanceof HumanMessage && input.additional_kwargs?.originalUserQuery) ||
        (Array.isArray(input) && input[0] instanceof HumanMessage && input[0].additional_kwargs?.originalUserQuery);
      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage(expectedContent || expect.any(String))],
      });
    });

    it.each([
      ['first HumanMessage content', [mkHuman('first human message'), mkHuman('second human message')]],
      ['fallback to last message', [mkAI('AI message'), mkAI('Another AI message')]],
    ])('should handle array input with %s', async (_, messages) => {
      mockInvoke('Operation completed');
      const result = await agent.execute(messages);
      expectSuccessMessage(result, 'Operation completed');
      
      const expectedContent = messages.find(m => m instanceof HumanMessage)?.content || 
        (messages[messages.length - 1]?.content);
      expect(mockReactAgent.invoke).toHaveBeenCalledWith({
        messages: [new HumanMessage(expectedContent || expect.any(String))],
      });
    });

    it.each([
      ['invoke rejection', () => { mockReactAgent.invoke.mockRejectedValue(new Error('Execution failed')); }, 'Configuration operation failed: Execution failed'],
      ['no content response', () => { mockReactAgent.invoke.mockResolvedValue({ messages: [] }); }, 'Configuration operation failed: No content found in the last message'],
    ])('should handle %s error', async (_, setup, expectedError) => {
      setup();
      const result = await agent.execute('test input');
      expect(result.content).toContain(expectedError);
      expect(result.additional_kwargs.success).toBe(false);
    });

    it('should handle React agent not initialized error', async () => {
      agent = new ConfigurationAgent();
      const result = await agent.execute('test input');
      expect(result.content).toContain('Configuration operation failed: React agent not initialized');
      expect(result.additional_kwargs.success).toBe(false);
    });
  });

  describe('getTools', () => {
    it('should return the tools array', () => {
      agent = new ConfigurationAgent();
      const tools = agent.getTools();
      expect(tools).toHaveLength(2);
    });
  });

  describe('dispose', () => {
    it('should dispose and unregister successfully', async () => {
      agent = new ConfigurationAgent();
      await agent.dispose();
      
      expect(mockUnregister).toHaveBeenCalledWith('configuration-agent');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ConfigurationAgent disposed and unregistered'
      );
    });

    it('should handle disposal errors gracefully', async () => {
      agent = new ConfigurationAgent();
      mockUnregister.mockImplementation(() => {
        throw new Error('Unregister failed');
      });
      
      await agent.dispose();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error disposing ConfigurationAgent')
      );
    });
  });

  describe('debug logging', () => {
    describe('debug: true', () => {
      beforeEach(async () => {
        agent = new ConfigurationAgent({ debug: true });
        await agent.init();
        mockInvoke('Operation completed');
      });

      it.each([
        ['string input', 'test string', 'Using string input directly'],
        ['first HumanMessage content', [mkHuman('test message')], 'Using first HumanMessage content'],
        ['fallback to last message', [mkAI('AI message'), mkAI('Another AI message')], 'Fallback to last message content'],
        ['originalUserQuery from config', 'some input', 'Using originalUserQuery from config: "Original query"', { originalUserQuery: 'Original query' }],
        ['originalUserQuery from kwargs', mkHuman('some content', { originalUserQuery: 'Original query' }), 'Using originalUserQuery from single message additional_kwargs'],
      ])('should log debug for %s', async (_, input, expectedLog, config = undefined) => {
        jest.clearAllMocks();
        await agent.execute(input, false, config);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `ConfigurationAgent: ${expectedLog}`
        );
      });
    });

    describe('debug: false', () => {
      beforeEach(async () => {
        agent = new ConfigurationAgent({ debug: false });
        await agent.init();
        mockInvoke('Operation completed');
      });

      it('should not log debug messages during execution', async () => {
        jest.clearAllMocks();
        
        await agent.execute('test string');
        await agent.execute([mkHuman('test message')]);
        await agent.execute('some input', false, { originalUserQuery: 'Original query' });
        
        expect(mockLogger.debug).not.toHaveBeenCalled();
      });
    });
  });
});



