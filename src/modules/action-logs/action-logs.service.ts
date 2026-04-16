import { Injectable, NotFoundException } from '@nestjs/common';
import { Status } from '@prisma/client';
import { parsePagination } from '../../common/utils/query.util';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { redactSensitiveData } from '../../common/utils/redact.util';
import { ActionLogQueryDto } from './dto/action-log-query.dto';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class ActionLogsService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeLogs<T>(items: T[]): T[] {
    return items.map((item) => redactSensitiveData(item));
  }

  async findAll(query: ActionLogQueryDto, user: RequestUser) {
    const { page, limit, skip, take } = parsePagination(query);

    const where: any = {
      organizationId: user.organizationId,
      ...(user.role === 'SUPER_ADMIN'
        ? {}
        : user.branchId
          ? { branchId: user.branchId }
          : {}),
      ...(query.includeDeleted ? {} : { status: { not: Status.DELETED } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId && user.role === 'SUPER_ADMIN'
        ? { branchId: query.branchId }
        : {}),
      ...(query.actionType ? { actionType: query.actionType } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.actionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take,
      }),
      this.prisma.actionLog.count({ where }),
    ]);

    return {
      data: this.sanitizeLogs(data),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, user: RequestUser) {
    const entity = await this.prisma.actionLog.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        ...(user.role === 'SUPER_ADMIN'
          ? {}
          : user.branchId
            ? { branchId: user.branchId }
            : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
    });

    if (!entity) {
      throw new NotFoundException('Action log topilmadi');
    }

    return redactSensitiveData(entity);
  }
}
