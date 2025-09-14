import { BadRequestException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { FastifyRequest } from 'fastify';
import { Socket } from 'socket.io';

export const USER_ID_HEADER = 'x-auth-request-user' as const;
/**
 * Validates if a string is a valid UUID (v4 format)
 * @param uuid - The string to validate
 * @returns boolean - True if valid UUID, false otherwise
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === 'string' && uuid.length === 36 && uuidRegex.test(uuid);
}


/**
 * Common function to extract and validate userId from headers
 * @param userIdHeader - The x-auth-request-user header value (can be string, string array, or undefined)
 * @returns string - Validated userId (must be a valid UUID v4)
 * @throws BadRequestException if userId is missing or invalid
 */
function extractAndValidateUserId(
  userIdHeader: string | string[] | undefined
): string {
  if (!userIdHeader) {
    throw new BadRequestException('User ID is required');
  }
  const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;

  if (!userId) {
    throw new BadRequestException('User ID cannot be empty');
  }

  if (!isValidUUID(userId)) {
    throw new BadRequestException('User ID must be a valid UUID v4 format');
  }

  return userId;
}

/**
 * Extract and validate userId from request headers
 * @param req - FastifyRequest object
 * @returns string - Validated userId
 * @throws BadRequestException if userId is missing or invalid
 */
export function getUserIdFromHeaders(req: FastifyRequest): string {
  return extractAndValidateUserId(req.headers[USER_ID_HEADER]);
}

/**
 * Extract and validate userId from WebSocket socket headers
 * @param client - Socket object from WebSocket connection
 * @returns string - Validated userId (must be a valid UUID v4)
 * @throws WsException if userId is missing or invalid
 */
export function getUserIdFromSocketHeaders(client: Socket): string {
  try {
    return extractAndValidateUserId(client.handshake.headers[USER_ID_HEADER]);
  } catch (err) {
    if (err instanceof BadRequestException) {
      throw new WsException(err.getResponse());
    }
    throw new WsException('Invalid User ID format');
  }
}
