import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { StoriesModule } from './modules/stories/stories.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 120,
    }]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', 
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI') || 
                   'mongodb://ansh132002:piaMEdyq40de4Gtk@alphacluster-shard-00-00.h1fav.mongodb.net:27017,alphacluster-shard-00-01.h1fav.mongodb.net:27017,alphacluster-shard-00-02.h1fav.mongodb.net:27017/Floq?ssl=true&authSource=admin&retryWrites=true&w=majority';
        
        console.log(`📡 Connecting to MongoDB... (Mode: ${configService.get('MONGODB_URI') ? 'ENV' : 'HARDCODED_FALLBACK'})`);
        
        return {
          uri: uri,
          connectTimeoutMS: 20000,
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
    StoriesModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
