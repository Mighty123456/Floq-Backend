import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' })
  receiver?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  group?: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 'text', enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'poll', 'event', 'ai'] })
  type: string;
  
  @Prop({ default: false })
  isDelivered: boolean;

  @Prop()
  deliveredAt?: Date;

  @Prop({ type: { url: String, publicId: String } })
  media?: { url: string; publicId: string };

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop()
  editedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Index for fast conversation retrieval
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });
