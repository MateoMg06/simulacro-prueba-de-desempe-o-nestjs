import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Request } from './request.entity.js';
import { RequestStatus } from './request-status.enum.js';
import { User } from '../../users/dao/user.entity.js';

@Entity('status_history')
export class StatusHistory {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Request, (request) => request.history, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  request: Relation<Request>;
  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status_enum',
  })
  previousStatus: RequestStatus;
  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status_enum',
  })
  newStatus: RequestStatus;
  @ManyToOne(() => User, { nullable: false }) changedBy: Relation<User>;
  @CreateDateColumn({ type: 'timestamptz' }) changedAt: Date;
}
