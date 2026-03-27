import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { SmtpEmailService } from './smtp-email.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EmailService,
      useClass: SmtpEmailService,
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
