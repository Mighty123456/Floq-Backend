import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MailModule } from './modules/mail/mail.module';
import { RedisModule } from './modules/redis/redis.module';
import { PostsModule } from './modules/posts/posts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // In production/Vercel, ConfigModule will ignore envFilePath and use system environment
      envFilePath: '.env', 
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        
        if (!uri) {
          // If no URI is provided, we fail explicitly with a clear message
          // This prevents falling back to localhost 27017 which always fails in Vercel/Render
          console.error('❌ MONGODB_URI is missing from ConfigService!');
          throw new Error('MONGODB_URI is not defined. Please set it in your environment variables.');
        }

        return {
          uri: uri,
          // Added connection options for better stability with Atlas
          connectTimeoutMS: 15000,
          socketTimeoutMS: 45000,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    MailModule,
    RedisModule,
    PostsModule,
    NotificationsModule,
    ConnectionsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
