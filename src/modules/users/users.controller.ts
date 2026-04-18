import { Controller, Patch, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Patch('update-fcm-token')
  async updateFcmToken(@Request() req, @Body('fcmToken') token: string) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');

    // Add token if it doesn't exist
    if (!user.fcmTokens) {
      user.fcmTokens = [];
    }
    
    if (token && !user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      await user.save();
    }

    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('all')
  async getAllUsers(@Request() req) {
    return this.usersService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(@Request() req, @Body() updateData: any) {
    // Basic profile update
    const updated = await this.usersService.update(req.user.id, updateData);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }
}
