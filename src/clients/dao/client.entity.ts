import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Request } from '../../requests/dao/request.entity.js';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'varchar', length: 180, nullable: true }) email:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  document: string | null;
  @OneToMany(() => Request, (request) => request.client) requests: Relation<
    Request[]
  >;
}
