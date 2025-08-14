import { normalizeNumericValues } from '../../../config-agent/tools/normalizeAgentValues.js';

describe('normalizeNumericValues', () => {
  describe('numeric properties normalization', () => {
    it.each([
      ['max_iterations', undefined, 15, true],
      ['max_iterations', null, 15, true],
      ['max_iterations', 0, 15, true],
      ['max_iterations', -1, 15, true],
      ['max_iterations', NaN, 15, true],
      ['max_iterations', Infinity, 15, true],
      ['max_iterations', 1, 1, false],
      ['max_iterations', 25, 25, false],

      ['interval', undefined, 5, true],
      ['interval', null, 5, true],
      ['interval', 0, 5, true],
      ['interval', -1, 5, true],
      ['interval', NaN, 5, true],
      ['interval', -Infinity, 5, true],
      ['interval', 1, 1, false],
      ['interval', 10, 10, false],

      ['memory.shortTermMemorySize', undefined, 5, true],
      ['memory.shortTermMemorySize', null, 5, true],
      ['memory.shortTermMemorySize', 0, 5, true],
      ['memory.shortTermMemorySize', -1, 5, true],
      ['memory.shortTermMemorySize', NaN, 5, true],
      ['memory.shortTermMemorySize', 1, 1, false],
      ['memory.shortTermMemorySize', 30, 30, false],

      ['memory.memorySize', undefined, 20, true],
      ['memory.memorySize', null, 20, true],
      ['memory.memorySize', 0, 20, true],
      ['memory.memorySize', -1, 20, true],
      ['memory.memorySize', NaN, 20, true],
      ['memory.memorySize', 1, 1, false],
      ['memory.memorySize', 100, 100, false],

      ['rag.topK', undefined, 4, true],
      ['rag.topK', null, 4, true],
      ['rag.topK', 0, 4, true],
      ['rag.topK', -1, 4, true],
      ['rag.topK', NaN, 4, true],
      ['rag.topK', 1, 1, false],
      ['rag.topK', 25, 25, false],
    ])(
      'should normalize %s: %p → %p',
      (path, inputValue, expected, shouldApplyDefault) => {
        const config = path.includes('.')
          ? { [path.split('.')[0]]: { [path.split('.')[1]]: inputValue } }
          : { [path]: inputValue };

        const result = normalizeNumericValues(config);

        if (path.includes('.')) {
          const [obj, prop] = path.split('.');
          expect(result.normalizedConfig[obj]?.[prop]).toBe(expected);
        } else {
          expect(result.normalizedConfig[path]).toBe(expected);
        }

        if (shouldApplyDefault) {
          const expectedMessage = `${path} set to default value (${expected})`;
          expect(result.appliedDefaults).toContain(expectedMessage);
        } else {
          const unexpectedMessage = `${path} set to default value`;
          expect(result.appliedDefaults).not.toContain(unexpectedMessage);
        }
      }
    );
  });

  describe('boolean properties normalization', () => {
    it.each([
      ['memory.enabled', undefined, false, true],
      ['memory.enabled', null, false, true],
      ['memory.enabled', true, true, false],
      ['memory.enabled', false, false, false],

      ['rag.enabled', undefined, false, true],
      ['rag.enabled', null, false, true],
      ['rag.enabled', true, true, false],
      ['rag.enabled', false, false, false],
    ])(
      'should normalize %s: %p → %p',
      (path, inputValue, expected, shouldApplyDefault) => {
        const [obj, prop] = path.split('.');
        const config = { [obj]: { [prop]: inputValue } };

        const result = normalizeNumericValues(config);

        expect(result.normalizedConfig[obj]?.[prop]).toBe(expected);

        if (shouldApplyDefault) {
          const expectedMessage = `${path} set to default value (${expected})`;
          expect(result.appliedDefaults).toContain(expectedMessage);
        } else {
          const unexpectedMessage = `${path} set to default value`;
          expect(result.appliedDefaults).not.toContain(unexpectedMessage);
        }
      }
    );
  });

  describe('string properties normalization', () => {
    it.each([
      ['rag.embeddingModel', undefined, 'Xenova/all-MiniLM-L6-v2', true],
      ['rag.embeddingModel', null, 'Xenova/all-MiniLM-L6-v2', true],
      ['rag.embeddingModel', 'test-model', 'test-model', false],
    ])(
      'should normalize %s: %p → %p',
      (path, inputValue, expected, shouldApplyDefault) => {
        const [obj, prop] = path.split('.');
        const config = { [obj]: { [prop]: inputValue } };

        const result = normalizeNumericValues(config);

        expect(result.normalizedConfig[obj]?.[prop]).toBe(expected);

        if (shouldApplyDefault) {
          const expectedMessage = `${path} set to default value (${expected})`;
          expect(result.appliedDefaults).toContain(expectedMessage);
        } else {
          const unexpectedMessage = `${path} set to default value`;
          expect(result.appliedDefaults).not.toContain(unexpectedMessage);
        }
      }
    );
  });

  describe('object initialization', () => {
    it('should initialize memory with defaults when absent/non-plain', () => {
      const testCases = [
        {},
        { memory: null },
        { memory: 'not-an-object' as any },
        { memory: [] as any },
        { memory: 123 as any },
      ];

      testCases.forEach((config) => {
        const result = normalizeNumericValues(config as any);

        expect(result.normalizedConfig.memory).toBeDefined();
        expect(result.normalizedConfig.memory?.enabled).toBe(false);
        expect(result.normalizedConfig.memory?.shortTermMemorySize).toBe(5);
        expect(result.normalizedConfig.memory?.memorySize).toBe(20);

        const expectedMessage =
          'memory initialized with default values (enabled: false, shortTermMemorySize: 5, memorySize: 20)';
        expect(result.appliedDefaults).toContain(expectedMessage);
      });
    });

    it('should initialize rag with defaults when absent/non-plain', () => {
      const testCases = [
        {},
        { rag: null },
        { rag: 'not-an-object' as any },
        { rag: [] as any },
        { rag: 123 as any },
      ];

      testCases.forEach((config) => {
        const result = normalizeNumericValues(config as any);

        expect(result.normalizedConfig.rag).toBeDefined();
        expect(result.normalizedConfig.rag?.enabled).toBe(false);
        expect(result.normalizedConfig.rag?.topK).toBe(4);
        expect(result.normalizedConfig.rag?.embeddingModel).toBe(
          'Xenova/all-MiniLM-L6-v2'
        );

        const expectedMessage =
          'rag initialized with default values (enabled: false, topK: 4, embeddingModel: Xenova/all-MiniLM-L6-v2)';
        expect(result.appliedDefaults).toContain(expectedMessage);
      });
    });
  });

  describe('defaults aggregation', () => {
    it('should aggregate all applied defaults', () => {
      const config = {
        max_iterations: -1,
        interval: 0,
        memory: { enabled: null, shortTermMemorySize: -5, memorySize: 0 },
        rag: { enabled: null, topK: -2, embeddingModel: undefined },
      };

      const result = normalizeNumericValues(config);

      expect(result.appliedDefaults).toContain(
        'max_iterations set to default value (15)'
      );
      expect(result.appliedDefaults).toContain(
        'interval set to default value (5)'
      );
      expect(result.appliedDefaults).toContain(
        'memory.enabled set to default value (false)'
      );
      expect(result.appliedDefaults).toContain(
        'memory.shortTermMemorySize set to default value (5)'
      );
      expect(result.appliedDefaults).toContain(
        'memory.memorySize set to default value (20)'
      );
      expect(result.appliedDefaults).toContain(
        'rag.enabled set to default value (false)'
      );
      expect(result.appliedDefaults).toContain(
        'rag.topK set to default value (4)'
      );
      expect(result.appliedDefaults).toContain(
        'rag.embeddingModel set to default value (Xenova/all-MiniLM-L6-v2)'
      );

      expect(result.appliedDefaults).toHaveLength(8);
    });
  });

  describe('pass-through behavior', () => {
    it('should preserve unknown fields and valid values', () => {
      const config = {
        foo: 123,
        bar: 'test',
        max_iterations: 25,
        interval: 10,
        memory: { enabled: true, shortTermMemorySize: 30, memorySize: 100 },
        rag: { enabled: true, topK: 20, embeddingModel: 'custom-model' },
      };

      const result = normalizeNumericValues(config);

      expect(result.normalizedConfig.foo).toBe(123);
      expect(result.normalizedConfig.bar).toBe('test');

      expect(result.normalizedConfig.max_iterations).toBe(25);
      expect(result.normalizedConfig.interval).toBe(10);
      expect(result.normalizedConfig.memory?.enabled).toBe(true);
      expect(result.normalizedConfig.memory?.shortTermMemorySize).toBe(30);
      expect(result.normalizedConfig.memory?.memorySize).toBe(100);
      expect(result.normalizedConfig.rag?.enabled).toBe(true);
      expect(result.normalizedConfig.rag?.topK).toBe(20);
      expect(result.normalizedConfig.rag?.embeddingModel).toBe('custom-model');

      expect(result.appliedDefaults).toHaveLength(0);
    });
  });

  describe('idempotence', () => {
    it('should not add new defaults when reapplied', () => {
      const config = { max_iterations: 25, interval: 10 };
      const firstResult = normalizeNumericValues(config);
      const secondResult = normalizeNumericValues(firstResult.normalizedConfig);

      expect(secondResult.appliedDefaults).toHaveLength(0);
      expect(secondResult.normalizedConfig.max_iterations).toBe(25);
      expect(secondResult.normalizedConfig.interval).toBe(10);
    });
  });
});
