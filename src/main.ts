import * as dotenv from 'dotenv';
// Load environment variables immediately before anything else
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * Shared configuration for both local server and serverless functions
 */
function setupApp(app: INestApplication) {
  app.useGlobalInterceptors(new TransformInterceptor());

  // Security & Optimization
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // Enable CORS for Flutter interaction
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
}

let cachedHandler: any;

async function bootstrap() {
  if (cachedHandler) return cachedHandler;

  const app = await NestFactory.create(AppModule);
  setupApp(app);

  await app.init();
  cachedHandler = app.getHttpAdapter().getInstance();
  return cachedHandler;
}

// Local & Production Server (for Render/Heroku/DigitalOcean)
async function startServer() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const port = process.env.PORT || 3000;
  
  console.log('🔍 ENVIRONMENT CHECK...');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ WARNING: MONGODB_URI is not defined in the environment! Falling back to default.');
  } else {
    console.log(`📡 MONGODB_URI detected (Protocol: ${uri.split(':')[0]})`);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Floq Backend running on port: ${port}`);
}

// Check if we are in a serverless environment (Vercel) or a regular server (Render)
if (process.env.VERCEL) {
  module.exports = async (req: any, res: any) => {
    const handler = await bootstrap();
    handler(req, res);
  };
} else {
  startServer();
}
