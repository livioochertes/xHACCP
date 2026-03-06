import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import path from "path";

// R2 Configuration - read at runtime to pick up env changes
function getR2Config() {
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    cdnUrl: process.env.R2_CDN_URL
  };
}

// Check if R2 is configured (CDN URL no longer required - images served via /r2/ proxy)
export function isR2Configured(): boolean {
  const config = getR2Config();
  return !!(config.accountId && config.accessKeyId && config.secretAccessKey && config.bucketName);
}

// Log R2 status (called once at startup)
export function logR2Status() {
  const config = getR2Config();
  const configured = isR2Configured();
  if (configured) {
    console.log("  - Account ID:", config.accountId?.slice(0, 8) + "...");
    console.log("  - Bucket:", config.bucketName);
    console.log("  - Images served via: /r2/ proxy route");
  }
}

// Create S3 client for R2
function getR2Client(): S3Client | null {
  const config = getR2Config();
  if (!isR2Configured()) {
    console.warn("⚠️ R2 storage not configured - falling back to local storage");
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
    },
  });
}

export interface UploadResult {
  filename: string;
  url: string;
  thumbnailUrl: string;
  originalName: string;
  size: number;
}

export async function uploadImageToR2(
  fileBuffer: Buffer,
  originalFilename: string,
  uploadType: "products" | "categories"
): Promise<UploadResult | null> {
  const client = getR2Client();
  
  if (!client) {
    return null; // R2 not configured
  }

  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  const ext = path.extname(originalFilename);
  const baseFilename = `${uploadType === 'categories' ? 'category' : 'product'}-${timestamp}-${randomNum}`;
  
  // Process main image
  const processedBuffer = await sharp(fileBuffer)
    .resize(800, 600, { 
      fit: 'inside',
      withoutEnlargement: true 
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Create thumbnail
  const thumbnailBuffer = await sharp(fileBuffer)
    .resize(200, 150, { 
      fit: 'cover',
      position: 'center' 
    })
    .webp({ quality: 70 })
    .toBuffer();

  const mainKey = `${uploadType}/processed-${baseFilename}.jpeg`;
  const thumbKey = `${uploadType}/thumb-${baseFilename}.webp`;

  const config = getR2Config();
  
  try {
    // Upload main image
    await client.send(new PutObjectCommand({
      Bucket: config.bucketName!,
      Key: mainKey,
      Body: processedBuffer,
      ContentType: 'image/jpeg',
    }));

    // Upload thumbnail
    await client.send(new PutObjectCommand({
      Bucket: config.bucketName!,
      Key: thumbKey,
      Body: thumbnailBuffer,
      ContentType: 'image/webp',
    }));

    console.log(`✅ Uploaded to R2: ${mainKey}`);

    return {
      filename: `processed-${baseFilename}.jpeg`,
      url: `/r2/${mainKey}`,
      thumbnailUrl: `/r2/${thumbKey}`,
      originalName: originalFilename,
      size: processedBuffer.length,
    };
  } catch (error) {
    console.error("❌ R2 upload error:", error);
    throw error;
  }
}

export async function deleteImageFromR2(imageUrl: string): Promise<boolean> {
  const config = getR2Config();
  const client = getR2Client();
  
  if (!client || !config.bucketName) {
    return false;
  }

  try {
    // Extract key from URL (supports both /r2/ proxy and CDN URLs)
    let key = imageUrl;
    if (key.startsWith("/r2/")) {
      key = key.replace("/r2/", "");
    } else if (config.cdnUrl) {
      const cdnBase = config.cdnUrl.replace(/\/$/, "");
      key = key.replace(`${cdnBase}/`, "");
    }

    await client.send(new DeleteObjectCommand({
      Bucket: config.bucketName!,
      Key: key,
    }));

    // Also try to delete thumbnail
    const thumbKey = key.replace('processed-', 'thumb-').replace('.jpeg', '.webp');
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: config.bucketName!,
        Key: thumbKey,
      }));
    } catch (e) {
      // Thumbnail might not exist
    }

    console.log(`✅ Deleted from R2: ${key}`);
    return true;
  } catch (error) {
    console.error("❌ R2 delete error:", error);
    return false;
  }
}

export async function getImageFromR2(key: string): Promise<{ body: any; contentType: string } | null> {
  const client = getR2Client();
  const config = getR2Config();
  if (!client || !config.bucketName) return null;

  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }));
    return {
      body: res.Body,
      contentType: res.ContentType || "image/jpeg",
    };
  } catch (e) {
    return null;
  }
}

// Upload multiple images
export async function uploadMultipleImagesToR2(
  files: { buffer: Buffer; originalname: string }[],
  uploadType: "products" | "categories"
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (const file of files) {
    const result = await uploadImageToR2(file.buffer, file.originalname, uploadType);
    if (result) {
      results.push(result);
    }
  }

  return results;
}
