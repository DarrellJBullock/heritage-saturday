import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertApiKeyConfig } from './common/auth/api-key.middleware';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Before anything listens: refuse to run an unprotected API in production.
  assertApiKeyConfig();

  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());

  // A bare enableCors() allows every origin. Once apps/web proxies API calls through its
  // own server, no browser calls this directly and CORS can be closed entirely. WEB_ORIGIN
  // stays available as an escape hatch (comma-separated) for a browser-facing deployment.
  const origins = process.env.WEB_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors(origins?.length ? { origin: origins } : { origin: false });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Heritage Saturday API listening on port ${port}`);
}
bootstrap();
