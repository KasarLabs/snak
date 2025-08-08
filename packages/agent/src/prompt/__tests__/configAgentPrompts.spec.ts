import { configurationAgentSystemPrompt } from '../configAgentPrompts.js';

describe('configAgentPrompts', () => {
  describe('configurationAgentSystemPrompt', () => {
    let prompt: string;

    beforeEach(() => {
      prompt = configurationAgentSystemPrompt();
    });

    it('should return a non-empty string', () => {
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should contain the core role description', () => {
      expect(prompt).toContain('Configuration Agent');
      expect(prompt).toContain('specialized in managing agent configurations');
      expect(prompt).toContain('intelligent tool selection');
    });

    it('should include all core operations', () => {
      const operations = [
        'CREATE',
        'READ', 
        'UPDATE',
        'DELETE',
        'LIST'
      ];

      operations.forEach(operation => {
        expect(prompt).toContain(operation);
      });
    });

    it('should include CREATE operation details', () => {
      expect(prompt).toContain('create_agent');
      expect(prompt).toContain('create');
      expect(prompt).toContain('add');
      expect(prompt).toContain('new');
      expect(prompt).toContain('make');
    });

    it('should include READ operation details', () => {
      expect(prompt).toContain('read_agent');
      expect(prompt).toContain('get');
      expect(prompt).toContain('show');
      expect(prompt).toContain('view');
      expect(prompt).toContain('find');
    });

    it('should include UPDATE operation details', () => {
      expect(prompt).toContain('update_agent');
      expect(prompt).toContain('modify');
      expect(prompt).toContain('change');
      expect(prompt).toContain('update');
      expect(prompt).toContain('edit');
      expect(prompt).toContain('rename');
    });

    it('should include DELETE operation details', () => {
      expect(prompt).toContain('delete_agent');
      expect(prompt).toContain('delete');
      expect(prompt).toContain('remove');
      expect(prompt).toContain('destroy');
    });

    it('should include LIST operation details', () => {
      expect(prompt).toContain('list_agents');
      expect(prompt).toContain('list');
      expect(prompt).toContain('show all');
      expect(prompt).toContain('get all');
    });

    it('should include parameter extraction guidelines', () => {
      expect(prompt).toContain('Parameter Extraction Guidelines');
      expect(prompt).toContain('Extract agent names from quotes or context');
      expect(prompt).toContain('Use "name" search by default');
      expect(prompt).toContain('"id" only when explicitly provided');
    });

    it('should include agent name extraction examples', () => {
      expect(prompt).toContain('"Agent Name" → identifier: "Agent Name"');
    });

    it('should include update operation guidance', () => {
      expect(prompt).toContain('For updates: map user intent to specific fields');
      expect(prompt).toContain('name, description, group');
    });

    it('should include precision guidance', () => {
      expect(prompt).toContain('Be precise with parameter values');
      expect(prompt).toContain('extract exactly what user specifies');
    });

    it('should include confirmation and feedback guidance', () => {
      expect(prompt).toContain('Always confirm what operation you\'re performing');
      expect(prompt).toContain('provide clear feedback about results');
    });

    it('should have proper formatting with line breaks', () => {
      // Check that the prompt contains multiple lines
      const lines = prompt.split('\n');
      expect(lines.length).toBeGreaterThan(5);
    });

    it('should be consistent across multiple calls', () => {
      const prompt1 = configurationAgentSystemPrompt();
      const prompt2 = configurationAgentSystemPrompt();
      const prompt3 = configurationAgentSystemPrompt();

      expect(prompt1).toBe(prompt2);
      expect(prompt2).toBe(prompt3);
      expect(prompt1).toBe(prompt3);
    });

    it('should not contain any undefined or null values', () => {
      expect(prompt).not.toContain('undefined');
      expect(prompt).not.toContain('null');
    });

    it('should have a professional and clear tone', () => {
      // Check for professional language patterns
      expect(prompt).toContain('You are');
      expect(prompt).toContain('Core Operations');
      expect(prompt).toContain('Guidelines');
    });

    it('should provide actionable instructions', () => {
      expect(prompt).toContain('Use');
      expect(prompt).toContain('Always');
      expect(prompt).toContain('Be precise');
    });

    describe('prompt structure validation', () => {
      it('should start with the agent role definition', () => {
        expect(prompt.trim()).toMatch(/^You are a Configuration Agent/);
      });

      it('should have clear section headers', () => {
        expect(prompt).toContain('Core Operations:');
        expect(prompt).toContain('Parameter Extraction Guidelines:');
      });

      it('should use consistent formatting for operation descriptions', () => {
        const operations = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LIST'];
        
        operations.forEach(operation => {
          const operationPattern = new RegExp(`- ${operation}: Use [a-z_]+ for`);
          expect(prompt).toMatch(operationPattern);
        });
      });

      it('should have bullet points for operations', () => {
        const bulletPoints = prompt.match(/- [A-Z]+:/g);
        expect(bulletPoints).toBeDefined();
        expect(bulletPoints!.length).toBeGreaterThanOrEqual(5);
      });
    });

    describe('content completeness', () => {
      it('should cover all CRUD operations plus listing', () => {
        const crudOperations = ['CREATE', 'READ', 'UPDATE', 'DELETE'];
        const allOperations = [...crudOperations, 'LIST'];
        
        allOperations.forEach(operation => {
          expect(prompt).toContain(operation);
        });
      });

      it('should include both tool names and user-friendly keywords', () => {
        const toolNames = ['create_agent', 'read_agent', 'update_agent', 'delete_agent', 'list_agents'];
        const keywords = ['create', 'get', 'modify', 'delete', 'list'];
        
        toolNames.forEach(tool => {
          expect(prompt).toContain(tool);
        });
        
        keywords.forEach(keyword => {
          expect(prompt).toContain(keyword);
        });
      });

      it('should provide specific guidance for parameter handling', () => {
        expect(prompt).toContain('Extract agent names from quotes or context');
        expect(prompt).toContain('Use "name" search by default');
        expect(prompt).toContain('"id" only when explicitly provided');
      });
    });
  });
});
