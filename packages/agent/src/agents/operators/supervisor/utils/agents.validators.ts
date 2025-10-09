import { RESERVED_GROUP, RESERVED_NAME } from './agents.constants.js';

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Check if an agent is protected (has reserved name or group)
 */
export function isProtectedAgent(
  agentName: string,
  agentGroup: string
): ValidationResult {
  const normalizedName = agentName.trim().toLowerCase();
  const normalizedGroup = agentGroup.trim().toLowerCase();

  if (normalizedName === RESERVED_NAME) {
    return {
      isValid: false,
      message: `Cannot modify agent with ${RESERVED_NAME} name - this agent is protected.`,
    };
  }

  if (normalizedGroup === RESERVED_GROUP) {
    return {
      isValid: false,
      message: `Cannot modify agent from ${RESERVED_GROUP} group - this agent is protected.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate that agent properties (name or group) don't use reserved values
 */
export function validateAgentProperties(
  name?: string,
  group?: string
): ValidationResult {
  if (name) {
    const normalizedName = name.trim().toLowerCase();
    if (normalizedName.includes(RESERVED_NAME)) {
      return {
        isValid: false,
        message: `The name ${RESERVED_NAME} is reserved and cannot be used for agents.`,
      };
    }
  }

  if (group) {
    const normalizedGroup = group.trim().toLowerCase();
    if (normalizedGroup === RESERVED_GROUP) {
      return {
        isValid: false,
        message: `The group ${RESERVED_GROUP} is reserved and cannot be used for agents.`,
      };
    }
  }

  return { isValid: true };
}
