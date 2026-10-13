import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Request } from './request.entity.js';
import { HistoryEventType } from './history-event-type.enum.js';
import { User } from '../../users/dao/user.entity.js';

// Audit event of a request (spec name: SolicitudHistorial). Read-only for API consumers.
@Entity('request_history')
export class RequestHistory {
  @PrimaryGeneratedColumn() id: number;
  @Index()
  @Column({ type: 'int' })
  requestId: number;
  @ManyToOne(() => Request, (request) => request.history, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requestId' })
  request: Relation<Request>;
  @Column({
    type: 'enum',
    enum: HistoryEventType,
    enumName: 'history_event_type_enum',
  })
  eventType: HistoryEventType;
  @Column({ type: 'varchar', length: 50, nullable: true })
  previousValue: string | null;
  @Column({ type: 'varchar', length: 50 }) newValue: string;
  @ManyToOne(() => User, { nullable: false }) actor: Relation<User>;
  @CreateDateColumn({ type: 'timestamptz' }) eventDate: Date;
}
