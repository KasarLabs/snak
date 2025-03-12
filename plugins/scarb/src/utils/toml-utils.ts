import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Adds or updates a section in a TOML file with specified key-value pairs
 * @param {Object} params - Function parameters
 * @param {string} params.path - Path to the TOML file (default: current directory)
 * @param {string} params.title - Title of the TOML section to add/update
 * @param {Object} params.values - Object with key-value pairs to add to the section
 * @returns {Promise<string>} JSON string with operation status and details
 */
export const addTomlSection = async (params : any) => {
    try {
      const workingDir = params.workingDir;
      const sectionTitle = params.sectionTitle;
      const valuesObject = params.valuesObject;
 
      const tomlPath = path.join(workingDir, 'Scarb.toml');
      try {
        await fs.access(tomlPath);
      } catch (error) {
        throw new Error(`TOML file not found at ${tomlPath}`);
      }
      
      let tomlContent = await fs.readFile(tomlPath, 'utf8');
      
      const isSingleSection = !sectionTitle.includes('.');
      const formattedTitle = isSingleSection 
        ? `[${sectionTitle}]` 
        : `[[${sectionTitle}]]`;
      
      const formatValue = (value: any) => {
        if (typeof value === 'string') return `"${value}"`;
        else if (typeof value === 'boolean' || typeof value === 'number') return value;
        else if (Array.isArray(value)) return `[${value.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]`;
        else if (value === null) return 'null';
        else return JSON.stringify(value);
      };
      
      const sectionContent = Object.entries(valuesObject)
        .map(([key, value]) => `${key} = ${formatValue(value)}`)
        .join('\n');

      const sectionRegex = new RegExp(
        `${formattedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(\\n\\n|\\n\\[|$)`,
        'g'
      );
      
      const sectionMatch = sectionRegex.exec(tomlContent);
      
      if (sectionMatch) {
        const existingContent = sectionMatch[1];
        const existingLines = existingContent.trim().split('\n');
        const existingKeys = existingLines.map(line => {
          const parts = line.trim().split('=');
          return parts[0]?.trim();
        });
    
        let updatedContent = existingContent;
        
        for (const [key, value] of Object.entries(valuesObject)) {
          const formattedKeyValue = `${key} = ${formatValue(value)}`;
          
          if (existingKeys.includes(key)) {
            const keyRegex = new RegExp(`${key}\\s*=.*`, 'g');
            updatedContent = updatedContent.replace(keyRegex, formattedKeyValue);
          } else {
            updatedContent += updatedContent.endsWith('\n') ? '' : '\n';
            updatedContent += formattedKeyValue + '\n';
          }
        }
        
        tomlContent = tomlContent.replace(
          sectionRegex,
          `${formattedTitle}${updatedContent}${sectionMatch[2]}`
        );
      } else {
        tomlContent += `\n\n${formattedTitle}\n${sectionContent}`;
      }
      
      await fs.writeFile(tomlPath, tomlContent, 'utf8');
      
      return JSON.stringify({
        status: 'success',
        message: `Scarb.toml updated with ${sectionTitle} section`,
        newConfig: tomlContent,
      });
    } catch (error) {
        console.log("Error updating Scarb.toml:", error);
        throw new Error(`Error updating Scarb.toml: ${error.message}`);
    }
  };
