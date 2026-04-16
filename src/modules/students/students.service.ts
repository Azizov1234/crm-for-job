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
import { AssignStudentGroupsDto } from './dto/assign-student-groups.dto';
import { AssignStudentParentsDto } from './dto/assign-student-parents.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptUtilsService: BcryptUtilsService,
    private readonly branchScopeService: BranchScopeService,
    private readonly entityCheckService: EntityCheckService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createStudent(
    dto: CreateStudentDto,
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

    if (dto.parentIds?.length) {
      await Promise.all(
        dto.parentIds.map((parentId) =>
          this.entityCheckService.ensureParentExists(
            parentId,
            actor.organizationId,
            {
              actor,
              expectedBranchId: branchId,
            },
          ),
        ),
      );
    }

    if (dto.groupIds?.length) {
      await Promise.all(
        dto.groupIds.map((groupId) =>
          this.entityCheckService.ensureGroupExists(
            groupId,
            actor.organizationId,
            {
              actor,
              expectedBranchId: branchId,
            },
          ),
        ),
      );
    }

    const password = dto.password ?? 'Student123!';
    const passwordHash =
      await this.bcryptUtilsService.generateHashPass(password);
    const nextStatus = dto.status ?? Status.ACTIVE;

    const student = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          role: UserRole.STUDENT,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          passwordHash,
          avatarUrl: dto.avatarUrl ?? null,
          status: nextStatus,
        },
      });

      const created = await tx.studentProfile.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          userId: user.id,
          studentNo: dto.studentNo ?? null,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          gender: dto.gender,
          joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : null,
          address: dto.address ?? null,
          status: nextStatus,
        },
        include: {
          user: true,
        },
      });

      if (dto.parentIds?.length) {
        await tx.parentStudent.createMany({
          data: dto.parentIds.map((parentId) => ({
            parentId,
            studentId: created.id,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.groupIds?.length) {
        await tx.groupStudent.createMany({
          data: dto.groupIds.map((groupId) => ({
            groupId,
            studentId: created.id,
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
      entityType: 'StudentProfile',
      entityId: student.id,
      description: 'Oquvchi yaratildi',
      newData: student,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return this.findStudent(student.id, actor);
  }

  async findStudents(query: BaseQueryDto, actor: RequestUser) {
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
        { studentNo: { contains: query.search, mode: 'insensitive' } },
        {
          user: { firstName: { contains: query.search, mode: 'insensitive' } },
        },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { user: { phone: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where,
        include: {
          user: true,
          branch: { select: { id: true, name: true } },
          _count: {
            select: {
              parentLinks: true,
              groupLinks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.studentProfile.count({ where }),
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

  async findStudent(id: string, actor: RequestUser) {
    const student = await this.prisma.studentProfile.findFirst({
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
        parentLinks: {
          where: { status: { not: Status.DELETED } },
          include: {
            parent: {
              include: {
                user: true,
              },
            },
          },
        },
        groupLinks: {
          where: { status: { not: Status.DELETED } },
          include: {
            group: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Oquvchi topilmadi');
    }

    return student;
  }

  async updateStudent(
    id: string,
    dto: UpdateStudentDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const current = await this.findStudent(id, actor);
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

      return tx.studentProfile.update({
        where: { id },
        data: {
          ...(branchId ? { branchId } : {}),
          ...(dto.studentNo !== undefined ? { studentNo: dto.studentNo } : {}),
          ...(dto.birthDate !== undefined
            ? { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }
            : {}),
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.joinedAt !== undefined
            ? { joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : null }
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
      entityType: 'StudentProfile',
      entityId: id,
      description: 'Oquvchi yangilandi',
      oldData: current,
      newData: updated,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return updated;
  }

  async softDeleteStudent(id: string, actor: RequestUser, request?: Request) {
    const current = await this.findStudent(id, actor);

    await this.prisma.$transaction([
      this.prisma.studentProfile.update({
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
      entityType: 'StudentProfile',
      entityId: id,
      description: 'Oquvchi ochirildi',
      oldData: current,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return { id, status: Status.DELETED };
  }

  async changeStudentStatus(
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

    const current = await this.findStudent(id, actor);

    const [student] = await this.prisma.$transaction([
      this.prisma.studentProfile.update({
        where: { id },
        data: { status },
      }),
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
      entityType: 'StudentProfile',
      entityId: id,
      description: `Oquvchi statusi ${status} qilindi`,
      oldData: current,
      newData: student,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return student;
  }

  async assignParents(
    id: string,
    dto: AssignStudentParentsDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const student = await this.findStudent(id, actor);

    await Promise.all(
      dto.parentIds.map((parentId) =>
        this.entityCheckService.ensureParentExists(
          parentId,
          actor.organizationId,
          {
            actor,
            expectedBranchId: student.branchId,
          },
        ),
      ),
    );

    await this.prisma.parentStudent.createMany({
      data: dto.parentIds.map((parentId) => ({ parentId, studentId: id })),
      skipDuplicates: true,
    });

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.ASSIGN,
      entityType: 'ParentStudent',
      entityId: id,
      description: 'Oquvchiga ota-ona biriktirildi',
      newData: dto,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return this.findStudent(id, actor);
  }

  async assignGroups(
    id: string,
    dto: AssignStudentGroupsDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const student = await this.findStudent(id, actor);

    await Promise.all(
      dto.groupIds.map((groupId) =>
        this.entityCheckService.ensureGroupExists(groupId, actor.organizationId, {
          actor,
          expectedBranchId: student.branchId,
        }),
      ),
    );

    await this.prisma.groupStudent.createMany({
      data: dto.groupIds.map((groupId) => ({ groupId, studentId: id })),
      skipDuplicates: true,
    });

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.ASSIGN,
      entityType: 'GroupStudent',
      entityId: id,
      description: 'Oquvchi guruhlarga biriktirildi',
      newData: dto,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return this.findStudent(id, actor);
  }

  async getStudentPayments(id: string, actor: RequestUser) {
    await this.findStudent(id, actor);

    return this.prisma.payment.findMany({
      where: {
        studentId: id,
        organizationId: actor.organizationId,
        ...(actor.role === UserRole.SUPER_ADMIN
          ? {}
          : actor.branchId
            ? { branchId: actor.branchId }
            : {}),
        status: { not: Status.DELETED },
      },
      include: {
        histories: true,
      },
      orderBy: { year: 'desc' },
    });
  }

  async getStudentAttendance(id: string, actor: RequestUser) {
    await this.findStudent(id, actor);

    return this.prisma.attendance.findMany({
      where: {
        studentId: id,
        organizationId: actor.organizationId,
        ...(actor.role === UserRole.SUPER_ADMIN
          ? {}
          : actor.branchId
            ? { branchId: actor.branchId }
            : {}),
        status: { not: Status.DELETED },
      },
      include: {
        group: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async getStudentRatings(id: string, actor: RequestUser) {
    await this.findStudent(id, actor);

    return this.prisma.rating.findMany({
      where: {
        studentId: id,
        organizationId: actor.organizationId,
        ...(actor.role === UserRole.SUPER_ADMIN
          ? {}
          : actor.branchId
            ? { branchId: actor.branchId }
            : {}),
        status: { not: Status.DELETED },
      },
      include: {
        group: true,
        teacher: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { ratedAt: 'desc' },
    });
  }

  async selectOptions(actor: RequestUser, branchId?: string) {
    const resolvedBranchId = this.branchScopeService.resolveBranchId(
      actor,
      branchId,
    );

    return this.prisma.studentProfile.findMany({
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
