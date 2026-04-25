import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';
import { Story } from './story.schema';

export type HighlightDocument = Highlight & Document;

@Schema({ timestamps: true })
export class Highlight {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  coverUrl: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Story' }], default: [] })
  stories: Story[];

  @Prop({ default: true })
  isActive: boolean;
}

export const HighlightSchema = SchemaFactory.createForClass(Highlight);

HighlightSchema.index({ user: 1, createdAt: -1 });
