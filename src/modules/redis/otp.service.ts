import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { createClient } from 'redis';

@Injectable()
export class OtpService {
  private redisClient;
  private readonly otpExpiry: number;
  private readonly maxTries: number;
  private readonly otpLen: number;

  constructor(private configService: ConfigService) {
    this.otpExpiry = parseInt(this.configService.get('OTP_EXPIRY_MINUTES') || '10') * 60;
    this.maxTries = parseInt(this.configService.get('OTP_MAX_ATTEMPTS') || '5');
    this.otpLen = parseInt(this.configService.get('OTP_LENGTH') || '6');

    this.initRedis();
  }

  private async initRedis() {
    this.redisClient = createClient({
      url: this.configService.get('REDIS_URL') || 'redis://localhost:6379',
    });
    this.redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await this.redisClient.connect();
  }

  private generateOTP(): string {
    const max = Math.pow(10, this.otpLen);
    return crypto.randomInt(0, max).toString().padStart(this.otpLen, '0');
  }

  private otpKey(purpose: string, email: string): string {
    return `otp:${purpose}:${email.toLowerCase()}`;
  }

  private attemptKey(purpose: string, email: string): string {
    return `otp_attempts:${purpose}:${email.toLowerCase()}`;
  }

  async createOTP(purpose: string, email: string) {
    const otp = this.generateOTP();
    const hash = await bcrypt.hash(otp, 10);

    const payload = JSON.stringify({
      hash,
      email: email.toLowerCase(),
      purpose,
      createdAt: Date.now(),
    });

    await this.redisClient.setEx(this.otpKey(purpose, email), this.otpExpiry, payload);
    await this.redisClient.del(this.attemptKey(purpose, email));

    return { otp, expiresInSeconds: this.otpExpiry };
  }

  async verifyOTP(purpose: string, email: string, candidateOTP: string): Promise<boolean> {
    const aKey = this.attemptKey(purpose, email);
    const oKey = this.otpKey(purpose, email);

    const attemptsRaw = await this.redisClient.get(aKey);
    const attempts = parseInt(attemptsRaw || '0', 10);
    if (attempts >= this.maxTries) {
      throw new BadRequestException('Too many incorrect attempts. Request a new OTP.');
    }

    const raw = await this.redisClient.get(oKey);
    if (!raw) {
      throw new BadRequestException('OTP has expired or does not exist.');
    }

    let stored;
    try {
      stored = JSON.parse(raw);
    } catch {
      throw new InternalServerErrorException('OTP data corrupted.');
    }

    if (stored.purpose !== purpose || stored.email !== email.toLowerCase()) {
      throw new BadRequestException('Invalid OTP request.');
    }

    const isMatch = await bcrypt.compare(String(candidateOTP), stored.hash);

    if (!isMatch) {
      await this.redisClient.setEx(aKey, this.otpExpiry, String(attempts + 1));
      const remaining = this.maxTries - attempts - 1;
      throw new BadRequestException(
        remaining > 0
          ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
          : 'Too many incorrect attempts. Request a new OTP.',
      );
    }

    await this.redisClient.del(oKey);
    await this.redisClient.del(aKey);

    return true;
  }

  async hasActiveOTP(purpose: string, email: string): Promise<number> {
    const ttl = await this.redisClient.ttl(this.otpKey(purpose, email));
    return ttl > 0 ? ttl : 0;
  }
}
