import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  username: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email: string;

  @Prop({ unique: true, sparse: true, trim: true })
  phoneNumber?: string;

  @Prop({ default: false })
  isPhoneVerified: boolean;

  @Prop({ select: false })
  password?: string;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop({ default: 'user', enum: ['user', 'admin', 'moderator'] })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: [], select: false })
  refreshTokens: string[];

  @Prop({ type: Object, default: { url: null, publicId: null } })
  avatar: { url: string; publicId: string };

  @Prop({ default: 0 })
  followersCount: number;

  @Prop({ default: 0 })
  followingCount: number;

  @Prop({ default: 0 })
  postsCount: number;

  @Prop()
  passwordChangedAt?: Date;

  @Prop({ default: Date.now })
  lastSeenAt: Date;

  @Prop({ default: [], type: [String] })
  fcmTokens: string[];

  @Prop({ type: [{ type: 'ObjectId', ref: 'Post' }], default: [] })
  savedPosts: Types.ObjectId[];

  @Prop({ type: [{ type: 'ObjectId', ref: 'User' }], default: [] })
  blockedUsers: Types.ObjectId[];

  @Prop({ type: [{ type: 'ObjectId', ref: 'User' }], default: [] })
  spammedUsers: Types.ObjectId[];


  @Prop({ default: false })
  isBanned: boolean;

  @Prop({ default: '', trim: true })
  banReason: string;

  @Prop({ default: Date.now })
  lastUsernameChange: Date;

  @Prop({ default: '', trim: true })
  bio: string;

  @Prop({ default: '', trim: true })
  website: string;

  @Prop({ default: '', trim: true })
  location: string;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({
    type: Object,
    default: {
      isDarkTheme: true,
      isNotificationsEnabled: true,
      showOnlineStatus: true,
      allowFriendRequests: true,
    },
  })
  settings: {
    isDarkTheme: boolean;
    isNotificationsEnabled: boolean;
    showOnlineStatus: boolean;
    allowFriendRequests: boolean;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});
