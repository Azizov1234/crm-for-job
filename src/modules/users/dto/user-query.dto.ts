import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';

export const USER_ROLE_QUERY_VALUES = [
  ...Object.values(UserRole),
  'MENTOR',
] as const;
export type UserRoleQuery = UserRole | 'MENTOR';

export class UserQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    enum: USER_ROLE_QUERY_VALUES,
    description:
      "Role bo'yicha filter. `MENTOR` yuborilsa `TEACHER` sifatida ishlatiladi.",
    example: UserRole.ADMIN,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : undefined,
  )
  @IsEnum(USER_ROLE_QUERY_VALUES)
  role?: UserRoleQuery;
}
