import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, IsMongoId } from 'class-validator';

export enum ReportTargetType {
  POST = 'post',
  USER = 'user',
  COMMENT = 'comment',
}

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  NUDITY = 'nudity',
  MISINFORMATION = 'misinformation',
  INAPPROPRIATE = 'inappropriate',
  OTHER = 'other',
}

export class CreateReportDto {
  @IsEnum(ReportTargetType, { message: 'Invalid target type' })
  @IsNotEmpty()
  targetType: ReportTargetType;

  @IsMongoId()
  @IsNotEmpty()
  targetId: string;

  @IsEnum(ReportReason, { message: 'Invalid report reason' })
  @IsNotEmpty()
  reason: ReportReason;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  details?: string;
}
