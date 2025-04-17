import { SystemMessage } from '@langchain/core/messages';
import logger from '../logger.js'; // Assuming logger is accessible like this

// Define ModelLevel type if not already globally available
export type ModelLevel = 'fast' | 'smart' | 'cheap';

export const MONITOR_SYSTEM_PROMPT_TEMPLATE = 
`You are a model selection monitor. Your task is to analyze the recent conversation history and the latest user request or agent task description. Based on the apparent complexity, decide which type of language model should handle the *next* step.

Consider the following factors:
- Simple greetings, confirmations, or straightforward questions: 'cheap' or 'fast'
- Retrieving specific information, basic tool use, simple data formatting: 'fast'
- Complex reasoning, multi-step planning, creative generation, complex tool orchestration, code generation, nuanced understanding: 'smart'
- If unsure, lean towards 'smart'.

Conversation History:
{history}

Latest Input/Task:
{input}

Based on the complexity, which model level is most appropriate for the next step? Respond with ONLY ONE of the following words: 'fast', 'smart', or 'cheap'.`;

export const formatMonitorPrompt = (historyStr: string, inputStr: string): string => {
  // Replace placeholders in the template
  return MONITOR_SYSTEM_PROMPT_TEMPLATE
    .replace('{history}', historyStr)
    .replace('{input}', inputStr);
};

export const parseMonitorResponse = (responseText: string): ModelLevel => {
    const cleanedResponse = responseText.trim().toLowerCase();
    if (cleanedResponse === 'fast') {
        return 'fast';
    } else if (cleanedResponse === 'smart') {
        return 'smart';
    } else if (cleanedResponse === 'cheap') {
        return 'cheap';
    } else {
        // Use logger if available, otherwise console.warn
        const warn = logger?.warn || console.warn;
        warn(`Monitor agent returned unexpected response: "${responseText}". Defaulting to 'smart'.`);
        return 'smart'; // Default to smart if parsing fails
    }
}; 