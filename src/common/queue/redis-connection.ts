import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export function isRedisConfigured(configService: ConfigService): boolean {
  return configService.get<string>('REDIS_ENABLED') === 'true';
}

export function createRedisConnectionOptions(configService: ConfigService): RedisOptions {
  const url = configService.get<string>('REDIS_URL');
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379) || 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db: Number(parsed.pathname.replace('/', '') || 0) || 0,
    };
  }

  return {
    host: configService.get<string>('REDIS_HOST') ?? '127.0.0.1',
    port: Number(configService.get<string>('REDIS_PORT') ?? 6379) || 6379,
    password: configService.get<string>('REDIS_PASSWORD') ?? undefined,
    db: Number(configService.get<string>('REDIS_DB') ?? 0) || 0,
  };
}
