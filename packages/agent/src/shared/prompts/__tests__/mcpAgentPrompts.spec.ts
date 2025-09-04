import { mcpAgentSystemPrompt } from '../index.js';

describe('mcpAgentPrompts', () => {
  describe('mcpAgentSystemPrompt', () => {
    let prompt: string;

    beforeEach(() => {
      prompt = mcpAgentSystemPrompt();
    });

    describe('basic properties', () => {
      it('should return a non-empty string', () => {
        expect(prompt).toBeDefined();
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(500);
      });

      it('should be consistent across multiple calls', () => {
        const prompt1 = mcpAgentSystemPrompt();
        const prompt2 = mcpAgentSystemPrompt();
        expect(prompt1).toBe(prompt2);
      });

      it('should not contain invalid placeholders', () => {
        expect(prompt).not.toContain('undefined');
        expect(prompt).not.toContain('null');
      });
    });

    describe('core content sections', () => {
      it.each([
        [
          'role definition',
          'You are a specialized MCP (Model Context Protocol) Agent',
        ],
        ['responsibilities header', 'Your primary responsibilities include:'],
        ['request handling header', 'When handling requests:'],
        ['tools section header', 'Use the available tools to:'],
        ['reminders header', 'Remember:'],
        ['workflow header', 'Respond to user queries by:'],
      ])('should contain %s', (description, expectedContent) => {
        expect(prompt).toContain(expectedContent);
      });
    });

    describe('primary responsibilities', () => {
      it.each([
        ['Managing MCP server configurations'],
        ['Monitoring MCP server status and health'],
        ['Managing and organizing MCP tools'],
        ['Ensuring proper integration of MCP servers'],
      ])('should include responsibility: %s', (responsibility) => {
        expect(prompt).toContain(responsibility);
      });

      it('should format responsibilities as numbered list', () => {
        expect(prompt).toMatch(/1\. Managing MCP server configurations/);
        expect(prompt).toMatch(/4\. Ensuring proper integration/);
      });
    });

    describe('operational guidelines', () => {
      it.each([
        ['validate inputs before performing operations'],
        ['Maintain consistent configuration formats'],
        ['Ensure proper error handling and logging'],
        ['Keep track of MCP server states and connections'],
        ['Provide clear feedback on operation results'],
      ])('should include guideline: %s', (guideline) => {
        expect(prompt).toContain(guideline);
      });
    });

    describe('available tools', () => {
      it.each([
        ['List and inspect MCP servers'],
        ['Manage MCP server configurations'],
        ['View and organize MCP tools'],
        ['Monitor MCP server status'],
      ])('should mention tool capability: %s', (capability) => {
        expect(prompt).toContain(capability);
      });
    });

    describe('workflow steps', () => {
      it.each([
        [1, 'Understanding the requested operation'],
        [2, 'Validating inputs and current state'],
        [3, 'Using appropriate tools to perform the operation'],
        [4, 'Providing clear feedback on results'],
        [5, 'Handling any errors gracefully'],
      ])('should include step %i: %s', (stepNumber, stepContent) => {
        expect(prompt).toContain(`${stepNumber}. ${stepContent}`);
      });
    });

    describe('key concepts', () => {
      it.each([
        ['MCP servers are crucial for extending agent capabilities'],
        ['Configuration changes should be handled carefully'],
        ['Always maintain proper security practices'],
        ['Keep configurations well-documented'],
      ])('should emphasize concept: %s', (concept) => {
        expect(prompt).toContain(concept);
      });
    });

    describe('structure and formatting', () => {
      it('should have proper line breaks and sections', () => {
        const lines = prompt.split('\n');
        expect(lines.length).toBeGreaterThan(5);
      });

      it('should use bullet points for guidelines', () => {
        const bulletPoints = prompt.match(/- [A-Z]/g);
        expect(bulletPoints).toBeDefined();
        expect(bulletPoints?.length ?? 0).toBeGreaterThanOrEqual(4);
      });

      it('should start with role definition', () => {
        expect(prompt.trim()).toMatch(/^You are a specialized MCP/);
      });
    });

    describe('pass-through validation', () => {
      it('should return the complete prompt unchanged', () => {
        const expectedPrompt = `You are a specialized MCP (Model Context Protocol) Agent responsible for managing MCP servers and their tools in the system.

Your primary responsibilities include:
1. Managing MCP server configurations (add, remove, update, list)
2. Monitoring MCP server status and health
3. Managing and organizing MCP tools
4. Ensuring proper integration of MCP servers with the agent system

When handling requests:
- Always validate inputs before performing operations
- Maintain consistent configuration formats
- Ensure proper error handling and logging
- Keep track of MCP server states and connections
- Provide clear feedback on operation results

Use the available tools to:
- List and inspect MCP servers
- Manage MCP server configurations
- View and organize MCP tools
- Monitor MCP server status

Remember:
- MCP servers are crucial for extending agent capabilities
- Configuration changes should be handled carefully
- Always maintain proper security practices
- Keep configurations well-documented

Respond to user queries by:
1. Understanding the requested operation
2. Validating inputs and current state
3. Using appropriate tools to perform the operation
4. Providing clear feedback on results
5. Handling any errors gracefully

Your goal is to ensure smooth operation and management of MCP servers while maintaining system stability and security.`;
        expect(prompt).toBe(expectedPrompt);
      });
    });
  });
});
