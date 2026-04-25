import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ required: true, trim: true })
  caption: string;

  @Prop({ type: [{ url: String, publicId: String }], required: true })
  media: { url: string; publicId: string }[];

  @Prop({ default: 0 })
  likesCount: number;

  @Prop({ default: 0 })
  commentsCount: number;

  @Prop({ default: 0 })
  viewsCount: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  uniqueViews: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  taggedUsers: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Post', default: null })
  repostOf: Types.ObjectId;

  @Prop({ default: 0 })
  repostsCount: number;

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop({ type: String, enum: ['post', 'story', 'reel'], default: 'post' })
  type: string;

  @Prop({ type: String, default: null })
  audioUrl: string;

  @Prop({ type: String, default: null })
  audioName: string;

  @Prop({ type: Object, default: null })
  location: { name: string; lat: number; lng: number };

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>; // For Polls, Prompts, etc.

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPinned: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Indexes to speed up feed queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ user: 1, createdAt: -1 });
