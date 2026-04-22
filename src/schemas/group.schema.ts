import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ type: Object, default: { url: null, publicId: null } })
  avatar: { url: string; publicId: string };

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  admin: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  members: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

// Index for fast group member search
GroupSchema.index({ members: 1 });
GroupSchema.index({ admin: 1 });
