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
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeachersService } from './teachers.service';

const teacherMultipartProperties = {
  firstName: { type: 'string', example: 'Sardor' },
  lastName: { type: 'string', example: 'Qodirov' },
  phone: { type: 'string', example: '+998901234567' },
  email: { type: 'string', example: 'teacher@academy.uz' },
  password: { type: 'string', example: 'Teacher123!' },
  specialty: { type: 'string', example: 'Matematika' },
  salary: { type: 'number', example: 5000000 },
  hiredAt: { type: 'string', format: 'date-time' },
  bio: { type: 'string', example: 'Senior mentor' },
  branchId: { type: 'string' },
  status: { type: 'string', enum: Object.values(Status) },
  avatarUrl: { type: 'string', format: 'binary' },
};

@ApiTags('Teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('teachers')
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: teacherMultipartProperties,
      required: ['firstName', 'lastName', 'branchId'],
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'Oqituvchi yaratish' })
  async create(
    @Body() dto: CreateTeacherDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/teachers',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.teachersService.createTeacher(dto, user, request);
    return successResponse('Oqituvchi yaratildi', data);
  }

  @Get()
  @ApiOperation({ summary: 'Oqituvchilar royxati' })
  async findAll(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.teachersService.findTeachers(query, user);
    return paginatedResponse(result.data, result.meta);
  }

  @Get('select-options')
  @ApiOperation({ summary: 'Select optionlar' })
  async selectOptions(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.teachersService.selectOptions(user, branchId);
    return successResponse('Select optionlar', data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta oqituvchi' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.teachersService.findTeacher(id, user);
    return successResponse('Oqituvchi topildi', data);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: teacherMultipartProperties,
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'Oqituvchini yangilash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/teachers',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.teachersService.updateTeacher(
      id,
      dto,
      user,
      request,
    );
    return successResponse('Oqituvchi yangilandi', data);
  }

  @Patch(':id/delete')
  @ApiOperation({ summary: 'Oqituvchini ochirish (soft delete)' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.teachersService.softDeleteTeacher(
      id,
      user,
      request,
    );
    return successResponse('Oqituvchi ochirildi', data);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Oqituvchi statusini ozgartirish' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.teachersService.changeTeacherStatus(
      id,
      dto.status,
      user,
      request,
    );
    return successResponse('Status yangilandi', data);
  }
}
