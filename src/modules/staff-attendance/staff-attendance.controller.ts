import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/role';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/role.guard';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import {
  paginatedResponse,
  successResponse,
} from '../../common/utils/api-response';
import { BulkStaffAttendanceDto } from './dto/bulk-staff-attendance.dto';
import { CreateStaffAttendanceDto } from './dto/create-staff-attendance.dto';
import { StaffAttendanceQueryDto } from './dto/staff-attendance-query.dto';
import { UpdateStaffAttendanceDto } from './dto/update-staff-attendance.dto';
import { StaffAttendanceService } from './staff-attendance.service';

@ApiTags('Staff Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff-attendance')
export class StaffAttendanceController {
  constructor(
    private readonly staffAttendanceService: StaffAttendanceService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Xodim davomati belgilash' })
  async create(
    @Body() dto: CreateStaffAttendanceDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.staffAttendanceService.create(dto, user, request);
    return successResponse('Xodim davomati saqlandi', data);
  }

  @Post('bulk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Xodim davomatini ommaviy saqlash' })
  async bulkCreate(
    @Body() dto: BulkStaffAttendanceDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.staffAttendanceService.bulkCreate(
      dto,
      user,
      request,
    );
    return successResponse('Bulk xodim davomati saqlandi', data);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Xodim davomati royxati' })
  async findAll(
    @Query() query: StaffAttendanceQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.staffAttendanceService.findAll(query, user);
    return paginatedResponse(result.data, result.meta);
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Xodim davomati statistikasi' })
  async stats(
    @Query() query: StaffAttendanceQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.staffAttendanceService.stats(query, user);
    return successResponse('Xodim davomati statistikasi', data);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Xodim davomatini yangilash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffAttendanceDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.staffAttendanceService.update(
      id,
      dto,
      user,
      request,
    );
    return successResponse('Xodim davomati yangilandi', data);
  }

  @Patch(':id/delete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Xodim davomatini soft delete qilish' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.staffAttendanceService.softDelete(
      id,
      user,
      request,
    );
    return successResponse('Xodim davomati ochirildi', data);
  }
}
