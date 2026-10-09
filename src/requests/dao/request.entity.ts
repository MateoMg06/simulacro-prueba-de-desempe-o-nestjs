import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/dao/user.entity.js';
import { Client } from '../../clients/dao/client.entity.js';
import { StatusHistory } from './status-history.entity.js';
import { RequestStatus } from './request-status.enum.js';
export { RequestStatus } from './request-status.enum.js';

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'text' }) description: string;
  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status_enum',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;
  @ManyToOne(() => User, (user) => user.requests, { nullable: false })
  advisor: Relation<User>;
  @ManyToOne(() => Client, (client) => client.requests, { nullable: false })
  client: Relation<Client>;
  @OneToMany(() => StatusHistory, (history) => history.request)
  history: Relation<StatusHistory[]>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
