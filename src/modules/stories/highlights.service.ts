import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Highlight, HighlightDocument } from '../../schemas/highlight.schema';
import { Story, StoryDocument } from '../../schemas/story.schema';

@Injectable()
export class HighlightsService {
  constructor(
    @InjectModel(Highlight.name) private highlightModel: Model<HighlightDocument>,
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
  ) {}

  async createHighlight(userId: string, name: string, storyIds: string[], coverUrl?: string) {
    const highlight = new this.highlightModel({
      user: new Types.ObjectId(userId),
      name,
      coverUrl: coverUrl || null,
      stories: storyIds.map(id => new Types.ObjectId(id)),
    });

    return (await highlight.save()).populate('stories');
  }

  async getUserHighlights(userId: string) {
    return this.highlightModel
      .find({ user: new Types.ObjectId(userId), isActive: true } as any)
      .populate('stories')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateHighlight(highlightId: string, userId: string, updateData: any) {
    const highlight = await this.highlightModel.findById(highlightId);
    if (!highlight) throw new NotFoundException('Highlight not found');

    if (highlight.user.toString() !== userId) {
      throw new ForbiddenException('You can only update your own highlights');
    }

    if (updateData.stories) {
        updateData.stories = updateData.stories.map((id: string) => new Types.ObjectId(id));
    }

    return this.highlightModel.findByIdAndUpdate(highlightId, updateData, { new: true }).populate('stories');
  }

  async deleteHighlight(highlightId: string, userId: string) {
    const highlight = await this.highlightModel.findById(highlightId);
    if (!highlight) throw new NotFoundException('Highlight not found');

    if (highlight.user.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own highlights');
    }

    await this.highlightModel.findByIdAndDelete(highlightId);
    return { success: true };
  }

  async getArchivedStories(userId: string) {
    // Stories older than 24h are considered archived
    // Since we removed auto-expiry, they stay in DB.
    return this.storyModel.find({
        user: new Types.ObjectId(userId),
        isActive: true,
        createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    } as any).sort({ createdAt: -1 }).exec();
  }
}
