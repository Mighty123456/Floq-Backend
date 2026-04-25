import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notifications.service';
import { NotificationController } from './notifications.controller';
import { NotificationGateway } from './notifications.gateway';
import { Notification, NotificationSchema } from '../../schemas/notification.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema }
    ]),
    AuthModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService],
})
export class NotificationsModule {}
