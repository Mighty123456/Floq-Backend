import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from '../../schemas/post.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Types } from 'mongoose';
import 'multer';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createPost(userId: string, caption: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one media file is required to create a post');
    }

    // Upload files to Cloudinary into a user-specific folder!
    const folderName = `floq_posts/user_${userId}`;
    const uploadResults = await this.cloudinaryService.uploadMultipleImages(files, folderName);
    
    const media = uploadResults.map(res => ({
      url: res.secure_url,
      publicId: res.public_id,
    }));

    // Save to Database
    const newPost = new this.postModel({
      user: userId,
      caption: caption || '',
      media,
    });

    const savedPost = await newPost.save();

    // Increment user's post count
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { postsCount: 1 }
    });

    return savedPost.populate('user', 'fullName username avatar');
  }

  async getFeed(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    return this.postModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName username avatar')
      .exec();
  }

  async getUserPosts(userId: string) {
    return this.postModel
      .find({ user: new Types.ObjectId(userId) as any, isActive: true })
      .sort({ createdAt: -1 })
      .populate('user', 'fullName username avatar')
      .exec();
  }
}
