import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument } from '../../schemas/report.schema';
import { Post, PostDocument } from '../../schemas/post.schema';
import { Comment, CommentDocument } from '../../schemas/comment.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { NotificationService } from '../notifications/notifications.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  async createReport(data: {
    reporterId: string;
    targetType: string;
    targetId: string;
    reason: string;
    details?: string;
  }) {
    if (data.targetType === 'user' && data.reporterId === data.targetId) {
      throw new BadRequestException('You cannot report yourself');
    }

    // Check for duplicate recent report (optional but good)
    const existing = await this.reportModel.findOne({
      reporter: new Types.ObjectId(data.reporterId),
      targetId: new Types.ObjectId(data.targetId),
      status: 'pending'
    });
    if (existing) throw new BadRequestException('You have already reported this content');

    const report = new this.reportModel({
      reporter: new Types.ObjectId(data.reporterId),
      targetType: data.targetType,
      targetId: new Types.ObjectId(data.targetId),
      reason: data.reason,
      details: data.details || '',
    });
    return report.save();
  }

  async getAllReports(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;
    const filter = status ? { status } : {};
    
    const [reports, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporter', 'fullName username email')
        .lean()
        .exec(),
      this.reportModel.countDocuments(filter)
    ]);
    
    // Manual Polymorphic Population
    const reportsWithTargets = await Promise.all(reports.map(async (report: any) => {
      let targetInfo: any = null;
      try {
        if (report.targetType === 'user') {
          targetInfo = await this.userModel.findById(report.targetId).select('fullName username avatar').lean();
        } else if (report.targetType === 'post') {
          targetInfo = await this.postModel.findById(report.targetId).select('caption media').lean();
        } else if (report.targetType === 'comment') {
          targetInfo = await this.commentModel.findById(report.targetId).select('text').lean();
        }
      } catch (e) {
        console.error(`Error populating report target ${report.targetId}:`, e);
      }
      return { ...report, target: targetInfo };
    }));
    
    return { 
      success: true, 
      data: reportsWithTargets,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit)
      }
    };
  }

  async resolveReport(reportId: string, resolution: { 
    status: string; 
    adminNotes?: string; 
    resolutionAction?: string 
  }) {
    const report = await this.reportModel.findByIdAndUpdate(
      reportId,
      { 
        status: resolution.status,
        adminNotes: resolution.adminNotes || '',
        resolutionAction: resolution.resolutionAction || 'none',
      },
      { new: true }
    );
    if (!report) throw new BadRequestException('Report not found');

    // Notify Reporter
    if (resolution.status === 'resolved' || resolution.status === 'dismissed') {
       try {
         await this.notificationService.createNotification({
           recipient: report.reporter.toString(),
           sender: 'admin', // Or identify system user
           type: 'mention', // We can repurpose or add a new type
           content: `Your report regarding a ${report.targetType} has been ${resolution.status}. Action taken: ${resolution.resolutionAction}`,
         });
       } catch (e) {
         console.error('Error notifying reporter:', e);
       }
    }

    return { success: true, data: report };
  }
}
