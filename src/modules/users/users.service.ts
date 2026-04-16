import { BadRequestException, Injectable } from '@nestjs/common';
import { Status, UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { BaseCrudService } from '../../common/services/base-crud.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { EntityCheckService } from '../../common/services/entity-check.service';
import { BcryptUtilsService } from '../../common/utils/bcrypt.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UsersService extends BaseCrudService {
  protected readonly model = 'user';
  protected readonly entityType = 'User';

  constructor(
    prisma: PrismaService,
    auditLogService: AuditLogService,
    private readonly bcryptUtilsService: BcryptUtilsService,
    private readonly branchScopeService: BranchScopeService,
    private readonly entityCheckService: EntityCheckService,
  ) {
    super(prisma, auditLogService);
  }

  async createUser(
    dto: CreateUserDto,
    actor: RequestUser,
    request?: Request,
  ): Promise<unknown> {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      dto.role === UserRole.SUPER_ADMIN
    ) {
      throw new BadRequestException('SUPER_ADMIN yaratish mumkin emas');
    }

    const branchId = this.branchScopeService.resolveBranchId(
      actor,
      dto.branchId,
    );

    if (branchId) {
      await this.entityCheckService.ensureBranchExists(
        branchId,
        actor.organizationId,
      );
    }

    const passwordHash = await this.bcryptUtilsService.generateHashPass(
      dto.password,
    );

    const createdUser: unknown = await this.create(
      {
        organizationId: actor.organizationId,
        branchId: branchId ?? null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        passwordHash,
        role: dto.role,
        avatarUrl: dto.avatarUrl ?? null,
        status: dto.status ?? Status.ACTIVE,
      },
      actor,
      request,
    );

    return createdUser;
  }

  async findUsers(query: UserQueryDto, actor: RequestUser) {
    const normalizedRole =
      query.role === 'MENTOR' ? UserRole.TEACHER : query.role;

    return this.findAll(query, actor, {
      searchFields: ['firstName', 'lastName', 'email', 'phone'],
      defaultWhere: normalizedRole ? { role: normalizedRole } : undefined,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findUser(id: string, actor: RequestUser) {
    return this.findOne(id, actor, {
      include: {
        branch: true,
      },
    });
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actor: RequestUser,
    request?: Request,
  ) {
    const payload: Record<string, unknown> = {
      ...dto,
    };

    if (dto.password) {
      payload.passwordHash = await this.bcryptUtilsService.generateHashPass(
        dto.password,
      );
      delete payload.password;
    }

    if (dto.branchId !== undefined) {
      const resolvedBranchId = this.branchScopeService.resolveBranchId(
        actor,
        dto.branchId,
      );
      if (resolvedBranchId) {
        await this.entityCheckService.ensureBranchExists(
          resolvedBranchId,
          actor.organizationId,
          {
            actor,
          },
        );
      }
      payload.branchId = resolvedBranchId ?? null;
    }

    return this.update(id, payload, actor, request);
  }

  async softDeleteUser(id: string, actor: RequestUser, request?: Request) {
    return this.softDelete(id, actor, request);
  }

  async changeUserStatus(
    id: string,
    status: Status,
    actor: RequestUser,
    request?: Request,
  ) {
    return this.changeStatus(id, status, actor, request);
  }

  async selectOptions(actor: RequestUser, branchId?: string) {
    const resolvedBranchId = this.branchScopeService.resolveBranchId(
      actor,
      branchId,
    );

    return this.prisma.user.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
        status: Status.ACTIVE,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });
  }
}
