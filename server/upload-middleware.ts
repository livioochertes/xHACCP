import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import { isR2Configured, uploadImageToR2, uploadRawFileToR2, deleteImageFromR2 } from './r2-storage';

// Extend Express Request interface to include processed files
declare global {
  namespace Express {
    interface Request {
      processedFiles?: {
        filename: string;
        thumbnail: string;
        originalName: string;
        size: number;
        url: string;
        thumbnailUrl: string;
      }[];
    }
  }
}

// Use memory storage when R2 is available, disk storage as fallback
const memoryStorage = multer.memoryStorage();

const diskStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadType = req.path.includes('categories') ? 'categories' : 'products';
    const uploadDir = path.join(process.cwd(), 'uploads', uploadType);
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const ext = path.extname(file.originalname);
    const fileType = req.path.includes('categories') ? 'category' : 'product';
    const filename = `${fileType}-${timestamp}-${randomNum}${ext}`;
    cb(null, filename);
  }
});

// File filter to accept only images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Use memory storage for R2, disk storage for local
const getStorage = () => {
  if (isR2Configured()) {
    console.log("📦 Using R2 cloud storage for uploads");
    return memoryStorage;
  }
  console.log("📁 Using local disk storage for uploads");
  return diskStorage;
};

// Helper function to save file locally
async function saveFileLocally(file: Express.Multer.File, uploadType: string) {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  const fileType = uploadType === 'categories' ? 'category' : 'product';
  const baseFilename = `${fileType}-${timestamp}-${randomNum}`;
  
  const uploadDir = path.join(process.cwd(), 'uploads', uploadType);
  await fs.mkdir(uploadDir, { recursive: true });
  
  const outputPath = path.join(uploadDir, `processed-${baseFilename}.jpeg`);
  const thumbnailPath = path.join(uploadDir, `thumb-${baseFilename}.webp`);
  
  await sharp(file.buffer)
    .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  await sharp(file.buffer)
    .resize(200, 150, { fit: 'cover', position: 'center' })
    .webp({ quality: 70 })
    .toFile(thumbnailPath);

  console.log(`  📁 Saved locally: /uploads/${uploadType}/processed-${baseFilename}.jpeg`);

  return {
    filename: `processed-${baseFilename}.jpeg`,
    thumbnail: `thumb-${baseFilename}.webp`,
    originalName: file.originalname,
    size: file.size,
    url: `/uploads/${uploadType}/processed-${baseFilename}.jpeg`,
    thumbnailUrl: `/uploads/${uploadType}/thumb-${baseFilename}.webp`
  };
}

// Configure multer with dynamic storage
export const upload = multer({
  storage: memoryStorage, // Always use memory, we'll decide where to save in processImages
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files per request
  }
});

// Middleware to process uploaded images
export const processImages = async (req: Request, res: Response, next: NextFunction) => {
  console.log("processImages middleware called");
  
  // Handle both single file and multiple files
  let files: Express.Multer.File[] = [];
  
  if (req.files && Array.isArray(req.files)) {
    files = req.files;
    console.log("Using req.files array with", files.length, "files");
  } else if (req.file) {
    files = [req.file];
    console.log("Using req.file single file");
  } else {
    console.log("No files found, calling next()");
    return next();
  }

  const uploadType = req.path.includes('categories') ? 'categories' : 'products';

  try {
    const processedFiles = [];

    // Check if R2 is configured
    const r2Configured = isR2Configured();
    
    if (r2Configured) {
      console.log("☁️ Attempting to upload to Cloudflare R2...");
      
      for (const file of files) {
        console.log(`  📤 Uploading: ${file.originalname} (${file.size} bytes)`);
        try {
          const result = await uploadImageToR2(file.buffer, file.originalname, uploadType);
          if (result) {
            console.log(`  ✅ R2 upload success: ${result.url}`);
            processedFiles.push({
              filename: result.filename,
              thumbnail: path.basename(result.thumbnailUrl),
              originalName: result.originalName,
              size: result.size,
              url: result.url,
              thumbnailUrl: result.thumbnailUrl
            });
          } else {
            console.error(`  ❌ R2 upload returned null for ${file.originalname} - falling back to local`);
            // Fall back to local storage for this file
            const localResult = await saveFileLocally(file, uploadType);
            processedFiles.push(localResult);
          }
        } catch (r2Error) {
          console.error(`  ❌ R2 upload error for ${file.originalname}:`, r2Error);
          console.log(`  📁 Falling back to local storage...`);
          // Fall back to local storage on R2 error
          const localResult = await saveFileLocally(file, uploadType);
          processedFiles.push(localResult);
        }
      }
    } else {
      console.log("📁 R2 not configured - saving to local filesystem...");
      for (const file of files) {
        const localResult = await saveFileLocally(file, uploadType);
        processedFiles.push(localResult);
      }
    }

    req.processedFiles = processedFiles;
    console.log("✅ Processed", processedFiles.length, "files");
    next();
  } catch (error) {
    console.error('Error processing images:', error);
    res.status(500).json({ success: false, message: 'Error processing images' });
  }
};

export async function uploadOriginalHomepageHeroImage(file: Express.Multer.File) {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(file.buffer).metadata();
  } catch {
    throw new Error('Homepage hero images must be valid JPEG, PNG, or WebP files.');
  }
  const formats: Record<string, { extension: string; contentType: string }> = {
    jpeg: { extension: 'jpg', contentType: 'image/jpeg' },
    png: { extension: 'png', contentType: 'image/png' },
    webp: { extension: 'webp', contentType: 'image/webp' },
  };
  const imageFormat = metadata.format ? formats[metadata.format] : undefined;
  if (!imageFormat || !metadata.width || !metadata.height) {
    throw new Error('Homepage hero images must be valid JPEG, PNG, or WebP files.');
  }

  const filename = `homepage-hero-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${imageFormat.extension}`;
  const key = `products/${filename}`;
  if (isR2Configured()) {
    const uploaded = await uploadRawFileToR2(file.buffer, key, imageFormat.contentType);
    if (!uploaded) throw new Error('Could not store the homepage hero image.');
    return {
      filename,
      originalName: file.originalname,
      size: file.size,
      width: metadata.width,
      height: metadata.height,
      url: `/r2/${key}`,
    };
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'products');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), file.buffer, { flag: 'wx' });
  return {
    filename,
    originalName: file.originalname,
    size: file.size,
    width: metadata.width,
    height: metadata.height,
    url: `/uploads/products/${filename}`,
  };
}

// Serve uploaded files (for local storage only)
export const serveUploads = (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filePath = path.join(process.cwd(), 'uploads', 'products', filename);
  
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ message: 'File not found' });
    }
  });
};

// Delete uploaded file (works for both local and R2)
export const deleteUploadedFile = async (imageUrl: string): Promise<boolean> => {
  try {
    // Check if this is an R2 URL (contains CDN domain)
    if (isR2Configured() && imageUrl.startsWith('http')) {
      return await deleteImageFromR2(imageUrl);
    }
    
    // Local file - extract filename from URL path
    const filename = path.basename(imageUrl);
    const uploadType = imageUrl.includes('/categories/') ? 'categories' : 'products';
    const filePath = path.join(process.cwd(), 'uploads', uploadType, filename);
    await fs.unlink(filePath);
    
    // Also try to delete thumbnail
    const thumbFilename = filename.replace('processed-', 'thumb-').replace('.jpeg', '.webp');
    const thumbPath = path.join(process.cwd(), 'uploads', uploadType, thumbFilename);
    try {
      await fs.unlink(thumbPath);
    } catch (e) {
      // Thumbnail might not exist
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};
