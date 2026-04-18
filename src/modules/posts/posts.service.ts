import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostSchema, PostDocument } from '../../schemas/post.schema';
import { User, UserSchema, UserDocument } from '../../schemas/user.schema';
import { Comment, CommentDocument } from '../../schemas/comment.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ConnectionsService } from '../connections/connections.service';
import { Types } from 'mongoose';
import 'multer';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private cloudinaryService: CloudinaryService,
    private connectionsService: ConnectionsService,
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

  async getFeed(requesterId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    // Get the list of people the requester follows
    const followingIds = await this.connectionsService.getFollowingIds(requesterId);
    
    // Filter posts from following users + own posts
    const query = {
      user: { $in: [...followingIds, new Types.ObjectId(requesterId)] },
      isActive: true,
    };

    const posts = await this.postModel
      .find(query as any)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName username avatar')
      .lean()
      .exec();
    
    return posts.map(post => ({
      ...post,
      isLiked: post.likes ? post.likes.some(id => id.toString() === requesterId) : false,
    }));
  }

  async getUserPosts(userId: string) {
    return this.postModel
      .find({ user: new Types.ObjectId(userId) as any, isActive: true })
      .sort({ createdAt: -1 })
      .populate('user', 'fullName username avatar')
      .exec();
  }

  async toggleLike(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    const userIdObj = new Types.ObjectId(userId);
    const hasLiked = post.likes.some(id => id.toString() === userId);

    if (hasLiked) {
      // Unlike
      await this.postModel.findByIdAndUpdate(postId, {
        $pull: { likes: userIdObj },
        $inc: { likesCount: -1 }
      });
      return { success: true, liked: false };
    } else {
      // Like
      await this.postModel.findByIdAndUpdate(postId, {
        $addToSet: { likes: userIdObj },
        $inc: { likesCount: 1 }
      });
      return { success: true, liked: true };
    }
  }

  async addComment(postId: string, userId: string, text: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    const comment = new this.commentModel({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(userId),
      text,
    });

    await comment.save();

    // Increment count on post
    await this.postModel.findByIdAndUpdate(postId, {
      $inc: { commentsCount: 1 }
    });

    return comment.populate('user', 'fullName username avatar');
  }

  async getComments(postId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const comments = await this.commentModel
      .find({ post: new Types.ObjectId(postId), isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName username avatar')
      .exec();
    
    return { success: true, data: comments };
  }
}
