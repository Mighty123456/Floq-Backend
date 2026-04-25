import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from '../../schemas/notification.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import * as admin from 'firebase-admin';

import { NotificationGateway } from './notifications.gateway';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  onModuleInit() {
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        console.log('Firebase Admin Initialized');
      }
    } catch (error) {
      console.error('Firebase Admin init error:', error);
    }
  }

  async createNotification(data: {
    recipient: string;
    sender: string;
    type: string;
    post?: string;
    content?: string;
  }) {
    const notification = new this.notificationModel({
      recipient: new Types.ObjectId(data.recipient),
      sender: new Types.ObjectId(data.sender),
      type: data.type,
      post: data.post ? new Types.ObjectId(data.post) : undefined,
      content: data.content || '',
    });
    const saved = await notification.save();
    const populated = await saved.populate('sender', 'fullName username avatar');
    
    // 1. Emit via WebSocket for real-time in-app delivery
    this.notificationGateway.emitNotification(data.recipient, populated);

    // 2. Send Push Notification via FCM
    try {
      const recipientUser = await this.userModel.findById(data.recipient).select('fcmTokens settings');
      if (recipientUser && recipientUser.fcmTokens?.length > 0 && recipientUser.settings?.isNotificationsEnabled) {
        const title = 'Floq';
        let body = '';
        
        switch (data.type) {
          case 'like': body = `${populated.sender['username']} liked your post`; break;
          case 'comment': body = `${populated.sender['username']} commented on your post`; break;
          case 'follow': body = `${populated.sender['username']} started following you`; break;
          case 'repost': body = `${populated.sender['username']} reposted your post`; break;
          default: body = data.content || 'New notification';
        }

        await this.sendToDevices(recipientUser.fcmTokens, title, body, {
          type: data.type,
          postId: data.post?.toString() || '',
          senderId: data.sender.toString(),
        });
      }
    } catch (error) {
      console.error('Push notification error:', error);
    }

    return populated;
  }

  async getNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const query = { recipient: new Types.ObjectId(userId) };
    
    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(query as any)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'fullName username avatar')
        .populate('post', 'media')
        .exec(),
      this.notificationModel.countDocuments(query as any)
    ]);
    
    return { 
      success: true, 
      data: notifications,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit)
      }
    };
  }

  async markAsRead(userId: string) {
    return this.notificationModel.updateMany(
      { recipient: new Types.ObjectId(userId), isRead: false },
      { isRead: true },
    );
  }

  async markOneAsRead(userId: string, notificationId: string) {
    return this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), recipient: new Types.ObjectId(userId) },
      { isRead: true },
      { new: true }
    );
  }

  async getUnreadCount(userId: string) {
    const count = await this.notificationModel.countDocuments({
      recipient: new Types.ObjectId(userId),
      isRead: false,
    });
    return { success: true, count };
  }

  async sendToDevices(tokens: string[], title: string, body: string, data?: any) {
    if (!tokens || tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`${response.successCount} messages were sent successfully`);
    } catch (error) {
      console.error('Error sending messages:', error);
    }
  }

  async deleteNotification(userId: string, notificationId: string) {
    return this.notificationModel.findOneAndDelete({
      _id: new Types.ObjectId(notificationId),
      recipient: new Types.ObjectId(userId),
    } as any);
  }

  async clearAll(userId: string) {
    return this.notificationModel.deleteMany({
      recipient: new Types.ObjectId(userId),
    } as any);
  }
}
