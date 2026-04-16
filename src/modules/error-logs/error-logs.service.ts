import { Injectable, NotFoundException } from '@nestjs/common';
import { Status } from '@prisma/client';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { parsePagination } from '../../common/utils/query.util';
import { redactSensitiveData } from '../../common/utils/redact.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ErrorLogQueryDto } from './dto/error-log-query.dto';

@Injectable()
export class ErrorLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ErrorLogQueryDto, user: RequestUser) {
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
      ...(query.statusCode ? { statusCode: query.statusCode } : {}),
      ...(query.method ? { method: query.method } : {}),
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
        { message: { contains: query.search, mode: 'insensitive' } },
        { path: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.errorLog.findMany({
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
      this.prisma.errorLog.count({ where }),
    ]);

    return {
      data: data.map((item) => redactSensitiveData(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, user: RequestUser) {
    const entity = await this.prisma.errorLog.findFirst({
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
      throw new NotFoundException('Error log topilmadi');
    }

    return redactSensitiveData(entity);
  }
}
