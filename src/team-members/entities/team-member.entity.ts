import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, JoinColumn, Unique } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';

@Entity({ name: 'team_members' })
@Unique('UQ_team_members_user_business', ['userId', 'businessId'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.teamMembers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Business, (business) => business.teamMembers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;
}
