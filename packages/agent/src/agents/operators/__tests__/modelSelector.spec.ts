import { HumanMessage } from '@langchain/core/messages';
import { ModelSelector } from '../modelSelector.js';
import { ModelsConfig } from '@snakagent/core';

class TestModelSelector extends ModelSelector {
  public loadKeys() {
    this.loadApiKeys();
  }
  public initModels() {
    return this.initializeModels();
  }
  public getAllApiKeys(): Record<string, string | undefined> {
    return this.allApiKeys;
  }
}

enum ModelProviders {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Gemini = 'gemini',
  DeepSeek = 'deepseek',
}

const mockOpenAIModel = { invoke: jest.fn() };
const mockAnthropicModel = { invoke: jest.fn() };
const mockGeminiModel = { invoke: jest.fn() };

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn(() => mockOpenAIModel),
}));
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn(() => mockAnthropicModel),
}));
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn(() => mockGeminiModel),
}));
jest.mock(
  '@snakagent/core',
  () => ({
    logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }),
  { virtual: true }
);
jest.mock('../../../prompt/prompts', () => ({
  modelSelectorSystemPrompt: () => '',
}));

describe('ModelSelector', () => {
  const modelsConfig: ModelsConfig = {
    fast: { provider: ModelProviders.OpenAI, model_name: 'gpt-fast' },
    smart: { provider: ModelProviders.Anthropic, model_name: 'claude-smart' },
    cheap: { provider: ModelProviders.Gemini, model_name: 'gemini-cheap' },
  };

  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads API keys from environment', () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    process.env.GEMINI_API_KEY = 'gemini-key';

    const selector = new TestModelSelector({ modelsConfig });
    selector.loadKeys();

    expect(selector.getAllApiKeys()).toEqual({
      openai: 'openai-key',
      anthropic: 'anthropic-key',
      gemini: 'gemini-key',
    });
  });

  it('initializes models using the configuration', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    process.env.GEMINI_API_KEY = 'gemini-key';

    const selector = new TestModelSelector({ modelsConfig });
    selector.loadKeys();
    await selector.initModels();

    const models = selector.getModels();
    expect(models.fast).toBe(mockOpenAIModel);
    expect(models.smart).toBe(mockAnthropicModel);
    expect(models.cheap).toBe(mockGeminiModel);
  });

  it.each([
    ['fast', mockOpenAIModel],
    ['smart', mockAnthropicModel],
    ['cheap', mockGeminiModel],
  ])(
    'selects %s model when meta-selector chooses %s',
    async (choice, expected) => {
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.GEMINI_API_KEY = 'gemini-key';

      const selector = new TestModelSelector({
        modelsConfig,
        useModelSelector: true,
      });
      selector.loadKeys();
      await selector.initModels();

      mockOpenAIModel.invoke.mockResolvedValueOnce({
        content: choice,
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      const result = await selector.selectModelForMessages([
        new HumanMessage('hello'),
      ]);

      expect(result.model).toBe(expected);
      expect(result.model_name).toBe(choice);
    }
  );

  it('throws an error when required model is missing', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    const selector = new TestModelSelector({ modelsConfig });
    selector.loadKeys();
    await selector.initModels();

    await expect(
      selector.selectModelForMessages([new HumanMessage('hello')])
    ).rejects.toThrow(`Cannot read properties of undefined (reading 'invoke')`);
  });
});
