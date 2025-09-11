import { configurationAgentSystemPrompt } from '../index.js';

describe('configAgentPrompts', () => {
  describe('configurationAgentSystemPrompt', () => {
    const getPrompt = () => configurationAgentSystemPrompt();

    it('returns a non-empty string with proper structure', () => {
      const prompt = getPrompt();

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt.trim()).toMatch(/^You are a Configuration Agent/);
    });

    it('is deterministic across multiple calls', () => {
      const prompt1 = getPrompt();
      const prompt2 = getPrompt();

      expect(prompt1).toBe(prompt2);
    });

    describe('CRUD operations', () => {
      it.each([
        ['CREATE', 'create_agent', ['create', 'add', 'new', 'make']],
        ['READ', 'read_agent', ['get', 'show', 'view', 'find']],
        [
          'UPDATE',
          'update_agent',
          ['modify', 'change', 'update', 'edit', 'rename'],
        ],
        ['DELETE', 'delete_agent', ['delete', 'remove', 'destroy']],
        ['LIST', 'list_agents', ['list', 'show all', 'get all']],
      ])(
        'includes %s operation with tool %s and keywords',
        (operation, toolName, keywords) => {
          const prompt = getPrompt();

          expect(prompt).toContain(operation);
          expect(prompt).toContain(toolName);
          keywords.forEach((keyword) => {
            expect(prompt).toContain(keyword);
          });
        }
      );
    });

    describe('guidance sections', () => {
      it('includes parameter extraction guidelines', () => {
        const prompt = getPrompt();

        expect(prompt).toContain('Parameter Extraction Guidelines');
        expect(prompt).toContain('Use "name" search by default');
        expect(prompt).toContain('"id" only when explicitly provided');
      });

      it('includes core sections and professional tone', () => {
        const prompt = getPrompt();

        expect(prompt).toContain('Core Operations:');
        expect(prompt).toContain('Always confirm what operation');
        expect(prompt).toContain('provide clear feedback');
      });
    });
  });
});
