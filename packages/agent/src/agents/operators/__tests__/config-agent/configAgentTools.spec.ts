import { getConfigAgentTools, configToolCategories } from '../../config-agent/configAgentTools.js';
import { createAgentTool } from '../../config-agent/tools/createAgentTool.js';
import { readAgentTool } from '../../config-agent/tools/readAgentTool.js';
import { updateAgentTool } from '../../config-agent/tools/updateAgentTool.js';
import { deleteAgentTool } from '../../config-agent/tools/deleteAgentTool.js';
import { listAgentsTool } from '../../config-agent/tools/listAgentsTool.js';

describe('configAgentTools', () => {
  describe('getConfigAgentTools', () => {
    it('should return an array of tools', () => {
      const tools = getConfigAgentTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(5);
    });

    it('should include all expected tools', () => {
      const tools = getConfigAgentTools();
      const toolNames = tools.map(tool => tool.name);
      
      expect(toolNames).toContain('create_agent');
      expect(toolNames).toContain('read_agent');
      expect(toolNames).toContain('update_agent');
      expect(toolNames).toContain('delete_agent');
      expect(toolNames).toContain('list_agents');
    });

    it('should return the correct tool instances', () => {
      const tools = getConfigAgentTools();
      
      expect(tools).toContain(createAgentTool);
      expect(tools).toContain(readAgentTool);
      expect(tools).toContain(updateAgentTool);
      expect(tools).toContain(deleteAgentTool);
      expect(tools).toContain(listAgentsTool);
    });

    it('should return tools with proper structure', () => {
      const tools = getConfigAgentTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('schema');
        expect(
          tool.hasOwnProperty('func') || tool.hasOwnProperty('invoke')
        ).toBe(true);
      });
    });
  });

  describe('configToolCategories', () => {
    it('should have all expected categories', () => {
      expect(configToolCategories).toHaveProperty('create');
      expect(configToolCategories).toHaveProperty('read');
      expect(configToolCategories).toHaveProperty('update');
      expect(configToolCategories).toHaveProperty('delete');
      expect(configToolCategories).toHaveProperty('list');
    });

    it('should categorize create tools correctly', () => {
      expect(configToolCategories.create).toHaveLength(1);
      expect(configToolCategories.create).toContain(createAgentTool);
    });

    it('should categorize read tools correctly', () => {
      expect(configToolCategories.read).toHaveLength(2);
      expect(configToolCategories.read).toContain(readAgentTool);
      expect(configToolCategories.read).toContain(listAgentsTool);
    });

    it('should categorize update tools correctly', () => {
      expect(configToolCategories.update).toHaveLength(1);
      expect(configToolCategories.update).toContain(updateAgentTool);
    });

    it('should categorize delete tools correctly', () => {
      expect(configToolCategories.delete).toHaveLength(1);
      expect(configToolCategories.delete).toContain(deleteAgentTool);
    });

    it('should categorize list tools correctly', () => {
      expect(configToolCategories.list).toHaveLength(1);
      expect(configToolCategories.list).toContain(listAgentsTool);
    });

    it('should have correct number of tools across categories', () => {
      const allTools = [
        ...configToolCategories.create,
        ...configToolCategories.read,
        ...configToolCategories.update,
        ...configToolCategories.delete,
        ...configToolCategories.list,
      ];
      
      expect(allTools.length).toBe(6);
      
      const listAgentsToolCount = allTools.filter(tool => tool === listAgentsTool).length;
      expect(listAgentsToolCount).toBe(2);
    });

    it('should include all tools from getConfigAgentTools', () => {
      const allTools = getConfigAgentTools();
      const categorizedTools = [
        ...configToolCategories.create,
        ...configToolCategories.read,
        ...configToolCategories.update,
        ...configToolCategories.delete,
        ...configToolCategories.list,
      ];
      
      expect(categorizedTools).toEqual(expect.arrayContaining(allTools));
      expect(allTools).toEqual(expect.arrayContaining(categorizedTools));
    });
  });
}); 