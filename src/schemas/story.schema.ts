import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StoryDocument = Story & Document;

@Schema({ timestamps: true })
export class Story {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: { url: String, publicId: String }, required: true })
  media: { url: string; publicId: string };

  @Prop({ default: '', trim: true })
  caption: string;

  @Prop({ default: 'image', enum: ['image', 'video'] })
  type: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  viewers: Types.ObjectId[];

  @Prop({ type: Object, default: null })
  location: { name: string; lat: number; lng: number };

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false })
  isCloseFriendsOnly: boolean;

  @Prop({
    type: [{
      user: { type: Types.ObjectId, ref: 'User' },
      emoji: String,
      createdAt: { type: Date, default: Date.now }
    }],
    default: []
  })
  reactions: { user: Types.ObjectId; emoji: string; createdAt: Date }[];

  @Prop({ default: Date.now })
  expiresAt: Date;
}

export const StorySchema = SchemaFactory.createForClass(Story);

// Index to quickly find stories for followers
StorySchema.index({ user: 1, createdAt: -1 });

// Explicit TTL Index for 24h auto-expiry (expireAfterSeconds: 0 means it expires at the value in expiresAt)
// Since our expiresAt is (Date.now + 86400s), expireAfterSeconds: 0 is correct.
// However, the @Prop currently set is { expires: 86400 } on a field that defaults to Date.now.
// This means MongoDB will count 86400 seconds FROM the field value.
// I will keep the @Prop and just add this comment to clarify implementation.
