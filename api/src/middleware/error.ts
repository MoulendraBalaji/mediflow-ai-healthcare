import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError, formatZodIssues } from '../lib/http.js';
import { logger } from '../lib/logger.js';

interface MulterLikeError extends Error {
  code?: string;
}

function statusForPrisma(error: Prisma.PrismaClientKnownRequestError): {
  status: number;
  code: string;
  message: string;
} {
  switch (error.code) {
    case 'P2002':
      return { status: 409, code: 'ALREADY_EXISTS', message: 'That record already exists' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'Not found' };
    case 'P2003':
      return { status: 409, code: 'CONFLICT', message: 'This record is still referenced elsewhere' };
    default:
      return { status: 500, code: 'DATABASE_ERROR', message: 'Something went wrong saving this' };
  }
}

/** Central error handler. Never leaks driver/Prisma internals to clients. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId;

  if (res.headersSent) return;

  if (err instanceof HttpError) {
    if (err.status >= 500) logger.error({ requestId, err }, 'request failed');
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details === undefined ? {} : { details: err.details }),
        ...(requestId ? { requestId } : {}),
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the highlighted fields',
        details: formatZodIssues(err),
        ...(requestId ? { requestId } : {}),
      },
    });
  }

  const multerError = err as MulterLikeError;
  if (err instanceof multer.MulterError || multerError?.name === 'MulterError') {
    const tooLarge = multerError.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 415).json({
      error: {
        code: tooLarge ? 'FILE_TOO_LARGE' : 'UNSUPPORTED_FILE',
        message: tooLarge
          ? 'That file is larger than 10 MB. Try a smaller file.'
          : 'That file type is not supported.',
        ...(requestId ? { requestId } : {}),
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = statusForPrisma(err);
    logger.error({ requestId, code: err.code }, 'prisma request failed');
    return res.status(mapped.status).json({
      error: { code: mapped.code, message: mapped.message, ...(requestId ? { requestId } : {}) },
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error({ requestId }, 'prisma validation failed');
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on our side',
        ...(requestId ? { requestId } : {}),
      },
    });
  }

  logger.error({ requestId, err }, 'unhandled error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      ...(requestId ? { requestId } : {}),
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'That endpoint does not exist',
      requestId: req.requestId,
    },
  });
}
