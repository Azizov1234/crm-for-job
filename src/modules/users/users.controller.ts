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
import { Status, UserRole } from '@prisma/client';
import type { Request } from 'express';
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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

const userMultipartProperties = {
  firstName: { type: 'string', example: 'John' },
  lastName: { type: 'string', example: 'Doe' },
  phone: { type: 'string', example: '+998901234567' },
  email: { type: 'string', example: 'john.doe@academy.uz' },
  password: { type: 'string', example: 'Secret123!' },
  role: {
    type: 'string',
    enum: Object.values(UserRole),
  },
  status: {
    type: 'string',
    enum: Object.values(Status),
  },
  branchId: { type: 'string' },
  avatarUrl: { type: 'string', format: 'binary' },
};

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: userMultipartProperties,
      required: ['firstName', 'lastName', 'password', 'role'],
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'User yaratish' })
  async create(
    @Body() dto: CreateUserDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/users',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.usersService.createUser(dto, user, request);
    return successResponse('User yaratildi', data);
  }

  @Get()
  @ApiOperation({ summary: 'Userlar royxati' })
  async findAll(
    @Query() query: UserQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.usersService.findUsers(query, user);
    return paginatedResponse(result.data, result.meta);
  }

  @Get('select-options')
  @ApiOperation({ summary: 'Select optionlar' })
  async selectOptions(
    @CurrentUser() user: RequestUser,
    @Query('branchId') branchId?: string,
  ) {
    const data = await this.usersService.selectOptions(user, branchId);
    return successResponse('Select optionlar', data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta user' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.usersService.findUser(id, user);
    return successResponse('User topildi', data);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: userMultipartProperties,
    },
  })
  @UseInterceptors(
    FileInterceptor('avatarUrl', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  @ApiOperation({ summary: 'User yangilash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @UploadedFile() avatarFile: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    if (avatarFile) {
      validateImage(avatarFile);
      const uploaded = await this.cloudinaryService.uploadFile(avatarFile, {
        resource_type: 'image',
        folder: 'academy/users',
      });
      dto.avatarUrl = uploaded.secure_url;
    }

    const data = await this.usersService.updateUser(id, dto, user, request);
    return successResponse('User yangilandi', data);
  }

  @Patch(':id/delete')
  @ApiOperation({ summary: 'User soft delete' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.usersService.softDeleteUser(id, user, request);
    return successResponse('User ochirildi', data);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'User status ozgartirish' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const data = await this.usersService.changeUserStatus(
      id,
      dto.status,
      user,
      request,
    );
    return successResponse('Status ozgartirildi', data);
  }
}
