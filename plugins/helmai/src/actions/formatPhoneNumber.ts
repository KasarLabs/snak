import { SnakAgentInterface } from '@snakagent/core';
import { formatPhoneNumberSchema } from '../schema/index.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { z } from 'zod';

type FormatPhoneNumberParams = z.infer<typeof formatPhoneNumberSchema>;

/**
 * Format phone number to international format (+33)
 * This function standardizes phone numbers to the French international format
 *
 * @param agent - The Starknet agent interface
 * @param params - The phone number formatting parameters
 * @returns Promise<string> - JSON string with formatted phone number result
 */
export const formatPhoneNumber = async (
  _agent: SnakAgentInterface,
  params: FormatPhoneNumberParams
): Promise<string> => {
  try {
    const { phoneNumber } = params;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      const errorResult = HelmaiErrorHandler.createError(
        'Invalid phone number',
        'VALIDATION_ERROR',
        'Phone number is required and must be a string'
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }

    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.length === 0) {
      const errorResult = HelmaiErrorHandler.createError(
        'Invalid phone number',
        'VALIDATION_ERROR',
        'Phone number must contain at least one digit'
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }

    let formattedNumber = cleaned;

    // Remove leading 0 if present
    if (formattedNumber.startsWith('0')) {
      formattedNumber = formattedNumber.substring(1);
    }

    // Add French country code if not present
    if (!formattedNumber.startsWith('33')) {
      formattedNumber = '33' + formattedNumber;
    }

    // Add + prefix for international format
    const finalNumber = '+' + formattedNumber;

    // Validate the final format (should be +33 followed by 9 digits)
    const frenchPhoneRegex = /^\+33[1-9]\d{8}$/;
    if (!frenchPhoneRegex.test(finalNumber)) {
      const errorResult = HelmaiErrorHandler.createError(
        'Invalid French phone number format',
        'VALIDATION_ERROR',
        'Phone number must be a valid French number (10 digits starting with 0, or 9 digits without 0)'
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }

    // Return success response
    const result = HelmaiErrorHandler.createSuccess({
      originalNumber: phoneNumber,
      formattedNumber: finalNumber,
      countryCode: '+33',
      nationalNumber: formattedNumber.substring(2),
      isValid: true,
      message: 'Phone number formatted successfully',
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch (error) {
    const errorResult = HelmaiErrorHandler.createError(
      'Failed to format phone number',
      'PHONE_FORMAT_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return HelmaiErrorHandler.toJsonString(errorResult);
  }
};
