import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/dao/user.entity.js';
@Injectable()
export class UserGuard implements CanActivate {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const id = request.headers['x-user'];
    if (typeof id !== 'string')
      throw new UnauthorizedException('Missing or unknown user');
    const user = await this.users.findOne({ where: { id, active: true } });
    if (!user) throw new UnauthorizedException('Missing or unknown user');
    request.user = user;
    return true;
  }
}
