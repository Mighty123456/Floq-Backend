import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter: Types.ObjectId;

  @Prop({ 
    required: true, 
    enum: ['user', 'post', 'comment'] 
  })
  targetType: string;

  @Prop({ type: Types.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ 
    required: true,
    enum: ['spam', 'harassment', 'inappropriate', 'hate_speech', 'violence', 'other'] 
  })
  reason: string;

  @Prop({ default: '' })
  details: string;

  @Prop({ default: 'pending', enum: ['pending', 'reviewed', 'resolved', 'dismissed'] })
  status: string;

  @Prop({ default: '' })
  adminNotes: string;

  @Prop({ default: 'none', enum: ['none', 'warned', 'content_removed', 'user_banned'] })
  resolutionAction: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Index for admin dashboard performance
ReportSchema.index({ status: 1, createdAt: -1 });
