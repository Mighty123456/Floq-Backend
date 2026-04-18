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

    // Check if already following
    const existingFollow = await this.followerModel.findOne({
      follower: new Types.ObjectId(followerId),
      following: new Types.ObjectId(followingId),
    });

    if (existingFollow) {
      throw new BadRequestException('You are already following this user');
    }

    // Create follow record
    await new this.followerModel({
      follower: new Types.ObjectId(followerId),
      following: new Types.ObjectId(followingId),
    }).save();

    // Increment counts
    await this.userModel.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
    await this.userModel.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });

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

    // Decrement counts
    await this.userModel.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
    await this.userModel.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } });

    return { success: true };
  }

  async getFollowingIds(userId: string): Promise<Types.ObjectId[]> {
    const following = await this.followerModel.find({ follower: new Types.ObjectId(userId) }).select('following');
    return following.map(f => f.following);
  }
}
