import { BadRequestException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

/**
 * Extract and validate userId from request headers
 * @param req - FastifyRequest object
 * @returns string - Validated userId
 * @throws BadRequestException if userId is missing or invalid
 */
export function getUserIdFromHeaders(req: FastifyRequest): string {
  const userIdHeader = req.headers['x-user-id'];

  if (!userIdHeader) {
    throw new BadRequestException('User ID is required');
  }
  const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;

  if (!userId || !/^[A-Za-z0-9_-]+$/.test(userId)) {
    throw new BadRequestException('Invalid User ID format');
  }

  return userId;
}
