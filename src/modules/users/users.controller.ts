import { 
  Controller, Patch, Get, Post, Body, UseGuards, 
  Request, NotFoundException, Param, Query, 
  UseInterceptors, UploadedFile, BadRequestException, Delete
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateProfileDto } from './dto/user.dto';
import { avatarMulterOptions } from '../../common/utils/multer-options';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private cloudinaryService: CloudinaryService
  ) {}

  @Get('check-username/:username')
  async checkUsername(@Param('username') username: string) {
    const available = await this.usersService.isUsernameAvailable(username);
    return { success: true, available };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update-fcm-token')
  async updateFcmToken(@Request() req, @Body('fcmToken') token: string) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');

    if (!user.fcmTokens) user.fcmTokens = [];
    
    if (token && !user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      await user.save();
    }

    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async searchUsers(@Request() req, @Query('q') query: string) {
    if (query && query.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters long');
    }
    return this.usersService.searchUsers(query || '', req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/:id')
  async getPublicProfile(@Request() req, @Param('id') id: string) {
    const targetId = id === 'me' ? req.user.id : id;
    const profile = await this.usersService.findPublicProfile(targetId, req.user.id);
    return { success: true, data: profile };
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarMulterOptions))
  async uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Avatar file is required');
    const result = await this.cloudinaryService.uploadImage(file, `floq_avatars/user_${req.user.id}`);
    const updated = await this.usersService.updateAvatar(req.user.id, {
      url: result.secure_url,
      publicId: result.public_id,
    });
    if (!updated) throw new NotFoundException('User not found');
    return { success: true, avatar: updated.avatar };
  }

  @UseGuards(JwtAuthGuard)
  @Get('all')
  async getAllUsers(@Request() req) {
    return this.usersService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(@Request() req, @Body() updateData: UpdateProfileDto) {
    const updated = await this.usersService.update(req.user.id, updateData);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('camera-settings')
  async updateCameraSettings(
    @Request() req, 
    @Body() cameraSettings: { alwaysStartOnFrontCamera: boolean; toolbarSide: 'left' | 'right' }
  ) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');
    user.cameraSettings = cameraSettings;
    await user.save();
    return { success: true, cameraSettings: user.cameraSettings };
  }

  @UseGuards(JwtAuthGuard)
  @Post('block/:id')
  async blockUser(@Request() req, @Param('id') id: string) {
    return this.usersService.blockUser(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('unblock/:id')
  async unblockUser(@Request() req, @Param('id') id: string) {
    return this.usersService.unblockUser(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('blocked-list')
  async getBlockedList(@Request() req) {
    return this.usersService.getBlockedList(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('deactivate')
  async deactivateAccount(@Request() req) {
    return this.usersService.deactivateAccount(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteAccount(@Request() req) {
    return this.usersService.deleteAccount(req.user.id);
  }

  // --- ADMIN ROUTES ---

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/list')
  async adminGetList(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.usersService.adminFindAll(parseInt(page, 10), parseInt(limit, 10));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/:id/status')
  async adminUpdateStatus(
    @Param('id') id: string,
    @Body() data: { isBanned: boolean; reason?: string }
  ) {
    return this.usersService.adminUpdateStatus(id, data.isBanned, data.reason);
  }
}
