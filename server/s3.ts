import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Check if AWS S3 is configured
const isS3ConfiguredInEnv = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_S3_BUCKET_NAME
);

let s3Client: S3Client | null = null;
let BUCKET_NAME: string | undefined = undefined;
let CLOUDFRONT_URL: string | undefined = undefined;
let isS3Configured = false;

if (isS3ConfiguredInEnv) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
  CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL;
  
  console.log('⚙️  AWS S3 credentials found - checking permissions...');
  console.warn('⚠️  Note: If uploads fail due to permissions, local storage will be used automatically.');
  
  // We'll set isS3Configured to true tentatively
  // It will fall back to local storage on actual upload errors
  isS3Configured = true;
} else {
  console.warn('⚠️  AWS S3 not configured. Using local storage fallback.');
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

/**
 * Sube un archivo a S3 o almacenamiento local si S3 no está configurado
 */
export async function uploadToS3(
  file: Express.Multer.File,
  folder: 'companies' | 'parks' | 'lots' = 'lots'
): Promise<UploadResult> {
  const fileExtension = file.originalname.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const key = `${folder}/${fileName}`;

  // If S3 is configured, use S3
  if (isS3Configured && s3Client && BUCKET_NAME) {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      // Construir URL
      const url = CLOUDFRONT_URL 
        ? `${CLOUDFRONT_URL}/${key}`
        : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      console.log('✅ Uploaded to S3:', url);
      return {
        key,
        url,
        bucket: BUCKET_NAME,
      };
    } catch (error: any) {
      if (error.Code === 'AccessDenied') {
        console.error('❌ AWS S3 Access Denied - IAM user lacks s3:PutObject permission');
        console.error('   User:', error.message.match(/User: (arn:aws:iam::\d+:user\/\w+)/)?.[1] || 'unknown');
        console.error('   Bucket:', BUCKET_NAME);
        console.error('   ⚠️  Falling back to local storage. Contact AWS admin to grant S3 permissions.');
      } else {
        console.error('❌ S3 upload failed:', error.message || error);
        console.error('   ⚠️  Falling back to local storage');
      }
      // Fall through to local storage
    }
  }

  // Fallback: Use local storage
  const uploadDir = path.join(process.cwd(), 'static', 'uploads', folder);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, file.buffer);

  const url = `/uploads/${folder}/${fileName}`;
  console.log('✅ Uploaded to local storage:', url);

  return {
    key,
    url,
    bucket: 'local',
  };
}

/**
 * Elimina un archivo de S3 o del almacenamiento local
 */
export async function deleteFromS3(key: string): Promise<void> {
  // If S3 is configured, delete from S3
  if (isS3Configured && s3Client && BUCKET_NAME) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      await s3Client.send(command);
      console.log('✅ Deleted from S3:', key);
      return;
    } catch (error) {
      console.error('❌ S3 delete failed, trying local storage:', error);
      // Fall through to local storage
    }
  }

  // Fallback: Delete from local storage
  const filePath = path.join(process.cwd(), 'static', 'uploads', key);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('✅ Deleted from local storage:', key);
  }
}

/**
 * Genera una URL firmada temporal (para archivos privados)
 */
export async function getSignedUrlForObject(
  key: string,
  expiresIn: number = 3600 // 1 hora por defecto
): Promise<string> {
  if (isS3Configured && s3Client && BUCKET_NAME) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  }
  
  // Fallback: return local URL
  return `/uploads/${key}`;
}

/**
 * Obtiene la URL pública de un archivo
 */
export function getPublicUrl(key: string): string {
  if (isS3Configured) {
    if (CLOUDFRONT_URL) {
      return `${CLOUDFRONT_URL}/${key}`;
    }
    if (BUCKET_NAME) {
      return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    }
  }
  
  // Fallback: return local URL
  return `/uploads/${key}`;
}

/**
 * Extrae el key de S3 de una URL completa o path local
 */
export function extractS3KeyFromUrl(url: string): string | null {
  if (url.includes('amazonaws.com/')) {
    const parts = url.split('.amazonaws.com/');
    return parts.length > 1 ? parts[1] : null;
  } else if (url.includes('cloudfront.net/')) {
    const parts = url.split('.cloudfront.net/');
    return parts.length > 1 ? parts[1] : null;
  } else if (url.startsWith('/uploads/')) {
    // Local file path
    return url.replace('/uploads/', '');
  }
  return null;
}

export { s3Client, isS3Configured };


