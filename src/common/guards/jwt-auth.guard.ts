import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Status, UserRole } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtUtilsService } from '../utils/jwt.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtUtilsService: JwtUtilsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader) {
      throw new UnauthorizedException('Token topilmadi');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token formati notogri');
    }

    const token = authHeader.split(' ')[1];
    const payload = this.jwtUtilsService.verifyToken(token);

    if (!payload?.sub) {
      throw new UnauthorizedException('Token yaroqsiz');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    if (user.status !== Status.ACTIVE) {
      throw new UnauthorizedException('Foydalanuvchi faol emas');
    }

    const branchHeader = request.headers['x-branch-id'];
    const requestedBranchId =
      typeof branchHeader === 'string'
        ? branchHeader.trim()
        : Array.isArray(branchHeader)
          ? branchHeader[0]?.trim()
          : '';

    request.user = {
      ...user,
      branchId:
        user.role === UserRole.SUPER_ADMIN && requestedBranchId
          ? requestedBranchId
          : user.branchId,
    };
    return true;
  }
}

export const AuthGuard = JwtAuthGuard;
