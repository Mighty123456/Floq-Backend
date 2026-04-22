import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OtpService } from '../redis/otp.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserDocument } from '../../schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private otpService: OtpService,
    private mailService: MailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { sub: user._id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    });

    // Hash and store refresh token for security (multi-device)
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const dbUser = await this.usersService.findById(user._id);
    if (dbUser) {
        if (!dbUser.isEmailVerified) {
             const { otp } = await this.otpService.createOTP('email_verify', dbUser.email);
             await this.mailService.sendVerificationOTP(dbUser.email, dbUser.fullName, otp);
             throw new ForbiddenException({ message: 'Email not verified', needsVerification: true, email: dbUser.email });
        }
        dbUser.refreshTokens = [...(dbUser.refreshTokens || []).slice(-4), hashedToken];
        await dbUser.save();
    }

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async register(userData: any) {
    const existing = await this.usersService.findByEmail(userData.email);
    if (existing) throw new ConflictException('Email already exists');

    const user = await this.usersService.create(userData);
    const { otp } = await this.otpService.createOTP('email_verify', user.email);
    await this.mailService.sendVerificationOTP(user.email, user.fullName, otp);

    return {
        message: 'Registration successful. Verification code sent.',
        userId: user._id,
        email: user.email,
    };
  }

  async verifyOTP(email: string, otp: string) {
    await this.otpService.verifyOTP('email_verify', email, otp);
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    user.isEmailVerified = true;
    await user.save();

    return this.login(user);
  }

  async resendOTP(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    const { otp } = await this.otpService.createOTP('email_verify', user.email);
    await this.mailService.sendVerificationOTP(user.email, user.fullName, otp);

    return { message: 'OTP resent successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    const { otp } = await this.otpService.createOTP('password_reset', user.email);
    await this.mailService.sendPasswordResetOTP(user.email, user.fullName, otp);

    return { message: 'Password reset code sent' };
  }

  async resetPassword(email: string, otp: string, newPass: string) {
    await this.otpService.verifyOTP('password_reset', email, otp);
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    user.password = newPass;
    await user.save();

    return { message: 'Password reset successful' };
  }

  async requestLoginOTP(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    const { otp } = await this.otpService.createOTP('login_otp', user.email);
    await this.mailService.sendLoginOTP(user.email, user.fullName, otp);

    return { message: 'Login code sent to your email' };
  }

  async loginViaOTP(email: string, otp: string) {
    await this.otpService.verifyOTP('login_otp', email, otp);
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    return this.login(user);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      });
      const user = await this.usersService.findById(payload.sub);
      
      if (!user) throw new UnauthorizedException();

      const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
      if (!user.refreshTokens.includes(hashedToken)) {
         throw new UnauthorizedException('Invalid refresh token');
      }

      // Rotate tokens
      return this.login(user);
    } catch (e) {
      throw new UnauthorizedException('Token expired or invalid');
    }
  }

  async changePassword(userId: string, newPass: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.password = newPass;
    await user.save();

    return { message: 'Password changed successfully' };
  }

  async logout(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user) return { success: true };

    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    user.refreshTokens = user.refreshTokens.filter(token => token !== hashedToken);
    await user.save();

    return { success: true };
  }

  private sanitizeUser(user: any) {
    const { password, refreshTokens, ...sanitized } = user;
    return sanitized;
  }
}
