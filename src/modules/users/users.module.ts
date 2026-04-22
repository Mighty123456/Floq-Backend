import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../schemas/user.schema';
import { Follower, FollowerSchema } from '../../schemas/follower.schema';
import { Post, PostSchema } from '../../schemas/post.schema';
import { Story, StorySchema } from '../../schemas/story.schema';
import { Message, MessageSchema } from '../../schemas/message.schema';
import { Comment, CommentSchema } from '../../schemas/comment.schema';
import { Notification, NotificationSchema } from '../../schemas/notification.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Follower.name, schema: FollowerSchema },
      { name: Post.name, schema: PostSchema },
      { name: Story.name, schema: StorySchema },
      { name: Message.name, schema: MessageSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    CloudinaryModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
