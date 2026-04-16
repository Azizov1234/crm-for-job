import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Status } from '@prisma/client';
import type { Request } from 'express';
import { BaseQueryDto } from '../../common/dto/base-query.dto';
import { ChangeStatusDto } from '../../common/dto/change-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  MAX_IMAGE_SIZE,
  validateImage,
} from '../../common/functions/check.file';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { CloudinaryService } from '../../common/uploads/cloudinary.service';
import {
  paginatedResponse,
  successResponse,
} from '../../common/utils/api-response';
import { AdminsService } from './admins.service';
import { AttachExistingUserDto } from './dto/attach-existing-user.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminRoleDto } from './dto/update-admin-role.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

const adminMultipartProperties = {
  firstName: { type: 'string', example: 'Ali' },
  lastName: { type: 'string', example: 'Valiyev' },
  phone: { type: 'string', example: '+998901234567' },
  email: { type: 'string', example: 'admin@academy.uz' },
  password: { type: 'string', example: 'Admin123!' },
  notes: { type: 'string', example: 'Main branch admin' },
  branchId: { type: 'string' },
  status: { type: 'string', enum: Object.values(Status) },
  avatarUrl: { type: 'string', format: 'binary' },
};

@ApiTags('Admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admins')
export class AdminsController {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: adminMultipartProperties,
      required: ['firstName', 'lastName', 'branchId'],
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'Admin yaratish' })
  async create(
    @Body() dto: CreateAdminDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/admins',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.adminsService.createAdmin(dto, user, request);
    return successResponse('Admin yaratildi', data);
  }

  @Get()
  @ApiOperation({ summary: 'Adminlar royxati' })
  async findAll(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.adminsService.findAdmins(query, user);
    return paginatedResponse(result.data, result.meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta admin' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.adminsService.findAdmin(id, user);
    return successResponse('Admin topildi', data);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: adminMultipartProperties,
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'Adminni yangilash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/admins',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.adminsService.updateAdmin(id, dto, user, request);
    return successResponse('Admin yangilandi', data);
  }

  @Patch(':id/delete')
  @ApiOperation({ summary: 'Adminni soft delete qilish' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.adminsService.deleteAdmin(id, user, request);
    return successResponse('Admin ochirildi', data);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Admin rolini yangilash' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateAdminRoleDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.adminsService.updateRole(id, dto, user, request);
    return successResponse('Role yangilandi', data);
  }

  @Post('attach-existing-user')
  @ApiOperation({ summary: 'Mavjud userni adminga biriktirish' })
  async attachExisting(
    @Body() dto: AttachExistingUserDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.adminsService.attachExistingUser(
      dto,
      user,
      request,
    );
    return successResponse('User adminga biriktirildi', data);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Admin statusini ozgartirish' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.adminsService.changeStatus(
      id,
      dto.status,
      user,
      request,
    );
    return successResponse('Status yangilandi', data);
  }
}
