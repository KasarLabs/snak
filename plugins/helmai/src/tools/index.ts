import { StarknetTool } from '@snakagent/core';
import {
  searchPatientSchema,
  createTaskSchema,
} from '../schema/index.js';
import { getPatientInformationsByFirstAndLastName } from '../actions/getPatientInformationsByFirstAndLastName.js';
import { createTask } from '../actions/createTask.js';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  // Patient Management Tools - Main function for dental assistant
  StarknetToolRegistry.push({
    name: 'get_patient_informations_by_first_and_last_name',
    plugins: 'helmai',
    description: 'Retrieve patient information by firstName and lastName (use these exact parameter names)',
    schema: searchPatientSchema,
    execute: getPatientInformationsByFirstAndLastName,
  });

  // Task Management Tools - Primary function
  StarknetToolRegistry.push({
    name: 'create_task',
    plugins: 'helmai',
    description: 'Create a healthcare task for the dental office',
    schema: createTaskSchema,
    execute: createTask,
  });

  // Task Management Tools - Alias for OpenAI compatibility
  StarknetToolRegistry.push({
    name: 'make_task',
    plugins: 'helmai',
    description: 'Create a healthcare task for the dental office (alias for create_task)',
    schema: createTaskSchema,
    execute: createTask,
  });

  // TODO: Fix other tools - temporarily commented out
  /*
  // Chat Management Tools
  StarknetToolRegistry.push({
    name: 'create_chat',
    plugins: 'helmai',
    description: 'Create a new chat session for a patient',
    schema: createChatSchema,
    execute: createChat,
  });

  StarknetToolRegistry.push({
    name: 'create_chat_from_name',
    plugins: 'helmai',
    description:
      'Automatically detect patient name in message and create chat if patient exists',
    schema: createChatFromNameSchema,
    execute: createChatFromName,
  });

  // Message Management Tools
  StarknetToolRegistry.push({
    name: 'create_message',
    plugins: 'helmai',
    description: 'Create a new message in an existing chat session',
    schema: createMessageSchema,
    execute: createMessage,
  });

  // Utility Tools
  StarknetToolRegistry.push({
    name: 'format_phone_number',
    plugins: 'helmai',
    description: 'Format phone number to French international format (+33)',
    schema: formatPhoneNumberSchema,
    execute: formatPhoneNumber,
  });

  StarknetToolRegistry.push({
    name: 'save_patient_chat_mapping',
    plugins: 'helmai',
    description:
      'Save association between phone number, patient ID, and chat ID',
    schema: savePatientChatMappingSchema,
    execute: savePatientChatMapping,
  });

  // Workflow Tools - Complete processes
  StarknetToolRegistry.push({
    name: 'process_patient_and_create_chat',
    plugins: 'helmai',
    description:
      'Complete workflow: search patient, create chat, and store mapping',
    schema: processPatientAndCreateChatSchema,
    execute: processPatientAndCreateChat,
  });
  */

  // TODO: Add more tools as actions are implemented
  // - create_patient
  // - update_patient
  // - search_patient_by_ssn (Desmos integration)
  // - update_chat
  // - get_chat_history
  // - update_message
  // - update_task
  // - get_patient_tasks
  // - schedule_appointment
  // - get_available_slots
};
