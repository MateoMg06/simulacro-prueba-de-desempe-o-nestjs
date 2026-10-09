import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Request } from '../../requests/dao/request.entity.js';

export type UserRole = 'admin' | 'supervisor' | 'advisor';
@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 50 }) id: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 180, unique: true }) email: string;
  @Column({ type: 'varchar', length: 20 }) role: UserRole;
  @Column({ default: true }) active: boolean;
  @OneToMany(() => Request, (request) => request.advisor) requests: Relation<
    Request[]
  >;
}
