import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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

  async findAll(excludeUserId: string) {
    const users = await this.userModel.find({ 
      _id: { $ne: new Types.ObjectId(excludeUserId) },
      isActive: true,
    }).select('fullName username avatar followersCount followingCount postsCount');
    
    return { success: true, data: users };
  }
}
