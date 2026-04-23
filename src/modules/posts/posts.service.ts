import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from '../../schemas/post.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Comment, CommentDocument } from '../../schemas/comment.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ConnectionsService } from '../connections/connections.service';
import { NotificationService } from '../notifications/notifications.service';
import 'multer';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private cloudinaryService: CloudinaryService,
    private connectionsService: ConnectionsService,
    private notificationService: NotificationService,
  ) {}

  async createPost(
    userId: string, 
    caption: string, 
    files: Express.Multer.File[], 
    type: string = 'post',
    audioData?: { url: string; name: string },
    location?: { name: string; lat: number; lng: number },
    metadata?: any
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one media file is required to create a post');
    }

    // Upload files to Cloudinary
    const folderName = `floq_${type}s/user_${userId}`;
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
      type,
      audioUrl: audioData?.url || null,
      audioName: audioData?.name || null,
      location: location || null,
      metadata: metadata || {},
      hashtags: this.extractHashtags(caption || ''),
    });

    const savedPost = await newPost.save();

    // Handle Tags/Mentions
    const taggedUserIds = await this.handleMentions(caption, userId, savedPost._id.toString(), 'post');
    if (taggedUserIds.length > 0) {
      await this.postModel.findByIdAndUpdate(savedPost._id, { taggedUsers: taggedUserIds });
    }

    // Only increment post count for standard posts (Stories/Reels might have different stats)
    if (type === 'post') {
      await this.userModel.findByIdAndUpdate(userId, {
        $inc: { postsCount: 1 }
      });
    }

    return savedPost.populate('user', 'fullName username avatar');
  }

  async getFeed(requesterId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    // Get block lists
    const requester = await this.userModel.findById(requesterId).select('blockedUsers');
    if (!requester) throw new NotFoundException('User not found');

    const blockedByOthers = await this.userModel.find({ blockedUsers: new Types.ObjectId(requesterId) }).select('_id');
    const excludeIds = [...(requester.blockedUsers || []), ...blockedByOthers.map(u => u._id)];

    // Get the list of people the requester follows
    const followingIds = await this.connectionsService.getFollowingIds(requesterId);

    // Filter followingIds to remove blocked people
    const filteredFollowingIds = followingIds.filter(id => !excludeIds.some(ex => ex.toString() === id.toString()));

    // Filter posts from following users + own posts
    const query = {
      user: { $in: [...filteredFollowingIds, new Types.ObjectId(requesterId)] },
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
    
    const total = await this.postModel.countDocuments(query as any);
    
    return {
      success: true,
      data: posts.map(post => ({
        ...post,
        isLiked: post.likes ? post.likes.some(id => id.toString() === requesterId) : false,
      })),
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      }
    };
  }

  async getUserPosts(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const query = { user: new Types.ObjectId(userId) as any, isActive: true };
    const posts = await this.postModel
      .find(query)
      .sort({ isPinned: -1, createdAt: -1 }) // Show pinned posts first
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName username avatar')
      .exec();

    const total = await this.postModel.countDocuments(query);
    return { 
      success: true, 
      data: posts,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit)
      }
    };
  }

  async getTaggedPosts(userId: string) {
    return this.postModel
      .find({ taggedUsers: new Types.ObjectId(userId) as any, isActive: true })
      .sort({ createdAt: -1 })
      .populate('user', 'fullName username avatar')
      .exec();
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    if (post.user.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Delete media from Cloudinary
    if (post.media && post.media.length > 0) {
      const deletePromises = post.media.map(m => this.cloudinaryService.deleteImage(m.publicId));
      await Promise.all(deletePromises);
    }

    // Delete post and related comments
    await this.postModel.findByIdAndDelete(postId);
    await this.commentModel.deleteMany({ post: new Types.ObjectId(postId) });

    // Decrement user's post count
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { postsCount: -1 }
    });

    return { success: true, message: 'Post deleted successfully' };
  }

  async updatePost(postId: string, userId: string, caption: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    if (post.user.toString() !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    post.caption = caption;
    post.hashtags = this.extractHashtags(caption);
    const updatedPost = await post.save();

    // Re-handle Tags/Mentions on update
    const taggedUserIds = await this.handleMentions(caption, userId, postId, 'post');
    await this.postModel.findByIdAndUpdate(postId, { taggedUsers: taggedUserIds });

    return updatedPost;
  }

  async toggleLike(postId: string, userId: string) {
    const post = await this.postModel.findById(postId).populate('user');
    if (!post) throw new NotFoundException('Post not found');

    const userIdObj = new Types.ObjectId(userId);
    const hasLiked = post.likes.some(id => id.toString() === userId);
    const requester = await this.userModel.findById(userId);
    if (!requester) throw new NotFoundException('User not found');

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

      // Send Notification to post owner
      const targetUser = post.user as unknown as UserDocument;
      if (targetUser._id.toString() !== userId) {
        // Save to DB
        await this.notificationService.createNotification({
          recipient: targetUser._id.toString(),
          sender: userId,
          type: 'like',
          post: post._id.toString(),
        });

        // Send Push
        if (targetUser.fcmTokens?.length > 0) {
          this.notificationService.sendToDevices(
            targetUser.fcmTokens,
            'New Like! ❤️',
            `${requester.fullName} liked your post.`,
            { postId: post._id.toString(), type: 'like' }
          );
        }
      }

      return { success: true, liked: true };
    }
  }

  async addComment(postId: string, userId: string, text: string, parentId?: string) {
    const post = await this.postModel.findById(postId).populate('user');
    if (!post) throw new NotFoundException('Post not found');

    const requester = await this.userModel.findById(userId);
    if (!requester) throw new NotFoundException('User not found');

    const comment = new this.commentModel({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(userId),
      parentComment: parentId ? new Types.ObjectId(parentId) : null,
      text,
      hashtags: this.extractHashtags(text),
    });

    const savedComment = await comment.save();

    // Handle Tags/Mentions in comments
    const taggedUserIds = await this.handleMentions(text, userId, postId, 'comment');
    if (taggedUserIds.length > 0) {
      await this.commentModel.findByIdAndUpdate(savedComment._id, { taggedUsers: taggedUserIds });
    }

    // Increment count on post
    await this.postModel.findByIdAndUpdate(postId, {
      $inc: { commentsCount: 1 }
    });

    // Handle Notifications
    if (parentId) {
      // It's a reply
      const parentComment = await this.commentModel.findById(parentId).populate('user');
      if (!parentComment || !parentComment.user) throw new NotFoundException('Comment or user not found');
      
      const targetUser = parentComment.user as unknown as UserDocument;
      
      if (targetUser._id.toString() !== userId) {
        // Save to DB
        await this.notificationService.createNotification({
          recipient: targetUser._id.toString(),
          sender: userId,
          type: 'comment', // Could add a 'reply' type if needed
          post: postId,
          content: `replied: ${text}`,
        });

        // Send Push
        if (targetUser.fcmTokens?.length > 0) {
          this.notificationService.sendToDevices(
            targetUser.fcmTokens,
            'New Reply! 💬',
            `${requester.fullName} replied to your comment.`,
            { postId, commentId: comment._id.toString(), type: 'reply' }
          );
        }
      }
    } else {
      // It's a top-level comment
      const targetUser = post.user as unknown as UserDocument;
      if (targetUser._id.toString() !== userId) {
        // Save to DB
        await this.notificationService.createNotification({
          recipient: targetUser._id.toString(),
          sender: userId,
          type: 'comment',
          post: postId,
          content: text,
        });

        // Send Push
        if (targetUser.fcmTokens?.length > 0) {
          this.notificationService.sendToDevices(
            targetUser.fcmTokens,
            'New Comment! 💬',
            `${requester.fullName} commented on your post.`,
            { postId, type: 'comment' }
          );
        }
      }
    }

    return comment.populate('user', 'fullName username avatar');
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.commentModel.findById(commentId);
    if (!comment) throw new NotFoundException('Comment not found');

    // Only comment owner OR post owner can delete
    const post = await this.postModel.findById(comment.post);
    if (comment.user.toString() !== userId && post?.user.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to delete this comment');
    }

    await this.commentModel.findByIdAndDelete(commentId);

    // Decrement count on post
    await this.postModel.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -1 }
    });

    return { success: true };
  }

  async getComments(postId: string, page: number = 1, limit: number = 20, parentId: string | null = null) {
    const skip = (page - 1) * limit;
    
    const query: any = { post: new Types.ObjectId(postId), isActive: true };
    if (parentId !== undefined) {
      query.parentComment = parentId ? new Types.ObjectId(parentId) : null;
    }

    const comments = await this.commentModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName username avatar')
      .exec();
    
    const total = await this.commentModel.countDocuments(query);
    return { 
      success: true, 
      data: comments,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit)
      }
    };
  }


  async toggleSave(postId: string, userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const postIdObj = new Types.ObjectId(postId);
    const postExists = await this.postModel.exists({ _id: postIdObj });
    if (!postExists) throw new NotFoundException('Post not found');

    const hasSaved = user['savedPosts'] ? user['savedPosts'].some(id => id.toString() === postId) : false;

    if (hasSaved) {
      await this.userModel.findByIdAndUpdate(userId, {
        $pull: { savedPosts: postIdObj },
      });
      return { success: true, saved: false };
    } else {
      await this.userModel.findByIdAndUpdate(userId, {
        $addToSet: { savedPosts: postIdObj },
      });
      return { success: true, saved: true };
    }
  }

  private async handleMentions(text: string, senderId: string, postId: string, type: 'post' | 'comment') {
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    if (!matches) return [];

    const usernames = [...new Set(matches.map(m => m.slice(1)))];
    const users = await this.userModel.find({ username: { $in: usernames } });
    const sender = await this.userModel.findById(senderId);
    if (!sender) return [];

    const taggedUserIds: Types.ObjectId[] = [];
    for (const user of users) {
      if (user._id.toString() === senderId) continue;
      
      taggedUserIds.push(user._id);

      // Save to notification DB
      await this.notificationService.createNotification({
        recipient: user._id.toString(),
        sender: senderId,
        type: 'mention',
        post: new Types.ObjectId(postId) as any,
        content: text.length > 50 ? `${text.substring(0, 47)}...` : text,
      });

      // Send Push
      if (user.fcmTokens?.length > 0) {
        this.notificationService.sendToDevices(
          user.fcmTokens,
          'You were tagged! 🏷️',
          `${sender.fullName} mentioned you in a ${type}.`,
          { postId, type: 'mention' }
        );
      }
    }
    return taggedUserIds;
  }

  async toggleCommentLike(commentId: string, userId: string) {
    const comment = await this.commentModel.findById(commentId);
    if (!comment) throw new NotFoundException('Comment not found');

    const userIdObj = new Types.ObjectId(userId);
    const hasLiked = comment.likes.some(id => id.toString() === userId);

    if (hasLiked) {
      await this.commentModel.findByIdAndUpdate(commentId, {
        $pull: { likes: userIdObj },
        $inc: { likesCount: -1 }
      });
      return { success: true, liked: false };
    } else {
      await this.commentModel.findByIdAndUpdate(commentId, {
        $addToSet: { likes: userIdObj },
        $inc: { likesCount: 1 }
      });
      return { success: true, liked: true };
    }
  }

  async repostPost(postId: string, userId: string, caption?: string) {
    const originalPost = await this.postModel.findById(postId);
    if (!originalPost) throw new NotFoundException('Original post not found');

    const repost = new this.postModel({
      user: userId,
      caption: caption || '',
      media: originalPost.media,
      repostOf: originalPost._id,
      hashtags: this.extractHashtags(caption || ''),
    });

    const savedRepost = await repost.save();

    await this.postModel.findByIdAndUpdate(postId, { $inc: { repostsCount: 1 } });
    
    return savedRepost.populate('user', 'fullName username avatar');
  }

  async getPostsByHashtag(hashtag: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const cleanHashtag = hashtag.startsWith('#') ? hashtag.slice(1) : hashtag;
    const query = { hashtags: cleanHashtag.toLowerCase(), isActive: true };
    
    const [posts, total] = await Promise.all([
      this.postModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'fullName username avatar')
        .exec(),
      this.postModel.countDocuments(query)
    ]);
    
    return { 
      success: true, 
      data: posts,
      meta: { total, page, lastPage: Math.ceil(total / limit) }
    };
  }

  async togglePin(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');
    if (post.user.toString() !== userId) {
      throw new ForbiddenException('You can only pin your own posts');
    }

    const newPinnedStatus = !post.isPinned;
    
    // If pinning, unpin any other posts (allowing only one pinned post for simplicity/UX)
    if (newPinnedStatus) {
      await this.postModel.updateMany({ user: new Types.ObjectId(userId) } as any, { isPinned: false });
    }

    post.isPinned = newPinnedStatus;
    await post.save();

    return { success: true, isPinned: newPinnedStatus };
  }

  async getExploreFeed(requesterId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    // Block filters
    const requester = await this.userModel.findById(requesterId).select('blockedUsers');
    const blockedByOthers = await this.userModel.find({ blockedUsers: new Types.ObjectId(requesterId) }).select('_id');
    const excludeIds = [...(requester?.blockedUsers || []), ...blockedByOthers.map(u => u._id)];

    const query = {
      user: { $nin: excludeIds },
      isActive: true,
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(query as any)
        .sort({ likesCount: -1, createdAt: -1 }) // "Trending" logic
        .skip(skip)
        .limit(limit)
        .populate('user', 'fullName username avatar')
        .exec(),
      this.postModel.countDocuments(query as any)
    ]);

    return { 
      success: true, 
      data: posts,
      meta: { total, page, lastPage: Math.ceil(total / limit) }
    };
  }

  async searchPosts(queryStr: string, requesterId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    // Block filters
    const requester = await this.userModel.findById(requesterId).select('blockedUsers');
    const blockedByOthers = await this.userModel.find({ blockedUsers: new Types.ObjectId(requesterId) }).select('_id');
    const excludeIds = [...(requester?.blockedUsers || []), ...blockedByOthers.map(u => u._id)];

    const query = {
      user: { $nin: excludeIds },
      isActive: true,
      caption: { $regex: queryStr, $options: 'i' }
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(query as any)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'fullName username avatar')
        .exec(),
      this.postModel.countDocuments(query as any)
    ]);

    return { 
      success: true, 
      data: posts,
      meta: { total, page, lastPage: Math.ceil(total / limit) }
    };
  }

  async getReels(requesterId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    // Block filters
    const requester = await this.userModel.findById(requesterId).select('blockedUsers');
    const blockedByOthers = await this.userModel.find({ blockedUsers: new Types.ObjectId(requesterId) }).select('_id');
    const excludeIds = [...(requester?.blockedUsers || []), ...blockedByOthers.map(u => u._id)];

    const query = {
      user: { $nin: excludeIds },
      isActive: true,
      type: 'reel'
    };

    const [reels, total] = await Promise.all([
      this.postModel
        .find(query as any)
        .sort({ likesCount: -1, createdAt: -1 }) // Discovery: trending first
        .skip(skip)
        .limit(limit)
        .populate('user', 'fullName username avatar')
        .lean()
        .exec(),
      this.postModel.countDocuments(query as any)
    ]);

    return { 
      success: true, 
      data: reels.map(post => ({
        ...post,
        isLiked: post.likes ? post.likes.some(id => id.toString() === requesterId) : false,
      })),
      meta: { total, page, lastPage: Math.ceil(total / limit) }
    };
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
  }
}
