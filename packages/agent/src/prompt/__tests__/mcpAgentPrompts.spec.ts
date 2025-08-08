import { mcpAgentSystemPrompt } from '../mcpAgentPrompts.js';

describe('mcpAgentPrompts', () => {
  describe('mcpAgentSystemPrompt', () => {
    let prompt: string;

    beforeEach(() => {
      prompt = mcpAgentSystemPrompt();
    });

    it('should return a non-empty string', () => {
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should contain the core role description', () => {
      expect(prompt).toContain('MCP (Model Context Protocol) Agent');
      expect(prompt).toContain('responsible for managing MCP servers');
      expect(prompt).toContain('Managing MCP server configurations');
    });

    it('should include all primary responsibilities', () => {
      const responsibilities = [
        'Managing MCP server configurations',
        'Monitoring MCP server status and health',
        'Managing and organizing MCP tools',
        'Ensuring proper integration of MCP servers'
      ];

      responsibilities.forEach(responsibility => {
        expect(prompt).toContain(responsibility);
      });
    });

    it('should include configuration management operations', () => {
      const operations = [
        'add',
        'remove', 
        'update',
        'list'
      ];

      operations.forEach(operation => {
        expect(prompt).toContain(operation);
      });
    });

    it('should include request handling guidelines', () => {
      const guidelines = [
        'validate inputs before performing operations',
        'Maintain consistent configuration formats',
        'Ensure proper error handling and logging',
        'Keep track of MCP server states and connections',
        'Provide clear feedback on operation results'
      ];

      guidelines.forEach(guideline => {
        expect(prompt).toContain(guideline);
      });
    });

    it('should include available tools section', () => {
      const tools = [
        'List and inspect MCP servers',
        'Manage MCP server configurations',
        'View and organize MCP tools',
        'Monitor MCP server status'
      ];

      tools.forEach(tool => {
        expect(prompt).toContain(tool);
      });
    });

    it('should include important reminders', () => {
      const reminders = [
        'MCP servers are crucial for extending agent capabilities',
        'Configuration changes should be handled carefully',
        'Always maintain proper security practices',
        'Keep configurations well-documented'
      ];

      reminders.forEach(reminder => {
        expect(prompt).toContain(reminder);
      });
    });

    it('should include response workflow steps', () => {
      const steps = [
        'Understanding the requested operation',
        'Validating inputs and current state',
        'Using appropriate tools to perform the operation',
        'Providing clear feedback on results',
        'Handling any errors gracefully'
      ];

      steps.forEach(step => {
        expect(prompt).toContain(step);
      });
    });

    it('should have proper formatting with line breaks', () => {
      const lines = prompt.split('\n');
      expect(lines.length).toBeGreaterThan(5);
    });

    it('should be consistent across multiple calls', () => {
      const prompt1 = mcpAgentSystemPrompt();
      const prompt2 = mcpAgentSystemPrompt();
      const prompt3 = mcpAgentSystemPrompt();

      expect(prompt1).toBe(prompt2);
      expect(prompt2).toBe(prompt3);
      expect(prompt1).toBe(prompt3);
    });

    it('should not contain any undefined or null values', () => {
      expect(prompt).not.toContain('undefined');
      expect(prompt).not.toContain('null');
    });

    it('should have a professional and clear tone', () => {
      expect(prompt).toContain('You are');
      expect(prompt).toContain('Your primary responsibilities');
      expect(prompt).toContain('When handling requests');
      expect(prompt).toContain('Remember');
    });

    it('should provide actionable instructions', () => {
      expect(prompt).toContain('Use the available tools');
      expect(prompt).toContain('Always');
      expect(prompt).toContain('Respond to user queries');
    });

    describe('prompt structure validation', () => {
      it('should start with the agent role definition', () => {
        expect(prompt.trim()).toMatch(/^You are a specialized MCP/);
      });

      it('should have clear section headers', () => {
        expect(prompt).toContain('Your primary responsibilities include:');
        expect(prompt).toContain('When handling requests:');
        expect(prompt).toContain('Use the available tools to:');
        expect(prompt).toContain('Remember:');
        expect(prompt).toContain('Respond to user queries by:');
      });

      it('should use consistent formatting for responsibilities', () => {
        // Check that responsibilities are numbered
        expect(prompt).toMatch(/1\. Managing MCP server configurations/);
        expect(prompt).toMatch(/2\. Monitoring MCP server status/);
        expect(prompt).toMatch(/3\. Managing and organizing MCP tools/);
        expect(prompt).toMatch(/4\. Ensuring proper integration/);
      });

      it('should use consistent formatting for response steps', () => {
        // Check that response steps are numbered
        expect(prompt).toMatch(/1\. Understanding the requested operation/);
        expect(prompt).toMatch(/2\. Validating inputs and current state/);
        expect(prompt).toMatch(/3\. Using appropriate tools/);
        expect(prompt).toMatch(/4\. Providing clear feedback/);
        expect(prompt).toMatch(/5\. Handling any errors gracefully/);
      });

      it('should have bullet points for guidelines and tools', () => {
        const bulletPoints = prompt.match(/- [A-Za-z]/g);
        expect(bulletPoints).toBeDefined();
        expect(bulletPoints!.length).toBeGreaterThanOrEqual(4);
      });
    });

    describe('content completeness', () => {
      it('should cover all MCP management aspects', () => {
        const aspects = [
          'server configurations',
          'server status',
          'server status and health',
          'MCP tools',
          'integration',
          'security'
        ];
        
        aspects.forEach(aspect => {
          expect(prompt).toContain(aspect);
        });
      });

      it('should include both technical and operational guidance', () => {
        const technicalTerms = ['MCP', 'Model Context Protocol', 'servers', 'tools'];
        const operationalTerms = ['manage', 'Monitoring', 'configurations', 'integration'];
        
        technicalTerms.forEach(term => {
          expect(prompt).toContain(term);
        });
        
        operationalTerms.forEach(term => {
          expect(prompt).toContain(term);
        });
      });

      it('should provide specific guidance for error handling', () => {
        expect(prompt).toContain('error handling and logging');
        expect(prompt).toContain('Handling any errors gracefully');
      });

      it('should emphasize security practices', () => {
        expect(prompt).toContain('security practices');
        expect(prompt).toContain('Configuration changes should be handled carefully');
      });
    });

    describe('MCP-specific functionality', () => {
      it('should emphasize MCP server importance', () => {
        expect(prompt).toContain('MCP servers are crucial for extending agent capabilities');
      });

      it('should mention configuration management', () => {
        expect(prompt).toContain('Managing MCP server configurations');
        expect(prompt).toContain('Maintain consistent configuration formats');
      });

      it('should include tool management', () => {
        expect(prompt).toContain('Managing and organizing MCP tools');
        expect(prompt).toContain('View and organize MCP tools');
      });

      it('should mention monitoring capabilities', () => {
        expect(prompt).toContain('Monitoring MCP server status and health');
        expect(prompt).toContain('Monitor MCP server status');
      });

      it('should emphasize integration', () => {
        expect(prompt).toContain('Ensuring proper integration of MCP servers with the agent system');
      });
    });

    describe('prompt quality and clarity', () => {
      it('should be comprehensive without being verbose', () => {
        expect(prompt.length).toBeGreaterThan(500);
        expect(prompt.length).toBeLessThan(2000);
      });

      it('should use clear and unambiguous language', () => {
        expect(prompt).toContain('You are');
        expect(prompt).toContain('Your primary responsibilities');
        expect(prompt).toContain('When handling requests');
      });

      it('should provide structured guidance', () => {
        expect(prompt).toMatch(/\d+\./);
      });

      it('should maintain professional tone throughout', () => {
        const professionalTerms = ['responsible', 'ensure', 'maintain', 'Provide', 'handle'];
        professionalTerms.forEach(term => {
          expect(prompt).toContain(term);
        });
      });
    });
  });
});
