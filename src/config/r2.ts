import { S3Client } from '@aws-sdk/client-s3';
import { config } from './index';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: config.r2.endpoint,
  credentials: {
    accessKeyId: config.r2.accessKeyId || '',
    secretAccessKey: config.r2.secretAccessKey || '',
  },
});

export const R2_BUCKET = config.r2.bucketName;
export const R2_PUBLIC_URL = config.r2.publicUrl;
