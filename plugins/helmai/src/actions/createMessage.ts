import { SnakAgentInterface } from '@snakagent/core';
import { createMessageSchema } from '../schema/index.js';
import { HelmaiHttpClients } from '../utils/httpClient.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { ValidationUtils } from '../utils/validation.js';
import { API_ENDPOINTS } from '../constants/api.js';
import { SUCCESS_MESSAGES } from '../constants/healthcare.js';
import { MessageCreationResult } from '../types/Message.js';
import { z } from 'zod';

type CreateMessageParams = z.infer<typeof createMessageSchema>;

interface MessageDataPayload {
  chatId: string;
  content: string;
  senderType: string;
  senderId: string;
  senderName?: string;
  messageType: string;
  priority: string;
  replyToMessageId?: string;
  metadata?: {
    twilioMessageSid?: string;
    twilioAccountSid?: string;
    twilioFrom?: string;
    twilioTo?: string;
    mediaUrl?: string;
    mediaType?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
  };
  patientId?: string; // For patient messages
}

/**
 * Create a new message in a chat session
 * This function creates a new message in an existing chat session for patient communication
 *
 * @param agent - The Starknet agent interface
 * @param params - The message creation parameters including chat ID, content, sender info
 * @returns Promise<string> - JSON string with message creation result
 */
export const createMessage = async (
  _agent: SnakAgentInterface,
  params: CreateMessageParams
): Promise<string> => {
  try {
    // Validate chat ID
    const chatIdValidation = ValidationUtils.validateUUID(
      params.chatId,
      'Chat ID'
    );
    if (chatIdValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(chatIdValidation);
    }

    // Validate message content
    const contentValidation = ValidationUtils.validateMessageContent(
      params.content
    );
    if (contentValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(contentValidation);
    }

    // Validate sender type
    const validSenderTypes = ['PATIENT', 'USER', 'ASSISTANT', 'SYSTEM'];
    if (!validSenderTypes.includes(params.senderType)) {
      const errorResult = HelmaiErrorHandler.createError(
        'Invalid sender type',
        'VALIDATION_ERROR',
        `Sender type must be one of: ${validSenderTypes.join(', ')}`
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }

    // Prepare message data
    const messageData: MessageDataPayload = {
      chatId: chatIdValidation.data,
      content: contentValidation.data,
      senderType: params.senderType,
      senderId: params.senderId,
      senderName: params.senderName,
      messageType: params.messageType || 'TEXT',
      priority: params.priority || 'MEDIUM',
      replyToMessageId: params.replyToMessageId,
      metadata: params.metadata,
    };

    if (params.senderType === 'PATIENT') {
      messageData.patientId = params.senderId; // For patient messages, senderId is patientId
    }

    // Determine the correct endpoint based on sender type
    let endpoint: string = API_ENDPOINTS.MESSAGES.CREATE;
    if (params.senderType === 'PATIENT') {
      // For patient messages, use the chat-specific endpoint
      endpoint = API_ENDPOINTS.MESSAGES.BY_CHAT.replace(
        ':chatId',
        chatIdValidation.data
      );
    }

    // Make API request to backend
    const backendClient = HelmaiHttpClients.getBackendClient();
    const response = await backendClient.post<MessageCreationResult>(
      endpoint,
      messageData
    );

    if (response.status === 'error') {
      return HelmaiErrorHandler.toJsonString(response);
    }

    // Return success response
    const result = HelmaiErrorHandler.createSuccess({
      messageId: response.data.id,
      chatId: messageData.chatId,
      content: messageData.content,
      senderType: messageData.senderType,
      senderId: messageData.senderId,
      createdAt: response.data.createdAt,
      message: SUCCESS_MESSAGES.MESSAGE_CREATED,
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch (error) {
    const errorResult = HelmaiErrorHandler.createError(
      'Failed to create message',
      'MESSAGE_CREATION_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return HelmaiErrorHandler.toJsonString(errorResult);
  }
};
