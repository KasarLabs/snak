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

      ['memoryshort_term_memory_size', undefined, 5, true],
      ['memoryshort_term_memory_size', null, 5, true],
      ['memoryshort_term_memory_size', 0, 5, true],
      ['memoryshort_term_memory_size', -1, 5, true],
      ['memoryshort_term_memory_size', NaN, 5, true],
      ['memoryshort_term_memory_size', 1, 1, false],
      ['memoryshort_term_memory_size', 30, 30, false],

      ['memory.memorySize', undefined, 20, true],
      ['memory.memorySize', null, 20, true],
      ['memory.memorySize', 0, 20, true],
      ['memory.memorySize', -1, 20, true],
      ['memory.memorySize', NaN, 20, true],
      ['memory.memorySize', 1, 1, false],
      ['memory.memorySize', 100, 100, false],

      ['rag.top_k', undefined, 4, true],
      ['rag.top_k', null, 4, true],
      ['rag.top_k', 0, 4, true],
      ['rag.top_k', -1, 4, true],
      ['rag.top_k', NaN, 4, true],
      ['rag.top_k', 1, 1, false],
      ['rag.top_k', 25, 25, false],
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
      ['rag.embedding_model', undefined, 'Xenova/all-MiniLM-L6-v2', true],
      ['rag.embedding_model', null, 'Xenova/all-MiniLM-L6-v2', true],
      ['rag.embedding_model', 'test-model', 'test-model', false],
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

  describe('mode normalization', () => {
    it.each([
      ['mode', undefined, 'interactive', true],
      ['mode', null, 'interactive', true],
      ['mode', '', 'interactive', true],
      ['mode', 'interactive', 'interactive', false],
      ['mode', 'autonomous', 'autonomous', false],
      ['mode', 'hybrid', 'hybrid', false],
    ])(
      'should normalize %s: %p → %p',
      (property, inputValue, expected, shouldApplyDefault) => {
        const config = { [property]: inputValue };

        const result = normalizeNumericValues(config);

        expect(result.normalizedConfig[property]).toBe(expected);

        if (shouldApplyDefault) {
          const expectedMessage = `${property} set to default value (${expected})`;
          expect(result.appliedDefaults).toContain(expectedMessage);
        } else {
          const unexpectedMessage = `${property} set to default value`;
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
        expect(result.normalizedConfig.memory?short_term_memory_size).toBe(5);
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
        expect(result.normalizedConfig.rag?.top_k).toBe(4);
        expect(result.normalizedConfig.rag?.embedding_model).toBe(
          'Xenova/all-MiniLM-L6-v2'
        );

        const expectedMessage =
          'rag initialized with default values (enabled: false, topK: 4, embeddingModel: Xenova/all-MiniLM-L6-v2)';
        expect(result.appliedDefaults).toContain(expectedMessage);
      });
    });

    it('should initialize mode with default value when absent', () => {
      const testCases = [{}, { mode: null }, { mode: undefined }];

      testCases.forEach((config) => {
        const result = normalizeNumericValues(config as any);

        expect(result.normalizedConfig.mode).toBe('interactive');
        expect(result.appliedDefaults).toContain(
          'mode set to default value (interactive)'
        );
      });
    });
  });

  describe('defaults aggregation', () => {
    it('should aggregate all applied defaults', () => {
      const config = {
        max_iterations: -1,
        interval: 0,
        mode: null,
        memory: {
          enabled: null,
          shortTermMemorySize: -5,
          memorySize: 0,
        },
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
        'mode set to default value (interactive)'
      );
      expect(result.appliedDefaults).toContain(
        'memory.enabled set to default value (false)'
      );
      expect(result.appliedDefaults).toContain(
        'memoryshort_term_memory_size set to default value (5)'
      );
      expect(result.appliedDefaults).toContain(
        'memory.memorySize set to default value (20)'
      );
      expect(result.appliedDefaults).toContain(
        'rag.enabled set to default value (false)'
      );
      expect(result.appliedDefaults).toContain(
        'rag.top_k set to default value (4)'
      );
      expect(result.appliedDefaults).toContain(
        'rag.embedding_model set to default value (Xenova/all-MiniLM-L6-v2)'
      );

      expect(result.appliedDefaults.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('pass-through behavior', () => {
    it('should preserve unknown fields and valid values', () => {
      const config = {
        foo: 123,
        bar: 'test',
        mode: 'autonomous',
        max_iterations: 25,
        interval: 10,
        memory: {
          enabled: true,
          shortTermMemorySize: 30,
          memorySize: 100,
        },
        rag: { enabled: true, topK: 20, embeddingModel: 'custom-model' },
      };

      const result = normalizeNumericValues(config);

      expect(result.normalizedConfig.foo).toBe(123);
      expect(result.normalizedConfig.bar).toBe('test');

      expect(result.normalizedConfig.max_iterations).toBe(25);
      expect(result.normalizedConfig.interval).toBe(10);
      expect(result.normalizedConfig.memory?.enabled).toBe(true);
      expect(result.normalizedConfig.memory?short_term_memory_size).toBe(30);
      expect(result.normalizedConfig.memory?.memorySize).toBe(100);
      expect(result.normalizedConfig.rag?.enabled).toBe(true);
      expect(result.normalizedConfig.rag?.top_k).toBe(20);
      expect(result.normalizedConfig.rag?.embedding_model).toBe('custom-model');

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
