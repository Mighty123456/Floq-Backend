import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Follower, FollowerDocument } from '../../schemas/follower.schema';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class ConnectionsService {
  constructor(
    @InjectModel(Follower.name) private followerModel: Model<FollowerDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const targetUser = await this.userModel.findById(followingId);
    if (!targetUser) {
      throw new NotFoundException('User to follow not found');
    }

    // Check if relationship already exists
    const existingFollow = await this.followerModel.findOne({
      follower: new Types.ObjectId(followerId),
      following: new Types.ObjectId(followingId),
    });

    if (existingFollow) {
      throw new BadRequestException('Relationship already exists');
    }

    // Create follow record as pending
    await new this.followerModel({
      follower: new Types.ObjectId(followerId),
      following: new Types.ObjectId(followingId),
      status: 'pending',
    }).save();

    return { success: true, message: 'Follow request sent' };
  }

  async acceptUser(followingId: string, followerId: string) {
    const follow = await this.followerModel.findOneAndUpdate(
      {
        follower: new Types.ObjectId(followerId),
        following: new Types.ObjectId(followingId),
        status: 'pending',
      },
      { status: 'accepted' },
      { new: true },
    );

    if (!follow) {
      throw new BadRequestException('No pending request found');
    }

    // Update counts only when accepted
    await this.userModel.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
    await this.userModel.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });

    return { success: true };
  }

  async declineUser(followingId: string, followerId: string) {
    const result = await this.followerModel.findOneAndDelete({
      follower: new Types.ObjectId(followerId),
      following: new Types.ObjectId(followingId),
      status: 'pending',
    });

    if (!result) {
      throw new BadRequestException('No pending request found');
    }

    return { success: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    const deletedFollow = await this.followerModel.findOneAndDelete({
      follower: new Types.ObjectId(followerId),
      following: new Types.ObjectId(followingId),
    });

    if (!deletedFollow) {
      throw new BadRequestException('You are not following this user');
    }

    // Decrement counts only if it was accepted
    if (deletedFollow.status === 'accepted') {
      await this.userModel.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
      await this.userModel.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } });
    }

    return { success: true };
  }

  async getFollowingIds(userId: string): Promise<Types.ObjectId[]> {
    const following = await this.followerModel.find({ 
      follower: new Types.ObjectId(userId),
      status: 'accepted'
    }).select('following');
    return following.map(f => f.following);
  }

  async getPendingRequests(userId: string) {
    const requests = await this.followerModel
      .find({ following: new Types.ObjectId(userId), status: 'pending' })
      .populate('follower', 'fullName username avatar')
      .exec();
    
    return { success: true, data: requests.map(r => r.follower) };
  }

  async getFollowers(userId: string) {
    const followers = await this.followerModel
      .find({ following: new Types.ObjectId(userId) })
      .populate('follower', 'fullName username avatar followersCount followingCount postsCount')
      .exec();
    
    return { success: true, data: followers.map(f => f.follower) };
  }

  async getFollowing(userId: string) {
    const following = await this.followerModel
      .find({ follower: new Types.ObjectId(userId) })
      .populate('following', 'fullName username avatar followersCount followingCount postsCount')
      .exec();
    
    return { success: true, data: following.map(f => f.following) };
  }
}
