import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BusinessesModule } from './businesses/businesses.module';
import { TeamMembersModule } from './team-members/team-members.module';
import { ContactsModule } from './contacts/contacts.module';
import { LeadsModule } from './leads/leads.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { TasksModule } from './tasks/tasks.module';
import { AiModule } from './ai/ai.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CommonModule } from './common/common.module';
import { QueuesModule } from './queues/queues.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL') ?? configService.get<string>('DB_URL'),
        host: configService.get<string>('DATABASE_HOST') ?? configService.get<string>('DB_HOST') ?? 'localhost',
        port:
          Number(configService.get<string>('DATABASE_PORT') ?? configService.get<string>('DB_PORT') ?? 5432) ||
          5432,
        username: configService.get<string>('DATABASE_USER') ?? configService.get<string>('DB_USERNAME') ?? 'postgres',
        password:
          configService.get<string>('DATABASE_PASSWORD') ?? configService.get<string>('DB_PASSWORD') ?? '',
        database: configService.get<string>('DATABASE_NAME') ?? configService.get<string>('DB_NAME') ?? 'leadnix',
        autoLoadEntities: true,
        synchronize: false,
        ssl:
          (configService.get<string>('DATABASE_SSL') ?? configService.get<string>('DB_SSL')) === 'true'
            ? { rejectUnauthorized: false }
            : undefined,
      }),
    }),
    AuthModule,
    UsersModule,
    BusinessesModule,
    TeamMembersModule,
    ContactsModule,
    LeadsModule,
    ConversationsModule,
    MessagesModule,
    TasksModule,
    AiModule,
    IntegrationsModule,
    WebhooksModule,
    CommonModule,
    QueuesModule,
    PublicModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
