import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { Follower, FollowerDocument } from '../../schemas/follower.schema';
import { Post, PostDocument } from '../../schemas/post.schema';
import { Story, StoryDocument } from '../../schemas/story.schema';
import { Message, MessageDocument } from '../../schemas/message.schema';
import { Comment, CommentDocument } from '../../schemas/comment.schema';
import { Notification, NotificationDocument } from '../../schemas/notification.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Follower.name) private followerModel: Model<FollowerDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password +refreshTokens');
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber }).select('+password +refreshTokens');
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+refreshTokens +fcmTokens');
  }

  async findPublicProfile(targetId: string, requesterId: string) {
    const user = await this.userModel.findById(targetId)
      .select('fullName username avatar bio website location followersCount followingCount postsCount isPrivate');
    
    if (!user) throw new NotFoundException('User not found');

    const connection = await this.followerModel.findOne({
      follower: new Types.ObjectId(requesterId),
      following: new Types.ObjectId(targetId),
    });

    const userObj = user.toObject();
    return {
      ...userObj,
      relation: connection ? connection.status : 'none',
    };
  }

  async blockUser(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('You cannot block yourself');

    // Add to blocked list
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: new Types.ObjectId(targetId) }
    });

    // Automatically unfollow both ways
    await this.followerModel.deleteMany({
      $or: [
        { follower: new Types.ObjectId(userId), following: new Types.ObjectId(targetId) },
        { follower: new Types.ObjectId(targetId), following: new Types.ObjectId(userId) }
      ]
    });

    // Update counts (optional but accurate)
    await this.userModel.findByIdAndUpdate(userId, { $inc: { followersCount: 0, followingCount: 0 } }); // Real trigger would be more complex

    return { success: true, message: 'User blocked' };
  }

  async unblockUser(userId: string, targetId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { blockedUsers: new Types.ObjectId(targetId) }
    });
    return { success: true, message: 'User unblocked' };
  }

  async searchUsers(query: string, requesterId: string) {
    const requester = await this.userModel.findById(requesterId).select('blockedUsers');
    if (!requester) throw new NotFoundException('Requester not found');
    
    const blockedByOthers = await this.userModel.find({ blockedUsers: new Types.ObjectId(requesterId) }).select('_id');
    const excludeIds = [...(requester.blockedUsers || []), ...blockedByOthers.map(u => u._id), new Types.ObjectId(requesterId)];

    const users = await this.userModel.find({
      $and: [
        { _id: { $nin: excludeIds } },
        { isActive: true },
        {
          $or: [
            { fullName: { $regex: query, $options: 'i' } },
            { username: { $regex: query, $options: 'i' } },
          ],
        },
      ],
    }).select('fullName username avatar bio relation').limit(20);

    return { success: true, data: users };
  }

  async updateAvatar(userId: string, avatarData: { url: string; publicId: string }) {
    return this.userModel.findByIdAndUpdate(userId, { avatar: avatarData }, { new: true });
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel(userData);
    return user.save();
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.userModel.findOne({ username: username.toLowerCase().trim() });
    return !user;
  }

  async update(id: string, updateData: any) {
    // If username is being changed, perform checks
    if (updateData.username) {
      updateData.username = updateData.username.toLowerCase().trim();
      const existing = await this.userModel.findOne({ 
        username: updateData.username, 
        _id: { $ne: new Types.ObjectId(id) } 
      });
      if (existing) throw new ConflictException('Username is already taken');

      const user = await this.userModel.findById(id);
      if (!user) throw new NotFoundException('User not found');

      // Rate limit username changes (e.g., once every 14 days)
      if (user.lastUsernameChange) {
        const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
        if (Date.now() - user.lastUsernameChange.getTime() < fourteenDaysInMs) {
           throw new BadRequestException('You can only change your username once every 14 days');
        }
      }
      updateData.lastUsernameChange = new Date();
    }

    return this.userModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async adminFindAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userModel.find()
        .select('+refreshTokens +fcmTokens')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments()
    ]);

    return {
      success: true,
      data: users,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit)
      }
    };
  }

  async adminUpdateStatus(userId: string, isBanned: boolean, reason?: string) {
    const user = await this.userModel.findByIdAndUpdate(userId, {
      isBanned,
      banReason: reason || '',
      isActive: !isBanned, // Automatically deactivate if banned
      refreshTokens: isBanned ? [] : undefined // Flush tokens if banned
    }, { new: true });

    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: user };
  }

  async findAll(requesterId: string) {
    const users = await this.userModel.find({ 
      _id: { $ne: new Types.ObjectId(requesterId) },
      isActive: true,
    }).select('fullName username avatar bio website followersCount followingCount postsCount');
    
    // Get all connections involving the requester
    const connections = await this.followerModel.find({
      follower: new Types.ObjectId(requesterId)
    });

    const connectionsMap = new Map();
    connections.forEach(c => connectionsMap.set(c.following.toString(), c.status));

    const data = users.map(user => {
      const userObj = user.toObject();
      return {
        ...userObj,
        relation: connectionsMap.get(user._id.toString()) || 'none'
      };
    });
    
    return { success: true, data };
  }

  async getBlockedList(userId: string) {
    const user = await this.userModel.findById(userId).populate('blockedUsers', 'fullName username avatar');
    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: user.blockedUsers };
  }

  async togglePrivacy(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    
    user.isPrivate = !user.isPrivate;
    await user.save();
    
    return { success: true, isPrivate: user.isPrivate };
  }

  async getCloseFriends(userId: string) {
    const user = await this.userModel.findById(userId).populate('closeFriends', 'fullName username avatar');
    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: user.closeFriends };
  }

  async addToCloseFriends(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('You cannot add yourself to close friends');
    const target = await this.userModel.findById(targetId);
    if (!target) throw new NotFoundException('User to add not found');

    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { closeFriends: new Types.ObjectId(targetId) }
    });
    return { success: true, message: 'Added to close friends' };
  }

  async removeFromCloseFriends(userId: string, targetId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { closeFriends: new Types.ObjectId(targetId) }
    });
    return { success: true, message: 'Removed from close friends' };
  }

  async deactivateAccount(userId: string) {
    const user = await this.userModel.findByIdAndUpdate(userId, { 
      isActive: false, 
      refreshTokens: [], 
      fcmTokens: [] 
    });
    if (!user) throw new NotFoundException('User not found');
    return { success: true, message: 'Account deactivated' };
  }

  async deleteAccount(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    
    // 1. Delete basic user record
    const result = await this.userModel.findByIdAndDelete(userId);
    if (!result) throw new NotFoundException('User not found');

    // 2. Cleanup all associated data (Parallel for performance)
    await Promise.all([
      this.postModel.deleteMany({ user: userObjId } as any),
      this.commentModel.deleteMany({ user: userObjId } as any),
      this.storyModel.deleteMany({ user: userObjId } as any),
      this.messageModel.deleteMany({ $or: [{ sender: userObjId }, { receiver: userObjId }] } as any),
      this.notificationModel.deleteMany({ $or: [{ recipient: userObjId }, { sender: userObjId }] } as any),
      this.followerModel.deleteMany({ $or: [{ follower: userObjId }, { following: userObjId }] } as any),
    ]);

    return { success: true, message: 'Account and all data deleted successfully' };
  }
}
