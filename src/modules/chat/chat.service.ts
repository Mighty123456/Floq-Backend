import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../../schemas/message.schema';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async saveMessage(senderId: string, receiverId: string, content: string, type: string = 'text') {
    const message = new this.messageModel({
      sender: new Types.ObjectId(senderId),
      receiver: new Types.ObjectId(receiverId),
      content,
      type,
    });
    return message.save();
  }

  async getMessages(userId: string, otherUserId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const userObjId = new Types.ObjectId(userId);
    const otherUserObjId = new Types.ObjectId(otherUserId);

    const messages = await this.messageModel
      .find({
        $or: [
          { sender: userObjId, receiver: otherUserObjId },
          { sender: otherUserObjId, receiver: userObjId },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return { success: true, data: messages.reverse() };
  }

  async getRecentConversations(userId: string) {
    const userObjId = new Types.ObjectId(userId);

    // Get unique people the user has chatted with
    const conversations = await this.messageModel.aggregate([
      {
        $match: {
          $or: [{ sender: userObjId }, { receiver: userObjId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userObjId] },
              '$receiver',
              '$sender',
            ],
          },
          lastMessage: { $first: '$content' },
          lastMessageTime: { $first: '$createdAt' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', userObjId] },
                    { $eq: ['$isRead', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          lastMessageTime: 1,
          unreadCount: 1,
          'user.fullName': 1,
          'user.username': 1,
          'user.avatar': 1,
        },
      },
    ]);

    return { success: true, data: conversations };
  }

  async markAsRead(receiverId: string, senderId: string) {
    return this.messageModel.updateMany(
      {
        sender: new Types.ObjectId(senderId),
        receiver: new Types.ObjectId(receiverId),
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      },
    );
  }
}
