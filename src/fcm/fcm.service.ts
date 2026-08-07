import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  getMessaging,
  type Message,
  type Messaging,
} from 'firebase-admin/messaging';
import { env } from 'src/config/env';
import {
  IFcmNotificationPayload,
  IFcmSendResult,
} from '../common/interfaces/fcm-message.interface';
import {
  FcmToken,
  FcmTokenDocument,
} from '../fcm-tokens/entities/fcm-token.entity';

const STALE_INSTALLATION_ERROR_CODES = new Set([
  'messaging/installation-id-not-registered',
  'messaging/registration-token-not-registered',
]);

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly messaging?: Messaging;

  constructor(
    @InjectModel(FcmToken.name)
    private readonly fcmTokenModel: Model<FcmTokenDocument>,
  ) {
    if (!env.firebaseServiceAccountJson) {
      this.logger.warn(
        '[FcmService] FIREBASE_SERVICE_ACCOUNT_JSON is not set. FCM notifications are disabled.',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(env.firebaseServiceAccountJson);

      if (getApps().length === 0) {
        initializeApp({
          credential: cert(serviceAccount),
        });
        this.logger.log('[FcmService] Firebase Admin SDK initialized');
      }

      this.messaging = getMessaging();
    } catch (error) {
      this.logger.error(
        '[FcmService] Failed to initialize Firebase Admin SDK',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private isReady(): boolean {
    if (!this.messaging) {
      this.logger.warn(
        '[FcmService] FCM is not initialized. Skipping notification.',
      );
      return false;
    }
    return true;
  }

  async sendToDevice(
    installationId: string,
    payload: IFcmNotificationPayload,
  ): Promise<IFcmSendResult> {
    if (!this.isReady()) {
      return { success: false, error: 'FCM is not initialized' };
    }

    try {
      const message = this.buildMessage(payload, { fid: installationId });
      const messageId = await this.messaging!.send(message);
      return { success: true, messageId };
    } catch (error) {
      const result = this.handleError('sendToDevice', error);
      await this.cleanupStaleInstallations([installationId], [result]);
      return result;
    }
  }

  async sendToDevices(
    installationIds: string[],
    payload: IFcmNotificationPayload,
  ): Promise<IFcmSendResult[]> {
    if (!this.isReady()) {
      return installationIds.map(() => ({
        success: false,
        error: 'FCM is not initialized',
      }));
    }

    const messages = installationIds.map((fid) =>
      this.buildMessage(payload, { fid }),
    );

    try {
      const response = await this.messaging!.sendEach(messages);
      const results = response.responses.map((item) => ({
        success: item.success,
        messageId: item.messageId,
        error: item.error ? item.error.message : undefined,
        errorCode: item.error ? item.error.code : undefined,
      }));
      await this.cleanupStaleInstallations(installationIds, results);
      return results;
    } catch (error) {
      return [this.handleError('sendToDevices', error)];
    }
  }

  private buildMessage(
    payload: IFcmNotificationPayload,
    target: { fid?: string },
  ): Message {
    return {
      ...target,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    } as Message;
  }

  private async cleanupStaleInstallations(
    installationIds: string[],
    results: IFcmSendResult[],
  ): Promise<void> {
    const staleInstallationIds = installationIds.filter(
      (_, index) =>
        results[index]?.errorCode &&
        STALE_INSTALLATION_ERROR_CODES.has(results[index].errorCode as string),
    );

    if (staleInstallationIds.length > 0) {
      this.logger.log(
        `[cleanupStaleInstallations] Removing stale installation IDs: ${staleInstallationIds.join(', ')}`,
      );
      await this.fcmTokenModel.deleteMany({
        installationId: { $in: staleInstallationIds },
      });
    }
  }

  private handleError(method: string, error: unknown): IFcmSendResult {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined;
    this.logger.error(`[FcmService] ${method} failed`, message);
    return { success: false, error: message, errorCode };
  }
}
