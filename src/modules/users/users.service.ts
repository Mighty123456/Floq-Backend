import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { Follower, FollowerDocument } from '../../schemas/follower.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Follower.name) private followerModel: Model<FollowerDocument>,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password +refreshTokens');
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+refreshTokens');
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel(userData);
    return user.save();
  }

  async update(id: string, updateData: any) {
    return this.userModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async findAll(requesterId: string) {
    const users = await this.userModel.find({ 
      _id: { $ne: new Types.ObjectId(requesterId) },
      isActive: true,
    }).select('fullName username avatar followersCount followingCount postsCount');
    
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
}
