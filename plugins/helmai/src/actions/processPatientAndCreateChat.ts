import { SnakAgentInterface } from '@snakagent/core';
import { processPatientAndCreateChatSchema } from '../schema/index.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { ValidationUtils } from '../utils/validation.js';
import { getPatientInformationsByFirstAndLastName } from './getPatientInformationsByFirstAndLastName.js';
import { createChat } from './createChat.js';
import { savePatientChatMapping } from './savePatientChatMapping.js';
import { SUCCESS_MESSAGES } from '../constants/healthcare.js';
import { z } from 'zod';

type ProcessPatientAndCreateChatParams = z.infer<
  typeof processPatientAndCreateChatSchema
>;

/**
 * Complete workflow: search patient, create chat, and store mapping
 * This function implements the complete patient processing workflow from the Python implementation
 *
 * @param agent - The Starknet agent interface
 * @param params - The patient processing parameters including names and optional settings
 * @returns Promise<string> - JSON string with complete workflow result
 */
export const processPatientAndCreateChat = async (
  agent: SnakAgentInterface,
  params: ProcessPatientAndCreateChatParams
): Promise<string> => {
  try {
    // Validate patient names
    const firstNameValidation = ValidationUtils.validatePatientName(
      params.firstName,
      'First name'
    );
    if (firstNameValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(firstNameValidation);
    }

    const lastNameValidation = ValidationUtils.validatePatientName(
      params.lastName,
      'Last name'
    );
    if (lastNameValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(lastNameValidation);
    }

    // Step 1: Search for patient
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
    const phoneNumber = params.phoneNumber || patient.phoneNumber;

    // Step 2: Create chat if autoCreateChat is enabled
    let chatId: string | null = null;
    if (params.autoCreateChat) {
      const chatResult = await createChat(agent, {
        patientId,
        centerId: params.centerId,
        type: 'WHATSAPP',
        priority: 'MEDIUM',
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

      chatId = chatData.data.chatId;

      // Step 3: Save patient-chat mapping if phone number is available
      if (phoneNumber && chatId) {
        const mappingResult = await savePatientChatMapping(agent, {
          phoneNumber,
          patientId,
          chatId,
          metadata: {
            createdAt: new Date().toISOString(),
            source: 'processPatientAndCreateChat',
            notes: `Auto-created for ${firstNameValidation.data} ${lastNameValidation.data}`,
          },
        });

        const mappingData = JSON.parse(mappingResult);
        if (mappingData.status === 'error') {
          // Log warning but don't fail the entire process
          console.warn(
            'Failed to save patient-chat mapping:',
            mappingData.error
          );
        }
      }
    }

    // Return success response with complete workflow result
    const result = HelmaiErrorHandler.createSuccess({
      patient: {
        id: patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phoneNumber: patient.phoneNumber,
        email: patient.email,
      },
      chat: chatId
        ? {
            id: chatId,
            patientId,
            status: 'ACTIVE',
            type: 'WHATSAPP',
          }
        : null,
      mapping:
        phoneNumber && chatId
          ? {
              phoneNumber,
              patientId,
              chatId,
            }
          : null,
      workflow: {
        patientFound: true,
        chatCreated: !!chatId,
        mappingSaved: !!(phoneNumber && chatId),
      },
      message: SUCCESS_MESSAGES.PATIENT_WORKFLOW_COMPLETED,
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch (error) {
    const errorResult = HelmaiErrorHandler.createError(
      'Failed to process patient workflow',
      'WORKFLOW_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return HelmaiErrorHandler.toJsonString(errorResult);
  }
};
