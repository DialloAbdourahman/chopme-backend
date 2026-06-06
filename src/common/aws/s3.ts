import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';

export class AwsS3Helper {
  private s3: S3Client;
  private readonly logger = new Logger(AwsS3Helper.name);

  private bucketName: string;
  private bucketRegion: string;

  constructor({
    bucketName,
    bucketRegion,
  }: {
    bucketName: string;
    bucketRegion: string;
  }) {
    this.bucketName = bucketName;
    this.bucketRegion = bucketRegion;

    this.s3 = new S3Client({
      region: this.bucketRegion,
      requestHandler: {
        socketTimeout: 120000,
      },
    });
  }

  async uploadImage(key: string, contentType: string, file: Buffer) {
    this.logger.log(
      `[uploadImage] Uploading image with key=${key}, contentType=${contentType}`,
    );

    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
    };

    const command = new PutObjectCommand(params);

    try {
      await this.s3.send(command);
      this.logger.log(
        `[uploadImage] Successfully uploaded image with key=${key}`,
      );
    } catch (error) {
      this.logger.error(
        `[uploadImage] Failed to upload image with key=${key}`,
        error,
      );
      throw error;
    }
  }

  async getImageUrl(key: string): Promise<string> {
    this.logger.log(`[getImageUrl] Getting presigned URL for key=${key}`);

    const params = {
      Bucket: this.bucketName,
      Key: key,
    };

    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 }); // 1hr = 3600

    this.logger.log(
      `[getImageUrl] Successfully generated presigned URL for key=${key}`,
    );

    return url;
  }

  async deleteImageFromS3(key: string) {
    this.logger.log(`[deleteImageFromS3] Deleting image with key=${key}`);

    const params = {
      Bucket: this.bucketName,
      Key: key,
    };

    const command = new DeleteObjectCommand(params);

    try {
      await this.s3.send(command);
      this.logger.log(
        `[deleteImageFromS3] Successfully deleted image with key=${key}`,
      );
    } catch (error) {
      this.logger.error(
        `[deleteImageFromS3] Failed to delete image with key=${key}`,
        error,
      );
      throw error;
    }
  }
}
