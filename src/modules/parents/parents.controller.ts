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
import { AssignParentStudentDto } from './dto/assign-parent-student.dto';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { ParentsService } from './parents.service';

const parentMultipartProperties = {
  firstName: { type: 'string', example: 'Otabek' },
  lastName: { type: 'string', example: 'Karimov' },
  phone: { type: 'string', example: '+998901234567' },
  email: { type: 'string', example: 'parent@academy.uz' },
  password: { type: 'string', example: 'Parent123!' },
  occupation: { type: 'string', example: 'Engineer' },
  address: { type: 'string', example: 'Toshkent shahri' },
  branchId: { type: 'string' },
  status: { type: 'string', enum: Object.values(Status) },
  studentIds: { type: 'array', items: { type: 'string' } },
  avatarUrl: { type: 'string', format: 'binary' },
};

@ApiTags('Parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parents')
export class ParentsController {
  constructor(
    private readonly parentsService: ParentsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: parentMultipartProperties,
      required: ['firstName', 'lastName', 'branchId'],
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'Ota-ona yaratish' })
  async create(
    @Body() dto: CreateParentDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/parents',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.parentsService.createParent(dto, user, request);
    return successResponse('Ota-ona yaratildi', data);
  }

  @Get()
  @ApiOperation({ summary: 'Ota-onalar royxati' })
  async findAll(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.parentsService.findParents(query, user);
    return paginatedResponse(result.data, result.meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta ota-ona' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.parentsService.findParent(id, user);
    return successResponse('Ota-ona topildi', data);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: parentMultipartProperties,
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'Ota-onani yangilash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateParentDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/parents',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.parentsService.updateParent(id, dto, user, request);
    return successResponse('Ota-ona yangilandi', data);
  }

  @Patch(':id/delete')
  @ApiOperation({ summary: 'Ota-onani soft delete qilish' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.parentsService.softDeleteParent(id, user, request);
    return successResponse('Ota-ona ochirildi', data);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ota-ona statusi' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.parentsService.changeParentStatus(
      id,
      dto.status,
      user,
      request,
    );
    return successResponse('Status yangilandi', data);
  }

  @Post(':id/assign-student')
  @ApiOperation({ summary: 'Ota-onaga student biriktirish' })
  async assignStudent(
    @Param('id') id: string,
    @Body() dto: AssignParentStudentDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.parentsService.assignStudent(
      id,
      dto,
      user,
      request,
    );
    return successResponse('Student biriktirildi', data);
  }
}
