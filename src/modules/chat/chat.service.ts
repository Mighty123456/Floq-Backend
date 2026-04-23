import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../../schemas/message.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
  ) {}

  async saveMessage(senderId: string, receiverId?: string, content: string = '', type: string = 'text', media?: any, groupId?: string, isDelivered: boolean = false) {
    const message = new this.messageModel({
      sender: new Types.ObjectId(senderId),
      receiver: receiverId ? new Types.ObjectId(receiverId) : undefined,
      group: groupId ? new Types.ObjectId(groupId) : undefined,
      content,
      type,
      media,
      isDelivered,
      deliveredAt: isDelivered ? new Date() : undefined,
    });
    return message.save();
  }

  async markAsDelivered(receiverId: string) {
    return this.messageModel.updateMany(
      {
        receiver: new Types.ObjectId(receiverId),
        isDelivered: false,
      },
      {
        $set: { isDelivered: true, deliveredAt: new Date() },
      },
    );
  }

  async getUndeliveredMessages(receiverId: string) {
    return this.messageModel.find({
      receiver: new Types.ObjectId(receiverId),
      isDelivered: false,
    }).exec();
  }

  async isBlocked(senderId: string, receiverId: string): Promise<boolean> {
    const receiver = await this.userModel.findById(receiverId);
    if (!receiver) return false;
    return receiver.blockedUsers.some(id => id.toString() === senderId);
  }

  async markAsSpam(userId: string, targetId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { spammedUsers: new Types.ObjectId(targetId) }
    });
  }

  async unmarkAsSpam(userId: string, targetId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      $pull: { spammedUsers: new Types.ObjectId(targetId) }
    });
  }


  async deleteMessage(messageId: string, userId: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    if (message.sender.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to delete this message');
    }

    await this.messageModel.findByIdAndDelete(messageId);
    return { success: true };
  }

  async editMessage(messageId: string, userId: string, newContent: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    if (message.sender.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to edit this message');
    }

    if (message.type !== 'text') {
      throw new BadRequestException('Only text messages can be edited');
    }

    return this.messageModel.findByIdAndUpdate(messageId, {
      content: newContent,
      isEdited: true,
      editedAt: new Date(),
    }, { new: true });
  }

  async createGroup(adminId: string, name: string, description: string = '', members: string[] = []) {
    const group = new this.groupModel({
      name,
      description,
      admin: new Types.ObjectId(adminId),
      members: [new Types.ObjectId(adminId), ...members.map(m => new Types.ObjectId(m))],
    });
    return group.save();
  }

  async getGroups(userId: string) {
    return this.groupModel.find({ members: new Types.ObjectId(userId), isActive: true }).exec();
  }

  async addMember(groupId: string, userId: string) {
    return this.groupModel.findByIdAndUpdate(groupId, {
      $addToSet: { members: new Types.ObjectId(userId) }
    }, { new: true }).populate('members', 'fullName username avatar');
  }

  async removeMember(groupId: string, adminId: string, memberId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    if (group.admin.toString() !== adminId) {
      throw new ForbiddenException('Only admins can remove members');
    }

    if (memberId === adminId) {
      throw new BadRequestException('Admin cannot be removed. Transfer ownership first.');
    }

    return this.groupModel.findByIdAndUpdate(groupId, {
      $pull: { members: new Types.ObjectId(memberId) }
    }, { new: true });
  }

  async leaveGroup(groupId: string, userId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    if (group.admin.toString() === userId) {
      throw new BadRequestException('Admins must transfer ownership before leaving');
    }

    return this.groupModel.findByIdAndUpdate(groupId, {
      $pull: { members: new Types.ObjectId(userId) }
    }, { new: true });
  }

  async transferAdmin(groupId: string, currentAdminId: string, newAdminId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    if (group.admin.toString() !== currentAdminId) {
      throw new ForbiddenException('Only the current admin can transfer ownership');
    }

    const isMember = group.members.some(id => id.toString() === newAdminId);
    if (!isMember) throw new BadRequestException('New admin must be a member of the group');

    return this.groupModel.findByIdAndUpdate(groupId, {
      admin: new Types.ObjectId(newAdminId)
    }, { new: true });
  }

  async updateGroup(groupId: string, adminId: string, updateData: any) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    if (group.admin.toString() !== adminId) {
      throw new ForbiddenException('Only admin can update group details');
    }

    return this.groupModel.findByIdAndUpdate(groupId, updateData, { new: true });
  }

  async getGroupDetails(groupId: string) {
    const group = await this.groupModel.findById(groupId)
      .populate('admin', 'fullName username avatar')
      .populate('members', 'fullName username avatar');
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async getGroupMessages(groupId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const messages = await this.messageModel
      .find({ group: new Types.ObjectId(groupId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'fullName username avatar')
      .exec();
    
    return { success: true, data: messages.reverse() };
  }

  async getMessages(userId: string, otherUserId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const userObjId = new Types.ObjectId(userId);
    const otherUserObjId = new Types.ObjectId(otherUserId);

    const messages = await this.messageModel
      .find({
        $and: [
          { group: { $exists: false } },
          {
            $or: [
              { sender: userObjId, receiver: otherUserObjId },
              { sender: otherUserObjId, receiver: userObjId },
            ],
          }
        ]
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return { success: true, data: messages.reverse() };
  }

  async getRecentConversations(userId: string) {
    const userObjId = new Types.ObjectId(userId);

    // 1. Direct Chats
    const conversations = await this.messageModel.aggregate([
      {
        $match: {
          group: { $exists: false },
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

    // 2. Groups
    const groupConversations = await this.messageModel.aggregate([
      {
        $match: {
          group: { $exists: true },
        },
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'group',
          foreignField: '_id',
          as: 'groupDetails',
        },
      },
      {
        $unwind: '$groupDetails',
      },
      {
        $match: {
          'groupDetails.members': userObjId,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$group',
          groupInfo: { $first: '$groupDetails' },
          lastMessage: { $first: '$content' },
          lastMessageTime: { $first: '$createdAt' },
        },
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          lastMessageTime: 1,
          name: '$groupInfo.name',
          avatar: '$groupInfo.avatar',
          isGroup: { $literal: true },
        },
      },
    ]);

    return { 
      success: true, 
      data: {
        individuals: conversations,
        groups: groupConversations
      } 
    };
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

  async getTrendingGroups(limit: number = 10) {
    const groups = await this.groupModel.aggregate([
      { $match: { isActive: true } },
      { $addFields: { memberCount: { $size: '$members' } } },
      { $sort: { memberCount: -1 } },
      { $limit: limit },
    ]);
    return { success: true, data: groups };
  }
}
