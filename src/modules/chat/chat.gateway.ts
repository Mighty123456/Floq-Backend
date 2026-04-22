import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers['authorization']?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      this.userSockets.set(userId, client.id);
      client.data.userId = userId;

      // Mark offline messages as delivered
      const undelivered = await this.chatService.getUndeliveredMessages(userId);
      if (undelivered.length > 0) {
        await this.chatService.markAsDelivered(userId);
        // Notify senders
        undelivered.forEach(msg => {
          const senderSocketId = this.userSockets.get(msg.sender.toString());
          if (senderSocketId) {
            this.server.to(senderSocketId).emit('messageDelivered', { 
              messageId: msg._id, 
              toUserId: userId,
              deliveredAt: new Date()
            });
          }
        });
      }

      // Join rooms for all groups the user is in
      const groups = await this.chatService.getGroups(userId);
      groups.forEach(group => client.join(group._id.toString()));

      // Broadcast online status to others
      this.server.emit('userStatus', { userId, status: 'online' });
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.userSockets.delete(userId);
      this.server.emit('userStatus', { userId, status: 'offline' });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(client: Socket, payload: { receiverId?: string, groupId?: string, content: string, type?: string, media?: any }) {
    const senderId = client.data.userId;
    if (!senderId) return;

    // Block Enforcement (Direct Chat only)
    if (payload.receiverId) {
      const isBlocked = await this.chatService.isBlocked(senderId, payload.receiverId);
      if (isBlocked) {
        client.emit('error', { message: 'You are blocked by this user' });
        return;
      }
      const hasBlocked = await this.chatService.isBlocked(payload.receiverId, senderId);
      if (hasBlocked) {
        client.emit('error', { message: 'You have blocked this user' });
        return;
      }
    }

    const receiverSocketId = payload.receiverId ? this.userSockets.get(payload.receiverId) : null;
    const isActuallyDelivered = !!receiverSocketId;

    // Save message to database
    const message = await this.chatService.saveMessage(
      senderId, 
      payload.receiverId, 
      payload.content, 
      payload.type || 'text',
      payload.media,
      payload.groupId,
      isActuallyDelivered // New parameter
    );

    // Populate sender data for the receiver
    const populatedMessage = await message.populate('sender', 'fullName username avatar');

    if (payload.groupId) {
      // Group message
      this.server.to(payload.groupId).emit('newGroupMessage', populatedMessage);
    } else if (payload.receiverId) {
      // Individual message
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('newMessage', populatedMessage);
        // Emit delivered back to sender
        client.emit('messageDelivered', { 
           messageId: populatedMessage._id, 
           toUserId: payload.receiverId,
           deliveredAt: new Date()
        });
      }
    }
    
    // Also emit back to sender to confirm Save
    client.emit('messageSent', populatedMessage);

    return populatedMessage;
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(client: Socket, payload: { messageId: string, receiverId?: string, groupId?: string }) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      await this.chatService.deleteMessage(payload.messageId, userId);
      
      if (payload.groupId) {
         this.server.to(payload.groupId).emit('messageDeleted', { messageId: payload.messageId });
      } else if (payload.receiverId) {
         const receiverSocketId = this.userSockets.get(payload.receiverId);
         if (receiverSocketId) {
            this.server.to(receiverSocketId).emit('messageDeleted', { messageId: payload.messageId });
         }
      }
      client.emit('messageDeleted', { messageId: payload.messageId });
    } catch (e) {
      client.emit('error', { message: e.message });
    }
  }

  @SubscribeMessage('joinGroup')
  async handleJoinGroup(client: Socket, payload: { groupId: string }) {
    const userId = client.data.userId;
    if (!userId) return;
    client.join(payload.groupId);
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(client: Socket, payload: { senderId: string }) {
    const receiverId = client.data.userId;
    if (!receiverId) return;

    await this.chatService.markAsRead(receiverId, payload.senderId);

    const senderSocketId = this.userSockets.get(payload.senderId);
    if (senderSocketId) {
      this.server.to(senderSocketId).emit('messagesRead', { 
        byUserId: receiverId,
        readAt: new Date()
      });
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(client: Socket, payload: { messageId: string, newContent: string, receiverId?: string, groupId?: string }) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      const updated = await this.chatService.editMessage(payload.messageId, userId, payload.newContent);
      
      if (payload.groupId) {
        this.server.to(payload.groupId).emit('messageUpdated', updated);
      } else if (payload.receiverId) {
        const receiverSocketId = this.userSockets.get(payload.receiverId);
        if (receiverSocketId) {
          this.server.to(receiverSocketId).emit('messageUpdated', updated);
        }
      }
      client.emit('messageUpdated', updated);
    } catch (e) {
      client.emit('error', { message: e.message });
    }
  }

  @SubscribeMessage('leaveGroup')
  async handleLeaveGroup(client: Socket, payload: { groupId: string }) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      await this.chatService.leaveGroup(payload.groupId, userId);
      client.leave(payload.groupId);
      this.server.to(payload.groupId).emit('userLeftGroup', { userId, groupId: payload.groupId });
    } catch (e) {
      client.emit('error', { message: e.message });
    }
  }

  @SubscribeMessage('removeMember')
  async handleRemoveMember(client: Socket, payload: { groupId: string, memberId: string }) {
    const adminId = client.data.userId;
    if (!adminId) return;

    try {
      await this.chatService.removeMember(payload.groupId, adminId, payload.memberId);
      
      const memberSocketId = this.userSockets.get(payload.memberId);
      if (memberSocketId) {
        this.server.to(memberSocketId).emit('removedFromGroup', { groupId: payload.groupId });
        // Make the client leave the room
        this.server.sockets.sockets.get(memberSocketId)?.leave(payload.groupId);
      }

      this.server.to(payload.groupId).emit('userRemovedFromGroup', { 
        userId: payload.memberId, 
        groupId: payload.groupId,
        removedBy: adminId
      });
    } catch (e) {
      client.emit('error', { message: e.message });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(client: Socket, payload: { receiverId?: string, groupId?: string, isTyping: boolean }) {
    const senderId = client.data.userId;
    if (!senderId) return;

    if (payload.groupId) {
       client.to(payload.groupId).emit('userTyping', {
         userId: senderId,
         groupId: payload.groupId,
         isTyping: payload.isTyping,
       });
    } else if (payload.receiverId) {
      const receiverSocketId = this.userSockets.get(payload.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('userTyping', {
          userId: senderId,
          isTyping: payload.isTyping,
        });
      }
    }
  }
}
