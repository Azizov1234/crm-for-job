import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { AuditLogService } from '../../common/services/audit-log.service';

type RequestWithOptionalUser = Request & { user?: Partial<RequestUser> };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithOptionalUser>();
    const response = ctx.getResponse<Response>();

    const prismaError =
      exception && typeof exception === 'object' && 'code' in exception
        ? (exception as {
            code?: string;
            meta?: { target?: string[] | string };
          })
        : null;
    const isPrismaKnownError = Boolean(prismaError?.code);
    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Serverda xatolik yuz berdi';
    let details: string[] | undefined;

    if (isPrismaKnownError) {
      if (prismaError?.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = Array.isArray(prismaError.meta?.target)
          ? prismaError.meta.target.join(', ')
          : typeof prismaError.meta?.target === 'string'
            ? prismaError.meta.target
            : 'field';
        message = `Takror qiymat: ${target} allaqachon mavjud`;
        details = [`${target} unique bo'lishi kerak`];
      } else if (prismaError?.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = "Yozuv topilmadi yoki allaqachon o'chirilgan";
      } else {
        message = 'Database xatoligi yuz berdi';
      }
    } else if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
      ) {
        const exceptionMessage = (
          exceptionResponse as { message: string | string[] }
        ).message;
        if (Array.isArray(exceptionMessage)) {
          details = exceptionMessage;
          message = exceptionMessage[0] ?? message;
        } else {
          message = exceptionMessage;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const actor = request.user;
    if (actor?.organizationId) {
      await this.auditLogService.logError({
        organizationId: actor.organizationId,
        userId: actor.id ?? null,
        branchId: actor.branchId ?? null,
        message,
        stack: exception instanceof Error ? exception.stack : null,
        path: request.url,
        method: request.method,
        statusCode: status,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        meta: {
          details,
          timestamp: new Date().toISOString(),
        },
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      details,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
