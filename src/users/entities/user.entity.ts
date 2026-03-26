import { Column, Entity, OneToMany, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TeamMember } from '../../team-members/entities/team-member.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  profilePhotoUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordResetTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  passwordResetExpiresAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordResetOtpHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  passwordResetOtpExpiresAt: Date | null;

  @Column({ type: 'int', default: 0 })
  passwordResetOtpAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  passwordResetOtpSentAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => TeamMember, (teamMember) => teamMember.user)
  teamMembers: TeamMember[];
}
