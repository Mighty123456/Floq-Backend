import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { Follower, FollowerSchema } from '../../schemas/follower.schema';
import { User, UserSchema } from '../../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Follower.name, schema: FollowerSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
