import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoriesService } from './stories.service';
import { StoriesController } from './stories.controller';
import { Story, StorySchema } from '../../schemas/story.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ConnectionsModule } from '../connections/connections.module';

import { ChatModule } from '../chat/chat.module';
import { Highlight, HighlightSchema } from '../../schemas/highlight.schema';
import { HighlightsController } from './highlights.controller';
import { HighlightsService } from './highlights.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: User.name, schema: UserSchema },
      { name: Highlight.name, schema: HighlightSchema },
    ]),
    CloudinaryModule,
    ConnectionsModule,
    ChatModule,
  ],
  controllers: [StoriesController, HighlightsController],
  providers: [StoriesService, HighlightsService],
})
export class StoriesModule {}
