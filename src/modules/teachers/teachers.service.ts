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
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptUtilsService: BcryptUtilsService,
    private readonly branchScopeService: BranchScopeService,
    private readonly entityCheckService: EntityCheckService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createTeacher(
    dto: CreateTeacherDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const branchId = this.branchScopeService.ensureBranchForCreate(
      actor,
      dto.branchId,
    );
    await this.entityCheckService.ensureBranchExists(
      branchId,
      actor.organizationId,
      {
        actor,
      },
    );
    const password = dto.password ?? 'Teacher123!';
    const passwordHash =
      await this.bcryptUtilsService.generateHashPass(password);
    const nextStatus = dto.status ?? Status.ACTIVE;

    const teacher = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          role: UserRole.TEACHER,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          passwordHash,
          avatarUrl: dto.avatarUrl ?? null,
          status: nextStatus,
        },
      });

      return tx.teacherProfile.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          userId: user.id,
          specialty: dto.specialty ?? null,
          salary: dto.salary ?? null,
          hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : null,
          bio: dto.bio ?? null,
          status: nextStatus,
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
      actionType: ActionType.CREATE,
      entityType: 'TeacherProfile',
      entityId: teacher.id,
      description: 'Oqituvchi yaratildi',
      newData: teacher,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return teacher;
  }

  async findTeachers(query: BaseQueryDto, actor: RequestUser) {
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
        { specialty: { contains: query.search, mode: 'insensitive' } },
        {
          user: { firstName: { contains: query.search, mode: 'insensitive' } },
        },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { user: { phone: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.teacherProfile.findMany({
        where,
        include: {
          user: true,
          branch: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.teacherProfile.count({ where }),
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

  async findTeacher(id: string, actor: RequestUser) {
    const teacher = await this.prisma.teacherProfile.findFirst({
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
        branch: true,
        groups: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Oqituvchi topilmadi');
    }

    return teacher;
  }

  async updateTeacher(
    id: string,
    dto: UpdateTeacherDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const current = await this.findTeacher(id, actor);
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

      return tx.teacherProfile.update({
        where: { id },
        data: {
          ...(branchId ? { branchId } : {}),
          ...(dto.specialty !== undefined ? { specialty: dto.specialty } : {}),
          ...(dto.salary !== undefined ? { salary: dto.salary } : {}),
          ...(dto.hiredAt !== undefined
            ? { hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : null }
            : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
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
      entityType: 'TeacherProfile',
      entityId: id,
      description: 'Oqituvchi yangilandi',
      oldData: current,
      newData: updated,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return updated;
  }

  async softDeleteTeacher(id: string, actor: RequestUser, request?: Request) {
    const current = await this.findTeacher(id, actor);

    await this.prisma.$transaction([
      this.prisma.teacherProfile.update({
        where: { id },
        data: {
          status: Status.DELETED,
          deletedAt: new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: current.userId },
        data: {
          status: Status.DELETED,
          deletedAt: new Date(),
        },
      }),
    ]);

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.DELETE,
      entityType: 'TeacherProfile',
      entityId: id,
      description: 'Oqituvchi ochirildi',
      oldData: current,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return { id, status: Status.DELETED };
  }

  async changeTeacherStatus(
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

    const current = await this.findTeacher(id, actor);

    const [teacher] = await this.prisma.$transaction([
      this.prisma.teacherProfile.update({
        where: { id },
        data: {
          status,
        },
      }),
      this.prisma.user.update({
        where: { id: current.userId },
        data: {
          status,
        },
      }),
    ]);

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.UPDATE,
      entityType: 'TeacherProfile',
      entityId: id,
      description: `Oqituvchi statusi ${status} qilindi`,
      oldData: current,
      newData: teacher,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return teacher;
  }

  async selectOptions(actor: RequestUser, branchId?: string) {
    const resolvedBranchId = this.branchScopeService.resolveBranchId(
      actor,
      branchId,
    );

    return this.prisma.teacherProfile.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
