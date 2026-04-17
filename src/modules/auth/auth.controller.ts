import { Controller, Post, Body, UseGuards, Request, Get, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard, JwtAuthGuard } from '../../common/guards/auth.guard';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: any) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('refresh-token')
  async refresh(@Body('refreshToken') token: string) {
    return this.authService.refreshTokens(token);
  }

  @Post('verify-otp')
  async verifyOTP(@Body('email') email: string, @Body('otp') otp: string) {
    return this.authService.verifyOTP(email, otp);
  }

  @Post('resend-otp')
  async resendOTP(@Body('email') email: string) {
    return this.authService.resendOTP(email);
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body('email') email: string,
    @Body('otp') otp: string,
    @Body('newPassword') newPass: string,
  ) {
    return this.authService.resetPassword(email, otp, newPass);
  }

  @Post('request-login-otp')
  async requestLoginOTP(@Body('email') email: string) {
    return this.authService.requestLoginOTP(email);
  }

  @Post('login-otp')
  async loginViaOTP(@Body('email') email: string, @Body('otp') otp: string) {
    return this.authService.loginViaOTP(email, otp);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new NotFoundException('User not found');
    const sanitized = user.toObject();
    delete sanitized.password;
    delete sanitized.refreshTokens;
    return sanitized;
  }
}
