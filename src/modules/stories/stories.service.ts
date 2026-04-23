import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryDocument } from '../../schemas/story.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ConnectionsService } from '../connections/connections.service';
import 'multer';

@Injectable()
export class StoriesService {
  constructor(
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private cloudinaryService: CloudinaryService,
    private connectionsService: ConnectionsService,
  ) {}

  async createStory(
    userId: string, 
    file: Express.Multer.File, 
    caption: string = '',
    location?: { name: string; lat: number; lng: number },
    metadata?: any
  ) {
    const result = await this.cloudinaryService.uploadImage(file, `floq_stories/user_${userId}`);
    
    const newStory = new this.storyModel({
      user: new Types.ObjectId(userId),
      media: {
        url: result.secure_url,
        publicId: result.public_id,
      },
      caption,
      location: location || null,
      metadata: metadata || {},
      type: file.mimetype.startsWith('video') ? 'video' : 'image',
    });

    return (await newStory.save()).populate('user', 'fullName username avatar');
  }

  async getMyStories(userId: string) {
    return this.storyModel
      .find({ user: new Types.ObjectId(userId), isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getFeedStories(userId: string) {
    const followingIds = await this.connectionsService.getFollowingIds(userId);
    
    // Get block lists
    const requester = await this.userModel.findById(userId).select('blockedUsers');
    if (!requester) throw new NotFoundException('User not found');
    
    const blockedByOthers = await this.userModel.find({ blockedUsers: new Types.ObjectId(userId) }).select('_id');
    const excludeIds = [...(requester.blockedUsers || []), ...blockedByOthers.map(u => u._id)];

    // Filter followingIds to remove blocked people
    const filteredFollowingIds = followingIds.filter(id => !excludeIds.some(ex => ex.toString() === id.toString()));

    const allRelevantIds = [...filteredFollowingIds, new Types.ObjectId(userId)];

    // Fetch all stories from the last 24h for these users
    // Added safety filter in case TTL hasn't run yet
    const stories = await this.storyModel
      .find({
        user: { $in: allRelevantIds },
        isActive: true,
        expiresAt: { $gt: new Date() } // Safety filter
      })
      .sort({ createdAt: -1 })
      .populate('user', 'fullName username avatar')
      .lean() // Use lean for performance since we're grouping manually
      .exec();

    // Group stories by user (standard social media format)
    const groupedStories = new Map();

    stories.forEach((story: any) => {
      const uId = story.user['_id'].toString();
      if (!groupedStories.has(uId)) {
        groupedStories.set(uId, {
          user: story.user,
          stories: [],
        });
      }
      
      // Inject hasSeen status for the requester
      const hasSeen = story.viewers ? story.viewers.some((vId: any) => vId.toString() === userId) : false;
      
      groupedStories.get(uId).stories.push({
        ...story,
        hasSeen
      });
    });

    return Array.from(groupedStories.values());
  }

  async markAsSeen(storyId: string, userId: string) {
    return this.storyModel.findByIdAndUpdate(
      storyId,
      { $addToSet: { viewers: new Types.ObjectId(userId) } },
      { new: true },
    );
  }

  async getViewers(storyId: string, userId: string) {
    const story = await this.storyModel.findById(storyId).populate('viewers', 'fullName username avatar');
    if (!story) throw new NotFoundException('Story not found');
    
    // Check if the requester is the owner
    if (story.user.toString() !== userId) {
      throw new ForbiddenException('Only the owner can see the viewers list');
    }

    return story.viewers;
  }

  async deleteStory(storyId: string, userId: string) {
    const story = await this.storyModel.findById(storyId);
    if (!story) throw new NotFoundException('Story not found');

    if (story.user.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own stories');
    }

    // Delete from Cloudinary
    await this.cloudinaryService.deleteImage(story.media.publicId);
    
    // Delete from DB
    await this.storyModel.findByIdAndDelete(storyId);
    
    return { success: true };
  }
}
