import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class BranchScopeService {
  resolveBranchId(user: RequestUser, branchId?: string): string | undefined {
    if (user.role === 'SUPER_ADMIN') {
      return branchId ?? user.branchId ?? undefined;
    }

    if (!user.branchId) {
      throw new ForbiddenException('Sizga filial biriktirilmagan');
    }

    if (branchId && branchId !== user.branchId) {
      throw new ForbiddenException('Boshqa filialga ruxsat yoq');
    }

    return user.branchId;
  }

  ensureBranchForCreate(user: RequestUser, branchId?: string): string {
    const resolved = this.resolveBranchId(user, branchId);
    if (!resolved) {
      throw new BadRequestException('branchId majburiy');
    }

    return resolved;
  }
}
