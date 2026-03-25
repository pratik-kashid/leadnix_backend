import { BeforeInsert, Column, Entity, OneToMany, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { randomBytes } from 'crypto';
import { TeamMember } from '../../team-members/entities/team-member.entity';

@Entity({ name: 'businesses' })
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  industry: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  timezone: string | null;

  @Column({ type: 'varchar', length: 128, unique: true, nullable: true })
  publicLeadToken: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => TeamMember, (teamMember) => teamMember.business)
  teamMembers: TeamMember[];

  @BeforeInsert()
  ensurePublicLeadToken() {
    if (!this.publicLeadToken) {
      this.publicLeadToken = randomBytes(24).toString('hex');
    }
  }
}
