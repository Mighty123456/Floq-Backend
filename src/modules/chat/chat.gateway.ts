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
  async handleMessage(client: Socket, payload: { receiverId: string, content: string, type?: string }) {
    const senderId = client.data.userId;
    if (!senderId) return;

    // Save message to database
    const message = await this.chatService.saveMessage(
      senderId, 
      payload.receiverId, 
      payload.content, 
      payload.type || 'text'
    );

    // Populate sender data for the receiver
    const populatedMessage = await message.populate('sender', 'fullName username avatar');

    // Emit to receiver if online
    const receiverSocketId = this.userSockets.get(payload.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('newMessage', populatedMessage);
    }
    
    // Also emit back to sender to confirm Delivery/Save
    client.emit('messageSent', populatedMessage);

    return populatedMessage;
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
}
