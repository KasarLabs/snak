export const ADAPTIVE_PROMPT_TOKEN_LIMIT =
  'Due to recent token limit issues, choose a very simple action now. Prefer actions that require minimal context and processing.';

export const ADAPTIVE_PROMPT_NORMAL =
  'Based on my objectives, You should take action now without seeking permission. Choose what to do.';

export const ERROR_PROMPT_TOKEN_LIMIT_RECOVERY =
  'Previous conversation was too long. Continuing with just recent messages.';

export const ERROR_MESSAGE_TOKEN_LIMIT_FATAL =
  'The conversation has become too long and exceeds token limits. Please start a new conversation.';

export const AUTONOMOUS_CONTINUE_ON_TOKEN_LIMIT =
  'The previous action was too complex and exceeded token limits. Take a simpler action while keeping your main objectives in mind.';

export const AUTONOMOUS_FAIL_ON_TOKEN_LIMIT =
  "I had to abandon the current action due to token limits. I'll try a different approach in the next turn.";

export const DEFAULT_TEST_PROMPT = 'Default system prompt';
