import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionType, Status, UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { AuditLogService } from '../../common/services/audit-log.service';
import { BranchScopeService } from '../../common/services/branch-scope.service';
import { EntityCheckService } from '../../common/services/entity-check.service';
import { parsePagination } from '../../common/utils/query.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BulkStaffAttendanceDto } from './dto/bulk-staff-attendance.dto';
import { CreateStaffAttendanceDto } from './dto/create-staff-attendance.dto';
import { StaffAttendanceQueryDto } from './dto/staff-attendance-query.dto';
import { UpdateStaffAttendanceDto } from './dto/update-staff-attendance.dto';

@Injectable()
export class StaffAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScopeService: BranchScopeService,
    private readonly entityCheckService: EntityCheckService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private normalizeDate(dateString: string) {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private ensureManagePermission(user: RequestUser) {
    if (user.role === UserRole.STAFF) {
      throw new BadRequestException(
        'Xodimlar davomatini boshqarish uchun ruxsat yoq',
      );
    }
  }

  private async resolveScopedStaffId(
    user: RequestUser,
    requestedStaffId?: string,
  ) {
    if (user.role !== UserRole.STAFF) {
      return requestedStaffId;
    }

    const ownStaff = await this.prisma.staffProfile.findFirst({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        status: { not: Status.DELETED },
      },
      select: { id: true },
    });

    if (!ownStaff) {
      throw new BadRequestException('Siz uchun staff profile topilmadi');
    }

    if (requestedStaffId && requestedStaffId !== ownStaff.id) {
      throw new BadRequestException(
        'Faqat ozingizning davomatingizni korishingiz mumkin',
      );
    }

    return ownStaff.id;
  }

  private async findScopedStaffAttendance(id: string, user: RequestUser) {
    const attendance = await this.prisma.staffAttendance.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        ...(user.role === UserRole.SUPER_ADMIN
          ? {}
          : user.role === UserRole.STAFF
            ? {
                staff: {
                  userId: user.id,
                },
              }
            : user.branchId
              ? { branchId: user.branchId }
              : {}),
      },
    });

    if (!attendance) {
      throw new NotFoundException('Staff attendance topilmadi');
    }

    return attendance;
  }

  async create(
    dto: CreateStaffAttendanceDto,
    user: RequestUser,
    request?: Request,
  ) {
    this.ensureManagePermission(user);

    const branchId = this.branchScopeService.ensureBranchForCreate(
      user,
      dto.branchId,
    );
    await this.entityCheckService.ensureBranchExists(branchId, user.organizationId, {
      actor: user,
    });
    await this.entityCheckService.ensureStaffExists(dto.staffId, user.organizationId, {
      actor: user,
      expectedBranchId: branchId,
    });
    const date = this.normalizeDate(dto.date);

    const data = await this.prisma.staffAttendance.upsert({
      where: {
        staffId_date: {
          staffId: dto.staffId,
          date,
        },
      },
      create: {
        organizationId: user.organizationId,
        branchId,
        staffId: dto.staffId,
        date,
        attendanceStatus: dto.attendanceStatus,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : null,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : null,
        note: dto.note ?? null,
        markedById: user.id,
      },
      update: {
        attendanceStatus: dto.attendanceStatus,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : null,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : null,
        note: dto.note ?? null,
        markedById: user.id,
      },
    });

    await this.auditLogService.logAction({
      organizationId: user.organizationId,
      userId: user.id,
      branchId: user.branchId,
      actionType: ActionType.ATTENDANCE_MARK,
      entityType: 'StaffAttendance',
      entityId: data.id,
      description: 'Xodim davomati belgilandi',
      newData: data,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return data;
  }

  async bulkCreate(
    dto: BulkStaffAttendanceDto,
    user: RequestUser,
    request?: Request,
  ) {
    this.ensureManagePermission(user);

    const results: unknown[] = [];
    for (const record of dto.records) {
      const data = await this.create(record, user, request);
      results.push(data);
    }

    return results;
  }

  async findAll(query: StaffAttendanceQueryDto, user: RequestUser) {
    const { page, limit, skip, take } = parsePagination(query);
    const scopedStaffId = await this.resolveScopedStaffId(user, query.staffId);

    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
      ...(user.role === UserRole.SUPER_ADMIN
        ? query.branchId
          ? { branchId: query.branchId }
          : {}
        : user.branchId
          ? { branchId: user.branchId }
          : {}),
      ...(query.includeDeleted ? {} : { status: { not: Status.DELETED } }),
      ...(query.status ? { status: query.status } : {}),
      ...(scopedStaffId ? { staffId: scopedStaffId } : {}),
      ...(query.attendanceStatus
        ? { attendanceStatus: query.attendanceStatus }
        : {}),
      ...(query.date ? { date: this.normalizeDate(query.date) } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.staffAttendance.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                },
              },
            },
          },
          markedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      this.prisma.staffAttendance.count({ where }),
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

  async stats(query: StaffAttendanceQueryDto, user: RequestUser) {
    const scopedStaffId = await this.resolveScopedStaffId(user, query.staffId);

    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
      ...(user.role === UserRole.SUPER_ADMIN
        ? query.branchId
          ? { branchId: query.branchId }
          : {}
        : user.branchId
          ? { branchId: user.branchId }
          : {}),
      status: { not: Status.DELETED },
      ...(scopedStaffId ? { staffId: scopedStaffId } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const grouped = await this.prisma.staffAttendance.groupBy({
      by: ['attendanceStatus'],
      where,
      _count: {
        _all: true,
      },
    });

    const total = grouped.reduce((sum, item) => sum + item._count._all, 0);

    return {
      total,
      breakdown: grouped.map((item) => ({
        status: item.attendanceStatus,
        count: item._count._all,
      })),
    };
  }

  async update(
    id: string,
    dto: UpdateStaffAttendanceDto,
    user: RequestUser,
    request?: Request,
  ) {
    this.ensureManagePermission(user);

    const existing = await this.findScopedStaffAttendance(id, user);
    const nextBranchId =
      dto.branchId !== undefined
        ? this.branchScopeService.resolveBranchId(user, dto.branchId) ??
          existing.branchId
        : existing.branchId;
    const nextStaffId = dto.staffId ?? existing.staffId;
    await this.entityCheckService.ensureStaffExists(
      nextStaffId,
      user.organizationId,
      {
        actor: user,
        expectedBranchId: nextBranchId,
      },
    );

    const payload: Record<string, unknown> = {
      ...(dto.staffId ? { staffId: dto.staffId } : {}),
      ...(dto.attendanceStatus
        ? { attendanceStatus: dto.attendanceStatus }
        : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(dto.date ? { date: this.normalizeDate(dto.date) } : {}),
      ...(dto.checkIn !== undefined
        ? { checkIn: dto.checkIn ? new Date(dto.checkIn) : null }
        : {}),
      ...(dto.checkOut !== undefined
        ? { checkOut: dto.checkOut ? new Date(dto.checkOut) : null }
        : {}),
      branchId: nextBranchId,
      markedById: user.id,
    };

    const data = await this.prisma.staffAttendance.update({
      where: { id },
      data: payload,
    });

    await this.auditLogService.logAction({
      organizationId: user.organizationId,
      userId: user.id,
      branchId: user.branchId,
      actionType: ActionType.UPDATE,
      entityType: 'StaffAttendance',
      entityId: id,
      description: 'Xodim davomati yangilandi',
      oldData: existing,
      newData: data,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return data;
  }

  async softDelete(id: string, user: RequestUser, request?: Request) {
    this.ensureManagePermission(user);

    const existing = await this.findScopedStaffAttendance(id, user);

    const data = await this.prisma.staffAttendance.update({
      where: { id },
      data: {
        status: Status.DELETED,
        deletedAt: new Date(),
      },
    });

    await this.auditLogService.logAction({
      organizationId: user.organizationId,
      userId: user.id,
      branchId: user.branchId,
      actionType: ActionType.DELETE,
      entityType: 'StaffAttendance',
      entityId: id,
      description: 'Xodim davomati ochirildi',
      oldData: existing,
      newData: data,
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'] ?? null,
    });

    return data;
  }
}
