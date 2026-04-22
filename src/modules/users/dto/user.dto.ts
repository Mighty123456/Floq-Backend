import { IsString, IsOptional, MaxLength, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UserSettingsDto {
  @IsBoolean()
  @IsOptional()
  isDarkTheme?: boolean;

  @IsBoolean()
  @IsOptional()
  isNotificationsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  showOnlineStatus?: boolean;

  @IsBoolean()
  @IsOptional()
  allowFriendRequests?: boolean;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(60)
  fullName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  username?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  bio?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  location?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserSettingsDto)
  settings?: UserSettingsDto;
}
