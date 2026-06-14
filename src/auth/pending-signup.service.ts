import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import type { SignupRole } from './dto/signup.dto';

export interface PendingSignup {
  token: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  passwordHash: string;
  role: SignupRole;
  codeHash: string;
  codeExpiresAt: Date;
  attempts: number;
  codeSentAt: Date;
  expiresAt: Date;
  file?: {
    path: string;
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
  };
}

@Injectable()
export class PendingSignupService implements OnModuleDestroy {
  private readonly signups = new Map<string, PendingSignup>();
  private readonly cleanupTimer = setInterval(
    () => this.removeExpired(),
    60_000,
  );

  create(data: Omit<PendingSignup, 'token'>) {
    this.removeByEmail(data.email);
    const pending = { ...data, token: randomUUID() };
    this.signups.set(pending.token, pending);
    return pending;
  }

  get(token: string) {
    const pending = this.signups.get(token);
    if (!pending) return undefined;
    if (pending.expiresAt <= new Date()) {
      this.remove(token);
      return undefined;
    }
    return pending;
  }

  remove(token: string, keepFile = false) {
    const pending = this.signups.get(token);
    this.signups.delete(token);
    if (!keepFile) this.deleteFile(pending?.file?.path);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    for (const token of this.signups.keys()) {
      this.remove(token);
    }
  }

  private removeByEmail(email: string) {
    for (const [token, pending] of this.signups) {
      if (pending.email === email) this.remove(token);
    }
  }

  private removeExpired() {
    const now = new Date();
    for (const [token, pending] of this.signups) {
      if (pending.expiresAt <= now) this.remove(token);
    }
  }

  private deleteFile(path?: string) {
    if (path && existsSync(path)) unlinkSync(path);
  }
}
