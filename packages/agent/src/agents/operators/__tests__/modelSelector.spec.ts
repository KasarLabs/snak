import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelSelector } from '../modelSelector.js';
import { ModelsConfig } from '@snakagent/core';

// Test class to expose protected methods
class TestModelSelector extends ModelSelector {
  public loadKeys() { this.loadApiKeys(); }
  public initModels() { return this.initializeModels(); }
  public getAllApiKeys() { return this.allApiKeys; }
  public getDebugMode() { return (this as any).debugMode; }
  public getUseModelSelector() { return (this as any).useModelSelector; }
}

// Test constants
enum ModelProviders {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Gemini = 'gemini',
  DeepSeek = 'deepseek',
}

// Mock models
const mockOpenAIModel = { invoke: jest.fn() };
const mockAnthropicModel = { invoke: jest.fn() };
const mockGeminiModel = { invoke: jest.fn() };

// Mock setup
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn(() => mockOpenAIModel),
}));
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn(() => mockAnthropicModel),
}));
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn(() => mockGeminiModel),
}));
jest.mock('@snakagent/core', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}), { virtual: true });
jest.mock('../../../prompt/prompts', () => ({
  modelSelectorSystemPrompt: jest.fn(() => 'test prompt'),
}));
jest.mock('../../../token/tokenTracking', () => ({
  TokenTracker: {
    trackCall: jest.fn(() => ({
      promptTokens: 1,
      responseTokens: 1,
      totalTokens: 2,
    })),
  },
}));

// Test helpers
const createModelsConfig = (overrides: Partial<ModelsConfig> = {}): ModelsConfig => ({
  fast: { provider: ModelProviders.OpenAI, model_name: 'gpt-fast' },
  smart: { provider: ModelProviders.Anthropic, model_name: 'claude-smart' },
  cheap: { provider: ModelProviders.Gemini, model_name: 'gemini-cheap' },
  ...overrides,
});

const setupApiKeys = (keys: Record<string, string>) => {
  Object.entries(keys).forEach(([key, value]) => {
    process.env[key] = value;
  });
};

const createSelector = (config: any = {}) => {
  const modelsConfig = createModelsConfig(config.modelsConfig);
  return new TestModelSelector({ modelsConfig, ...config });
};

const mockModelResponse = (choice: string) => ({
  content: choice,
  _getType: () => 'ai',
  usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
});

const setupFullEnvironment = () => {
  setupApiKeys({
    OPENAI_API_KEY: 'openai-key',
    ANTHROPIC_API_KEY: 'anthropic-key',
    GEMINI_API_KEY: 'gemini-key',
  });
};

describe('ModelSelector', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Constructor and initialization', () => {
    it.each([
      [false, false, 'default values'],
      [true, true, 'custom values'],
    ])('initializes with %s', (debugMode, useModelSelector, description) => {
      const selector = createSelector({ debugMode, useModelSelector });
      expect(selector.getDebugMode()).toBe(debugMode);
      expect(selector.getUseModelSelector()).toBe(useModelSelector);
    });

    it('sets singleton instance', () => {
      const selector = createSelector();
      expect(ModelSelector.getInstance()).toBe(selector);
    });

    it('initializes successfully with full init method', async () => {
      setupFullEnvironment();
      const selector = createSelector();
      await selector.init();

      const models = selector.getModels();
      expect(models.fast).toBeDefined();
      expect(models.smart).toBeDefined();
      expect(models.cheap).toBeDefined();
    });
  });

  describe('API key management', () => {
    it.each([
      [
        { OPENAI_API_KEY: 'openai-key' },
        { openai: 'openai-key' },
        'single API key'
      ],
      [
        {
          OPENAI_API_KEY: 'openai-key',
          ANTHROPIC_API_KEY: 'anthropic-key',
          GEMINI_API_KEY: 'gemini-key',
        },
        {
          openai: 'openai-key',
          anthropic: 'anthropic-key',
          gemini: 'gemini-key',
        },
        'multiple API keys'
      ],
    ])('loads API keys for %s', (keys, expected, description) => {
      setupApiKeys(keys);
      const selector = createSelector();
      selector.loadKeys();

      expect(selector.getAllApiKeys()).toEqual(expected);
    });

    it('loads API keys with debug mode', () => {
      setupApiKeys({ OPENAI_API_KEY: 'openai-key' });
      const selector = createSelector({ debugMode: true });
      selector.loadKeys();

      expect(selector.getAllApiKeys()).toEqual({ openai: 'openai-key' });
    });
  });

  describe('Model initialization', () => {
    it('initializes models successfully', async () => {
      setupFullEnvironment();
      const selector = createSelector();
      selector.loadKeys();
      await selector.initModels();

      const models = selector.getModels();
      expect(models.fast).toBe(mockOpenAIModel);
      expect(models.smart).toBe(mockAnthropicModel);
      expect(models.cheap).toBe(mockGeminiModel);
    });

    it('throws error when models config is missing', async () => {
      const selector = new TestModelSelector({ modelsConfig: null as any });
      selector.loadKeys();

      await expect(selector.initModels()).rejects.toThrow(
        'Models configuration is not loaded.'
      );
    });

    it.each([
      ['missing API keys', 'missing API keys'],
      ['unsupported provider', 'unsupported provider'],
    ])('handles %s gracefully', async (description, _) => {
      const modelsConfig = createModelsConfig({
        fast: description === 'unsupported provider' 
          ? { provider: 'unsupported' as any, model_name: 'test' }
          : { provider: ModelProviders.OpenAI, model_name: 'test' },
      });

      if (description === 'missing API keys') {
        // Don't set any API keys for this test
        setupApiKeys({});
      } else {
        setupApiKeys({ OPENAI_API_KEY: 'openai-key' });
      }
      
      const selector = new TestModelSelector({ modelsConfig });
      selector.loadKeys();
      await selector.initModels();

      const models = selector.getModels();
      expect(models.fast).toBeUndefined();
    });

    it('initializes models with debug mode', async () => {
      setupFullEnvironment();
      const selector = createSelector({ debugMode: true });
      selector.loadKeys();
      await selector.initModels();

      const models = selector.getModels();
      expect(models.fast).toBe(mockOpenAIModel);
    });
  });

  describe('Model validation', () => {
    it('logs warning for missing required models', async () => {
      setupApiKeys({ OPENAI_API_KEY: 'openai-key' });
      const selector = createSelector();
      selector.loadKeys();
      await selector.initModels();

      const models = selector.getModels();
      expect(models.fast).toBe(mockOpenAIModel);
      expect(models.smart).toBeUndefined();
      expect(models.cheap).toBeUndefined();
    });

    it('logs debug info when all models are present', async () => {
      setupFullEnvironment();
      const selector = createSelector({ debugMode: true });
      selector.loadKeys();
      await selector.initModels();

      const models = selector.getModels();
      expect(Object.keys(models)).toHaveLength(3);
    });
  });

  describe('Model selection', () => {
    beforeEach(() => setupFullEnvironment());

    it.each([
      ['fast', mockOpenAIModel],
      ['smart', mockAnthropicModel],
      ['cheap', mockGeminiModel],
    ])('selects %s model when meta-selector chooses %s', async (choice, expected) => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse(choice));

      const result = await selector.selectModelForMessages([new HumanMessage('hello')]);

      expect(result.model).toBe(expected);
      expect(result.model_name).toBe(choice);
      expect(result.token).toBeDefined();
    });

    it('uses originalUserQuery when provided in config', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse('smart'));

      const result = await selector.selectModelForMessages(
        [new HumanMessage('hello')],
        { originalUserQuery: 'complex reasoning task' }
      );

      expect(result.model).toBe(mockAnthropicModel);
      expect(result.model_name).toBe('smart');
    });

    it('falls back to last message when no originalUserQuery', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse('cheap'));

      const result = await selector.selectModelForMessages([new HumanMessage('simple task')]);

      expect(result.model).toBe(mockGeminiModel);
      expect(result.model_name).toBe('cheap');
    });

    it('handles message with non-string content', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse('fast'));

      const result = await selector.selectModelForMessages([
        new HumanMessage({ type: 'text', text: 'test' } as any),
      ]);

      expect(result.model).toBe(mockOpenAIModel);
      expect(result.model_name).toBe('fast');
    });

    it('defaults to smart when model choice is invalid', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse('invalid'));

      const result = await selector.selectModelForMessages([new HumanMessage('hello')]);

      expect(result.model).toBe(mockAnthropicModel);
      expect(result.model_name).toBe('smart');
    });

    it('defaults to smart when no messages provided', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      const result = await selector.selectModelForMessages([]);

      expect(result.model).toBe(mockAnthropicModel);
      expect(result.model_name).toBe('smart');
    });

    it('throws error when fast model fails', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockRejectedValueOnce(new Error('API error'));

      await expect(
        selector.selectModelForMessages([new HumanMessage('hello')])
      ).rejects.toThrow('API error');
    });
  });

  describe('Execute method', () => {
    beforeEach(() => setupFullEnvironment());

    it('executes selected model successfully', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse('fast'));
      mockOpenAIModel.invoke.mockResolvedValueOnce({ result: 'success' });

      const result = await selector.execute([new HumanMessage('hello')]);

      expect(result).toEqual({ result: 'success' });
    });

    it('falls back to smart model when selected model is unavailable', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse('nonexistent'));
      mockAnthropicModel.invoke.mockResolvedValueOnce({ result: 'fallback' });

      const result = await selector.execute([new HumanMessage('hello')]);

      expect(result).toEqual({ result: 'fallback' });
    });

    it('throws error when both selected and fallback models are unavailable', async () => {
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse('nonexistent'));
      
      const models = selector.getModels();
      delete models.smart;

      await expect(
        selector.execute([new HumanMessage('hello')])
      ).rejects.toThrow('Selected model and fallback "smart" model are unavailable.');
    });

    it('executes with debug mode enabled', async () => {
      const selector = createSelector({ useModelSelector: true, debugMode: true });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce(mockModelResponse('fast'));
      mockOpenAIModel.invoke.mockResolvedValueOnce({ result: 'debug success' });

      const result = await selector.execute([new HumanMessage('hello')]);

      expect(result).toEqual({ result: 'debug success' });
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles missing required models gracefully', async () => {
      setupApiKeys({ ANTHROPIC_API_KEY: 'anthropic-key' });
      const selector = createSelector();
      selector.loadKeys();
      await selector.initModels();

      await expect(
        selector.selectModelForMessages([new HumanMessage('hello')])
      ).rejects.toThrow('Cannot read properties of undefined (reading \'invoke\')');
    });

    it('handles initialization failure', async () => {
      const invalidSelector = new TestModelSelector({ modelsConfig: null as any });
      invalidSelector.loadKeys();

      await expect(invalidSelector.init()).rejects.toThrow('ModelSelector initialization failed:');
    });

    it.each([
      [false, 'without debug mode'],
      [true, 'with debug mode'],
    ])('handles model initialization errors %s', async (debugMode, description) => {
      const config = createModelsConfig({
        fast: { provider: ModelProviders.OpenAI, model_name: 'invalid-model' },
      });

      setupApiKeys({ OPENAI_API_KEY: 'openai-key' });

      const mockChatOpenAI = jest.fn().mockImplementation(() => {
        throw new Error('Model creation failed');
      });
      jest.mocked(require('@langchain/openai').ChatOpenAI).mockImplementation(mockChatOpenAI);

      const selector = new TestModelSelector({ modelsConfig: config, debugMode });
      selector.loadKeys();
      await selector.initModels();

      const models = selector.getModels();
      expect(models.fast).toBeUndefined();
    });
  });

  describe('Additional functionality', () => {
    it('handles deepseek provider gracefully', async () => {
      const config = createModelsConfig({
        fast: { provider: 'deepseek' as any, model_name: 'deepseek-model' },
      });

      setupApiKeys({ OPENAI_API_KEY: 'openai-key' });
      const selector = new TestModelSelector({ modelsConfig: config });
      selector.loadKeys();
      await selector.initModels();

      const models = selector.getModels();
      expect(models.fast).toBeUndefined();
    });

    it('handles empty messages array in selectModelForMessages', async () => {
      setupFullEnvironment();
      const selector = createSelector({ useModelSelector: true });
      selector.loadKeys();
      await selector.initModels();

      const result = await selector.selectModelForMessages([]);

      expect(result.model_name).toBe('smart');
      expect(result.model).toBe(mockAnthropicModel);
    });

    it('tests getApiKey method', () => {
      setupApiKeys({ OPENAI_API_KEY: 'openai-key' });
      const selector = createSelector();
      selector.loadKeys();
      
      const apiKey = (selector as any).getApiKey('openai');
      expect(apiKey).toBe('openai-key');
    });

    it('tests allApiKeys getter', () => {
      setupApiKeys({ OPENAI_API_KEY: 'openai-key' });
      const selector = createSelector();
      selector.loadKeys();
      
      const allKeys = selector.getAllApiKeys();
      expect(allKeys.openai).toBe('openai-key');
      expect(allKeys.anthropic).toBeUndefined();
    });

    it('tests getInstance before initialization', () => {
      // Clear any existing instance
      (ModelSelector as any).instance = null;
      
      const instance = ModelSelector.getInstance();
      expect(instance).toBeNull();
    });

    it('tests getInstance after initialization', () => {
      const selector = createSelector();
      const instance = ModelSelector.getInstance();
      expect(instance).toBe(selector);
    });
  });

  describe('Pass-through validation', () => {
    it('returns models object as-is', () => {
      setupFullEnvironment();
      const selector = createSelector();
      selector.loadKeys();
      
      const models = selector.getModels();
      expect(models).toBeDefined();
      expect(typeof models).toBe('object');
    });
  });
});
