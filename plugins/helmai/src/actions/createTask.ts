import { SnakAgentInterface } from '@snakagent/core';
import { createTaskSchema } from '../schema/index.js';
import { HelmaiHttpClients } from '../utils/httpClient.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { ValidationUtils } from '../utils/validation.js';
import { API_ENDPOINTS } from '../constants/api.js';
import {
  SUCCESS_MESSAGES,
  HEALTHCARE_CONFIG,
} from '../constants/healthcare.js';
import { Task } from '../types/Task.js';
import { z } from 'zod';

type CreateTaskParams = z.infer<typeof createTaskSchema>;

/**
 * Create a new healthcare task for a patient
 *
 * @param agent - The Snak agent interface (not used but required for tool interface)
 * @param params - The task creation parameters
 * @returns Promise<string> - JSON string with created task or error
 */
export const createTask = async (
  _agent: SnakAgentInterface,
  params: unknown
): Promise<string> => {
  try {
    // Parse and validate params using the schema
    const parsedParams = createTaskSchema.parse(params) as CreateTaskParams;

    // Validate required fields
    const titleValidation = ValidationUtils.validatePatientName(
      parsedParams.title,
      'Task title'
    );
    if (titleValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(titleValidation);
    }

    const descriptionValidation = ValidationUtils.validateTaskDescription(
      parsedParams.description
    );
    if (descriptionValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(descriptionValidation);
    }

    const patientIdValidation = ValidationUtils.validateUUID(
      parsedParams.patientId,
      'Patient ID'
    );
    if (patientIdValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(patientIdValidation);
    }

    // Skip centerId validation since we're forcing the default center ID
    // const centerIdValidation = ValidationUtils.validateUUID(
    //   parsedParams.centerId,
    //   'Center ID'
    // );
    // if (centerIdValidation.status === 'error') {
    //   return HelmaiErrorHandler.toJsonString(centerIdValidation);
    // }

    // Validate assigned to ID if provided
    if (parsedParams.assignedTo) {
      const assignedToValidation = ValidationUtils.validateUUID(
        parsedParams.assignedTo,
        'Assigned to ID'
      );
      if (assignedToValidation.status === 'error') {
        return HelmaiErrorHandler.toJsonString(assignedToValidation);
      }
    }

    // Validate assigned by ID if provided
    if (parsedParams.assignedBy) {
      const assignedByValidation = ValidationUtils.validateUUID(
        parsedParams.assignedBy,
        'Assigned by ID'
      );
      if (assignedByValidation.status === 'error') {
        return HelmaiErrorHandler.toJsonString(assignedByValidation);
      }
    }

    // Validate related chat ID if provided
    if (parsedParams.relatedChatId) {
      const chatIdValidation = ValidationUtils.validateUUID(
        parsedParams.relatedChatId,
        'Related chat ID'
      );
      if (chatIdValidation.status === 'error') {
        return HelmaiErrorHandler.toJsonString(chatIdValidation);
      }
    }

    // Validate related message ID if provided
    if (parsedParams.relatedMessageId) {
      const messageIdValidation = ValidationUtils.validateUUID(
        parsedParams.relatedMessageId,
        'Related message ID'
      );
      if (messageIdValidation.status === 'error') {
        return HelmaiErrorHandler.toJsonString(messageIdValidation);
      }
    }

    // Validate due date if provided
    if (parsedParams.dueDate) {
      const dueDateValidation = ValidationUtils.validateDate(
        parsedParams.dueDate,
        'Due date'
      );
      if (dueDateValidation.status === 'error') {
        return HelmaiErrorHandler.toJsonString(dueDateValidation);
      }
    }

    // Validate estimated duration if provided
    if (parsedParams.estimatedDuration) {
      const durationValidation = ValidationUtils.validateDuration(
        parsedParams.estimatedDuration,
        'Estimated duration'
      );
      if (durationValidation.status === 'error') {
        return HelmaiErrorHandler.toJsonString(durationValidation);
      }
    }

    // Validate notes if provided
    if (
      parsedParams.notes &&
      parsedParams.notes.length > HEALTHCARE_CONFIG.MAX_TASK_DESCRIPTION_LENGTH
    ) {
      return HelmaiErrorHandler.toJsonString(
        HelmaiErrorHandler.createError(
          'INVALID_NOTES',
          `Notes cannot exceed ${HEALTHCARE_CONFIG.MAX_TASK_DESCRIPTION_LENGTH} characters`
        )
      );
    }

    // Prepare task request
    const taskRequest = {
      description: `${titleValidation.data}: ${descriptionValidation.data}`,
      priority: parsedParams.priority,
      status: 'OPEN',
      source: 'MANUAL',
      patientId: patientIdValidation.data,
      centerId: process.env.HELMAI_DEFAULT_CENTER_ID || '4322a733-6aba-497e-b54d-6bd04cffd598',
    };

    // Make API request
    const backendClient = HelmaiHttpClients.getBackendClient();
    const response = await backendClient.post<Task>(
      API_ENDPOINTS.TASKS.CREATE,
      taskRequest
    );

    if (response.status === 'error') {
      return HelmaiErrorHandler.toJsonString(
        HelmaiErrorHandler.handleTaskError(
          new Error(response.message),
          'create_task'
        )
      );
    }

    const result = HelmaiErrorHandler.createSuccess({
      task: response.data,
      message: SUCCESS_MESSAGES.TASK_CREATED,
      taskId: response.data.id,
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch (error) {
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      const errorResult = HelmaiErrorHandler.createError(
        'VALIDATION_ERROR',
        'Invalid task parameters provided',
        error.errors
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }
    
    return HelmaiErrorHandler.toJsonString(
      HelmaiErrorHandler.handleTaskError(error, 'create_task')
    );
  }
};
