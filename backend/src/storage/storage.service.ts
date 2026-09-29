import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

/** MinIO's default region. Setting it spares the client a region lookup per signature. */
const REGION = 'us-east-1';

/** How long a signed download URL stays valid, in seconds. */
export const SIGNED_URL_TTL = 60 * 60;

function connection(url: URL) {
  const useSSL = url.protocol === 'https:';
  return {
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : useSSL ? 443 : 80,
    useSSL,
  };
}

/**
 * S3-compatible object storage (MinIO). The bucket stays private: files are read
 * through short-lived signed URLs built on S3_PUBLIC_URL, the address browsers reach.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  /** Talks to MinIO from the API (inside Docker: http://minio:9000). */
  private readonly client: Client;
  /** Only signs URLs, with the public host baked into the signature. Makes no requests. */
  private readonly signer: Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    const endpoint = new URL(config.getOrThrow<string>('S3_ENDPOINT'));
    const publicUrl = new URL(
      config.get<string>('S3_PUBLIC_URL') ?? endpoint.href,
    );
    const credentials = {
      accessKey: config.getOrThrow<string>('S3_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      region: REGION,
    };
    this.client = new Client({ ...connection(endpoint), ...credentials });
    this.signer = new Client({ ...connection(publicUrl), ...credentials });
    this.bucket = config.get<string>('S3_BUCKET', 'ordely-media');
  }

  /** Creates the bucket on first start. Storage being down must not stop the API. */
  async onModuleInit() {
    try {
      if (!(await this.client.bucketExists(this.bucket))) {
        await this.client.makeBucket(this.bucket, REGION);
        this.logger.log(`Created bucket "${this.bucket}"`);
      }
    } catch (err) {
      this.logger.warn(
        `Object storage unavailable (${(err as Error).message}); uploads will fail until it is reachable.`,
      );
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, body, body.length, {
      'Content-Type': contentType,
    });
  }

  async remove(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  /** A signed GET URL the browser can load directly. */
  url(key: string): Promise<string> {
    return this.signer.presignedGetObject(this.bucket, key, SIGNED_URL_TTL);
  }

  /** True when the bucket answers — used by the health check. */
  async isUp(): Promise<boolean> {
    try {
      return await this.client.bucketExists(this.bucket);
    } catch {
      return false;
    }
  }
}
