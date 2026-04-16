import { Injectable, Logger } from '@nestjs/common';
import { ActionType } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { redactSensitiveData } from '../utils/redact.util';

export type ActionLogInput = {
  organizationId: string;
  userId?: string | null;
  branchId?: string | null;
  actionType: ActionType;
  entityType: string;
  entityId?: string | null;
  description: string;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ErrorLogInput = {
  organizationId: string;
  userId?: string | null;
  branchId?: string | null;
  message: string;
  stack?: string | null;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  meta?: unknown;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(payload: ActionLogInput): Promise<void> {
    try {
      await this.prisma.actionLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: payload.userId ?? null,
          branchId: payload.branchId ?? null,
          actionType: payload.actionType,
          entityType: payload.entityType,
          entityId: payload.entityId ?? null,
          description: payload.description,
          oldData: redactSensitiveData(payload.oldData) as never,
          newData: redactSensitiveData(payload.newData) as never,
          ipAddress: payload.ipAddress ?? null,
          userAgent: payload.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Action log yozilmadi: ${(error as Error).message}`);
    }
  }

  async logError(payload: ErrorLogInput): Promise<void> {
    try {
      await this.prisma.errorLog.create({
        data: {
          organizationId: payload.organizationId,
          userId: payload.userId ?? null,
          branchId: payload.branchId ?? null,
          message: payload.message,
          stack: payload.stack ?? null,
          path: payload.path ?? null,
          method: payload.method ?? null,
          statusCode: payload.statusCode ?? null,
          ipAddress: payload.ipAddress ?? null,
          userAgent: payload.userAgent ?? null,
          meta: redactSensitiveData(payload.meta) as never,
        },
      });
    } catch (error) {
      this.logger.warn(`Error log yozilmadi: ${(error as Error).message}`);
    }
  }
}
