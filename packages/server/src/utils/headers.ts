import { BadRequestException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { FastifyRequest } from 'fastify';
import { Socket } from 'socket.io';

export const USER_ID_HEADER = 'x-auth-request-user' as const;

/**
 * Common function to extract and validate userId from headers
 * @param userIdHeader - The x-auth-request-user header value (can be string, string array, or undefined)
 * @returns string - Validated userId
 * @throws BadRequestException if userId is missing or invalid
 */
function extractAndValidateUserId(
  userIdHeader: string | string[] | undefined
): string {
  if (!userIdHeader) {
    throw new BadRequestException('User ID is required');
  }
  const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;

  if (!userId || !/^[A-Za-z0-9_-]+$/.test(userId)) {
    throw new BadRequestException('Invalid User ID format');
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
 * @returns string - Validated userId
 * @throws BadRequestException if userId is missing or invalid
 */
export function getUserIdFromSocketHeaders(client: Socket): string {
  try {
    return extractAndValidateUserId(client.handshake.headers[USER_ID_HEADER]);
  } catch (err) {
    if (err instanceof BadRequestException) {
      throw new WsException(err.getResponse());
    }
    throw new WsException('Invalid User ID');
  }
}
