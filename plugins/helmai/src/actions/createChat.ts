import { SnakAgentInterface } from '@snakagent/core';
import { createChatSchema } from '../schema/index.js';
import { HelmaiHttpClients } from '../utils/httpClient.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { ValidationUtils } from '../utils/validation.js';
import { API_ENDPOINTS } from '../constants/api.js';
import { SUCCESS_MESSAGES } from '../constants/healthcare.js';
import { ChatCreationResult } from '../types/Chat.js';
import { z } from 'zod';

type CreateChatParams = z.infer<typeof createChatSchema>;

/**
 * Create a new chat session for a patient
 * This function creates a new chat session in the backend system for patient communication
 *
 * @param agent - The Starknet agent interface
 * @param params - The chat creation parameters including patient ID and optional center ID
 * @returns Promise<string> - JSON string with chat creation result
 */
export const createChat = async (
  _agent: SnakAgentInterface,
  params: CreateChatParams
): Promise<string> => {
  try {
    // Validate patient ID
    const patientIdValidation = ValidationUtils.validateUUID(
      params.patientId,
      'Patient ID'
    );
    if (patientIdValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(patientIdValidation);
    }

    // Validate center ID if provided
    if (params.centerId) {
      const centerIdValidation = ValidationUtils.validateUUID(
        params.centerId,
        'Center ID'
      );
      if (centerIdValidation.status === 'error') {
        return HelmaiErrorHandler.toJsonString(centerIdValidation);
      }
    }

    // Prepare chat data
    const chatData = {
      patientId: patientIdValidation.data,
      centerId:
        params.centerId ||
        process.env.HELMAI_DEFAULT_CENTER_ID ||
        '4322a733-6aba-497e-b54d-6bd04cffd598',
      status: 'ACTIVE',
      type: params.type || 'WHATSAPP',
      priority: params.priority || 'MEDIUM',
    };

    // Make API request to backend
    const backendClient = HelmaiHttpClients.getBackendClient();
    const response = await backendClient.post<ChatCreationResult>(
      API_ENDPOINTS.CHATS.CREATE,
      chatData
    );

    if (response.status === 'error') {
      return HelmaiErrorHandler.toJsonString(response);
    }

    // Return success response
    const result = HelmaiErrorHandler.createSuccess({
      chatId: response.data.id,
      patientId: chatData.patientId,
      centerId: chatData.centerId,
      status: chatData.status,
      createdAt: response.data.createdAt,
      message: SUCCESS_MESSAGES.CHAT_CREATED,
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch (error) {
    const errorResult = HelmaiErrorHandler.createError(
      'Failed to create chat session',
      'CHAT_CREATION_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return HelmaiErrorHandler.toJsonString(errorResult);
  }
};
