import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActionType, Status, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { BaseQueryDto } from '../../common/dto/base-query.dto';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { AuditLogService } from '../../common/services/audit-log.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { EntityCheckService } from '../../common/services/entity-check.service';
import { BcryptUtilsService } from '../../common/utils/bcrypt.service';
import { parsePagination } from '../../common/utils/query.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AssignParentStudentDto } from './dto/assign-parent-student.dto';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptUtilsService: BcryptUtilsService,
    private readonly branchScopeService: BranchScopeService,
    private readonly entityCheckService: EntityCheckService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createParent(
    dto: CreateParentDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const branchId = this.branchScopeService.ensureBranchForCreate(
      actor,
      dto.branchId,
    );
    await this.entityCheckService.ensureBranchExists(branchId, actor.organizationId, {
      actor,
    });

    if (dto.studentIds?.length) {
      await Promise.all(
        dto.studentIds.map((studentId) =>
          this.entityCheckService.ensureStudentExists(
            studentId,
            actor.organizationId,
            {
              actor,
              expectedBranchId: branchId,
            },
          ),
        ),
      );
    }

    const password = dto.password ?? 'Parent123!';
    const passwordHash =
      await this.bcryptUtilsService.generateHashPass(password);
    const nextStatus = dto.status ?? Status.ACTIVE;

    const parent = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          role: UserRole.PARENT,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          passwordHash,
          avatarUrl: dto.avatarUrl ?? null,
          status: nextStatus,
        },
      });

      const created = await tx.parentProfile.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          userId: user.id,
          occupation: dto.occupation ?? null,
          address: dto.address ?? null,
          status: nextStatus,
        },
        include: {
          user: true,
        },
      });

      if (dto.studentIds?.length) {
        await tx.parentStudent.createMany({
          data: dto.studentIds.map((studentId) => ({
            parentId: created.id,
            studentId,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.CREATE,
      entityType: 'ParentProfile',
      entityId: parent.id,
      description: 'Ota-ona yaratildi',
      newData: parent,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return this.findParent(parent.id, actor);
  }

  async findParents(query: BaseQueryDto, actor: RequestUser) {
    const { page, limit, skip, take } = parsePagination(query);

    const where: any = {
      organizationId: actor.organizationId,
      ...(actor.role === UserRole.SUPER_ADMIN
        ? query.branchId
          ? { branchId: query.branchId }
          : {}
        : actor.branchId
          ? { branchId: actor.branchId }
          : {}),
      ...(query.status
        ? { status: query.status }
        : query.includeDeleted
          ? {}
          : { status: { not: Status.DELETED } }),
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
        { occupation: { contains: query.search, mode: 'insensitive' } },
        {
          user: { firstName: { contains: query.search, mode: 'insensitive' } },
        },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { user: { phone: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.parentProfile.findMany({
        where,
        include: {
          user: true,
          _count: {
            select: {
              studentLinks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.parentProfile.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findParent(id: string, actor: RequestUser) {
    const parent = await this.prisma.parentProfile.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        status: { not: Status.DELETED },
        ...(actor.role === UserRole.SUPER_ADMIN
          ? {}
          : actor.branchId
            ? { branchId: actor.branchId }
            : {}),
      },
      include: {
        user: true,
        studentLinks: {
          where: { status: { not: Status.DELETED } },
          include: {
            student: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException('Ota-ona topilmadi');
    }

    return parent;
  }

  async updateParent(
    id: string,
    dto: UpdateParentDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const current = await this.findParent(id, actor);
    if (dto.status === Status.DELETED) {
      throw new BadRequestException(
        'DELETED uchun delete endpointdan foydalaning',
      );
    }
    const branchId = dto.branchId
      ? this.branchScopeService.resolveBranchId(actor, dto.branchId)
      : current.branchId;
    if (branchId) {
      await this.entityCheckService.ensureBranchExists(
        branchId,
        actor.organizationId,
        {
          actor,
        },
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const userPayload: any = {
        ...(dto.firstName ? { firstName: dto.firstName } : {}),
        ...(dto.lastName ? { lastName: dto.lastName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(branchId ? { branchId } : {}),
      };

      if (dto.password) {
        userPayload.passwordHash =
          await this.bcryptUtilsService.generateHashPass(dto.password);
      }

      if (Object.keys(userPayload).length > 0) {
        await tx.user.update({
          where: { id: current.userId },
          data: userPayload,
        });
      }

      return tx.parentProfile.update({
        where: { id },
        data: {
          ...(branchId ? { branchId } : {}),
          ...(dto.occupation !== undefined
            ? { occupation: dto.occupation }
            : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: {
          user: true,
        },
      });
    });

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.UPDATE,
      entityType: 'ParentProfile',
      entityId: id,
      description: 'Ota-ona yangilandi',
      oldData: current,
      newData: updated,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return updated;
  }

  async softDeleteParent(id: string, actor: RequestUser, request?: Request) {
    const current = await this.findParent(id, actor);

    await this.prisma.$transaction([
      this.prisma.parentProfile.update({
        where: { id },
        data: { status: Status.DELETED, deletedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: current.userId },
        data: { status: Status.DELETED, deletedAt: new Date() },
      }),
    ]);

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.DELETE,
      entityType: 'ParentProfile',
      entityId: id,
      description: 'Ota-ona ochirildi',
      oldData: current,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return { id, status: Status.DELETED };
  }

  async assignStudent(
    id: string,
    dto: AssignParentStudentDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const parent = await this.findParent(id, actor);

    await Promise.all(
      dto.studentIds.map((studentId) =>
        this.entityCheckService.ensureStudentExists(
          studentId,
          actor.organizationId,
          {
            actor,
            expectedBranchId: parent.branchId,
          },
        ),
      ),
    );

    await this.prisma.parentStudent.createMany({
      data: dto.studentIds.map((studentId) => ({ parentId: id, studentId })),
      skipDuplicates: true,
    });

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.ASSIGN,
      entityType: 'ParentStudent',
      entityId: id,
      description: 'Ota-onaga oquvchilar biriktirildi',
      newData: dto,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return this.findParent(id, actor);
  }

  async changeParentStatus(
    id: string,
    status: Status,
    actor: RequestUser,
    request?: Request,
  ) {
    if (status === Status.DELETED) {
      throw new BadRequestException(
        'DELETED uchun delete endpointdan foydalaning',
      );
    }

    const current = await this.findParent(id, actor);

    const [parent] = await this.prisma.$transaction([
      this.prisma.parentProfile.update({ where: { id }, data: { status } }),
      this.prisma.user.update({
        where: { id: current.userId },
        data: { status },
      }),
    ]);

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.UPDATE,
      entityType: 'ParentProfile',
      entityId: id,
      description: `Ota-ona statusi ${status} qilindi`,
      oldData: current,
      newData: parent,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return parent;
  }
}
