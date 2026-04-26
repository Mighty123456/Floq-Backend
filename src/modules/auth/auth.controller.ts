import { Controller, Post, Body, UseGuards, Request, Get, NotFoundException, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard, JwtAuthGuard } from '../../common/guards/auth.guard';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, VerifyOtpDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Body() loginDto: LoginDto) {
    // loginDto is mainly for documentation/validation here since LocalAuthGuard handles logic
    return this.authService.login(req.user);
  }

  @Post('refresh-token')
  async refresh(@Body('refreshToken') token: string) {
    return this.authService.refreshTokens(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-otp')
  async verifyOTP(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOTP(
      { email: verifyOtpDto.email, phoneNumber: verifyOtpDto.phoneNumber }, 
      verifyOtpDto.otp
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('resend-otp')
  async resendOTP(@Body('email') email: string, @Body('phoneNumber') phoneNumber?: string) {
    return this.authService.resendOTP(email, phoneNumber);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email, forgotPasswordDto.phoneNumber);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      { email: resetPasswordDto.email, phoneNumber: resetPasswordDto.phoneNumber }, 
      resetPasswordDto.otp, 
      resetPasswordDto.newPassword
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('request-login-otp')
  async requestLoginOTP(
    @Body('email') email?: string, 
    @Body('phoneNumber') phoneNumber?: string,
  ) {
    return this.authService.requestLoginOTP(email, phoneNumber);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login-otp')
  async loginViaOTP(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.loginViaOTP(
      { email: verifyOtpDto.email, phoneNumber: verifyOtpDto.phoneNumber }, 
      verifyOtpDto.otp
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google')
  async googleSignIn(@Body('idToken') idToken: string) {
    return this.authService.googleSignIn(idToken);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('apple')
  async appleSignIn(
    @Body('idToken') idToken: string,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
  ) {
    return this.authService.appleSignIn(idToken, firstName, lastName);
  }

  @Post('send-verification-link')
  async sendVerificationLink(@Body('email') email: string) {
    return this.authService.sendVerificationLink(email);
  }

  @Get('verify-email')
  async verifyEmailLink(@Query('token') token: string) {
    return this.authService.verifyEmailLink(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, changePasswordDto.newPassword);
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

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req, @Body('refreshToken') refreshToken: string) {
    return this.authService.logout(req.user.id, refreshToken);
  }
}
