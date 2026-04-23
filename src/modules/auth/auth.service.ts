import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OtpService } from '../redis/otp.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserDocument } from '../../schemas/user.schema';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private otpService: OtpService,
    private mailService: MailService,
  ) {}

  private async findUserByIdentifier(email?: string, phoneNumber?: string) {
    if (email) return this.usersService.findByEmail(email);
    if (phoneNumber) return this.usersService.findByPhoneNumber(phoneNumber);
    return null;
  }

  // Required by LocalStrategy for passport-local email/password auth
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    if (!user.password) return null; // Google-only accounts have no password

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
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
        if (!dbUser.isEmailVerified && !dbUser.isPhoneVerified) {
             const identifier = dbUser.email || dbUser.phoneNumber;
             const { otp } = await this.otpService.createOTP('verify', identifier!);
             if (dbUser.email) await this.mailService.sendVerificationOTP(dbUser.email, dbUser.fullName, otp);
             // TODO: Add SmsService.sendOTP(dbUser.phoneNumber, otp)
             throw new ForbiddenException({ 
               message: 'Account not verified', 
               needsVerification: true, 
               email: dbUser.email,
               phoneNumber: dbUser.phoneNumber 
             });
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
    if (userData.email) {
      const existing = await this.usersService.findByEmail(userData.email);
      if (existing) throw new ConflictException('Email already exists');
    }
    if (userData.phoneNumber) {
      const existing = await this.usersService.findByPhoneNumber(userData.phoneNumber);
      if (existing) throw new ConflictException('Phone number already exists');
    }

    const user = await this.usersService.create(userData);
    const identifier = user.email || user.phoneNumber;
    const { otp } = await this.otpService.createOTP('verify', identifier!);
    
    if (user.email) await this.mailService.sendVerificationOTP(user.email, user.fullName, otp);
    // TODO: Add SmsService.sendOTP(user.phoneNumber, otp)

    return {
        message: 'Registration successful. Verification code sent.',
        userId: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
    };
  }

  async verifyOTP(identifier: { email?: string; phoneNumber?: string }, otp: string) {
    const id = identifier.email || identifier.phoneNumber;
    if (!id) throw new BadRequestException('No identifier provided');

    await this.otpService.verifyOTP('verify', id, otp);
    const user = await this.findUserByIdentifier(identifier.email, identifier.phoneNumber);
    if (!user) throw new NotFoundException('User not found');

    if (identifier.email) user.isEmailVerified = true;
    if (identifier.phoneNumber) user.isPhoneVerified = true;
    await user.save();

    return this.login(user);
  }

  async resendOTP(email?: string, phoneNumber?: string) {
    const user = await this.findUserByIdentifier(email, phoneNumber);
    if (!user) throw new NotFoundException('User not found');

    const identifier = user.email || user.phoneNumber;
    const { otp } = await this.otpService.createOTP('verify', identifier!);
    
    if (user.email) await this.mailService.sendVerificationOTP(user.email, user.fullName, otp);
    // TODO: Add SmsService.sendOTP(user.phoneNumber, otp)

    return { message: 'OTP resent successfully' };
  }

  async forgotPassword(email?: string, phoneNumber?: string) {
    const user = await this.findUserByIdentifier(email, phoneNumber);
    if (!user) throw new NotFoundException('User not found');

    const identifier = user.email || user.phoneNumber;
    const { otp } = await this.otpService.createOTP('password_reset', identifier!);
    
    if (user.email) await this.mailService.sendPasswordResetOTP(user.email, user.fullName, otp);
    // TODO: Add SmsService.sendOTP(user.phoneNumber, otp)

    return { message: 'Password reset code sent' };
  }

  async resetPassword(identifier: { email?: string; phoneNumber?: string }, otp: string, newPass: string) {
    const id = identifier.email || identifier.phoneNumber;
    if (!id) throw new BadRequestException('No identifier provided');

    await this.otpService.verifyOTP('password_reset', id, otp);
    const user = await this.findUserByIdentifier(identifier.email, identifier.phoneNumber);
    if (!user) throw new NotFoundException('User not found');

    user.password = newPass;
    await user.save();

    return { message: 'Password reset successful' };
  }

  async requestLoginOTP(email?: string, phoneNumber?: string) {
    const user = await this.findUserByIdentifier(email, phoneNumber);
    if (!user) throw new NotFoundException('User not found');

    const identifier = user.email || user.phoneNumber;
    const { otp } = await this.otpService.createOTP('login_otp', identifier!);
    
    if (user.email) await this.mailService.sendLoginOTP(user.email, user.fullName, otp);
    // TODO: Add SmsService.sendOTP(user.phoneNumber, otp)

    return { message: 'Login code sent' };
  }

  async loginViaOTP(identifier: { email?: string; phoneNumber?: string }, otp: string) {
    const id = identifier.email || identifier.phoneNumber;
    if (!id) throw new BadRequestException('No identifier provided');

    await this.otpService.verifyOTP('login_otp', id, otp);
    const user = await this.findUserByIdentifier(identifier.email, identifier.phoneNumber);
    if (!user) throw new NotFoundException('User not found');

    return this.login(user);
  }

  async googleSignIn(idToken: string) {
    // Verify the Google ID token using google-auth-library
    const client = new OAuth2Client();
    let payload: any;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID, // Web client ID from Google Cloud Console
      });
      payload = ticket.getPayload();
    } catch (e) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { email, name, sub: googleId, picture } = payload;
    if (!email) throw new BadRequestException('Google account has no email');

    // Find or create user
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.create({
        fullName: name,
        email,
        googleId,
        avatar: { url: picture, publicId: 'google' },
        isEmailVerified: true, // Google already verified the email
        password: crypto.randomBytes(32).toString('hex'), // random password, not used
      });
      // Send welcome email
      try {
        await this.mailService.sendWelcomeEmail(email, name);
      } catch (e) {
        console.error('Failed to send welcome email:', e);
      }
    } else {
      // Link Google to existing account if not linked
      let updated = false;
      if (!user.googleId) {
        user.googleId = googleId;
        updated = true;
      }
      // Update avatar if missing
      if (!user.avatar?.url && picture) {
        user.avatar = { url: picture, publicId: 'google' };
        updated = true;
      }
      user.isEmailVerified = true;
      if (updated) await user.save();
    }

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
    // Must call toObject() first — spreading a Mongoose Document directly
    // only copies wrapper properties, not the actual DB fields (fullName, avatar, etc.)
    const plain = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    const { password, refreshTokens, __v, ...sanitized } = plain;
    return sanitized;
  }
}
