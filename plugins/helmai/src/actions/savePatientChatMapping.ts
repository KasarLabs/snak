import { SnakAgentInterface } from '@snakagent/core';
import { savePatientChatMappingSchema } from '../schema/index.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { ValidationUtils } from '../utils/validation.js';
import { SUCCESS_MESSAGES } from '../constants/healthcare.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

type SavePatientChatMappingParams = z.infer<
  typeof savePatientChatMappingSchema
>;

interface PatientChatMapping {
  [phoneNumber: string]: {
    patient_id: string;
    chat_id: string;
    metadata?: {
      createdAt?: string;
      source?: string;
      notes?: string;
    };
  };
}

/**
 * Save patient-chat mapping to storage
 * This function stores the association between phone number, patient ID, and chat ID
 * Replicates the Python save_patient_chat_mapping functionality
 *
 * @param agent - The Starknet agent interface
 * @param params - The mapping parameters including phone number, patient ID, and chat ID
 * @returns Promise<string> - JSON string with mapping save result
 */
export const savePatientChatMapping = async (
  _agent: SnakAgentInterface,
  params: SavePatientChatMappingParams
): Promise<string> => {
  try {
    // Validate phone number
    const phoneValidation = ValidationUtils.validatePhoneNumber(
      params.phoneNumber
    );
    if (phoneValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(phoneValidation);
    }

    // Validate patient ID
    const patientIdValidation = ValidationUtils.validateUUID(
      params.patientId,
      'Patient ID'
    );
    if (patientIdValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(patientIdValidation);
    }

    // Validate chat ID
    const chatIdValidation = ValidationUtils.validateUUID(
      params.chatId,
      'Chat ID'
    );
    if (chatIdValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(chatIdValidation);
    }

    // Define storage file path (similar to Python implementation)
    const storageDir = process.env.HELMAI_STORAGE_DIR || './storage';
    const storageFile = path.join(storageDir, 'patients_chats.json');

    // Ensure storage directory exists
    try {
      await fs.mkdir(storageDir, { recursive: true });
    } catch {
      // Directory might already exist, ignore error
    }

    // Load existing data
    let existingData: PatientChatMapping = {};
    try {
      const fileContent = await fs.readFile(storageFile, 'utf-8');
      existingData = JSON.parse(fileContent);
    } catch {
      // File doesn't exist or is invalid, start with empty object
      existingData = {};
    }

    // Add new mapping
    existingData[phoneValidation.data] = {
      patient_id: patientIdValidation.data,
      chat_id: chatIdValidation.data,
      metadata: {
        createdAt: params.metadata?.createdAt || new Date().toISOString(),
        source: params.metadata?.source || 'savePatientChatMapping',
        notes: params.metadata?.notes,
      },
    };

    // Save updated data
    await fs.writeFile(
      storageFile,
      JSON.stringify(existingData, null, 2),
      'utf-8'
    );

    // Return success response
    const result = HelmaiErrorHandler.createSuccess({
      phoneNumber: phoneValidation.data,
      patientId: patientIdValidation.data,
      chatId: chatIdValidation.data,
      storageFile,
      totalMappings: Object.keys(existingData).length,
      message: SUCCESS_MESSAGES.MAPPING_SAVED,
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch (error) {
    const errorResult = HelmaiErrorHandler.createError(
      'Failed to save patient-chat mapping',
      'MAPPING_SAVE_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return HelmaiErrorHandler.toJsonString(errorResult);
  }
};
