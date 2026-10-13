import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/dao/user.entity.js';
import { Client } from '../../clients/dao/client.entity.js';
import { RequestHistory } from './request-history.entity.js';
import { RequestStatus } from './request-status.enum.js';
export { RequestStatus } from './request-status.enum.js';

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'text' }) description: string;
  @Index()
  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status_enum',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;
  // Null while an admin/supervisor request has not been assigned yet.
  @Index()
  @ManyToOne(() => User, (user) => user.requests, { nullable: true })
  advisor: Relation<User> | null;
  @ManyToOne(() => Client, (client) => client.requests, { nullable: false })
  client: Relation<Client>;
  @OneToMany(() => RequestHistory, (history) => history.request)
  history: Relation<RequestHistory[]>;
  // Optimistic concurrency: increased on every change of the request.
  @Column({ type: 'int', default: 1 }) version: number;
  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
