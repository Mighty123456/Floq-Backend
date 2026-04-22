import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['like', 'comment', 'follow_request', 'follow_accept', 'mention']
  })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'Post' })
  post?: Types.ObjectId;

  @Prop({ default: '' })
  content: string;

  @Prop({ default: false })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index for fast retrieval for a specific user
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// Auto-delete after 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
