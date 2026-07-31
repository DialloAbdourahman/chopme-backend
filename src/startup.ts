import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserDocument } from './users/entities/user.entity';
import { EnumUserRole } from './common/enums/user-roles';
import { EnumAuthType } from './common/enums/auth-types';
import { env } from './config/env';

@Injectable()
export class StartupService implements OnModuleInit {
  private readonly logger = new Logger(StartupService.name);

  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async onModuleInit() {
    this.logger.log('Application started');
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const userModel = this.connection.model<UserDocument>('User');
    const existingAdmin = await userModel.findOne({ role: EnumUserRole.ADMIN });

    if (existingAdmin) {
      this.logger.log('Admin user already exists. Skipping creation.');
      return;
    }

    const hashedPassword = await bcrypt.hash(env.adminPassword, 10);
    const admin = new userModel({
      fullName: 'Admin',
      email: env.adminEmail,
      password: hashedPassword,
      role: EnumUserRole.ADMIN,
      authType: EnumAuthType.EMAIL_PASSWORD,
      active: true,
    });

    await admin.save();
    this.logger.log(`Admin user created with email=${env.adminEmail}`);
  }
}
