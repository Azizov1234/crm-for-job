import {
  BadRequestException,
  ForbiddenException,
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
import { AttachExistingUserDto } from './dto/attach-existing-user.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptUtilsService: BcryptUtilsService,
    private readonly branchScopeService: BranchScopeService,
    private readonly entityCheckService: EntityCheckService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private ensureSuperAdmin(actor: RequestUser) {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Bu amalni faqat SUPER_ADMIN bajara oladi');
    }
  }

  async createAdmin(
    dto: CreateAdminDto,
    actor: RequestUser,
    request?: Request,
  ) {
    this.ensureSuperAdmin(actor);

    const branchId = this.branchScopeService.ensureBranchForCreate(
      actor,
      dto.branchId,
    );
    await this.entityCheckService.ensureBranchExists(branchId, actor.organizationId, {
      actor,
    });
    const password = dto.password ?? 'Admin123!';
    const passwordHash =
      await this.bcryptUtilsService.generateHashPass(password);
    const nextStatus = dto.status ?? Status.ACTIVE;

    const admin = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          role: UserRole.ADMIN,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          passwordHash,
          avatarUrl: dto.avatarUrl ?? null,
          status: nextStatus,
        },
      });

      return tx.adminProfile.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          userId: user.id,
          notes: dto.notes ?? null,
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
      entityType: 'AdminProfile',
      entityId: admin.id,
      description: 'Admin yaratildi',
      newData: admin,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return admin;
  }

  async findAdmins(query: BaseQueryDto, actor: RequestUser) {
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
        { notes: { contains: query.search, mode: 'insensitive' } },
        {
          user: { firstName: { contains: query.search, mode: 'insensitive' } },
        },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { user: { phone: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.adminProfile.findMany({
        where,
        include: {
          user: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.adminProfile.count({ where }),
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

  async findAdmin(id: string, actor: RequestUser) {
    const admin = await this.prisma.adminProfile.findFirst({
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
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin topilmadi');
    }

    return admin;
  }

  async updateAdmin(
    id: string,
    dto: UpdateAdminDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const current = await this.findAdmin(id, actor);
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

      return tx.adminProfile.update({
        where: { id },
        data: {
          ...(branchId ? { branchId } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
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
      entityType: 'AdminProfile',
      entityId: id,
      description: 'Admin yangilandi',
      oldData: current,
      newData: updated,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return updated;
  }

  async deleteAdmin(id: string, actor: RequestUser, request?: Request) {
    this.ensureSuperAdmin(actor);

    const current = await this.findAdmin(id, actor);

    await this.prisma.$transaction([
      this.prisma.adminProfile.update({
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
      entityType: 'AdminProfile',
      entityId: id,
      description: 'Admin ochirildi',
      oldData: current,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return { id, status: Status.DELETED };
  }

  async updateRole(
    id: string,
    dto: UpdateAdminRoleDto,
    actor: RequestUser,
    request?: Request,
  ) {
    this.ensureSuperAdmin(actor);

    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Bu endpoint orqali SUPER_ADMIN berilmaydi',
      );
    }

    const current = await this.findAdmin(id, actor);

    const user = await this.prisma.user.update({
      where: { id: current.userId },
      data: { role: dto.role },
    });

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.ROLE_UPDATE,
      entityType: 'UserRole',
      entityId: current.userId,
      description: `Admin roli ${dto.role} ga ozgartirildi`,
      oldData: { role: current.user.role },
      newData: { role: dto.role },
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return user;
  }

  async attachExistingUser(
    dto: AttachExistingUserDto,
    actor: RequestUser,
    request?: Request,
  ) {
    this.ensureSuperAdmin(actor);

    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        organizationId: actor.organizationId,
        status: { not: Status.DELETED },
      },
    });

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    const branchId = this.branchScopeService.resolveBranchId(
      actor,
      dto.branchId ?? user.branchId ?? undefined,
    );
    if (!branchId) {
      throw new BadRequestException('branchId majburiy');
    }
    await this.entityCheckService.ensureBranchExists(branchId, actor.organizationId, {
      actor,
    });

    const existing = await this.prisma.adminProfile.findUnique({
      where: { userId: user.id },
    });

    if (existing && existing.status !== Status.DELETED) {
      throw new BadRequestException('Bu user allaqachon admin');
    }

    const data = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          role: UserRole.ADMIN,
          branchId,
        },
      });

      if (existing) {
        return tx.adminProfile.update({
          where: { id: existing.id },
          data: {
            status: Status.ACTIVE,
            deletedAt: null,
            branchId,
            notes: dto.notes ?? existing.notes,
          },
          include: { user: true },
        });
      }

      return tx.adminProfile.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          userId: user.id,
          notes: dto.notes ?? null,
        },
        include: { user: true },
      });
    });

    await this.auditLogService.logAction({
      organizationId: actor.organizationId,
      userId: actor.id,
      branchId: actor.branchId,
      actionType: ActionType.ASSIGN,
      entityType: 'AdminProfile',
      entityId: data.id,
      description: 'Mavjud user admin sifatida biriktirildi',
      newData: data,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return data;
  }

  async changeStatus(
    id: string,
    status: Status,
    actor: RequestUser,
    request?: Request,
  ) {
    this.ensureSuperAdmin(actor);

    if (status === Status.DELETED) {
      throw new BadRequestException(
        'DELETED uchun delete endpointdan foydalaning',
      );
    }

    const current = await this.findAdmin(id, actor);

    const [profile] = await this.prisma.$transaction([
      this.prisma.adminProfile.update({ where: { id }, data: { status } }),
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
      entityType: 'AdminProfile',
      entityId: id,
      description: `Admin statusi ${status} qilindi`,
      oldData: current,
      newData: profile,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return profile;
  }
}
