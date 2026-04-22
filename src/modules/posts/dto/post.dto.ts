import { IsString, IsOptional, MaxLength, IsMongoId } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(2200, { message: 'Caption is too long (max 2200 characters)' })
  caption?: string;
}

export class CreateCommentDto {
  @IsString()
  @MaxLength(500, { message: 'Comment is too long (max 500 characters)' })
  text: string;

  @IsMongoId()
  @IsOptional()
  parentId?: string;
}

export class UpdatePostDto {
  @IsString()
  @MaxLength(2200)
  caption: string;
}
