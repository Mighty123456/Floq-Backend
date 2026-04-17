import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';

@Injectable()
export class NotificationService implements OnModuleInit {
  onModuleInit() {
    // Note: You must provide a serviceAccountKey.json in the root or set FIREBASE_CONFIG env
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(), // Or pass specific cert
        });
        console.log('Firebase Admin Initialized');
      }
    } catch (error) {
      console.error('Firebase Admin init error:', error);
    }
  }

  async sendToDevices(tokens: string[], title: string, body: string, data?: any) {
    if (!tokens || tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
      },
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
      
      // Handle cleanup of invalid tokens if needed
      if (response.failureCount > 0) {
        // You could find invalid tokens and remove them from DB here
      }
    } catch (error) {
      console.error('Error sending messages:', error);
    }
  }
}
