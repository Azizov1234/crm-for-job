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
import { Gender, Status } from '@prisma/client';
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
import { AssignStudentGroupsDto } from './dto/assign-student-groups.dto';
import { AssignStudentParentsDto } from './dto/assign-student-parents.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

const studentMultipartProperties = {
  firstName: { type: 'string', example: 'Aziz' },
  lastName: { type: 'string', example: 'Karimov' },
  phone: { type: 'string', example: '+998901234567' },
  email: { type: 'string', example: 'student@academy.uz' },
  password: { type: 'string', example: 'Student123!' },
  studentNo: { type: 'string', example: 'ST-1001' },
  birthDate: { type: 'string', format: 'date-time' },
  gender: { type: 'string', enum: Object.values(Gender) },
  joinedAt: { type: 'string', format: 'date-time' },
  address: { type: 'string', example: 'Toshkent sh.' },
  branchId: { type: 'string' },
  status: { type: 'string', enum: Object.values(Status) },
  parentIds: { type: 'array', items: { type: 'string' } },
  groupIds: { type: 'array', items: { type: 'string' } },
  avatarUrl: { type: 'string', format: 'binary' },
};

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: studentMultipartProperties,
      required: ['firstName', 'lastName', 'branchId'],
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'Oquvchi yaratish' })
  async create(
    @Body() dto: CreateStudentDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/students',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.studentsService.createStudent(dto, user, request);
    return successResponse('Oquvchi yaratildi', data);
  }

  @Get()
  @ApiOperation({ summary: 'Oquvchilar royxati' })
  async findAll(
    @Query() query: BaseQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.studentsService.findStudents(query, user);
    return paginatedResponse(result.data, result.meta);
  }

  @Get('select-options')
  @ApiOperation({ summary: 'Select optionlar' })
  async selectOptions(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.studentsService.selectOptions(user, branchId);
    return successResponse('Select optionlar', data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta oquvchi' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.studentsService.findStudent(id, user);
    return successResponse('Oquvchi topildi', data);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: studentMultipartProperties,
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'Oquvchini yangilash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/students',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.studentsService.updateStudent(
      id,
      dto,
      user,
      request,
    );
    return successResponse('Oquvchi yangilandi', data);
  }

  @Patch(':id/delete')
  @ApiOperation({ summary: 'Oquvchini soft delete qilish' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.studentsService.softDeleteStudent(
      id,
      user,
      request,
    );
    return successResponse('Oquvchi ochirildi', data);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Oquvchi statusini ozgartirish' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.studentsService.changeStudentStatus(
      id,
      dto.status,
      user,
      request,
    );
    return successResponse('Oquvchi statusi yangilandi', data);
  }

  @Post(':id/assign-parent')
  @ApiOperation({ summary: 'Oquvchiga ota-ona biriktirish' })
  async assignParent(
    @Param('id') id: string,
    @Body() dto: AssignStudentParentsDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.studentsService.assignParents(
      id,
      dto,
      user,
      request,
    );
    return successResponse('Ota-onalar biriktirildi', data);
  }

  @Post(':id/assign-groups')
  @ApiOperation({ summary: 'Oquvchini guruhlarga biriktirish' })
  async assignGroups(
    @Param('id') id: string,
    @Body() dto: AssignStudentGroupsDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.studentsService.assignGroups(
      id,
      dto,
      user,
      request,
    );
    return successResponse('Guruhlar biriktirildi', data);
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'Oquvchi tolovlari' })
  async payments(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.studentsService.getStudentPayments(id, user);
    return successResponse('Tolovlar', data);
  }

  @Get(':id/attendance')
  @ApiOperation({ summary: 'Oquvchi davomatlari' })
  async attendance(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.studentsService.getStudentAttendance(id, user);
    return successResponse('Davomatlar', data);
  }

  @Get(':id/ratings')
  @ApiOperation({ summary: 'Oquvchi reytinglari' })
  async ratings(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.studentsService.getStudentRatings(id, user);
    return successResponse('Reytinglar', data);
  }
}
