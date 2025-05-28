import { SnakAgentInterface } from '@snakagent/core';
import { createChatFromNameSchema } from '../schema/index.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { ValidationUtils } from '../utils/validation.js';
import { getPatientInformationsByFirstAndLastName } from './getPatientInformationsByFirstAndLastName.js';
import { createChat } from './createChat.js';
import { SUCCESS_MESSAGES } from '../constants/healthcare.js';
import { z } from 'zod';

type CreateChatFromNameParams = z.infer<typeof createChatFromNameSchema>;

/**
 * Create chat from name detection in message content
 * This function analyzes message content to detect patient names and automatically creates chats
 * Replicates the Python create_chat_from_name functionality
 *
 * @param agent - The Starknet agent interface
 * @param params - The parameters including message content and optional phone number
 * @returns Promise<string> - JSON string with chat creation result
 */
export const createChatFromName = async (
  agent: SnakAgentInterface,
  params: CreateChatFromNameParams
): Promise<string> => {
  try {
    // Validate message content
    const contentValidation = ValidationUtils.validateMessageContent(
      params.messageContent
    );
    if (contentValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(contentValidation);
    }

    // Extract potential names from message content
    const messageContent = contentValidation.data.trim();
    const parts = messageContent.split(/\s+/);

    // Check if message contains exactly 2 words (potential first name and last name)
    if (parts.length !== 2) {
      const errorResult = HelmaiErrorHandler.createError(
        'Invalid name format',
        'NAME_DETECTION_ERROR',
        `Message should contain exactly 2 words (first name and last name). Found ${parts.length} words: "${messageContent}"`
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }

    // Extract and normalize names (capitalize first letter)
    const firstName =
      parts[0].trim().charAt(0).toUpperCase() +
      parts[0].trim().slice(1).toLowerCase();
    const lastName =
      parts[1].trim().charAt(0).toUpperCase() +
      parts[1].trim().slice(1).toLowerCase();

    // Validate extracted names
    const firstNameValidation = ValidationUtils.validatePatientName(
      firstName,
      'First name'
    );
    if (firstNameValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(firstNameValidation);
    }

    const lastNameValidation = ValidationUtils.validatePatientName(
      lastName,
      'Last name'
    );
    if (lastNameValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(lastNameValidation);
    }

    // Search for patient
    const patientSearchResult = await getPatientInformationsByFirstAndLastName(
      agent,
      {
        firstName: firstNameValidation.data,
        lastName: lastNameValidation.data,
        limit: 1,
        offset: 0,
      }
    );

    const searchData = JSON.parse(patientSearchResult);
    if (searchData.status === 'error' || !searchData.data?.patients?.length) {
      const errorResult = HelmaiErrorHandler.createError(
        'Patient not found',
        'PATIENT_NOT_FOUND',
        `No patient found with name: ${firstNameValidation.data} ${lastNameValidation.data}`
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }

    const patient = searchData.data.patients[0];
    const patientId = patient.id;

    // Create chat for the found patient
    const chatResult = await createChat(agent, {
      patientId,
      centerId: params.centerId,
      type: 'WHATSAPP',
      priority: 'MEDIUM',
      subject: `Auto-created for ${firstNameValidation.data} ${lastNameValidation.data}`,
      metadata: {
        phoneNumber: params.phoneNumber,
        twilioConversationSid: `auto_${Date.now()}`,
      },
    });

    const chatData = JSON.parse(chatResult);
    if (chatData.status === 'error') {
      const errorResult = HelmaiErrorHandler.createError(
        'Failed to create chat',
        'CHAT_CREATION_ERROR',
        chatData.error || 'Unknown error during chat creation'
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }

    // Return success response
    const result = HelmaiErrorHandler.createSuccess({
      detectedName: {
        firstName: firstNameValidation.data,
        lastName: lastNameValidation.data,
        originalMessage: messageContent,
      },
      patient: {
        id: patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phoneNumber: patient.phoneNumber,
      },
      chat: {
        id: chatData.data.chatId,
        patientId,
        status: 'ACTIVE',
        type: 'WHATSAPP',
        createdAt: chatData.data.createdAt,
      },
      message: SUCCESS_MESSAGES.CHAT_FROM_NAME_CREATED,
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch (error) {
    const errorResult = HelmaiErrorHandler.createError(
      'Failed to create chat from name',
      'CHAT_FROM_NAME_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return HelmaiErrorHandler.toJsonString(errorResult);
  }
};
