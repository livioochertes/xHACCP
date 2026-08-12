import type { Express } from "express";
import { storage } from "./storage";
import { db, pool } from "./db";
import { companySettings, suppliers, productMarkets, invoices } from "@shared/schema";
import { desc, eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { upload, processImages, serveUploads, deleteUploadedFile } from "./upload-middleware";
import { loadAllDataIntoMemory, refreshMarketCaches, applyVolumeDiscount, applyMarketOverlay, marketSettingsMap } from "./routes";
import multer from "multer";
import { readScheduleConfig, writeScheduleConfig } from "./blog-schedule-config";
import { restartBlogScheduler } from "./blog-scheduler";
import ExcelJS from "exceljs";
import * as cheerio from "cheerio";

async function buildCombinedParcels(items: any[], storageRef: typeof storage): Promise<any[]> {
  const parcels: any[] = [];
  let parcelCounter = 1;

  if (!items || items.length === 0) {
    parcels.push({ sequenceNo: 1, weight: 1, width: 30, height: 20, length: 40 });
    return parcels;
  }

  const itemsWithProducts: { item: any; product: any }[] = [];
  for (const item of items) {
    const product = await storageRef.getProduct(item.productId);
    if (product) {
      itemsWithProducts.push({ item, product });
    }
  }

  if (itemsWithProducts.length === 0) {
    parcels.push({ sequenceNo: 1, weight: 1, width: 30, height: 20, length: 40 });
    return parcels;
  }

  const categoryGroups = new Map<number, { item: any; product: any }[]>();
  for (const entry of itemsWithProducts) {
    const catId = entry.product.categoryId || 0;
    if (!categoryGroups.has(catId)) categoryGroups.set(catId, []);
    categoryGroups.get(catId)!.push(entry);
  }

  for (const [, group] of categoryGroups) {
    const allHaveMultiPack = group.every(
      (e) => (parseInt(String(e.product.piecesPerPackage)) || 1) > 1
    );

    if (allHaveMultiPack && group.length > 1) {
      const minPiecesPerPackage = Math.min(
        ...group.map((e) => parseInt(String(e.product.piecesPerPackage)) || 1)
      );
      const totalQuantity = group.reduce((sum, e) => sum + (e.item.quantity || 1), 0);
      const combinedWeight = group.reduce(
        (sum, e) => sum + (parseFloat(String(e.product.weight)) || 1) * (e.item.quantity || 1),
        0
      );
      const numberOfPackages = Math.ceil(totalQuantity / minPiecesPerPackage);
      const weightPerParcel = combinedWeight / numberOfPackages;

      console.log(`📦 Category group (${group.length} products): totalQty=${totalQuantity}, minPiecesPerPkg=${minPiecesPerPackage}, parcels=${numberOfPackages}`);

      for (let i = 0; i < numberOfPackages; i++) {
        parcels.push({
          sequenceNo: parcelCounter++,
          weight: parseFloat(weightPerParcel.toFixed(2)),
          width: 30,
          height: 20,
          length: 40,
        });
      }
    } else {
      for (const entry of group) {
        const piecesPerPackage = parseInt(String(entry.product.piecesPerPackage)) || 1;
        const weight = parseFloat(String(entry.product.weight)) || 1;
        const numberOfPackages = Math.ceil((entry.item.quantity || 1) / piecesPerPackage);
        for (let i = 0; i < numberOfPackages; i++) {
          parcels.push({
            sequenceNo: parcelCounter++,
            weight,
            width: 30,
            height: 20,
            length: 40,
          });
        }
      }
    }
  }

  if (parcels.length === 0) {
    parcels.push({ sequenceNo: 1, weight: 1, width: 30, height: 20, length: 40 });
  }

  return parcels;
}

// Helper function to extract URL from image object or string
function extractImageUrl(image: any): string | null {
  if (!image) return null;
  
  // If it's already a string URL, return it
  if (typeof image === 'string') {
    // Check if it's a JSON string that was accidentally stringified
    if (image.startsWith('{') && image.includes('"url"')) {
      try {
        const parsed = JSON.parse(image);
        return parsed.url || parsed.thumbnailUrl || null;
      } catch {
        return image; // Return as-is if parsing fails
      }
    }
    return image;
  }
  
  // If it's an object with url property, extract it
  if (typeof image === 'object' && image !== null) {
    return image.url || image.thumbnailUrl || null;
  }
  
  return null;
}

// Process images array to extract URLs
function processImagesArray(images: any[]): string[] {
  if (!Array.isArray(images)) return [];
  
  return images
    .map(img => extractImageUrl(img))
    .filter((url): url is string => url !== null && url.length > 0);
}

// Rate limiting for admin login attempts
// keyGenerator includes the host so xhaccp.ro and xhaccp.fr have separate counters
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP+domain to 20 requests per windowMs
  message: { message: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = (req.headers['x-forwarded-for'] as string || req.ip || '').split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'unknown';
    return `${ip}::${host}`;
  },
});

// Rate limiting for 2FA attempts
const twoFactorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP+domain to 10 requests per windowMs
  message: { message: "Too many 2FA attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = (req.headers['x-forwarded-for'] as string || req.ip || '').split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'unknown';
    return `${ip}::${host}`;
  },
});

interface AdminAuthRequest extends Request {
  adminId?: number;
  admin?: any;
  adminMarkets?: string[];
  isSuperAdmin?: boolean;
}

// Market access helper — superadmin (empty adminMarkets) can access all markets
function canAccessMarket(req: AdminAuthRequest, market: string): boolean {
  const allowed = req.adminMarkets || [];
  return allowed.length === 0 || allowed.includes(market);
}

// Admin authentication middleware
const authenticateAdmin = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token) {
      console.log("No token provided");
      return res.status(401).json({ message: "Admin authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback-secret") as { id?: number; adminId?: number; isAdmin?: boolean };
    
    // Support both token structures: regular admin tokens (with id) and admin-specific tokens (with adminId)
    const userId = decoded.id || decoded.adminId;
    if (!userId) {
      return res.status(401).json({ message: "Invalid token structure" });
    }

    const admin = await storage.getUser(userId);
    
    if (!admin || !admin.isAdmin) {
      return res.status(401).json({ message: "Admin access denied" });
    }

    req.adminId = userId;
    req.admin = admin;
    req.adminMarkets = (admin.adminMarkets as string[]) || [];
    req.isSuperAdmin = req.adminMarkets.length === 0;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid admin token" });
  }
};

// Generate backup codes
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

// Supplier API synchronization helper functions
async function simulateSupplierDeliverySync(supplier: any, deliveryUpdate: any) {
  // Simulate API call based on supplier's integration type
  switch (supplier.integrationType) {
    case 'api':
      if (supplier.apiEndpoint && supplier.apiKey) {
        // Simulate REST API call
        return {
          success: true,
          method: 'POST',
          endpoint: `${supplier.apiEndpoint}/delivery/update`,
          response: {
            orderId: deliveryUpdate.orderId,
            status: deliveryUpdate.deliveryStatus,
            trackingNumber: deliveryUpdate.trackingNumber,
            estimatedDelivery: deliveryUpdate.estimatedDelivery,
            supplierResponse: "Delivery status updated successfully"
          }
        };
      }
      break;
    case 'email':
      // Simulate email notification
      return {
        success: true,
        method: 'EMAIL',
        recipient: supplier.email,
        response: {
          subject: `Delivery Update for Order #${deliveryUpdate.orderId}`,
          message: `Delivery status: ${deliveryUpdate.deliveryStatus}`,
          sent: true
        }
      };
    case 'manual':
      // Manual process - just log the update
      return {
        success: true,
        method: 'MANUAL',
        response: {
          message: "Manual delivery update logged",
          requiresHumanAction: true
        }
      };
    default:
      return {
        success: false,
        message: "Unknown integration type"
      };
  }
}

async function fetchSupplierDeliveryStatus(supplier: any, orderId: string) {
  // Simulate fetching delivery status from supplier's system
  const mockStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
  
  return {
    orderId,
    supplierId: supplier.id,
    supplierName: supplier.name,
    deliveryStatus: randomStatus,
    trackingNumber: `TRK${Date.now()}`,
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdated: new Date().toISOString(),
    integrationType: supplier.integrationType,
    apiEndpoint: supplier.apiEndpoint
  };
}

// Fetch updated prices from supplier's API
async function fetchSupplierPrices(supplier: any) {
  // Simulate API call to fetch prices from supplier
  const mockPriceUpdates = [
    { productId: 7537, price: 125.99, compareAtPrice: 149.99, stockQuantity: 15 },
    { productId: 7536, price: 89.99, compareAtPrice: 109.99, stockQuantity: 22 },
    { productId: 7535, price: 34.99, compareAtPrice: 39.99, stockQuantity: 45 }
  ];

  if (supplier.integrationType === 'api' && supplier.apiEndpoint) {
    // In real implementation, make HTTP request to supplier's API
    // const response = await fetch(`${supplier.apiEndpoint}/prices`, {
    //   headers: { 'Authorization': `Bearer ${supplier.apiKey}` }
    // });
    // return await response.json();
    
    return mockPriceUpdates;
  }
  
  return mockPriceUpdates;
}

// Fetch updated stock from supplier's API
async function fetchSupplierStock(supplier: any) {
  // Simulate API call to fetch stock from supplier
  const mockStockUpdates = [
    { productId: 7537, stockQuantity: 18 },
    { productId: 7536, stockQuantity: 25 },
    { productId: 7535, stockQuantity: 42 },
    { productId: 7534, stockQuantity: 8 }
  ];

  if (supplier.integrationType === 'api' && supplier.apiEndpoint) {
    // In real implementation, make HTTP request to supplier's API
    // const response = await fetch(`${supplier.apiEndpoint}/stock`, {
    //   headers: { 'Authorization': `Bearer ${supplier.apiKey}` }
    // });
    // return await response.json();
    
    return mockStockUpdates;
  }
  
  return mockStockUpdates;
}

// Forward order to supplier
async function forwardOrderToSupplier(supplier: any, orderData: any) {
  try {
    switch (supplier.integrationType) {
      case 'api':
        if (supplier.apiEndpoint && supplier.apiKey) {
          // In real implementation, make HTTP request to supplier's API
          // const response = await fetch(`${supplier.apiEndpoint}/orders`, {
          //   method: 'POST',
          //   headers: { 
          //     'Authorization': `Bearer ${supplier.apiKey}`,
          //     'Content-Type': 'application/json'
          //   },
          //   body: JSON.stringify(orderData)
          // });
          
          return {
            success: true,
            method: 'API',
            endpoint: `${supplier.apiEndpoint}/orders`,
            data: {
              orderId: orderData.orderId,
              supplierOrderId: `SUP-${Date.now()}`,
              status: 'forwarded',
              message: 'Order successfully forwarded to supplier API',
              items: orderData.items.length,
              totalAmount: orderData.items.reduce((sum: number, item: any) => sum + parseFloat(item.totalPrice), 0)
            }
          };
        }
        break;
        
      case 'email':
        // Format order for email
        const emailContent = {
          to: supplier.email,
          subject: `New Order #${orderData.orderId} - ${supplier.name}`,
          html: `
            <h2>New Order Received</h2>
            <p><strong>Order ID:</strong> ${orderData.orderId}</p>
            <p><strong>Order Date:</strong> ${orderData.orderDate}</p>
            
            <h3>Delivery Address:</h3>
            <p>${orderData.shippingAddress.name}<br>
            ${orderData.shippingAddress.street}<br>
            ${orderData.shippingAddress.city}, ${orderData.shippingAddress.zipCode}<br>
            ${orderData.shippingAddress.country}</p>
            
            <h3>Order Items:</h3>
            <table border="1" style="border-collapse: collapse;">
              <tr>
                <th>Product</th>
                <th>Code</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
              ${orderData.items.map((item: any) => `
                <tr>
                  <td>${item.productName}</td>
                  <td>${item.productCode || 'N/A'}</td>
                  <td>${item.quantity}</td>
                  <td>€${item.price}</td>
                  <td>€${item.totalPrice}</td>
                </tr>
              `).join('')}
            </table>
            
            <p><strong>Instructions:</strong> ${orderData.supplierInstructions}</p>
          `
        };
        
        return {
          success: true,
          method: 'EMAIL',
          data: {
            orderId: orderData.orderId,
            recipient: supplier.email,
            subject: emailContent.subject,
            status: 'sent',
            message: 'Order details sent via email'
          }
        };
        
      case 'manual':
        return {
          success: true,
          method: 'MANUAL',
          data: {
            orderId: orderData.orderId,
            status: 'logged',
            message: 'Order logged for manual processing',
            requiresHumanAction: true
          }
        };
        
      default:
        return {
          success: false,
          message: 'Unknown integration type'
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to forward order: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function performSupplierSync(supplier: any, order: any, action: string) {
  try {
    switch (action) {
      case 'fetch_status':
        const status = await fetchSupplierDeliveryStatus(supplier, order.id.toString());
        return {
          success: true,
          message: "Delivery status fetched successfully",
          data: status
        };
      
      case 'update_delivery':
        const updateResult = await simulateSupplierDeliverySync(supplier, {
          orderId: order.id,
          deliveryStatus: 'processing',
          trackingNumber: `TRK${Date.now()}`,
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        });
        return {
          success: true,
          message: "Delivery status updated with supplier",
          data: updateResult
        };
      
      case 'notify_suppliers':
        // Send notification to supplier about order
        const notificationResult = await simulateSupplierDeliverySync(supplier, {
          orderId: order.id,
          deliveryStatus: 'notification',
          message: `New order #${order.id} requires processing`
        });
        return {
          success: true,
          message: "Supplier notified successfully",
          data: notificationResult
        };
      
      default:
        return {
          success: false,
          message: "Unknown sync action"
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function registerAdminRoutes(app: Express) {
  // Serve uploaded files
  app.get("/uploads/products/:filename", serveUploads);

  // Image upload endpoint
  app.post("/admin/api/upload-images", authenticateAdmin, upload.array('images', 10), processImages, async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!req.processedFiles || req.processedFiles.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "No files uploaded" 
        });
      }

      res.json({
        success: true,
        message: `${req.processedFiles.length} image(s) uploaded successfully`,
        files: req.processedFiles
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error uploading images" 
      });
    }
  });

  // Delete image endpoint - supports both filename param and full URL in body
  app.delete("/admin/api/delete-image/:filename", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { filename } = req.params;
      const deleted = await deleteUploadedFile(filename);
      
      if (deleted) {
        res.json({ success: true, message: "Image deleted successfully" });
      } else {
        res.status(404).json({ success: false, message: "Image not found" });
      }
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ success: false, message: "Error deleting image" });
    }
  });

  // Delete image by URL endpoint - for R2 stored images
  app.post("/admin/api/delete-image-by-url", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ success: false, message: "Image URL is required" });
      }
      
      console.log(`Attempting to delete image: ${imageUrl}`);
      const deleted = await deleteUploadedFile(imageUrl);
      
      if (deleted) {
        res.json({ success: true, message: "Image deleted successfully from storage" });
      } else {
        // Even if server delete fails, return success so UI can proceed
        res.json({ success: true, message: "Image removed (may not exist in storage)" });
      }
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ success: false, message: "Error deleting image" });
    }
  });

  // Admin login endpoint
  app.post("/admin/api/login", adminLoginLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find admin user
      const admin = await storage.getUserByEmail(email);
      if (!admin || !admin.isAdmin) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      // Check if 2FA is enabled
      if (admin.twoFactorEnabled) {
        // Generate a temporary token for 2FA verification
        const tempToken = jwt.sign(
          { adminId: admin.id, stage: "2fa_required" },
          process.env.JWT_SECRET || "fallback-secret",
          { expiresIn: "10m" }
        );
        
        return res.json({
          message: "2FA verification required",
          tempToken,
          requiresTwoFactor: true
        });
      }

      // Generate access token
      const token = jwt.sign(
        { adminId: admin.id, adminMarkets: admin.adminMarkets || [] },
        process.env.JWT_SECRET || "fallback-secret",
        { expiresIn: "24h" }
      );

      res.json({
        message: "Admin login successful",
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          twoFactorEnabled: admin.twoFactorEnabled,
          adminMarkets: admin.adminMarkets || []
        }
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Forgot password endpoint
  app.post("/admin/api/forgot-password", adminLoginLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email este obligatoriu." });
      }

      // Always return success to avoid email enumeration
      const admin = await storage.getUserByEmail(email);
      if (!admin || !admin.isAdmin) {
        return res.json({ message: "Dacă adresa există, veți primi un email cu parola temporară." });
      }

      // Generate temporary password
      const tempPassword = crypto.randomBytes(6).toString("hex"); // 12 chars hex
      const hashed = await bcrypt.hash(tempPassword, 10);

      // Update password in DB
      await db.execute(
        `UPDATE users SET password = $1 WHERE id = $2`,
        [hashed, admin.id]
      );

      // Send email
      const { sendEmail } = await import("./email-service.js");
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@xhaccp.com";
      await sendEmail({
        to: email,
        from: fromEmail,
        subject: "xHACCP Admin – Parolă temporară",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px;">
            <h2 style="color:#6c63ff;margin-top:0;">Reset parolă Admin</h2>
            <p>Salut,</p>
            <p>Ai solicitat resetarea parolei pentru contul tău de administrator <strong>xHACCP</strong>.</p>
            <p>Parola ta temporară este:</p>
            <div style="background:#fff;border:2px solid #6c63ff;border-radius:8px;padding:16px;text-align:center;font-size:22px;font-weight:bold;letter-spacing:4px;color:#333;margin:16px 0;">
              ${tempPassword}
            </div>
            <p style="color:#e53e3e;font-size:13px;">⚠️ Schimbă această parolă imediat după autentificare din setările contului.</p>
            <p style="color:#888;font-size:12px;">Dacă nu ai solicitat această resetare, ignoră acest email.</p>
          </div>
        `,
        text: `Parola ta temporară xHACCP Admin: ${tempPassword}\n\nSchimb-o imediat după autentificare.`,
      });

      return res.json({ message: "Email trimis. Verificați inbox-ul (și folderul spam)." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Eroare internă. Încercați din nou." });
    }
  });

  // 2FA verification endpoint
  app.post("/admin/api/verify-2fa", twoFactorLimiter, async (req: Request, res: Response) => {
    try {
      const { tempToken, code, backupCode } = req.body;
      
      if (!tempToken || (!code && !backupCode)) {
        return res.status(400).json({ message: "Temporary token and verification code are required" });
      }

      // Verify temporary token
      const decoded = jwt.verify(tempToken, process.env.JWT_SECRET || "fallback-secret") as { adminId: number, stage: string };
      
      if (decoded.stage !== "2fa_required") {
        return res.status(401).json({ message: "Invalid verification stage" });
      }

      const admin = await storage.getUser(decoded.adminId);
      if (!admin || !admin.isAdmin || !admin.twoFactorEnabled) {
        return res.status(401).json({ message: "Invalid admin or 2FA not enabled" });
      }

      let isValid = false;

      if (backupCode) {
        // Verify backup code
        const backupCodes = admin.twoFactorBackupCodes as string[] || [];
        const codeIndex = backupCodes.indexOf(backupCode.toUpperCase());
        
        if (codeIndex !== -1) {
          isValid = true;
          // Remove used backup code
          backupCodes.splice(codeIndex, 1);
          await storage.updateUser(admin.id, { twoFactorBackupCodes: backupCodes });
        }
      } else if (code) {
        // Verify TOTP code
        isValid = speakeasy.totp.verify({
          secret: admin.twoFactorSecret!,
          encoding: 'base32',
          token: code,
          window: 2
        });
      }

      if (!isValid) {
        return res.status(401).json({ message: "Invalid verification code" });
      }

      // Generate final access token
      const token = jwt.sign(
        { adminId: admin.id, adminMarkets: admin.adminMarkets || [] },
        process.env.JWT_SECRET || "fallback-secret",
        { expiresIn: "24h" }
      );

      res.json({
        message: "2FA verification successful",
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          twoFactorEnabled: admin.twoFactorEnabled,
          adminMarkets: admin.adminMarkets || []
        }
      });
    } catch (error) {
      console.error("2FA verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enable 2FA endpoint
  app.post("/admin/api/enable-2fa", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      if (req.admin.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA is already enabled" });
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `xHACCP Admin (${req.admin.email})`,
        issuer: 'xHACCP',
        length: 32
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
      
      // Store secret temporarily (not yet enabled)
      await storage.updateUser(req.admin.id, { twoFactorSecret: secret.base32 });

      res.json({
        message: "2FA setup initiated",
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32
      });
    } catch (error) {
      console.error("Enable 2FA error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Confirm 2FA setup
  app.post("/admin/api/confirm-2fa", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
      }

      if (!req.admin || !req.admin.twoFactorSecret) {
        return res.status(400).json({ message: "2FA setup not initiated" });
      }

      // Verify the code
      const isValid = speakeasy.totp.verify({
        secret: req.admin.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });

      if (!isValid) {
        return res.status(401).json({ message: "Invalid verification code" });
      }

      // Generate backup codes
      const backupCodes = generateBackupCodes();

      // Enable 2FA
      await storage.updateUser(req.admin.id, {
        twoFactorEnabled: true,
        twoFactorBackupCodes: backupCodes
      });

      res.json({
        message: "2FA enabled successfully",
        backupCodes
      });
    } catch (error) {
      console.error("Confirm 2FA error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Disable 2FA endpoint
  app.post("/admin/api/disable-2fa", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { code, backupCode } = req.body;
      
      if (!code && !backupCode) {
        return res.status(400).json({ message: "Verification code or backup code is required" });
      }

      if (!req.admin || !req.admin.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA is not enabled" });
      }

      let isValid = false;

      if (backupCode) {
        // Verify backup code
        const backupCodes = req.admin.twoFactorBackupCodes as string[] || [];
        isValid = backupCodes.includes(backupCode.toUpperCase());
      } else if (code) {
        // Verify TOTP code
        isValid = speakeasy.totp.verify({
          secret: req.admin.twoFactorSecret!,
          encoding: 'base32',
          token: code,
          window: 2
        });
      }

      if (!isValid) {
        return res.status(401).json({ message: "Invalid verification code" });
      }

      // Disable 2FA
      await storage.updateUser(req.admin.id, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: []
      });

      res.json({ message: "2FA disabled successfully" });
    } catch (error) {
      console.error("Disable 2FA error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get admin profile
  app.get("/admin/api/profile", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "Admin authentication required" });
      }

      res.json({
        id: req.admin.id,
        email: req.admin.email,
        firstName: req.admin.firstName,
        lastName: req.admin.lastName,
        twoFactorEnabled: req.admin.twoFactorEnabled
      });
    } catch (error) {
      console.error("Get admin profile error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin dashboard stats
  app.get("/admin/api/stats", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      console.log("Admin stats endpoint called");
      // Restricted admins only see data for their markets; superadmins see all
      // Superadmins can also pass ?market=xx to filter dashboard by selected tab
      let markets: string[] | undefined;
      if (!req.isSuperAdmin) {
        markets = req.adminMarkets || [];
      } else {
        const marketParam = req.query.market as string | undefined;
        if (marketParam && marketParam !== 'all') {
          markets = [marketParam];
        }
      }

      const totalUsers = await storage.getTotalUsers();
      const totalOrders = await storage.getTotalOrders(markets);
      const totalProducts = await storage.getTotalProducts();
      const recentOrders = await storage.getRecentOrders(10, markets);

      res.json({
        totalUsers,
        totalOrders,
        totalProducts,
        recentOrders
      });
    } catch (error) {
      console.error("Get admin stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin logout
  app.post("/admin/api/logout", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      // In a real implementation, you might want to blacklist the token
      res.json({ message: "Admin logout successful" });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin User Management Routes
  app.get("/admin/api/users", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;
      const marketParam = req.query.market as string | undefined;

      if (!isSuperAdmin) {
        // Market-restricted admin: scope by JWT markets
        const orders = await storage.getOrders();
        const userIdsWithOrders = new Set(
          orders
            .filter(o => allowedMarkets.includes(o.market || 'ro') && o.userId)
            .map(o => o.userId!)
        );
        const filtered = users.filter(u =>
          userIdsWithOrders.has(u.id) ||
          (u.isAdmin && ((u.adminMarkets as string[]) || []).some((m: string) => allowedMarkets.includes(m)))
        );
        return res.json(filtered);
      }

      // Superadmin: optionally filter by selected market tab
      if (marketParam && marketParam !== 'all') {
        const orders = await storage.getOrders();
        const userIdsWithOrders = new Set(
          orders
            .filter(o => (o.market || 'ro') === marketParam && o.userId)
            .map(o => o.userId!)
        );
        const filtered = users.filter(u =>
          userIdsWithOrders.has(u.id) ||
          (u.isAdmin && ((u.adminMarkets as string[]) || []).includes(marketParam))
        );
        return res.json(filtered);
      }

      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/admin/api/users", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { email, password, firstName, lastName, isAdmin = false, adminMarkets } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userData: any = {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        isAdmin
      };
      // Only superadmins can set adminMarkets on new users
      if (req.isSuperAdmin && Array.isArray(adminMarkets)) {
        userData.adminMarkets = adminMarkets;
      }
      // Privilege escalation prevention: non-superadmins cannot create global admin accounts
      if (!req.isSuperAdmin && userData.isAdmin) {
        const callerMarkets = req.adminMarkets || [];
        if (!Array.isArray(userData.adminMarkets) || userData.adminMarkets.length === 0) {
          userData.adminMarkets = callerMarkets;
        } else {
          const intersection = userData.adminMarkets.filter((m: string) => callerMarkets.includes(m));
          userData.adminMarkets = intersection.length > 0 ? intersection : callerMarkets;
        }
        // Final invariant: non-superadmins can NEVER persist [] (= superadmin semantics)
        if (userData.adminMarkets.length === 0) {
          return res.status(403).json({ message: "Cannot create a global admin account from a market-restricted account" });
        }
      }

      const newUser = await storage.createUser(userData);

      res.json({ message: "User created successfully", user: { id: newUser.id, email: newUser.email } });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/admin/api/users/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { email, firstName, lastName, isAdmin, adminMarkets } = req.body;

      // Scope check: non-superadmins can only modify users within their market scope
      if (!req.isSuperAdmin) {
        const targetUser = await storage.getUser(userId);
        if (targetUser) {
          const orders = await storage.getOrders();
          const hasOrderInMarket = orders.some(o => o.userId === userId && (req.adminMarkets || []).includes(o.market || 'ro'));
          const isAdminWithOverlap = targetUser.isAdmin && ((targetUser.adminMarkets as string[]) || []).some((m: string) => (req.adminMarkets || []).includes(m));
          if (!hasOrderInMarket && !isAdminWithOverlap) {
            return res.status(403).json({ message: "Access denied: user is not in your market scope" });
          }
        }
      }
      
      const updateData: any = {
        email,
        firstName,
        lastName,
        isAdmin
      };
      // Only superadmins may modify adminMarkets — all others are blocked
      if (Array.isArray(adminMarkets)) {
        if (!req.isSuperAdmin) {
          return res.status(403).json({ message: "Only superadmins can modify admin market assignments" });
        }
        updateData.adminMarkets = adminMarkets;
      }
      // Non-superadmin isAdmin promotion invariant: ensure adminMarkets is never empty
      // (empty = superadmin semantics). Force to caller's markets if not set by superadmin.
      if (!req.isSuperAdmin && updateData.isAdmin) {
        const callerMarkets = req.adminMarkets || [];
        if (callerMarkets.length === 0) {
          return res.status(403).json({ message: "Cannot promote users to admin from a market-restricted account with no markets assigned" });
        }
        // Always force adminMarkets when non-superadmin promotes — ensures no [] escapes
        updateData.adminMarkets = callerMarkets;
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      res.json({ message: "User updated successfully", user: updatedUser });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/admin/api/users/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Don't allow deleting own account
      if (userId === req.adminId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Scope check: non-superadmins can only delete users within their market scope
      if (!req.isSuperAdmin) {
        const targetUser = await storage.getUser(userId);
        if (targetUser) {
          const orders = await storage.getOrders();
          const hasOrderInMarket = orders.some(o => o.userId === userId && (req.adminMarkets || []).includes(o.market || 'ro'));
          const isAdminWithOverlap = targetUser.isAdmin && ((targetUser.adminMarkets as string[]) || []).some((m: string) => (req.adminMarkets || []).includes(m));
          if (!hasOrderInMarket && !isAdminWithOverlap) {
            return res.status(403).json({ message: "Access denied: user is not in your market scope" });
          }
        }
      }

      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin Order Management Routes
  app.get("/admin/api/orders", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { status, limit = 50, offset = 0, supplierId, market } = req.query;
      
      const orders = await storage.getOrders();
      
      let filteredOrders = orders;
      if (status) {
        filteredOrders = orders.filter(order => order.status === status);
      }
      
      // Enforce market restriction for non-superadmins
      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;
      if (!isSuperAdmin) {
        filteredOrders = filteredOrders.filter(order => allowedMarkets.includes(order.market || 'ro'));
      }
      
      // Filter by market if specified
      if (market && market !== 'all') {
        filteredOrders = filteredOrders.filter(order => (order.market || 'ro') === market);
      }
      
      // Filter by supplier if specified
      if (supplierId) {
        filteredOrders = filteredOrders.filter(order => 
          (order as any).orderItems && (order as any).orderItems.some((item: any) => item.supplierId === parseInt(supplierId as string))
        );
      }
      
      const paginatedOrders = filteredOrders.slice(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string)
      );

      res.json(paginatedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Bulk update order status (must come before individual endpoint)
  app.put("/admin/api/orders/bulk/status", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { orderIds, status } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "Order IDs array is required" });
      }
      
      if (!status || !['pending', 'processing', 'shipped', 'in_delivery', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const results = [];
      for (const orderId of orderIds) {
        try {
          const parsedOrderId = parseInt(orderId);
          if (isNaN(parsedOrderId)) {
            results.push({ orderId, success: false, error: "Invalid order ID" });
            continue;
          }
          const existingOrder = await storage.getOrder(parsedOrderId);
          if (!existingOrder || !canAccessMarket(req, existingOrder.market || 'ro')) {
            results.push({ orderId, success: false, error: "Access denied or order not found" });
            continue;
          }
          const order = await storage.updateOrderStatus(parsedOrderId, status);
          results.push({ orderId, success: true, order });
        } catch (error) {
          results.push({ orderId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      res.json({ 
        message: `Bulk status update completed`,
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      });
    } catch (error) {
      console.error("Bulk update order status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get individual order details
  app.get("/admin/api/orders/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      
      if (isNaN(orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID' });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (!canAccessMarket(req, order.market || 'ro')) {
        return res.status(403).json({ success: false, message: 'Access denied for this market' });
      }

      res.json({ success: true, order });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch order' });
    }
  });

  // Individual order status update
  app.put("/admin/api/orders/:id/status", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      
      const validStatuses = ['pending', 'processing', 'shipped', 'in_delivery', 'delivered', 'cancelled', 'accepted', 'manual_processing', 'manual_failed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const existingOrder = await storage.getOrder(orderId);
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (!canAccessMarket(req, existingOrder.market || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      const updatedOrder = await storage.updateOrderStatus(orderId, status);
      res.json({ message: "Order status updated successfully", order: updatedOrder });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Accept order with email notifications
  app.post("/admin/api/orders/:id/accept", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      
      if (isNaN(orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID' });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (!canAccessMarket(req, order.market || 'ro')) {
        return res.status(403).json({ success: false, message: 'Access denied for this market' });
      }

      if (order.status === 'processing' || order.status === 'accepted' || order.status === 'shipped' || order.status === 'in_delivery' || order.status === 'delivered') {
        return res.status(400).json({ success: false, message: 'Order has already been processed' });
      }

      // Atomic conditional claim: rejects if manual processing has already claimed this order.
      // storage.acceptOrder uses a WHERE (source IS NULL OR source = 'website') clause.
      const updatedOrder = await storage.acceptOrder(orderId);
      if (!updatedOrder) {
        return res.status(409).json({
          success: false,
          message: 'Comanda a fost deja preluată pentru procesare manuală și nu poate fi acceptată automat.',
        });
      }

      res.json({
        success: true,
        message: "Order accepted successfully. Invoice, AWB and emails are being processed in background.",
        order: updatedOrder,
      });

      (async () => {
        try {
          console.log(`🔄 [Background] Processing acceptance flow for order #${orderId}...`);

          let user: any = null;
          if (order.userId) {
            user = await storage.getUser(order.userId);
          }

          const shippingAddr = order.shippingAddress as any;
          const billingAddr = order.billingAddress as any;

          if (!user) {
            const guestEmail = shippingAddr?.email || billingAddr?.email || '';
            const notesEmailMatch = order.notes?.match(/Guest email:\s*([^\s,]+)/);
            const resolvedEmail = guestEmail || (notesEmailMatch ? notesEmailMatch[1] : '');

            if (resolvedEmail) {
              const existingUser = await storage.getUserByEmail(resolvedEmail);
              if (existingUser) {
                user = existingUser;
                await storage.updateOrder(orderId, { userId: existingUser.id });
                (order as any).userId = existingUser.id;
                console.log(`🔗 [Background] Linked order #${orderId} to registered user ${existingUser.id} (${resolvedEmail})`);
              }
            }

            if (!user) {
              user = {
                id: 0,
                email: resolvedEmail,
                firstName: shippingAddr?.firstName || billingAddr?.firstName || 'Guest',
                lastName: shippingAddr?.lastName || billingAddr?.lastName || 'Customer',
                isAdmin: false,
              };
              console.log(`📧 [Background] Accept order #${orderId}: guest order, no registered user for ${resolvedEmail}`);
            }
          }

          const isCOD = order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'cod' || order.paymentMethod === 'cash';
          let invoiceGenerated = false;
          let invoiceNumber: string | undefined;
          let invoiceId: number | undefined;
          let awbNumber: string | undefined;

          try {
            console.log(`📄 [Background] Generating SmartBill invoice for order #${orderId} (${isCOD ? 'COD' : order.paymentMethod})...`);
            const { createInvoiceService } = await import('./invoice-service.js');
            const invoiceService = await createInvoiceService();
            const invoice = await invoiceService.generateInvoiceAfterPayment(
              orderId,
              {
                status: 'succeeded',
                paymentMethod: isCOD ? 'cash_on_delivery' : (order.paymentMethod || 'card'),
                paymentId: isCOD ? `cod_${orderId}` : `accept_${orderId}`,
                amount: parseFloat(String(order.totalAmount)),
              }
            );
            console.log(`✅ [Background] Invoice generated for order #${orderId}: ${invoice.invoiceNumber}`);
            invoiceGenerated = true;
            invoiceNumber = invoice.invoiceNumber;
            invoiceId = invoice.id;
          } catch (invoiceError) {
            console.error(`❌ [Background] Failed to generate invoice for order #${orderId}:`, invoiceError);
          }

          try {
            console.log(`📦 [Background] Generating AWB for order #${orderId}...`);
            const bgAwbTimeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Background AWB generation timeout after 90s')), 90000)
            );
            await Promise.race([
              (async () => {
                const { createSamedayAPI } = await import('./sameday-api');
                const samedayAPI = createSamedayAPI();
                if (samedayAPI) {
                  const currentOrder = await storage.getOrder(orderId);
                  if (currentOrder && !currentOrder.awbNumber) {
                    console.log(`📦 [Background] Fetching pickup points and services...`);
                    const [pickupPoints, services] = await Promise.all([
                      samedayAPI.getPickupPoints(),
                      samedayAPI.getServices()
                    ]);
                    console.log(`📦 [Background] Pickup points: ${pickupPoints.length}, Services: ${services.length}`);

                    if (pickupPoints.length > 0 && services.length > 0) {
                      const selectedPickupPoint = pickupPoints.find((p: any) => p.id === 447249) || pickupPoints[0];
                      const parcels = await buildCombinedParcels(currentOrder.items || [], storage);
                      console.log(`📦 [Background] Combined parcels: ${parcels.length} parcel(s) for ${(currentOrder.items || []).length} item(s)`);

                      const totalAmount = parseFloat(String(currentOrder.totalAmount));
                      const defaultContact = selectedPickupPoint.contactPersons?.find((c: any) => c.default) || selectedPickupPoint.contactPersons?.[0];
                      const preferredService = services.find((s: any) => {
                        const name = s.name?.toLowerCase() || '';
                        if (name.includes('retur') || name.includes('return')) return false;
                        return name.includes('standard') || name.includes('next day');
                      });
                      if (!preferredService) {
                        console.warn(`⚠️ [Background] No 'Standard'/'Next Day' service found, falling back to first service: ${services[0].id} (${services[0].name})`);
                      }
                      const standardService = preferredService || services[0];
                      console.log(`📦 [Background] Using service: ${standardService.id} (${standardService.name})`);
                      const countyVal = shippingAddr?.state || shippingAddr?.county || '';
                      const cityVal = shippingAddr?.city || countyVal || 'N/A';
                      const isB2BBackground = !!(billingAddr?.companyName);
                      const awbData: any = {
                        pickupPoint: selectedPickupPoint.id,
                        contactPerson: defaultContact?.id,
                        service: standardService.id,
                        packageType: 0,
                        packageWeight: parcels.reduce((sum: number, p: any) => sum + p.weight, 0),
                        awbPayment: 1,
                        awbRecipient: {
                          name: `${shippingAddr?.firstName || ''} ${shippingAddr?.lastName || ''}`.trim() || shippingAddr?.companyName || 'Customer',
                          phoneNumber: shippingAddr?.phone || '',
                          personType: isB2BBackground ? 1 : 0,
                          ...(isB2BBackground && { companyName: billingAddr.companyName }),
                          address: shippingAddr?.streetAddress || shippingAddr?.address || '',
                          countyString: countyVal,
                          cityString: cityVal,
                          postalCode: shippingAddr?.zipCode || '',
                        },
                        parcels,
                        thirdPartyPickup: 0,
                        insuredValue: 0,
                        cashOnDelivery: isCOD ? totalAmount : 0,
                        observation: `Order #${orderId}`,
                        clientInternalReference: `order_${orderId}`,
                      };

                      const awbResult = await samedayAPI.createAWB(awbData);
                      if (awbResult && awbResult.awbNumber) {
                        await storage.updateOrder(orderId, {
                          awbNumber: awbResult.awbNumber,
                          awbCost: String(awbResult.cost || 0),
                          awbCurrency: awbResult.currency || 'RON',
                          status: 'processing',
                        });
                        awbNumber = awbResult.awbNumber;
                        console.log(`✅ [Background] AWB generated for order #${orderId}: ${awbNumber}`);
                      }
                    }
                  } else if (currentOrder?.awbNumber) {
                    awbNumber = currentOrder.awbNumber;
                    console.log(`ℹ️ [Background] Order #${orderId} already has AWB: ${awbNumber}`);
                  }
                }
              })(),
              bgAwbTimeout,
            ]);
          } catch (awbError) {
            console.error(`❌ [Background] Failed to generate AWB for order #${orderId}:`, awbError);
          }

          if (awbNumber) {
            console.log(`📧 [Background] Sending supplier and customer emails for order #${orderId}...`);
            const { sendSupplierOrderEmail, sendCustomerShipmentEmail } = await import('./email-service');
            const { createSamedayAPI } = await import('./sameday-api');

            let awbPdfBuffer: Buffer | undefined;
            try {
              const samedayAPI = createSamedayAPI();
              if (samedayAPI) {
                awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
                console.log(`✅ [Background] AWB PDF retrieved for order #${orderId}`);
              }
            } catch (pdfError) {
              console.error(`❌ [Background] AWB PDF retrieval failed for ${awbNumber}:`, pdfError);
            }

            const fullOrder = await storage.getOrder(orderId);
            if (fullOrder) {
              const supplierGroups = new Map<number | null, { supplierName: string; supplierEmail: string; items: { productName: string; quantity: number }[] }>();

              for (const item of fullOrder.items) {
                const product = await storage.getProduct(item.productId);
                const supplierId = product?.supplierId || null;
                let supplierInfo = supplierGroups.get(supplierId);

                if (!supplierInfo) {
                  if (supplierId) {
                    const supplier = await storage.getSupplier(supplierId);
                    if (supplier && supplier.email) {
                      supplierInfo = {
                        supplierName: supplier.contactPerson || supplier.name,
                        supplierEmail: supplier.email,
                        items: [],
                      };
                    }
                  }
                  if (!supplierInfo) {
                    const companySettings = await storage.getCompanySettings();
                    const fallbackEmail = companySettings?.logisticsEmail || companySettings?.email || '';
                    supplierInfo = {
                      supplierName: companySettings?.name || 'xHACCP',
                      supplierEmail: fallbackEmail,
                      items: [],
                    };
                  }
                  supplierGroups.set(supplierId, supplierInfo);
                }

                supplierInfo.items.push({
                  productName: item.product.name,
                  quantity: item.quantity,
                });
              }

              for (const [, group] of supplierGroups) {
                if (group.supplierEmail) {
                  try {
                    await sendSupplierOrderEmail(
                      group.supplierEmail,
                      group.supplierName,
                      fullOrder,
                      group.items,
                      awbNumber,
                      awbPdfBuffer
                    );
                    console.log(`✅ [Background] Supplier email sent to ${group.supplierEmail} for order #${orderId}`);
                  } catch (supplierEmailError) {
                    console.error(`❌ [Background] Failed to send supplier email to ${group.supplierEmail}:`, supplierEmailError);
                  }
                }
              }

              let invoicePdfBuffer: Buffer | null = null;
              if (invoiceGenerated && invoiceId) {
                try {
                  const { createInvoiceService } = await import('./invoice-service.js');
                  const invoiceService = await createInvoiceService();
                  invoicePdfBuffer = await invoiceService.getInvoicePdf(invoiceId);
                  console.log(`✅ [Background] Invoice PDF retrieved for order #${orderId}`);
                } catch (pdfError) {
                  console.error(`❌ [Background] Failed to retrieve invoice PDF for order #${orderId}:`, pdfError);
                }
              }

              if (user.email) {
                try {
                  await sendCustomerShipmentEmail(
                    user.email,
                    fullOrder,
                    awbNumber,
                    invoicePdfBuffer,
                    invoiceNumber
                  );
                  console.log(`✅ [Background] Customer shipment email sent to ${user.email} for order #${orderId}`);
                } catch (custEmailError) {
                  console.error(`❌ [Background] Failed to send customer shipment email for order #${orderId}:`, custEmailError);
                }
              }
            }
          } else {
            console.log(`⚠️ [Background] No AWB generated for order #${orderId}, skipping supplier/customer emails`);
          }

          console.log(`✅ [Background] Acceptance flow completed for order #${orderId}`);
        } catch (bgError) {
          console.error(`❌ [Background] Error in acceptance flow for order #${orderId}:`, bgError);
        }
      })();
    } catch (error) {
      console.error("Error accepting order:", error);
      res.status(500).json({ success: false, message: "Failed to accept order" });
    }
  });

  // ─── Product options for manual order creation (mirrors site availability) ──
  app.get("/admin/api/orders/product-options", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const market = ['ro', 'com', 'fr'].includes(String(req.query.market)) ? String(req.query.market) : 'ro';
      if (!canAccessMarket(req, market)) {
        return res.status(403).json({ success: false, message: 'Access denied for this market' });
      }
      const allProducts = await storage.getProducts();
      const options = [];
      for (const product of allProducts) {
        const productActive = (product as any).status === 'active' || (product as any).isActive === true;
        if (!productActive) continue;
        const effective = applyMarketOverlay(product, market);
        if (!effective) continue; // disabled for this market
        options.push({
          id: product.id,
          name: product.name,
          price: effective.price,
          currency: effective.currency,
          volumeDiscounts: (product as any).volumeDiscounts || [],
        });
      }
      res.json(options);
    } catch (error) {
      console.error('Error fetching product options:', error);
      res.status(500).json({ success: false, message: 'Eroare la încărcarea produselor' });
    }
  });

  // ─── Create order manually from admin (same pricing rules as site checkout) ──
  app.post("/admin/api/orders/create-manual", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { market, items, shippingAddress, billingAddress, paymentMethod, notes, email, phone } = req.body || {};

      const orderMarket = ['ro', 'com', 'fr'].includes(market) ? market : 'ro';
      if (!canAccessMarket(req, orderMarket)) {
        return res.status(403).json({ success: false, message: 'Access denied for this market' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Comanda trebuie să conțină cel puțin un produs' });
      }
      if (!shippingAddress?.firstName || !shippingAddress?.lastName) {
        return res.status(400).json({ success: false, message: 'Numele și prenumele clientului sunt obligatorii' });
      }
      if (!email && !shippingAddress?.email) {
        return res.status(400).json({ success: false, message: 'Emailul clientului este obligatoriu' });
      }
      // Fields required downstream by Sameday AWB + Smartbill invoice
      if (!phone && !shippingAddress?.phone) {
        return res.status(400).json({ success: false, message: 'Telefonul este obligatoriu (necesar pentru AWB)' });
      }
      if (!shippingAddress?.streetAddress && !shippingAddress?.address) {
        return res.status(400).json({ success: false, message: 'Adresa este obligatorie (necesară pentru AWB și factură)' });
      }
      if (!shippingAddress?.city) {
        return res.status(400).json({ success: false, message: 'Orașul este obligatoriu (necesar pentru AWB și factură)' });
      }
      if (!shippingAddress?.state && !shippingAddress?.county) {
        return res.status(400).json({ success: false, message: 'Județul este obligatoriu (necesar pentru AWB și factură)' });
      }
      // Normalize aliases so both AWB (streetAddress/state) and Smartbill (address/county) find their fields
      const normalizeAddr = (a: any) => a ? ({
        ...a,
        streetAddress: a.streetAddress || a.address,
        address: a.address || a.streetAddress,
        state: a.state || a.county,
        county: a.county || a.state,
      }) : a;
      const normShipping = normalizeAddr(shippingAddress);
      const normBilling = normalizeAddr(billingAddress && Object.keys(billingAddress).length > 0 ? billingAddress : shippingAddress);

      // Server-side price validation — identical rules to site checkout:
      // active product check, market overlay, volume discounts.
      const validatedItems = [];
      for (const item of items) {
        const quantity = parseInt(String(item.quantity), 10);
        if (isNaN(quantity) || quantity < 1 || quantity > 9999) {
          return res.status(400).json({ success: false, message: `Cantitate invalidă pentru produsul #${item.productId}` });
        }
        const product = await storage.getProduct(parseInt(String(item.productId), 10));
        if (!product) {
          return res.status(400).json({ success: false, message: `Produsul #${item.productId} nu există` });
        }
        const productActive = (product as any).status === 'active' || (product as any).isActive === true;
        if (!productActive) {
          return res.status(400).json({ success: false, message: `Produsul "${product.name}" nu este activ` });
        }
        const effectiveProduct = applyMarketOverlay(product, orderMarket);
        if (!effectiveProduct) {
          return res.status(400).json({ success: false, message: `Produsul "${product.name}" nu este disponibil pe piața ${orderMarket.toUpperCase()}` });
        }
        const unitPrice = applyVolumeDiscount(parseFloat(effectiveProduct.price), quantity, (product as any).volumeDiscounts);
        validatedItems.push({
          productId: product.id,
          quantity,
          price: unitPrice.toFixed(2),
          totalPrice: (unitPrice * quantity).toFixed(2),
        });
      }

      const subtotal = validatedItems.reduce((sum, it) => sum + parseFloat(it.price) * it.quantity, 0);

      // Shipping — same market-specific thresholds as site checkout
      const companySettingsData = await storage.getCompanySettings();
      const marketSetting = marketSettingsMap.get(orderMarket);
      const freeShippingThreshold = marketSetting?.freeShippingThreshold
        ? parseFloat(marketSetting.freeShippingThreshold)
        : (companySettingsData?.freeShippingThreshold ? parseFloat(companySettingsData.freeShippingThreshold) : 500);
      const standardShippingCost = marketSetting?.standardShippingCost
        ? parseFloat(marketSetting.standardShippingCost)
        : (companySettingsData?.standardShippingCost ? parseFloat(companySettingsData.standardShippingCost) : 25);
      const shippingCost = subtotal > freeShippingThreshold ? 0 : standardShippingCost;
      const totalAmount = subtotal + shippingCost;

      const customerEmail = email || shippingAddress?.email || '';
      const adminName = req.admin?.username || req.admin?.email || 'admin';
      let orderNotes = `Comandă creată manual din admin de ${adminName}`;
      if (customerEmail) orderNotes += `\nGuest email: ${customerEmail}${phone ? ', Phone: ' + phone : ''}`;
      if (notes) orderNotes += `\n${notes}`;

      const orderData: any = {
        userId: null,
        market: orderMarket,
        status: 'pending',
        totalAmount: totalAmount.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        shippingAddress: { ...normShipping, email: customerEmail, phone: phone || normShipping?.phone },
        billingAddress: normBilling,
        paymentMethod: paymentMethod || 'cash_on_delivery',
        paymentStatus: 'pending',
        notes: orderNotes,
      };

      const order = await storage.createOrder(orderData, validatedItems as any);
      console.log(`📝 [Admin] Manual order #${order.id} created on market ${orderMarket} by ${adminName} — total ${totalAmount.toFixed(2)}`);

      res.json({
        success: true,
        message: `Comanda #${order.id} a fost creată (subtotal ${subtotal.toFixed(2)}, transport ${shippingCost.toFixed(2)}, total ${totalAmount.toFixed(2)})`,
        order,
      });
    } catch (error) {
      console.error('Error creating manual order:', error);
      res.status(500).json({ success: false, message: 'Eroare la crearea comenzii' });
    }
  });

  // ─── Process order manually (AWB + invoice, NO emails) ───────────────────
  app.post("/admin/api/orders/:id/process-manual", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID' });

      // First, a lightweight read for market access check only
      const orderPrecheck = await storage.getOrder(orderId);
      if (!orderPrecheck) return res.status(404).json({ success: false, message: 'Order not found' });

      if (!canAccessMarket(req, orderPrecheck.market || 'ro')) {
        return res.status(403).json({ success: false, message: 'Access denied for this market' });
      }

      // ATOMIC CLAIM using a conditional UPDATE as a distributed lock.
      // Status lifecycle: pending → manual_processing (in-flight) → processing (success) / manual_failed (failure)
      // Retry is only allowed from 'manual_failed' (explicit failed state, NOT in-flight).
      // Accept uses a symmetric conditional UPDATE excluding source='manual_admin',
      // so both flows cannot simultaneously claim the same order.
      const claimResult = await pool.query(
        `UPDATE orders
            SET source = 'manual_admin', status = 'manual_processing', updated_at = NOW()
          WHERE id = $1
            AND (
              -- New claim: pending, not yet manual, no AWB exists
              (status = 'pending' AND (source IS NULL OR source = 'website') AND awb_number IS NULL)
              OR
              -- Retry: explicitly failed (AWB may already exist — background job skips AWB if present,
              -- so retry can complete a partial failure such as invoice-failed/AWB-succeeded)
              (source = 'manual_admin' AND status = 'manual_failed')
            )
          RETURNING id`,
        [orderId]
      );

      if (claimResult.rowCount === 0) {
        const cur = await storage.getOrder(orderId);
        if (!cur) return res.status(404).json({ success: false, message: 'Order not found' });
        if ((cur as any).source === 'manual_admin' && cur.status === 'manual_processing') {
          return res.status(409).json({ success: false, message: 'Comanda este deja în curs de procesare manuală. Asteaptă finalizarea sau reîncercă după eșec.' });
        }
        return res.status(409).json({
          success: false,
          message: `Nu se poate procesa manual — status curent: "${cur.status}". Doar comenzile "pending" (sau cele care au eșuat anterior) pot fi procesate manual.`,
        });
      }

      // Claim succeeded — fetch the fresh order snapshot for the background job
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(500).json({ success: false, message: 'Order vanished after claim' });

      res.json({ success: true, message: 'Procesare manuală pornită (AWB + factură). Fără mailuri trimise.' });

      // Background: invoice + AWB, no emails.
      // Uses status lifecycle: manual_processing → processing (success) / manual_failed (any failure).
      (async () => {
        let invoiceOk = false;
        let awbOk = false;
        const isCOD = order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'cod' || order.paymentMethod === 'cash';
        try {
          console.log(`🖐 [Manual] Processing order #${orderId} manually...`);

          // ── Invoice ──────────────────────────────────────────────────────────
          // Guard against duplicates: check DB before calling invoice service.
          // Invoice service internally changes status to 'processing'; we re-assert
          // 'manual_processing' immediately after so AWB failure still lands in 'manual_failed'.
          try {
            const existingInvoices = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
            if (existingInvoices.length > 0) {
              console.log(`ℹ️ [Manual] Invoice already exists for order #${orderId}: ${existingInvoices[0].invoiceNumber} — skipping`);
              invoiceOk = true;
            } else {
              const { createInvoiceService } = await import('./invoice-service.js');
              const invoiceService = await createInvoiceService();
              await invoiceService.generateInvoiceAfterPayment(orderId, {
                status: 'succeeded',
                paymentMethod: isCOD ? 'cash_on_delivery' : (order.paymentMethod || 'card'),
                paymentId: `manual_${orderId}`,
                amount: parseFloat(String(order.totalAmount)),
              });
              console.log(`✅ [Manual] Invoice generated for order #${orderId}`);
              invoiceOk = true;
            }
            // Re-assert manual_processing: invoice service may have changed status to 'processing'.
            // We keep it as manual_processing until AWB is also done (or fails) so that the
            // final status is set atomically by this flow, not by invoice side-effects.
            await pool.query(
              `UPDATE orders SET status = 'manual_processing', updated_at = NOW()
                WHERE id = $1 AND source = 'manual_admin' AND status != 'manual_failed'`,
              [orderId]
            );
          } catch (invoiceError) {
            console.error(`❌ [Manual] Invoice failed for order #${orderId}:`, invoiceError);
            // invoice failed; invoiceOk stays false
          }

          // ── AWB ──────────────────────────────────────────────────────────────
          if ((order.market || 'ro') !== 'fr') {
            try {
              const shippingAddr = order.shippingAddress as any;
              const billingAddr  = order.billingAddress  as any;
              const { createSamedayAPI } = await import('./sameday-api');
              const samedayAPI = createSamedayAPI();
              if (samedayAPI) {
                const currentOrder = await storage.getOrder(orderId);
                if (currentOrder && !currentOrder.awbNumber) {
                  const [pickupPoints, services] = await Promise.all([
                    samedayAPI.getPickupPoints(),
                    samedayAPI.getServices(),
                  ]);
                  if (pickupPoints.length > 0 && services.length > 0) {
                    const selectedPickupPoint = pickupPoints.find((p: any) => p.id === 447249) || pickupPoints[0];
                    const parcels = await buildCombinedParcels(currentOrder.items || [], storage);
                    const preferredService = services.find((s: any) => {
                      const name = s.name?.toLowerCase() || '';
                      if (name.includes('retur') || name.includes('return')) return false;
                      return name.includes('standard') || name.includes('next day');
                    });
                    const standardService = preferredService || services[0];
                    const defaultContact = selectedPickupPoint.contactPersons?.find((c: any) => c.default) || selectedPickupPoint.contactPersons?.[0];
                    const isB2B = !!(billingAddr?.companyName);
                    const awbData: any = {
                      pickupPoint: selectedPickupPoint.id,
                      contactPerson: defaultContact?.id,
                      service: standardService.id,
                      packageType: 0,
                      packageWeight: parcels.reduce((sum: number, p: any) => sum + p.weight, 0),
                      awbPayment: 1,
                      awbRecipient: {
                        name: `${shippingAddr?.firstName || ''} ${shippingAddr?.lastName || ''}`.trim() || shippingAddr?.companyName || 'Customer',
                        phoneNumber: shippingAddr?.phone || '',
                        personType: isB2B ? 1 : 0,
                        ...(isB2B && { companyName: billingAddr.companyName }),
                        address: shippingAddr?.streetAddress || shippingAddr?.address || '',
                        countyString: shippingAddr?.state || shippingAddr?.county || '',
                        cityString: shippingAddr?.city || shippingAddr?.state || shippingAddr?.county || 'N/A',
                        postalCode: shippingAddr?.zipCode || '',
                      },
                      parcels,
                      thirdPartyPickup: 0,
                      insuredValue: 0,
                      cashOnDelivery: isCOD ? parseFloat(String(currentOrder.totalAmount)) : 0,
                      observation: `Order #${orderId} (manual)`,
                      clientInternalReference: `order_${orderId}`,
                    };
                    // AWB idempotency: before creating at the courier, check if one already
                    // exists for this order reference. This covers crash-after-courier-create
                    // scenarios where the AWB was created externally but not yet persisted.
                    const clientRef = `order_${orderId}`;
                    const recoveredAwbNumber = await samedayAPI.findAWBByReference(clientRef);
                    let finalAwbNumber: string | undefined;
                    let awbCost = '0';
                    let awbCurrency = 'RON';
                    if (recoveredAwbNumber) {
                      console.log(`ℹ️ [Manual] Recovered existing Sameday AWB ${recoveredAwbNumber} for order #${orderId} — skipping create`);
                      finalAwbNumber = recoveredAwbNumber;
                    } else {
                      const awbResult = await samedayAPI.createAWB(awbData);
                      finalAwbNumber = awbResult?.awbNumber;
                      awbCost = String(awbResult?.cost || 0);
                      awbCurrency = awbResult?.currency || 'RON';
                    }
                    if (finalAwbNumber) {
                      awbOk = true;
                      // Persist AWB fields only. Do NOT set status here —
                      // terminal status ('processing' / 'manual_failed') is set
                      // exclusively by the finally block to remain authoritative.
                      await storage.updateOrder(orderId, {
                        awbNumber: finalAwbNumber,
                        awbCost,
                        awbCurrency,
                      });
                      console.log(`✅ [Manual] AWB persisted for order #${orderId}: ${finalAwbNumber}`);
                    } else {
                      console.warn(`⚠️ [Manual] AWB result had no number for order #${orderId}`);
                    }
                  }
                } else if (currentOrder?.awbNumber) {
                  awbOk = true;
                  console.log(`ℹ️ [Manual] AWB already existed for order #${orderId}: ${currentOrder.awbNumber}`);
                }
              }
            } catch (awbError) {
              console.error(`❌ [Manual] AWB failed for order #${orderId}:`, awbError);
            }
          } else {
            // FR market: no AWB; treat invoice success as overall success
            awbOk = invoiceOk;
            console.log(`ℹ️ [Manual] FR market — AWB skipped for order #${orderId}`);
          }

        } catch (bgErr) {
          console.error(`❌ [Manual] Unexpected background error for order #${orderId}:`, bgErr);
        } finally {
          // The finally block is the sole authority for terminal order status.
          // It always runs and always writes, overriding any intermediate status
          // changes (e.g., invoice service side-effects, AWB partial writes).
          // This guarantees no unrecoverable intermediate state regardless of
          // which steps succeeded or failed.
          const allOk = invoiceOk && awbOk;
          const terminalStatus = allOk ? 'processing' : 'manual_failed';
          await pool.query(
            `UPDATE orders SET status = $2, updated_at = NOW()
              WHERE id = $1 AND source = 'manual_admin'`,
            [orderId, terminalStatus]
          );
          if (allOk) {
            console.log(`✅ [Manual] Order #${orderId} marked as processing (invoiceOk=${invoiceOk}, awbOk=${awbOk})`);
          } else {
            console.log(`⚠️ [Manual] Order #${orderId} marked as manual_failed (invoiceOk=${invoiceOk}, awbOk=${awbOk}) — retry available`);
          }
        }
      })();

    } catch (error) {
      console.error("Error in process-manual:", error);
      res.status(500).json({ success: false, message: "Eroare la procesarea manuală" });
    }
  });

  // ─── Resend acceptance/shipment email with AWB ─────────────────────────────
  app.post("/admin/api/orders/:id/send-acceptance-email", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID' });

      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

      if (!canAccessMarket(req, order.market || 'ro')) {
        return res.status(403).json({ success: false, message: 'Access denied for this market' });
      }

      if (!order.awbNumber) {
        return res.status(400).json({ success: false, message: 'Comanda nu are AWB generat. Generează AWB înainte de a trimite mailul.' });
      }

      // Resolve customer email
      const shippingAddr = order.shippingAddress as any;
      const billingAddr  = order.billingAddress  as any;
      let customerEmail = shippingAddr?.email || billingAddr?.email || '';
      if (!customerEmail && order.userId) {
        const user = await storage.getUser(order.userId);
        customerEmail = user?.email || '';
      }
      if (!customerEmail) {
        const m = order.notes?.match(/Guest email:\s*([^\s,]+)/);
        customerEmail = m ? m[1] : '';
      }
      if (!customerEmail) {
        return res.status(400).json({ success: false, message: 'Nu am găsit adresa de email a clientului.' });
      }

      const awbNumber = order.awbNumber;

      // Fetch AWB PDF
      let awbPdfBuffer: Buffer | undefined;
      try {
        const { createSamedayAPI } = await import('./sameday-api');
        const samedayAPI = createSamedayAPI();
        if (samedayAPI) {
          awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
        }
      } catch (pdfErr) {
        console.warn(`⚠️ [SendEmail] Could not fetch AWB PDF for order #${orderId}:`, pdfErr);
      }

      // Fetch invoice PDF if available
      let invoicePdfBuffer: Buffer | null = null;
      let invoiceNumber: string | undefined;
      try {
        const orderInvoices = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
        if (orderInvoices.length > 0) {
          const inv = orderInvoices[0];
          invoiceNumber = inv.invoiceNumber;
          const { createInvoiceService } = await import('./invoice-service.js');
          const invoiceService = await createInvoiceService();
          invoicePdfBuffer = await invoiceService.getInvoicePdf(inv.id);
        }
      } catch (invErr) {
        console.warn(`⚠️ [SendEmail] Could not fetch invoice PDF for order #${orderId}:`, invErr);
      }

      const { sendCustomerShipmentEmail } = await import('./email-service');
      const sent = await sendCustomerShipmentEmail(customerEmail, order, awbNumber, invoicePdfBuffer, invoiceNumber, awbPdfBuffer);

      if (sent) {
        console.log(`✅ [SendEmail] Acceptance email sent to ${customerEmail} for order #${orderId}`);
        res.json({ success: true, message: `Mail de acceptare trimis la ${customerEmail}` });
      } else {
        res.status(500).json({ success: false, message: 'Trimiterea mailului a eșuat. Verifică configurarea SendGrid.' });
      }

    } catch (error) {
      console.error("Error in send-acceptance-email:", error);
      res.status(500).json({ success: false, message: "Eroare la trimiterea mailului" });
    }
  });

  // Generate shipping labels (simulation)
  app.post("/admin/api/orders/bulk/shipping-labels", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { orderIds } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "Order IDs array is required" });
      }
      
      const results = [];
      for (const orderId of orderIds) {
        try {
          const parsedOrderId = parseInt(orderId);
          if (isNaN(parsedOrderId)) {
            results.push({ orderId, success: false, error: "Invalid order ID" });
            continue;
          }
          const order = await storage.getOrder(parsedOrderId);
          if (!order) {
            results.push({ orderId, success: false, error: "Order not found" });
          } else if (!canAccessMarket(req, order.market || 'ro')) {
            results.push({ orderId, success: false, error: "Access denied for this market" });
          } else {
            results.push({ 
              orderId, 
              success: true, 
              trackingNumber: `KO${Date.now()}${orderId}`,
              shippingLabel: `shipping_label_${orderId}.pdf`
            });
          }
        } catch (error) {
          results.push({ orderId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      res.json({ 
        message: `Shipping labels generated`,
        results,
        successCount: results.filter(r => r.success).length
      });
    } catch (error) {
      console.error("Generate shipping labels error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Send bulk notifications (simulation)
  app.post("/admin/api/orders/bulk/notifications", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { orderIds, notificationType, message } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "Order IDs array is required" });
      }
      
      if (!notificationType || !['order_update', 'shipping_notification', 'delivery_confirmation'].includes(notificationType)) {
        return res.status(400).json({ message: "Invalid notification type" });
      }
      
      const results = [];
      for (const orderId of orderIds) {
        try {
          const parsedOrderId = parseInt(orderId);
          if (isNaN(parsedOrderId)) {
            results.push({ orderId, success: false, error: "Invalid order ID" });
            continue;
          }
          const order = await storage.getOrder(parsedOrderId);
          if (!order) {
            results.push({ orderId, success: false, error: "Order not found" });
          } else if (!canAccessMarket(req, order.market || 'ro')) {
            results.push({ orderId, success: false, error: "Access denied for this market" });
          } else {
            results.push({ 
              orderId, 
              success: true, 
              notificationType,
              sentTo: `user_${order.userId}@example.com`,
              message: message || `Your order #${orderId} has been updated.`
            });
          }
        } catch (error) {
          results.push({ orderId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      res.json({ 
        message: `Bulk notifications sent`,
        results,
        successCount: results.filter(r => r.success).length
      });
    } catch (error) {
      console.error("Send bulk notifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Process bulk refunds (simulation)
  app.post("/admin/api/orders/bulk/refunds", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { orderIds, refundAmount, reason } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: "Order IDs array is required" });
      }
      
      const results = [];
      for (const orderId of orderIds) {
        try {
          const parsedOrderId = parseInt(orderId);
          if (isNaN(parsedOrderId)) {
            results.push({ orderId, success: false, error: "Invalid order ID" });
            continue;
          }
          const order = await storage.getOrder(parsedOrderId);
          if (!order) {
            results.push({ orderId, success: false, error: "Order not found" });
          } else if (!canAccessMarket(req, order.market || 'ro')) {
            results.push({ orderId, success: false, error: "Access denied for this market" });
          } else {
            const refundAmt = refundAmount || order.totalAmount;
            results.push({ 
              orderId, 
              success: true, 
              refundAmount: refundAmt,
              reason: reason || "Admin initiated refund",
              transactionId: `REF${Date.now()}${orderId}`
            });
          }
        } catch (error) {
          results.push({ orderId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      res.json({ 
        message: `Bulk refunds processed`,
        results,
        successCount: results.filter(r => r.success).length,
        totalRefunded: results.filter(r => r.success).reduce((sum, r) => sum + parseFloat(r.refundAmount), 0)
      });
    } catch (error) {
      console.error("Process bulk refunds error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Smartbill Credentials Management
  app.get("/admin/api/smartbill/credentials", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      // Return current credentials (masked for security)
      const credentials = {
        username: process.env.SMARTBILL_USERNAME,
        token: process.env.SMARTBILL_TOKEN ? process.env.SMARTBILL_TOKEN.substring(0, 10) + '...' : 'Not set',
        companyVat: process.env.SMARTBILL_COMPANY_VAT,
        series: process.env.SMARTBILL_SERIES,
        enabled: process.env.ENABLE_SMARTBILL === 'true'
      };
      
      res.json(credentials);
    } catch (error) {
      console.error("Error fetching Smartbill credentials:", error);
      res.status(500).json({ message: "Failed to fetch credentials" });
    }
  });

  app.post("/admin/api/smartbill/test-credentials", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { username, token } = req.body;
      
      if (!username || !token) {
        return res.status(400).json({ message: "Username and token are required" });
      }

      // Test the provided credentials
      const credentials = Buffer.from(`${username}:${token}`).toString('base64');
      const response = await fetch('https://ws.smartbill.ro/SBORO/api/series', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${credentials}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        res.json({
          success: true,
          message: 'Credentials are valid!',
          availableSeries: result.map((s: any) => ({ name: s.name, type: s.type }))
        });
      } else {
        const errorText = await response.text();
        res.json({
          success: false,
          message: 'Authentication failed',
          error: errorText
        });
      }
    } catch (error) {
      console.error("Error testing Smartbill credentials:", error);
      res.status(500).json({ 
        success: false,
        message: "Connection error",
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.post("/admin/api/smartbill/create-series", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { seriesName, startNumber = 1 } = req.body;
      
      if (!seriesName) {
        return res.status(400).json({ message: "Series name is required" });
      }

      // Test creating a new series via Smartbill API
      const credentials = Buffer.from(`${process.env.SMARTBILL_USERNAME}:${process.env.SMARTBILL_TOKEN}`).toString('base64');
      
      const seriesData = {
        name: seriesName,
        startNumber: startNumber,
        type: 'factura' // Invoice type
      };
      
      const response = await fetch('https://ws.smartbill.ro/SBORO/api/series', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify(seriesData)
      });

      if (response.ok) {
        const result = await response.json();
        res.json({
          success: true,
          message: `Series ${seriesName} created successfully`,
          series: result
        });
      } else {
        const errorText = await response.text();
        res.json({
          success: false,
          message: "Series creation not supported via API",
          note: "Create new series manually in Smartbill Dashboard: Settings > Document Series"
        });
      }
      
    } catch (error) {
      console.error("Error creating series:", error);
      res.status(500).json({ message: "Failed to create series" });
    }
  });

  app.post("/admin/api/smartbill/update-credentials", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { username, token, companyVat, series } = req.body;
      
      if (!username || !token) {
        return res.status(400).json({ message: "Username and token are required" });
      }

      // Test credentials before updating
      const credentials = Buffer.from(`${username}:${token}`).toString('base64');
      const testResponse = await fetch('https://ws.smartbill.ro/SBORO/api/series', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${credentials}`
        }
      });

      if (!testResponse.ok) {
        return res.status(400).json({
          message: "Invalid credentials",
          error: "Authentication test failed"
        });
      }

      // Update environment variables (this would require a restart in production)
      process.env.SMARTBILL_USERNAME = username;
      process.env.SMARTBILL_TOKEN = token;
      if (companyVat) process.env.SMARTBILL_COMPANY_VAT = companyVat;
      if (series) process.env.SMARTBILL_SERIES = series;
      
      const result = await testResponse.json();
      
      res.json({
        success: true,
        message: "Credentials updated successfully!",
        note: "Credentials updated for current session. For permanent changes, update your Replit Secrets.",
        availableSeries: result.map((s: any) => ({ name: s.name, type: s.type }))
      });
      
    } catch (error) {
      console.error("Error updating Smartbill credentials:", error);
      res.status(500).json({ message: "Failed to update credentials" });
    }
  });

  // Admin Product Management Routes
  app.get("/admin/api/products", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { search, categoryId, featured, limit = 50, offset = 0, supplierId, market } = req.query;
      if (market && market !== 'all' && !canAccessMarket(req as AdminAuthRequest, market as string)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;

      // Determine which markets we need to filter by (if any) BEFORE fetching products
      // so we can apply market-scoped IDs in the initial fetch, not post-pagination.
      let marketProductIds: Set<number> | null = null;
      let marketRowByProduct: Map<number, typeof productMarkets.$inferSelect> | null = null;
      if (!isSuperAdmin && (!market || market === 'all')) {
        // Restricted admin — limit to their markets
        const marketRows = await db.select().from(productMarkets).where(
          allowedMarkets.length === 1
            ? eq(productMarkets.market, allowedMarkets[0])
            : inArray(productMarkets.market, allowedMarkets)
        );
        marketProductIds = new Set(marketRows.map(r => r.productId));
        // If restricted to a single market, we can safely apply its price overrides
        if (allowedMarkets.length === 1) {
          marketRowByProduct = new Map(marketRows.map(r => [r.productId, r]));
        }
      } else if (market && market !== 'all') {
        // Explicit market filter requested
        const marketRows = await db.select().from(productMarkets).where(eq(productMarkets.market, market as string));
        marketProductIds = new Set(marketRows.map(r => r.productId));
        marketRowByProduct = new Map(marketRows.map(r => [r.productId, r]));
      }

      // Fetch ALL products from memory when a market filter is active so that
      // pagination is applied AFTER filtering (prevents missing items when limit < total).
      const needsMarketFilter = marketProductIds !== null;
      const fetchLimit = needsMarketFilter ? 100000 : parseInt(limit as string);
      const fetchOffset = needsMarketFilter ? 0 : parseInt(offset as string);

      const products = await storage.getProducts({
        search: search as string,
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
        featured: featured === 'true',
        limit: fetchLimit,
        offset: fetchOffset
      });

      // Apply market filter
      let filteredProducts = products;
      if (marketProductIds !== null) {
        filteredProducts = filteredProducts.filter(p => (marketProductIds as Set<number>).has(p.id));
      }

      // Filter by supplier if specified
      if (supplierId) {
        filteredProducts = filteredProducts.filter(product => product.supplierId === parseInt(supplierId as string));
      }

      // Apply limit/offset manually when we fetched everything for market filtering
      if (needsMarketFilter) {
        const off = parseInt(offset as string);
        const lim = parseInt(limit as string);
        filteredProducts = filteredProducts.slice(off, off + lim);
      }

      // Apply market-specific price/currency/stock overrides so the admin sees
      // the values for the selected market (e.g. EUR prices on the FR tab).
      if (marketRowByProduct) {
        const effectiveMarket = (market && market !== 'all') ? (market as string) : allowedMarkets[0];
        let defaultCurrency: string | null = null;
        try {
          const settings = await storage.getMarketSettings();
          defaultCurrency = settings.find((s: any) => s.market === effectiveMarket)?.currency || null;
        } catch (e) {
          console.error('Could not load market settings for currency fallback:', e);
        }
        filteredProducts = filteredProducts.map(p => {
          const row = (marketRowByProduct as Map<number, any>).get(p.id);
          if (!row) return p;
          return {
            ...p,
            price: row.price ?? p.price,
            compareAtPrice: row.compareAtPrice ?? p.compareAtPrice,
            currency: row.currency ?? defaultCurrency ?? p.currency,
            stockQuantity: row.stockQuantity ?? p.stockQuantity,
          };
        });
      }

      res.json(filteredProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/admin/api/products", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productData = req.body;
      
      if (!productData.name || !productData.price) {
        return res.status(400).json({ message: "Name and price are required" });
      }

      // Generate slug from name
      const slug = productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      
      // Auto-generate product code if not provided (format: PRD-XXXXX)
      let productCode = productData.productCode;
      if (!productCode || productCode.trim() === '') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        productCode = `PRD-${timestamp}${random}`;
      }
      
      // Process images array to extract clean URLs (handles both objects and strings)
      const cleanImages = processImagesArray(productData.images || []);
      const mainImageUrl = cleanImages.length > 0 ? cleanImages[0] : extractImageUrl(productData.imageUrl);
      
      console.log('Creating product with images:', cleanImages);
      console.log('Main image URL:', mainImageUrl);
      console.log('Product code:', productCode);
      
      // Helper to safely parse integer fields - converts empty strings to null/undefined
      const safeParseInt = (value: any): number | undefined => {
        if (value === '' || value === undefined || value === null) return undefined;
        const parsed = parseInt(String(value));
        return isNaN(parsed) ? undefined : parsed;
      };
      
      const newProduct = await storage.createProduct({
        ...productData,
        slug,
        productCode,
        price: parseFloat(productData.price),
        compareAtPrice: productData.compareAtPrice && productData.compareAtPrice !== '' ? parseFloat(productData.compareAtPrice) : undefined,
        categoryId: safeParseInt(productData.categoryId),
        supplierId: safeParseInt(productData.supplierId),
        stockQuantity: parseInt(productData.stockQuantity || 0),
        images: cleanImages,
        imageUrl: mainImageUrl,
        // Convert logistics fields properly - weight must be minimum 1kg with 1kg increments
        // Handle both string and number types safely
        weight: productData.weight && String(productData.weight).trim() !== '' ? Math.max(1, Math.round(parseFloat(String(productData.weight)))) : null,
        length: productData.length && String(productData.length).trim() !== '' ? parseFloat(String(productData.length)) : null,
        width: productData.width && String(productData.width).trim() !== '' ? parseFloat(String(productData.width)) : null,
        height: productData.height && String(productData.height).trim() !== '' ? parseFloat(String(productData.height)) : null,
        // Priority field for product display order (1 = highest, 0 = default)
        priority: productData.priority !== undefined ? parseInt(String(productData.priority)) || 0 : 0,
        isService: productData.isService === true || productData.isService === 'true'
      });

      // Refresh memory cache so site shows new product immediately
      // Wrapped in try-catch to not fail the main operation if cache refresh fails
      try {
        await loadAllDataIntoMemory();
      } catch (cacheError) {
        console.error("Cache refresh failed after product creation:", cacheError);
      }

      res.json({ message: "Product created successfully", product: newProduct });
    } catch (error) {
      console.error("Error creating product:", error);
      console.error("Product data that failed:", req.body);
      res.status(500).json({ message: "Failed to create product", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/admin/api/products/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const productData = req.body;
      
      console.log(`Updating product ${productId} with data:`, productData);
      console.log('Currency field:', productData.currency);
      console.log('VAT percentage field:', productData.vatPercentage);
      
      // Process images array to extract clean URLs (handles both objects and strings)
      const cleanImages = processImagesArray(productData.images || []);
      const mainImageUrl = cleanImages.length > 0 ? cleanImages[0] : extractImageUrl(productData.imageUrl);
      
      console.log('Updating product with clean images:', cleanImages);
      console.log('Main image URL:', mainImageUrl);
      
      // Helper to safely parse integer fields - converts empty strings to null
      const safeParseInt = (value: any): number | null => {
        if (value === '' || value === undefined || value === null) return null;
        const parsed = parseInt(String(value));
        return isNaN(parsed) ? null : parsed;
      };
      
      // Helper to safely format decimal fields as strings for database
      const safeDecimalString = (value: any): string | null => {
        if (value === '' || value === undefined || value === null) return null;
        const parsed = parseFloat(String(value));
        return isNaN(parsed) ? null : parsed.toString();
      };
      
      const updatedProduct = await storage.updateProduct(productId, {
        ...productData,
        // Override fields that need special handling/normalization
        price: productData.price ? String(parseFloat(productData.price)) : undefined,
        compareAtPrice: safeDecimalString(productData.compareAtPrice),
        categoryId: safeParseInt(productData.categoryId),
        supplierId: safeParseInt(productData.supplierId),
        stockQuantity: safeParseInt(productData.stockQuantity) ?? 0,
        images: cleanImages,
        imageUrl: mainImageUrl,
        // Convert logistics fields properly - weight must be minimum 1kg with 1kg increments (stored as string for decimal type)
        weight: productData.weight && String(productData.weight).trim() !== '' ? String(Math.max(1, Math.round(parseFloat(String(productData.weight))))) : null,
        length: safeDecimalString(productData.length),
        width: safeDecimalString(productData.width),
        height: safeDecimalString(productData.height),
        piecesPerPackage: safeParseInt(productData.piecesPerPackage),
        // Priority field for product display order (1 = highest, 0 = default)
        priority: safeParseInt(productData.priority) ?? 0,
        ...(productData.isService !== undefined && { isService: productData.isService === true || productData.isService === 'true' })
      });
      
      console.log('Updated product result:', updatedProduct);

      // Refresh memory cache so site shows updated data immediately
      // Wrapped in try-catch to not fail the main operation if cache refresh fails
      try {
        await loadAllDataIntoMemory();
      } catch (cacheError) {
        console.error("Cache refresh failed after product update:", cacheError);
      }

      res.json({ 
        message: "Product updated successfully", 
        product: updatedProduct,
        // Signal to frontend that data should be refreshed
        refreshRequired: true
      });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/admin/api/products/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      
      await storage.deleteProduct(productId);
      
      // Refresh memory cache so site reflects deletion immediately
      // Wrapped in try-catch to not fail the main operation if cache refresh fails
      try {
        await loadAllDataIntoMemory();
      } catch (cacheError) {
        console.error("Cache refresh failed after product deletion:", cacheError);
      }
      
      res.json({ message: "Product deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting product:", error);
      
      // Check if it's a foreign key constraint error (product is in orders)
      if (error.code === '23503' || (error.message && error.message.includes('foreign key'))) {
        return res.status(400).json({ 
          message: "Acest produs nu poate fi șters deoarece există comenzi care îl conțin. Puteți marca produsul ca inactiv în loc să îl ștergeți." 
        });
      }
      
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Product Translations API endpoints
  app.get("/admin/api/products/:id/translations", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const translations = await storage.getProductTranslations(productId);
      res.json(translations);
    } catch (error) {
      console.error("Error fetching product translations:", error);
      res.status(500).json({ message: "Failed to fetch translations" });
    }
  });

  app.post("/admin/api/products/:id/translations", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const { language, name, description, slug, sourceUrl } = req.body;
      
      if (!language || !name) {
        return res.status(400).json({ message: "Language and name are required" });
      }
      
      // Check if translation for this language already exists
      const existingTranslation = await storage.getProductTranslation(productId, language);
      if (existingTranslation) {
        return res.status(400).json({ message: `Translation for language '${language}' already exists` });
      }
      
      const translation = await storage.createProductTranslation({
        productId,
        language,
        name,
        description: description || null,
        slug: slug || null,
        sourceUrl: sourceUrl || null
      });
      
      res.status(201).json(translation);
    } catch (error) {
      console.error("Error creating product translation:", error);
      res.status(500).json({ message: "Failed to create translation" });
    }
  });

  app.put("/admin/api/products/translations/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const translationId = parseInt(req.params.id);
      const { language, name, description, slug, sourceUrl } = req.body;
      
      const translation = await storage.updateProductTranslation(translationId, {
        language,
        name,
        description,
        slug,
        sourceUrl
      });
      
      res.json(translation);
    } catch (error) {
      console.error("Error updating product translation:", error);
      res.status(500).json({ message: "Failed to update translation" });
    }
  });

  app.delete("/admin/api/products/translations/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const translationId = parseInt(req.params.id);
      await storage.deleteProductTranslation(translationId);
      res.json({ message: "Translation deleted successfully" });
    } catch (error) {
      console.error("Error deleting product translation:", error);
      res.status(500).json({ message: "Failed to delete translation" });
    }
  });

  // Import product data from URL using web scraping
  app.post("/admin/api/products/import-from-url", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }
      
      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }
      
      // Fetch the webpage
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      
      if (!response.ok) {
        return res.status(400).json({ message: `Failed to fetch URL: ${response.statusText}` });
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract Open Graph meta tags
      const ogTitle = $('meta[property="og:title"]').attr('content') || 
                      $('meta[name="og:title"]').attr('content') ||
                      $('title').text() || '';
      
      // Try to get a fuller description from the page content first
      let fullDescription = '';
      
      // Look for common product description containers
      const descriptionSelectors = [
        '.product-description',
        '.description',
        '#description',
        '[itemprop="description"]',
        '.product-info',
        '.product-details',
        '#tab1 ul li', // xhaccp.ro specific - product details in tab1
        '.tab-content ul li',
        '.product-content ul li'
      ];
      
      for (const selector of descriptionSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          const texts: string[] = [];
          elements.each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 20) { // Only meaningful text
              texts.push(text);
            }
          });
          if (texts.length > 0) {
            fullDescription = texts.join('\n');
            break;
          }
        }
      }
      
      // Fallback to meta description if no content found
      const ogDescription = fullDescription || 
                            $('meta[property="og:description"]').attr('content') || 
                            $('meta[name="og:description"]').attr('content') ||
                            $('meta[name="description"]').attr('content') || '';
      
      let ogImage = $('meta[property="og:image"]').attr('content') || 
                    $('meta[name="og:image"]').attr('content') || '';
      
      // Make relative image URLs absolute
      if (ogImage && !ogImage.startsWith('http')) {
        ogImage = new URL(ogImage, parsedUrl.origin).href;
      }
      
      // Additional fallback: try to find product image (avoid logos and icons)
      if (!ogImage) {
        // Look for product-specific images first
        const productImage = $('img.product-image').first().attr('src') ||
                            $('img[itemprop="image"]').first().attr('src') ||
                            $('img[src*="product"]').first().attr('src') ||
                            $('img[src*="/images/db/"]').first().attr('src'); // xhaccp.ro specific
        if (productImage) {
          ogImage = productImage.startsWith('http') ? productImage : new URL(productImage, parsedUrl.origin).href;
        }
      }
      
      // Try to extract price if available
      const priceMatch = html.match(/["']price["']\s*:\s*["']?(\d+(?:[.,]\d{2})?)/i) ||
                        html.match(/(\d+(?:[.,]\d{2})?)\s*(?:lei|ron|eur|€|RON|LEI)/i);
      const price = priceMatch ? priceMatch[1].replace(',', '.') : null;
      
      res.json({
        success: true,
        data: {
          title: ogTitle.trim(),
          description: ogDescription.trim(),
          imageUrl: ogImage,
          price: price,
          sourceUrl: url
        }
      });
    } catch (error) {
      console.error("Error importing from URL:", error);
      res.status(500).json({ message: "Failed to import data from URL" });
    }
  });

  // Endpoint to fix corrupted product images (JSON objects stored as strings)
  app.post("/admin/api/products/fix-images", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const products = await storage.getProducts({});
      let fixedCount = 0;
      const fixedProducts: string[] = [];
      
      for (const product of products) {
        let needsFix = false;
        let cleanImages: string[] = [];
        let cleanImageUrl: string | null = null;
        
        // Check and fix images array
        if (product.images && Array.isArray(product.images)) {
          cleanImages = processImagesArray(product.images);
          if (JSON.stringify(cleanImages) !== JSON.stringify(product.images)) {
            needsFix = true;
          }
        }
        
        // Check and fix imageUrl
        if (product.imageUrl) {
          cleanImageUrl = extractImageUrl(product.imageUrl);
          if (cleanImageUrl !== product.imageUrl) {
            needsFix = true;
          }
        }
        
        // If no clean imageUrl but we have clean images, use first image
        if (!cleanImageUrl && cleanImages.length > 0) {
          cleanImageUrl = cleanImages[0];
          needsFix = true;
        }
        
        if (needsFix) {
          await storage.updateProduct(product.id, {
            images: cleanImages,
            imageUrl: cleanImageUrl
          });
          fixedCount++;
          fixedProducts.push(`${product.id}: ${product.name}`);
          console.log(`Fixed product ${product.id} (${product.name}): images=${JSON.stringify(cleanImages)}, imageUrl=${cleanImageUrl}`);
        }
      }
      
      // Refresh memory cache
      await loadAllDataIntoMemory();
      
      res.json({ 
        message: `Fixed ${fixedCount} products with corrupted images`,
        fixedProducts
      });
    } catch (error) {
      console.error("Error fixing product images:", error);
      res.status(500).json({ message: "Failed to fix product images" });
    }
  });

  // Admin Category Management Routes
  app.get("/admin/api/categories", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      let market = req.query.market as string | undefined;
      const allowedMkts = req.adminMarkets || [];
      const isSuperAdm = allowedMkts.length === 0;
      if (market && market !== 'all' && !canAccessMarket(req as AdminAuthRequest, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      // Restricted admins without explicit market default to their first market
      if (!isSuperAdm && (!market || market === 'all')) {
        market = allowedMkts[0];
      }
      const categories = await storage.getCategories(market);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/admin/api/categories", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { name, description, imageUrl, marketCode } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }

      const targetMarket = marketCode || 'ro';
      if (!canAccessMarket(req as AdminAuthRequest, targetMarket)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      // Generate slug from name
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      
      // Extract clean URL from imageUrl (handles objects and strings)
      const cleanImageUrl = extractImageUrl(imageUrl);
      
      const newCategory = await storage.createCategory({
        name,
        slug,
        description,
        imageUrl: cleanImageUrl,
        marketCode: targetMarket,
      });

      await loadAllDataIntoMemory();
      res.json({ message: "Category created successfully", category: newCategory });
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/admin/api/categories/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id);
      const { name, description, imageUrl, marketCode } = req.body;

      // Record-level market ownership check
      const existingCat = await storage.getCategory(categoryId);
      if (!existingCat) return res.status(404).json({ message: "Category not found" });
      if (!canAccessMarket(req as AdminAuthRequest, existingCat.marketCode || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      if (marketCode !== undefined && !canAccessMarket(req as AdminAuthRequest, marketCode)) {
        return res.status(403).json({ message: "Access denied for target market" });
      }
      
      // Extract clean URL from imageUrl (handles objects and strings)
      const cleanImageUrl = imageUrl !== undefined ? extractImageUrl(imageUrl) : undefined;
      
      const updatedCategory = await storage.updateCategory(categoryId, {
        name,
        description,
        imageUrl: cleanImageUrl,
        ...(marketCode !== undefined ? { marketCode } : {}),
      });

      await loadAllDataIntoMemory();
      res.json({ message: "Category updated successfully", category: updatedCategory });
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/admin/api/categories/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id);

      // Record-level market ownership check
      const catToDelete = await storage.getCategory(categoryId);
      if (!catToDelete) return res.status(404).json({ message: "Category not found" });
      if (!canAccessMarket(req as AdminAuthRequest, catToDelete.marketCode || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      await storage.deleteCategory(categoryId);
      await loadAllDataIntoMemory();
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Category image upload endpoint
  app.post("/admin/api/categories/:id/upload-image", authenticateAdmin, upload.single('image'), processImages, async (req: AdminAuthRequest, res: Response) => {
    try {
      console.log("Category image upload request received");
      console.log("Category ID:", req.params.id);
      console.log("Admin user:", req.admin?.email);
      console.log("Files received:", req.file ? "Yes" : "No");
      console.log("Processed files:", req.processedFiles?.length || 0);
      
      const categoryId = parseInt(req.params.id);
      
      if (!req.processedFiles || req.processedFiles.length === 0) {
        console.log("No processed files found");
        return res.status(400).json({ message: "No image file provided" });
      }

      const processedFile = req.processedFiles[0];
      console.log("Processed file URL:", processedFile.url);
      
      // Update category with new image URL
      const updatedCategory = await storage.updateCategory(categoryId, {
        imageUrl: processedFile.url
      });

      console.log("Category updated successfully:", updatedCategory);

      // Refresh memory cache
      await loadAllDataIntoMemory();
      
      res.json({ 
        message: "Category image uploaded successfully", 
        category: updatedCategory,
        imageUrl: processedFile.url,
        thumbnailUrl: processedFile.thumbnailUrl
      });
    } catch (error) {
      console.error("Error uploading category image:", error);
      res.status(500).json({ message: "Failed to upload category image" });
    }
  });

  // Product Bulk Operations
  app.put("/admin/api/products/bulk/prices", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { productIds, multiplier, fixedPrice } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "Product IDs are required" });
      }
      
      const results = [];
      for (const productId of productIds) {
        try {
          const product = await storage.getProduct(parseInt(productId));
          if (product) {
            let newPrice = product.price;
            if (multiplier) {
              newPrice = parseFloat(product.price) * multiplier;
            } else if (fixedPrice) {
              newPrice = fixedPrice;
            }
            
            await storage.updateProduct(parseInt(productId), { price: newPrice.toString() });
            results.push({ id: productId, success: true, newPrice });
          } else {
            results.push({ id: productId, success: false, message: "Product not found" });
          }
        } catch (error) {
          results.push({ id: productId, success: false, message: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      // Refresh memory cache after bulk operations
      await loadAllDataIntoMemory();
      
      res.json({ 
        message: `Price update completed for ${productIds.length} products`,
        results
      });
    } catch (error) {
      console.error("Error updating product prices:", error);
      res.status(500).json({ message: "Failed to update product prices" });
    }
  });

  app.put("/admin/api/products/bulk/categories", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { productIds, categoryId } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "Product IDs are required" });
      }
      
      if (!categoryId) {
        return res.status(400).json({ message: "Category ID is required" });
      }
      
      const results = [];
      for (const productId of productIds) {
        try {
          const product = await storage.getProduct(parseInt(productId));
          if (product) {
            await storage.updateProduct(parseInt(productId), { categoryId: parseInt(categoryId) });
            results.push({ id: productId, success: true });
          } else {
            results.push({ id: productId, success: false, message: "Product not found" });
          }
        } catch (error) {
          results.push({ id: productId, success: false, message: error.message });
        }
      }
      
      // Refresh memory cache after bulk operations
      await loadAllDataIntoMemory();
      
      res.json({ 
        message: `Category update completed for ${productIds.length} products`,
        results
      });
    } catch (error) {
      console.error("Error updating product categories:", error);
      res.status(500).json({ message: "Failed to update product categories" });
    }
  });

  app.put("/admin/api/products/bulk/status", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { productIds, status } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "Product IDs are required" });
      }
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const results = [];
      for (const productId of productIds) {
        try {
          const product = await storage.getProduct(parseInt(productId));
          if (product) {
            await storage.updateProduct(parseInt(productId), { status });
            results.push({ id: productId, success: true });
          } else {
            results.push({ id: productId, success: false, message: "Product not found" });
          }
        } catch (error) {
          results.push({ id: productId, success: false, message: error.message });
        }
      }
      
      // Refresh memory cache after bulk operations
      await loadAllDataIntoMemory();
      
      res.json({ 
        message: `Status update completed for ${productIds.length} products`,
        results
      });
    } catch (error) {
      console.error("Error updating product status:", error);
      res.status(500).json({ message: "Failed to update product status" });
    }
  });

  // Bulk generate product codes for products without codes
  app.post("/admin/api/products/bulk/generate-codes", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      // Get all products without product codes
      const allProducts = await storage.getProducts({ limit: 10000 });
      const productsWithoutCodes = allProducts.filter(p => !p.productCode || p.productCode.trim() === '');
      
      if (productsWithoutCodes.length === 0) {
        return res.json({ 
          message: "All products already have product codes",
          updated: 0
        });
      }
      
      const results = [];
      for (const product of productsWithoutCodes) {
        try {
          const timestamp = Date.now().toString(36).toUpperCase();
          const random = Math.random().toString(36).substring(2, 5).toUpperCase();
          const productCode = `PRD-${timestamp}${random}`;
          
          await storage.updateProduct(product.id, { productCode });
          results.push({ id: product.id, name: product.name, productCode, success: true });
          
          // Small delay to ensure unique timestamps
          await new Promise(resolve => setTimeout(resolve, 5));
        } catch (error: any) {
          results.push({ id: product.id, name: product.name, success: false, message: error.message });
        }
      }
      
      // Refresh memory cache
      await loadAllDataIntoMemory();
      
      res.json({
        message: `Generated product codes for ${results.filter(r => r.success).length} products`,
        updated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      });
    } catch (error) {
      console.error("Error generating product codes:", error);
      res.status(500).json({ message: "Failed to generate product codes" });
    }
  });

  app.put("/admin/api/products/bulk/stock", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { productIds, operation, value } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "Product IDs are required" });
      }
      
      if (!operation || !value) {
        return res.status(400).json({ message: "Operation and value are required" });
      }
      
      const results = [];
      for (const productId of productIds) {
        try {
          const product = await storage.getProduct(parseInt(productId));
          if (product) {
            let newStock = product.stockQuantity || 0;
            
            switch (operation) {
              case 'set':
                newStock = value;
                break;
              case 'add':
                newStock += value;
                break;
              case 'subtract':
                newStock = Math.max(0, newStock - value);
                break;
              default:
                throw new Error('Invalid operation');
            }
            
            await storage.updateProduct(parseInt(productId), { stockQuantity: newStock });
            results.push({ id: productId, success: true, newStock });
          } else {
            results.push({ id: productId, success: false, message: "Product not found" });
          }
        } catch (error) {
          results.push({ id: productId, success: false, message: error.message });
        }
      }
      
      // Refresh memory cache after bulk operations
      await loadAllDataIntoMemory();
      
      res.json({ 
        message: `Stock update completed for ${productIds.length} products`,
        results
      });
    } catch (error) {
      console.error("Error updating product stock:", error);
      res.status(500).json({ message: "Failed to update product stock" });
    }
  });

  app.put("/admin/api/products/bulk/export", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { productIds } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "Product IDs are required" });
      }
      
      const products = [];
      for (const productId of productIds) {
        try {
          const product = await storage.getProduct(parseInt(productId));
          if (product) {
            products.push(product);
          }
        } catch (error) {
          console.error(`Error fetching product ${productId}:`, error);
        }
      }
      
      // Generate CSV content
      const csvHeader = "ID,Name,Price,Category,Stock,VAT%,Product Code,NC Code,CPV Code,Description\n";
      const csvRows = products.map(product => 
        `${product.id},"${product.name}",${product.price},"${product.category?.name || 'N/A'}",${product.stockQuantity || 0},${product.vatValue || 0},"${product.productCode || ''}","${product.ncCode || ''}","${product.cpvCode || ''}","${product.description || ''}"`
      ).join('\n');
      
      const csvContent = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products_export.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting products:", error);
      res.status(500).json({ message: "Failed to export products" });
    }
  });

  app.put("/admin/api/products/bulk/delete", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { productIds } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: "Product IDs are required" });
      }
      
      const results = [];
      for (const productId of productIds) {
        try {
          const product = await storage.getProduct(parseInt(productId));
          if (product) {
            await storage.deleteProduct(parseInt(productId));
            results.push({ id: productId, success: true });
          } else {
            results.push({ id: productId, success: false, message: "Product not found" });
          }
        } catch (error) {
          results.push({ id: productId, success: false, message: error.message });
        }
      }
      
      // Refresh memory cache after bulk operations
      await loadAllDataIntoMemory();
      
      const totalCount = productIds.length;
      res.json({ 
        message: `Delete operation completed for ${totalCount} products`,
        results
      });
    } catch (error) {
      console.error("Error deleting products:", error);
      res.status(500).json({ message: "Failed to delete products" });
    }
  });

  // Supplier routes
  app.get("/admin/api/suppliers", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      let market = req.query.market as string | undefined;
      const suppAllowed = req.adminMarkets || [];
      const suppIsSuperAdmin = suppAllowed.length === 0;
      if (market && market !== 'all' && !canAccessMarket(req as AdminAuthRequest, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      if (!suppIsSuperAdmin && (!market || market === 'all')) {
        market = suppAllowed[0];
      }
      const suppliers = await storage.getSuppliers(market);
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.get("/admin/api/suppliers/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const supplier = await storage.getSupplier(parseInt(id));
      
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      // Record-level market ownership check
      if (!canAccessMarket(req as AdminAuthRequest, supplier.marketCode || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      
      res.json(supplier);
    } catch (error) {
      console.error("Error fetching supplier:", error);
      res.status(500).json({ message: "Failed to fetch supplier" });
    }
  });

  app.post("/admin/api/suppliers", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { name, email, phone, address, city, state, zipCode, country, contactPerson, apiEndpoint, apiKey, integrationType, notes, isActive, marketCode } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }

      const targetMarket = marketCode || 'ro';
      if (!canAccessMarket(req as AdminAuthRequest, targetMarket)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      
      const supplier = await storage.createSupplier({
        name,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        country,
        contactPerson,
        apiEndpoint,
        apiKey,
        integrationType: integrationType || 'email',
        notes,
        isActive: isActive !== undefined ? isActive : true,
        marketCode: targetMarket,
      });
      
      res.json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  app.put("/admin/api/suppliers/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, email, phone, address, city, state, zipCode, country, contactPerson, apiEndpoint, apiKey, integrationType, notes, isActive, marketCode } = req.body;

      // Record-level market ownership check
      const existingSupp = await storage.getSupplier(parseInt(id));
      if (!existingSupp) return res.status(404).json({ message: "Supplier not found" });
      if (!canAccessMarket(req as AdminAuthRequest, existingSupp.marketCode || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      if (marketCode !== undefined && !canAccessMarket(req as AdminAuthRequest, marketCode)) {
        return res.status(403).json({ message: "Access denied for target market" });
      }

      const supplier = await storage.updateSupplier(parseInt(id), {
        name,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        country,
        contactPerson,
        apiEndpoint,
        apiKey,
        integrationType,
        notes,
        isActive,
        ...(marketCode !== undefined ? { marketCode } : {}),
      });
      
      res.json(supplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ message: "Failed to update supplier" });
    }
  });

  // Supplier bulk operations
  app.post("/admin/api/suppliers/bulk", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { operation, supplierIds, ...operationData } = req.body;
      
      if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
        return res.status(400).json({ message: "No suppliers selected" });
      }

      let processed = 0;
      let success = 0;
      let failed = 0;
      let message = "";

      for (const supplierId of supplierIds) {
        try {
          processed++;
          
          switch (operation) {
            case 'activate':
              await storage.updateSupplier(supplierId, { isActive: true });
              success++;
              break;
              
            case 'deactivate':
              await storage.updateSupplier(supplierId, { isActive: false });
              success++;
              break;
              
            case 'status':
              await storage.updateSupplier(supplierId, { isActive: operationData.status === 'active' });
              success++;
              break;
              
            case 'sync-prices':
              // This would normally call the supplier's API to sync prices
              // For now, we'll simulate the operation
              console.log(`Syncing prices for supplier ${supplierId}`);
              success++;
              break;
              
            case 'sync-stock':
              // This would normally call the supplier's API to sync stock
              // For now, we'll simulate the operation
              console.log(`Syncing stock for supplier ${supplierId}`);
              success++;
              break;
              
            case 'delete':
              await storage.deleteSupplier(supplierId);
              success++;
              break;
              
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
        } catch (error) {
          console.error(`Error processing supplier ${supplierId}:`, error);
          failed++;
        }
      }

      // Set appropriate message based on operation
      switch (operation) {
        case 'activate':
          message = `Successfully activated ${success} supplier(s)`;
          break;
        case 'deactivate':
          message = `Successfully deactivated ${success} supplier(s)`;
          break;
        case 'status':
          message = `Successfully updated status for ${success} supplier(s)`;
          break;
        case 'sync-prices':
          message = `Successfully synced prices for ${success} supplier(s)`;
          break;
        case 'sync-stock':
          message = `Successfully synced stock for ${success} supplier(s)`;
          break;
        case 'delete':
          message = `Successfully deleted ${success} supplier(s)`;
          break;
        default:
          message = `Successfully processed ${success} supplier(s)`;
      }

      if (failed > 0) {
        message += ` (${failed} failed)`;
      }

      res.json({
        message,
        processed,
        success,
        failed,
        operation
      });
    } catch (error) {
      console.error("Error in supplier bulk operation:", error);
      res.status(500).json({ message: "Failed to perform bulk operation" });
    }
  });

  app.delete("/admin/api/suppliers/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Record-level market ownership check
      const suppToDelete = await storage.getSupplier(parseInt(id));
      if (!suppToDelete) return res.status(404).json({ message: "Supplier not found" });
      if (!canAccessMarket(req as AdminAuthRequest, suppToDelete.marketCode || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      await storage.deleteSupplier(parseInt(id));
      res.json({ message: "Supplier deleted successfully" });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ message: "Failed to delete supplier" });
    }
  });

  // Supplier price and stock synchronization endpoints
  app.post("/admin/api/suppliers/:id/sync-prices", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const supplier = await storage.getSupplier(parseInt(id));
      
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      // Fetch updated prices from supplier's API
      const priceUpdates = await fetchSupplierPrices(supplier);
      
      // Update products with new prices
      const updateResults = [];
      for (const update of priceUpdates) {
        try {
          const product = await storage.getProduct(update.productId);
          if (product && product.supplierId === parseInt(id)) {
            await storage.updateProduct(update.productId, {
              price: update.price.toString(),
              compareAtPrice: update.compareAtPrice?.toString(),
              stockQuantity: update.stockQuantity
            });
            updateResults.push({
              productId: update.productId,
              productName: product.name,
              oldPrice: product.price,
              newPrice: update.price,
              oldStock: product.stockQuantity,
              newStock: update.stockQuantity,
              success: true
            });
          }
        } catch (error) {
          updateResults.push({
            productId: update.productId,
            success: false,
            error: error.message
          });
        }
      }

      // Refresh memory cache
      await loadAllDataIntoMemory();
      
      res.json({
        success: true,
        message: `Updated prices for ${updateResults.filter(r => r.success).length} products`,
        data: updateResults
      });
    } catch (error) {
      console.error("Error syncing prices:", error);
      res.status(500).json({ message: "Failed to sync prices with supplier" });
    }
  });

  app.post("/admin/api/suppliers/:id/sync-stock", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const supplier = await storage.getSupplier(parseInt(id));
      
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      // Fetch updated stock from supplier's API
      const stockUpdates = await fetchSupplierStock(supplier);
      
      // Update products with new stock levels
      const updateResults = [];
      for (const update of stockUpdates) {
        try {
          const product = await storage.getProduct(update.productId);
          if (product && product.supplierId === parseInt(id)) {
            await storage.updateProduct(update.productId, {
              stockQuantity: update.stockQuantity
            });
            updateResults.push({
              productId: update.productId,
              productName: product.name,
              oldStock: product.stockQuantity,
              newStock: update.stockQuantity,
              success: true
            });
          }
        } catch (error) {
          updateResults.push({
            productId: update.productId,
            success: false,
            error: error.message
          });
        }
      }

      // Refresh memory cache
      await loadAllDataIntoMemory();
      
      res.json({
        success: true,
        message: `Updated stock for ${updateResults.filter(r => r.success).length} products`,
        data: updateResults
      });
    } catch (error) {
      console.error("Error syncing stock:", error);
      res.status(500).json({ message: "Failed to sync stock with supplier" });
    }
  });

  // Order forwarding to suppliers
  app.post("/admin/api/suppliers/forward-order", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { orderId } = req.body;
      
      const order = await storage.getOrder(parseInt(orderId));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Group order items by supplier
      const supplierOrders = new Map();
      
      for (const item of order.items) {
        const product = await storage.getProduct(item.productId);
        if (product && product.supplierId) {
          if (!supplierOrders.has(product.supplierId)) {
            supplierOrders.set(product.supplierId, []);
          }
          supplierOrders.get(product.supplierId).push({
            ...item,
            product: product
          });
        }
      }

      // Forward order to each supplier
      const forwardResults = [];
      for (const [supplierId, items] of supplierOrders) {
        try {
          const supplier = await storage.getSupplier(supplierId);
          if (supplier) {
            const orderData = {
              orderId: order.id,
              orderDate: order.createdAt,
              customerInfo: {
                userId: order.userId,
                totalAmount: order.totalAmount
              },
              shippingAddress: order.shippingAddress,
              billingAddress: order.billingAddress,
              items: items.map(item => ({
                productId: item.productId,
                productName: item.product.name,
                productCode: item.product.productCode,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.totalPrice
              })),
              supplierInstructions: `Please process order #${order.id} for delivery to customer`
            };

            const result = await forwardOrderToSupplier(supplier, orderData);
            forwardResults.push({
              supplierId,
              supplierName: supplier.name,
              itemCount: items.length,
              success: result.success,
              message: result.message,
              data: result.data
            });
          }
        } catch (error) {
          forwardResults.push({
            supplierId,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Order forwarded to ${forwardResults.length} suppliers`,
        data: forwardResults
      });
    } catch (error) {
      console.error("Error forwarding order:", error);
      res.status(500).json({ message: "Failed to forward order to suppliers" });
    }
  });

  app.get("/admin/api/suppliers/:id/delivery-status/:orderId", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { id, orderId } = req.params;
      
      const supplier = await storage.getSupplier(parseInt(id));
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      // Simulate fetching delivery status from supplier's API
      const deliveryStatus = await fetchSupplierDeliveryStatus(supplier, orderId);
      
      res.json({
        success: true,
        data: deliveryStatus
      });
    } catch (error) {
      console.error("Error fetching delivery status:", error);
      res.status(500).json({ message: "Failed to fetch delivery status" });
    }
  });

  app.post("/admin/api/suppliers/bulk-sync", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { orderIds, action } = req.body; // action: 'fetch_status', 'update_delivery', 'notify_suppliers'
      
      if (!orderIds || !Array.isArray(orderIds)) {
        return res.status(400).json({ message: "Order IDs array is required" });
      }

      const results = [];
      
      for (const orderId of orderIds) {
        try {
          const order = await storage.getOrder(parseInt(orderId));
          if (!order) {
            results.push({ orderId, success: false, message: "Order not found" });
            continue;
          }

          // Get suppliers for products in this order
          const supplierIds = new Set();
          for (const item of order.items) {
            const product = await storage.getProduct(item.productId);
            if (product && product.supplierId) {
              supplierIds.add(product.supplierId);
            }
          }

          // Sync with each supplier
          for (const supplierId of supplierIds) {
            const supplier = await storage.getSupplier(supplierId);
            if (supplier) {
              const syncResult = await performSupplierSync(supplier, order, action);
              results.push({
                orderId,
                supplierId,
                supplierName: supplier.name,
                success: syncResult.success,
                message: syncResult.message,
                data: syncResult.data
              });
            }
          }
        } catch (error) {
          results.push({ orderId, success: false, message: error.message });
        }
      }

      res.json({
        success: true,
        message: `Bulk sync completed for ${orderIds.length} orders`,
        results
      });
    } catch (error) {
      console.error("Error in bulk supplier sync:", error);
      res.status(500).json({ message: "Failed to perform bulk sync" });
    }
  });

  // Helper: send customer & supplier emails after AWB generation
  async function sendAwbEmails(orderId: number, awbNumber: string) {
    try {
      console.log(`📧 [AWB Email] Sending emails for order #${orderId}, AWB: ${awbNumber}...`);
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`❌ [AWB Email] Order #${orderId} not found`);
        return;
      }

      const shippingAddr = order.shippingAddress as any;
      const billingAddr = order.billingAddress as any;

      let user: any = null;
      if (order.userId) {
        user = await storage.getUser(order.userId);
      }
      if (!user) {
        const guestEmail = shippingAddr?.email || billingAddr?.email || '';
        if (guestEmail) {
          const existingUser = await storage.getUserByEmail(guestEmail);
          if (existingUser) {
            user = existingUser;
          } else {
            user = {
              id: 0,
              email: guestEmail,
              firstName: shippingAddr?.firstName || billingAddr?.firstName || 'Guest',
              lastName: shippingAddr?.lastName || billingAddr?.lastName || 'Customer',
            };
          }
        }
      }

      if (!user) {
        const notesEmailMatch = order.notes?.match(/Guest email:\s*([^\s,]+)/);
        const notesEmail = notesEmailMatch ? notesEmailMatch[1] : '';
        if (notesEmail) {
          const existingUser = await storage.getUserByEmail(notesEmail);
          if (existingUser) {
            user = existingUser;
          } else {
            user = { id: 0, email: notesEmail, firstName: 'Guest', lastName: 'Customer' };
          }
        }
      }

      if (!user?.email) {
        console.error(`❌ [AWB Email] No email found for order #${orderId}`);
        return;
      }

      const { sendSupplierOrderEmail, sendCustomerShipmentEmail } = await import('./email-service');
      const { createSamedayAPI } = await import('./sameday-api');

      let awbPdfBuffer: Buffer | undefined;
      if (!awbNumber.includes('MANUAL')) {
        try {
          const samedayAPI = createSamedayAPI();
          if (samedayAPI) {
            awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
            console.log(`✅ [AWB Email] AWB PDF retrieved for order #${orderId}`);
          }
        } catch (pdfError) {
          console.error(`❌ [AWB Email] AWB PDF retrieval failed:`, pdfError);
        }
      }

      const supplierGroups = new Map<number | null, { supplierName: string; supplierEmail: string; items: { productName: string; quantity: number }[] }>();
      for (const item of order.items) {
        const product = await storage.getProduct(item.productId);
        const supplierId = product?.supplierId || null;
        let supplierInfo = supplierGroups.get(supplierId);
        if (!supplierInfo) {
          if (supplierId) {
            const supplier = await storage.getSupplier(supplierId);
            if (supplier && supplier.email) {
              supplierInfo = { supplierName: supplier.contactPerson || supplier.name, supplierEmail: supplier.email, items: [] };
            }
          }
          if (!supplierInfo) {
            const companySettings = await storage.getCompanySettings();
            const fallbackEmail = companySettings?.logisticsEmail || companySettings?.email || '';
            supplierInfo = { supplierName: companySettings?.name || 'xHACCP', supplierEmail: fallbackEmail, items: [] };
          }
          supplierGroups.set(supplierId, supplierInfo);
        }
        supplierInfo.items.push({ productName: item.product.name, quantity: item.quantity });
      }

      for (const [, group] of supplierGroups) {
        if (group.supplierEmail) {
          try {
            await sendSupplierOrderEmail(group.supplierEmail, group.supplierName, order, group.items, awbNumber, awbPdfBuffer);
            console.log(`✅ [AWB Email] Supplier email sent to ${group.supplierEmail} for order #${orderId}`);
          } catch (e) {
            console.error(`❌ [AWB Email] Failed to send supplier email to ${group.supplierEmail}:`, e);
          }
        }
      }

      let invoicePdfBuffer: Buffer | null = null;
      let invoiceNumber: string | undefined;
      try {
        const invoicesList = await storage.getInvoices(order.userId || undefined);
        const orderInvoice = invoicesList.find(inv => inv.orderId === orderId);
        if (orderInvoice) {
          invoiceNumber = orderInvoice.invoiceNumber;
          const { createInvoiceService } = await import('./invoice-service.js');
          const invoiceService = await createInvoiceService();
          invoicePdfBuffer = await invoiceService.getInvoicePdf(orderInvoice.id);
          console.log(`✅ [AWB Email] Invoice PDF retrieved for order #${orderId}`);
        }
      } catch (e) {
        console.error(`❌ [AWB Email] Failed to retrieve invoice PDF:`, e);
      }

      try {
        await sendCustomerShipmentEmail(user.email, order, awbNumber, invoicePdfBuffer, invoiceNumber);
        console.log(`✅ [AWB Email] Customer email sent to ${user.email} for order #${orderId}`);
      } catch (e) {
        console.error(`❌ [AWB Email] Failed to send customer email:`, e);
      }

      console.log(`✅ [AWB Email] Email flow completed for order #${orderId}`);
    } catch (error) {
      console.error(`❌ [AWB Email] Error in email flow for order #${orderId}:`, error);
    }
  }

  // Manual AWB Generation route for admin interface
  app.post("/admin/api/orders/:id/generate-awb", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    let responded = false;
    try {
      const orderId = parseInt(req.params.id);
      console.log('🚚 Starting manual AWB generation for order:', orderId);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!canAccessMarket(req, order.market || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      
      if (!samedayAPI) {
        return res.status(500).json({ message: "Sameday API not configured. Please add SAMEDAY_USERNAME and SAMEDAY_PASSWORD environment variables." });
      }

      console.log('🚚 Starting AWB generation for order:', orderId);
      const awbGenerationPromise = async () => {
        // Get real pickup points and services from Sameday API
        console.log('📍 Fetching pickup points and services from Sameday API...');
        const [pickupPoints, services] = await Promise.all([
          samedayAPI.getPickupPoints(),
          samedayAPI.getServices()
        ]);

        if (pickupPoints.length === 0) {
          throw new Error("No pickup points configured in Sameday account");
        }

        if (services.length === 0) {
          throw new Error("No services configured in Sameday account");
        }

        const pickupPoint = pickupPoints.find((p: any) => p.id === 447249) || pickupPoints[0];
        const preferredManualService = services.find((s: any) => {
          const name = s.name?.toLowerCase() || '';
          if (name.includes('retur') || name.includes('return')) return false;
          return name.includes('standard') || name.includes('next day');
        });
        if (!preferredManualService) {
          console.warn(`⚠️ [Manual AWB] No 'Standard'/'Next Day' service found, falling back to first service: ${services[0].id} (${services[0].name})`);
        }
        const service = preferredManualService || services[0];

        console.log('✅ Using pickup point:', pickupPoint.id, pickupPoint.alias);
        console.log('✅ Using service:', service.id, service.name);

        // Parse shipping and billing addresses
        let shippingAddress: any = {};
        try {
          if (order.shippingAddress) {
            shippingAddress = typeof order.shippingAddress === 'string' 
              ? JSON.parse(order.shippingAddress)
              : order.shippingAddress;
          }
        } catch (err) {
          console.error('Failed to parse shipping address:', err);
          shippingAddress = {};
        }

        let manualBillingAddr: any = {};
        try {
          if (order.billingAddress) {
            manualBillingAddr = typeof order.billingAddress === 'string'
              ? JSON.parse(order.billingAddress as string)
              : order.billingAddress;
          }
        } catch (err) {
          console.error('Failed to parse billing address:', err);
          manualBillingAddr = {};
        }

        const isB2BManual = !!(manualBillingAddr.companyName);

        // Look up county and city IDs for production reliability
        let countyId = null;
        let cityId = null;
        
        try {
          console.log('🗺️ Fetching counties and cities for location lookup...');
          const counties = await samedayAPI.getCounties();
          const countyName = shippingAddress.county || shippingAddress.state || "Cluj";
          const foundCounty = counties.find(c => 
            c.name.toLowerCase().includes(countyName.toLowerCase()) ||
            countyName.toLowerCase().includes(c.name.toLowerCase())
          );
          
          if (foundCounty) {
            countyId = foundCounty.id;
            
            // Get cities for this county
            const cities = await samedayAPI.getCities(String(foundCounty.id));
            const cityName = shippingAddress.city || "Cluj-Napoca";
            const foundCity = cities.find(c => 
              c.name.toLowerCase().includes(cityName.toLowerCase()) ||
              cityName.toLowerCase().includes(c.name.toLowerCase())
            );
            
            if (foundCity) {
              cityId = foundCity.id;
            }
          }
        } catch (error) {
          console.warn('Could not fetch county/city IDs, using string names as fallback:', error.message);
        }

        // Create AWB request with EXACT Sameday API v3.0 format and required fields
        const manualIsCOD = order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'cod' || order.paymentMethod === 'cash';
        const manualTotalAmount = parseFloat(String(order.totalAmount));
        const awbRequest = {
          pickupPoint: pickupPoint.id,
          contactPerson: pickupPoint.contactPersons?.[0]?.id || null,
          service: service.id,
          packageType: 0,
          packageWeight: 1,
          awbPayment: 1,
          cashOnDelivery: manualIsCOD ? manualTotalAmount : 0,
          insuredValue: 0,
          thirdPartyPickup: 0,
          awbRecipient: {
            name: `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim() || shippingAddress.companyName || order.customerName || 'Customer',
            phoneNumber: shippingAddress.phone || "+40745009000",
            personType: isB2BManual ? 1 : 0,
            ...(isB2BManual && { companyName: manualBillingAddr.companyName }),
            address: shippingAddress.address || shippingAddress.street || "Address not provided",
            countyString: shippingAddress.county || shippingAddress.state || 'Cluj',
            cityString: shippingAddress.city || 'Cluj-Napoca',
            postalCode: shippingAddress.zipCode || shippingAddress.postalCode || "400000"
          },
          parcels: await buildCombinedParcels(order.items || [], storage),
          clientInternalReference: `KTO${String(orderId).padStart(5, '0')}`
        };

        awbRequest.packageWeight = awbRequest.parcels.reduce((sum: number, p: any) => sum + (p.weight || 1), 0);
        console.log(`📦 [Manual] Combined parcels: ${awbRequest.parcels.length} parcel(s) for ${(order.items || []).length} item(s)`);
        console.log('📦 Creating AWB with Sameday API:', JSON.stringify(awbRequest, null, 2));
        
        const awbStartTime = Date.now();
        const awbResponse = await samedayAPI.createAWB(awbRequest);
        const awbEndTime = Date.now();
        console.log('✅ AWB created successfully in', awbEndTime - awbStartTime, 'ms:', awbResponse);

        if (!awbResponse.awbNumber) {
          throw new Error('Sameday API returned empty AWB number');
        }

        const orderUpdate = await storage.updateOrder(parseInt(orderId), {
          awbNumber: awbResponse.awbNumber,
          awbCourier: 'Sameday',
          awbCost: awbResponse.cost || 0,
          awbCurrency: awbResponse.currency || 'RON',
          awbPdfUrl: awbResponse.pdfLink || null,
          status: 'in_delivery',
          awbCreatedAt: new Date(),
        });

        const finalAwb = awbResponse.awbNumber;
        if (!responded) {
          responded = true;
          res.json({
            success: true,
            awbNumber: finalAwb,
            awbCost: awbResponse.cost || 0,
            currency: awbResponse.currency || 'RON',
            courier: 'Sameday',
            order: orderUpdate,
            trackingUrl: `https://sameday.ro/status-colet/?awb=${finalAwb}`,
            message: `Real AWB created via Sameday API: ${finalAwb}`
          });
          sendAwbEmails(parseInt(orderId), finalAwb).catch(e => console.error('❌ [AWB Email] Background email error:', e));
        }
      };

      const timeoutMs = 120000;
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('AWB generation timeout after 120s')), timeoutMs));
      await Promise.race([awbGenerationPromise(), timeout]);

    } catch (error) {
      console.error("Admin AWB generation error:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      console.error("Error message:", error instanceof Error ? error.message : 'Unknown error');
      
      if (!responded) {
        responded = true;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ AWB generation failed, NOT saving fake AWB to database:', errorMsg);
        res.status(500).json({ 
          success: false,
          message: "Failed to generate AWB. Please retry or create manually in Sameday portal.", 
          error: errorMsg.substring(0, 300)
        });
      }
    }
  });

  // Bulk update category homepage positioning
  app.put("/admin/api/categories/bulk/homepage", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { mainTopCategories, mainShopCategories } = req.body;
      
      // Validate input
      if (!Array.isArray(mainTopCategories) || !Array.isArray(mainShopCategories)) {
        return res.status(400).json({ message: "Invalid category arrays" });
      }
      
      if (mainTopCategories.length > 4) {
        return res.status(400).json({ message: "Maximum 4 categories allowed for main top section" });
      }
      
      if (mainShopCategories.length > 3) {
        return res.status(400).json({ message: "Maximum 3 categories allowed for main shop section" });
      }

      // Reset all categories
      const allCategories = await storage.getCategories();
      const resetPromises = allCategories.map(category => 
        storage.updateCategory(category.id, { 
          showOnMainTop: false, 
          showOnMainShop: false,
          sortOrder: 0 
        })
      );
      await Promise.all(resetPromises);

      // Update main top categories
      const mainTopPromises = mainTopCategories.map((categoryId, index) => 
        storage.updateCategory(parseInt(categoryId), { 
          showOnMainTop: true, 
          sortOrder: index + 1 
        })
      );
      await Promise.all(mainTopPromises);

      // Update main shop categories
      const mainShopPromises = mainShopCategories.map((categoryId, index) => 
        storage.updateCategory(parseInt(categoryId), { 
          showOnMainShop: true,
          sortOrder: index + 1 
        })
      );
      await Promise.all(mainShopPromises);

      // Refresh memory cache
      await loadAllDataIntoMemory();
      
      res.json({ 
        message: "Homepage categories updated successfully",
        mainTopCount: mainTopCategories.length,
        mainShopCount: mainShopCategories.length
      });
    } catch (error) {
      console.error("Error updating homepage categories:", error);
      res.status(500).json({ message: "Failed to update homepage categories" });
    }
  });

  // Company Settings Routes
  app.get("/admin/api/company-settings", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    console.log('Company settings API endpoint called');
    try {
      let market = req.query.market as string | undefined;
      const csAllowed = req.adminMarkets || [];
      const csIsSuperAdmin = csAllowed.length === 0;
      // Restricted admins default to their first market
      if (!csIsSuperAdmin && (!market || market === 'all')) {
        market = csAllowed[0];
      }
      // Enforce access control for explicit market
      if (market && market !== 'all' && !canAccessMarket(req as AdminAuthRequest, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const DEFAULTS = {
        name: 'Namarte CCL SRL', email: 'info@xhaccp.com',
        logisticsEmail: 'logistics@xhaccp.com', phone: '+40 123 456 789',
        address: 'Calea Mosilor 158', city: 'Bucharest', state: 'Bucuresti',
        zipCode: '020883', country: 'Romania', contactPerson: 'Company Administrator',
        website: 'https://xhaccp.com', vatNumber: 'RO12345678',
        registrationNumber: 'J40/12345/2020', bankName: 'Banca Comercială Română',
        iban: 'RO49 AAAA 1B31 0075 9384 0000',
        description: 'Professional kitchen equipment and supplies for the HORECA industry.',
        defaultCurrency: 'RON', defaultVatPercentage: '19.00', reverseChargeVat: '0.00',
        freeShippingThreshold: '500.00', standardShippingCost: '25.00', marketContacts: null, marketCode: null
      };

      if (market && market !== 'all') {
        // Look for a market-specific row first
        const marketRow = await pool.query(
          `SELECT * FROM company_settings WHERE market_code = $1 LIMIT 1`, [market]
        );
        if (marketRow.rows.length > 0) {
          const r = marketRow.rows[0];
          return res.json({
            marketCode: r.market_code, name: r.name, email: r.email,
            logisticsEmail: r.logistics_email, phone: r.phone, address: r.address,
            city: r.city, state: r.state, zipCode: r.zip_code, country: r.country,
            contactPerson: r.contact_person, website: r.website,
            vatNumber: r.vat_number, registrationNumber: r.registration_number,
            bankName: r.bank_name, iban: r.iban, description: r.description,
            defaultCurrency: r.default_currency, defaultVatPercentage: r.default_vat_percentage,
            reverseChargeVat: r.reverse_charge_vat,
            freeShippingThreshold: r.free_shipping_threshold,
            standardShippingCost: r.standard_shipping_cost,
            marketContacts: r.market_contacts
          });
        }
        // No market-specific row found — create an empty row for this market (no data cloned from other markets)
        const emptyData = {
          name: '', email: '', logisticsEmail: '', phone: '', address: '', city: '', state: '',
          zipCode: '', country: '', contactPerson: '', website: '', vatNumber: '',
          registrationNumber: '', bankName: '', iban: '', description: '',
          defaultCurrency: 'RON', defaultVatPercentage: 19, reverseChargeVat: false,
          freeShippingThreshold: null, standardShippingCost: null
        };
        // Create the empty market-specific row so future GETs will find it
        try {
          await pool.query(`
            INSERT INTO company_settings (
              market_code, name, email, logistics_email, phone, address, city, state, zip_code, country,
              contact_person, website, vat_number, registration_number, bank_name, iban, description,
              default_currency, default_vat_percentage, reverse_charge_vat, free_shipping_threshold, standard_shipping_cost
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
            ON CONFLICT (market_code) DO NOTHING
          `, [market, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
              'RON', 19, false, null, null]);
        } catch (_) { /* ignore concurrent create */ }
        return res.json({ ...emptyData, marketCode: market, marketContacts: null });
      }

      // No market: return global settings (first row)
      const globalResult = await pool.query(
        `SELECT * FROM company_settings ORDER BY created_at ASC LIMIT 1`
      );
      if (globalResult.rows.length > 0) {
        const g = globalResult.rows[0];
        return res.json({
          marketCode: g.market_code, name: g.name, email: g.email,
          logisticsEmail: g.logistics_email, phone: g.phone, address: g.address,
          city: g.city, state: g.state, zipCode: g.zip_code, country: g.country,
          contactPerson: g.contact_person, website: g.website,
          vatNumber: g.vat_number, registrationNumber: g.registration_number,
          bankName: g.bank_name, iban: g.iban, description: g.description,
          defaultCurrency: g.default_currency, defaultVatPercentage: g.default_vat_percentage,
          reverseChargeVat: g.reverse_charge_vat,
          freeShippingThreshold: g.free_shipping_threshold,
          standardShippingCost: g.standard_shipping_cost,
          marketContacts: g.market_contacts
        });
      }
      res.json(DEFAULTS);
    } catch (error) {
      console.error("Error fetching company settings:", error);
      res.status(500).json({ message: "Failed to fetch company settings" });
    }
  });

  app.put("/admin/api/company-settings", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const market = (req.query.market as string | undefined);
      // Enforce market authorization
      const effectiveMarket = market && market !== 'all' ? market : 'ro';
      if (!canAccessMarket(req as AdminAuthRequest, effectiveMarket)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const { 
        name, email, logisticsEmail, phone, address, city, state, zipCode, country, 
        contactPerson, website, vatNumber, registrationNumber, bankName, iban, description,
        defaultCurrency, defaultVatPercentage, reverseChargeVat, freeShippingThreshold, standardShippingCost,
        invoiceSeries, invoiceNumberFormat, invoiceCurrentNumber
      } = req.body;
      
      console.log('Updating company settings, market:', market, 'currency:', defaultCurrency);

      if (!name || !email) {
        return res.status(400).json({ message: "Company name and email are required" });
      }

      if (market && market !== 'all') {
        // Per-market upsert: INSERT or UPDATE a row with market_code = market
        const existing = await pool.query(
          `SELECT id FROM company_settings WHERE market_code = $1 LIMIT 1`, [market]
        );
        if (existing.rows.length > 0) {
          await pool.query(`
            UPDATE company_settings
            SET name=$1, email=$2, logistics_email=$3, phone=$4, address=$5, city=$6,
                state=$7, zip_code=$8, country=$9, contact_person=$10,
                website=$11, vat_number=$12, registration_number=$13,
                bank_name=$14, iban=$15, description=$16,
                default_currency=$17, default_vat_percentage=$18, reverse_charge_vat=$19,
                free_shipping_threshold=$20, standard_shipping_cost=$21,
                invoice_series=COALESCE($23, invoice_series),
                invoice_number_format=COALESCE($24, invoice_number_format),
                invoice_current_number=COALESCE($25, invoice_current_number),
                updated_at=CURRENT_TIMESTAMP
            WHERE market_code=$22
          `, [name, email, logisticsEmail, phone, address, city, state, zipCode, country,
              contactPerson, website, vatNumber, registrationNumber, bankName, iban, description,
              defaultCurrency, defaultVatPercentage, reverseChargeVat, freeShippingThreshold, standardShippingCost,
              market,
              invoiceSeries || null, invoiceNumberFormat || null, invoiceCurrentNumber != null ? parseInt(invoiceCurrentNumber) : null]);
        } else {
          await pool.query(`
            INSERT INTO company_settings (
              market_code, name, email, logistics_email, phone, address, city, state, zip_code, country,
              contact_person, website, vat_number, registration_number, bank_name, iban, description,
              default_currency, default_vat_percentage, reverse_charge_vat, free_shipping_threshold, standard_shipping_cost,
              invoice_series, invoice_number_format, invoice_current_number
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
          `, [market, name, email, logisticsEmail, phone, address, city, state, zipCode, country,
              contactPerson, website, vatNumber, registrationNumber, bankName, iban, description,
              defaultCurrency, defaultVatPercentage, reverseChargeVat, freeShippingThreshold, standardShippingCost,
              invoiceSeries || 'FACT', invoiceNumberFormat || 'YYYY-NNNNNN', invoiceCurrentNumber != null ? parseInt(invoiceCurrentNumber) : 0]);
        }

        // Sync invoice series to invoice_counters for this market (keep in lockstep)
        if (invoiceSeries && market && market !== 'all') {
          await pool.query(
            `INSERT INTO invoice_counters (market, series, current_number) VALUES ($1, $2, 0)
             ON CONFLICT (market) DO UPDATE SET series = $2, updated_at = NOW()`,
            [market, invoiceSeries]
          );
        }

        return res.json({ message: "Market company settings updated successfully" });
      }

      // Global update (no market): update/insert the global row (market_code IS NULL or first row)
      const globalRow = await pool.query(
        `SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1`
      );
      if (globalRow.rows.length > 0) {
        await pool.query(`
          UPDATE company_settings 
          SET name=$1, email=$2, logistics_email=$3, phone=$4, address=$5, city=$6,
              state=$7, zip_code=$8, country=$9, contact_person=$10,
              website=$11, vat_number=$12, registration_number=$13,
              bank_name=$14, iban=$15, description=$16,
              default_currency=$17, default_vat_percentage=$18, reverse_charge_vat=$19,
              free_shipping_threshold=$20, standard_shipping_cost=$21,
              updated_at=CURRENT_TIMESTAMP
          WHERE id=$22
        `, [name, email, logisticsEmail, phone, address, city, state, zipCode, country,
            contactPerson, website, vatNumber, registrationNumber, bankName, iban, description,
            defaultCurrency, defaultVatPercentage, reverseChargeVat, freeShippingThreshold, standardShippingCost,
            globalRow.rows[0].id]);
      } else {
        await pool.query(`
          INSERT INTO company_settings (
            name, email, logistics_email, phone, address, city, state, zip_code, country,
            contact_person, website, vat_number, registration_number, bank_name, iban, description,
            default_currency, default_vat_percentage, reverse_charge_vat, free_shipping_threshold, standard_shipping_cost
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        `, [name, email, logisticsEmail, phone, address, city, state, zipCode, country,
            contactPerson, website, vatNumber, registrationNumber, bankName, iban, description,
            defaultCurrency, defaultVatPercentage, reverseChargeVat, freeShippingThreshold, standardShippingCost]);
      }

      // After updating global settings, ensure company exists as a supplier
      await ensureCompanySupplier(name, email, phone, address, city, state, zipCode, country, contactPerson);

      res.json({ message: "Company settings updated successfully" });
    } catch (error) {
      console.error("Error updating company settings:", error);
      res.status(500).json({ message: "Failed to update company settings" });
    }
  });

  // Helper function to ensure company exists as a supplier
  async function ensureCompanySupplier(name: string, email: string, phone: string, address: string, city: string, state: string, zipCode: string, country: string, contactPerson: string) {
    try {
      // Check if company supplier already exists
      const existingSupplier = await pool.query('SELECT id FROM suppliers WHERE name = $1 AND email = $2', [name, email]);
      
      if (existingSupplier.rows.length === 0) {
        // Create company as supplier
        await pool.query(`
          INSERT INTO suppliers (
            name, email, phone, address, city, state, zip_code, country, 
            contact_person, integration_type, notes, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          name, email, phone, address, city, state, zipCode, country,
          contactPerson, 'internal', 'Company warehouse - direct fulfillment', true
        ]);
        console.log(`✅ Created company supplier: ${name}`);
      } else {
        // Update existing company supplier
        await pool.query(`
          UPDATE suppliers 
          SET phone = $3, address = $4, city = $5, state = $6, zip_code = $7, 
              country = $8, contact_person = $9, updated_at = CURRENT_TIMESTAMP
          WHERE name = $1 AND email = $2
        `, [name, email, phone, address, city, state, zipCode, country, contactPerson]);
        console.log(`✅ Updated company supplier: ${name}`);
      }
    } catch (error) {
      console.error('Error ensuring company supplier:', error);
    }
  }

  // Configure multer for Excel file uploads
  const excelUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.toLowerCase().endsWith('.xlsx') ||
          file.originalname.toLowerCase().endsWith('.xls')) {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Excel product import endpoint
  app.post("/admin/api/products/import-excel", authenticateAdmin, excelUpload.single('excelFile'), async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No Excel file uploaded" });
      }

      // Parse Excel file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      const headers: string[] = [];
      const jsonData: Array<Record<string, any>> = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          (row.values as any[]).forEach((value, idx) => {
            if (idx > 0) headers.push(String(value ?? ''));
          });
        } else {
          const obj: Record<string, any> = {};
          (row.values as any[]).forEach((value, idx) => {
            if (idx > 0 && headers[idx - 1]) {
              obj[headers[idx - 1]] = value;
            }
          });
          jsonData.push(obj);
        }
      });

      if (!jsonData || jsonData.length === 0) {
        return res.status(400).json({ message: "Excel file is empty or invalid" });
      }

      console.log(`📤 Processing ${jsonData.length} rows from Excel file`);
      console.log('First row data:', JSON.stringify(jsonData[0], null, 2));

      let imported = 0;
      let errors = [];
      let duplicates = [];

      // Get all categories for validation
      const categories = await storage.getCategories();
      const categoryMap = new Map();
      categories.forEach(cat => {
        categoryMap.set(cat.id, cat);
        categoryMap.set(cat.name, cat);
      });

      // Get existing products to check for duplicates
      const existingProducts = await storage.getProducts();
      const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));

      // Process each row
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel row number (header is row 1)

        try {
          console.log(`Processing row ${rowNumber}:`, JSON.stringify(row, null, 2));
          
          // Extract and validate required fields
          const productName = row['Product Name']?.toString()?.trim();
          const price = parseFloat(row['Price']?.toString()?.replace(',', '.') || '0');
          const stockQuantity = parseInt(row['Stock Quantity']?.toString() || '0');
          const categoryId = parseInt(row['Category ID']?.toString() || '0');
          
          console.log(`Row ${rowNumber} parsed:`, { productName, price, stockQuantity, categoryId });

          // Validation
          if (!productName) {
            errors.push(`Row ${rowNumber}: Product Name is required`);
            continue;
          }

          if (existingNames.has(productName.toLowerCase())) {
            duplicates.push(`Row ${rowNumber}: Product "${productName}" already exists`);
            continue;
          }

          if (price <= 0) {
            errors.push(`Row ${rowNumber}: Price must be greater than 0`);
            continue;
          }

          if (stockQuantity < 0) {
            errors.push(`Row ${rowNumber}: Stock Quantity cannot be negative`);
            continue;
          }

          // Try to find category by ID first, then by name if provided
          let finalCategoryId = categoryId;
          const categoryName = row['Category Name']?.toString()?.trim();
          
          if (!categoryMap.has(categoryId)) {
            // If category ID doesn't exist, try to find by name
            if (categoryName) {
              const categoryByName = categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
              if (categoryByName) {
                finalCategoryId = categoryByName.id;
                console.log(`✅ Found category by name: "${categoryName}" (ID: ${finalCategoryId})`);
              } else {
                errors.push(`Row ${rowNumber}: Category ID ${categoryId} and Category Name "${categoryName}" do not exist`);
                continue;
              }
            } else {
              errors.push(`Row ${rowNumber}: Category ID ${categoryId} does not exist`);
              continue;
            }
          }

          // Get company defaults for currency and VAT
          const companySettings = await storage.getCompanySettings();
          const defaultCurrency = companySettings?.defaultCurrency || 'RON';
          const defaultVatPercentage = companySettings?.defaultVatPercentage || 19;

          // Extract optional fields with defaults
          const description = row['Description']?.toString()?.trim() || '';
          const status = row['Status']?.toString()?.toLowerCase()?.trim() || 'active';
          const vatValue = parseFloat(row['VAT %']?.toString()?.replace('%', '').replace(',', '.') || defaultVatPercentage.toString());
          const currency = row['Currency']?.toString()?.trim()?.toUpperCase() || defaultCurrency;
          const productCode = row['Product Code']?.toString()?.trim() || '';
          const ncCode = row['NC Code']?.toString()?.trim() || '';
          const cpvCode = row['CPV Code']?.toString()?.trim() || '';
          const supplierName = row['Supplier Name']?.toString()?.trim() || 'xHACCP Direct';
          
          // Extract logistics fields with defaults and validation
          const weight = Math.max(1, Math.round(parseFloat(row['Weight (kg)']?.toString()?.replace(',', '.') || '1')));
          const length = parseFloat(row['Length (cm)']?.toString()?.replace(',', '.') || '10');
          const width = parseFloat(row['Width (cm)']?.toString()?.replace(',', '.') || '10'); 
          const height = parseFloat(row['Height (cm)']?.toString()?.replace(',', '.') || '10');
          const piecesPerPackage = Math.max(1, parseInt(row['Pieces Per Package']?.toString() || '1'));

          // Validate status
          const validStatuses = ['active', 'inactive', 'draft', 'discontinued'];
          if (!validStatuses.includes(status)) {
            errors.push(`Row ${rowNumber}: Status must be one of: ${validStatuses.join(', ')}`);
            continue;
          }

          // Find or create supplier
          let supplierId = null;
          const suppliers = await storage.getSuppliers();
          const supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
          if (supplier) {
            supplierId = supplier.id;
            console.log(`✅ Found existing supplier: ${supplierName} (ID: ${supplierId})`);
          } else {
            console.log(`🔄 Creating new supplier: ${supplierName}`);
            // Create new supplier if it doesn't exist
            const newSupplier = await storage.createSupplier({
              name: supplierName,
              email: `contact@${supplierName.toLowerCase().replace(/\s+/g, '')}.com`,
              phone: '',
              address: '',
              city: '',
              state: '',
              zipCode: '',
              country: '',
              contactPerson: '',
              integrationType: 'email',
              isActive: true
            });
            supplierId = newSupplier.id;
            console.log(`✅ Created new supplier: ${supplierName} (ID: ${supplierId})`);
          }

          // Generate slug
          const slug = productName.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();

          // Create product
          const productData = {
            name: productName,
            slug: slug,
            description: description,
            price: price.toString(),
            compareAtPrice: (price * 1.2).toString(), // 20% higher than regular price
            categoryId: finalCategoryId,
            supplierId: supplierId,
            stockQuantity: stockQuantity,
            featured: false,
            images: [],
            vatValue: vatValue.toString(),
            vatPercentage: vatValue.toString(), // Use same value for backwards compatibility
            currency: currency, // Use company default currency (RON for Romanian market)
            productCode: productCode,
            ncCode: ncCode,
            cpvCode: cpvCode,
            status: status,
            weight: weight,
            length: length.toString(),
            width: width.toString(),
            height: height.toString(),
            piecesPerPackage: piecesPerPackage
          };

          console.log(`🔄 Creating product with data:`, JSON.stringify(productData, null, 2));
          const createdProduct = await storage.createProduct(productData);
          console.log(`✅ Product created successfully:`, createdProduct);
          imported++;
          existingNames.add(productName.toLowerCase()); // Add to set to prevent duplicates in same import

          console.log(`✅ Imported product: ${productName}`);
        } catch (error: any) {
          console.error(`❌ Error processing row ${rowNumber}:`, error);
          console.error('Error details:', error.stack);
          errors.push(`Row ${rowNumber}: ${error.message}`);
        }
      }

      // Refresh memory cache
      await loadAllDataIntoMemory();

      console.log('📊 Import Summary:', {
        total: jsonData.length,
        imported: imported,
        errors: errors.length,
        duplicates: duplicates.length,
        errorDetails: errors,
        duplicateDetails: duplicates
      });

      res.json({
        success: true,
        message: `Import completed: ${imported} products imported`,
        total: jsonData.length,
        imported: imported,
        errors: errors,
        duplicates: duplicates
      });

    } catch (error: any) {
      console.error("Excel import error:", error);
      res.status(500).json({ 
        message: "Failed to import Excel file", 
        error: error.message 
      });
    }
  });

  // Smartbill Integration Routes
  app.get("/admin/api/smartbill/test", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      
      const isConnected = await invoiceService.testConnection();
      
      res.json({
        success: isConnected,
        message: isConnected ? "Smartbill connection successful" : "Smartbill connection failed",
        enabled: process.env.ENABLE_SMARTBILL === 'true',
        series: process.env.SMARTBILL_SERIES || 'FACT'
      });
    } catch (error) {
      console.error("Smartbill test error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to test Smartbill connection",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/admin/api/smartbill/sync-products", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { SmartbillAPI } = await import('./smartbill-api.js');
      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      
      if (process.env.ENABLE_SMARTBILL !== 'true') {
        return res.status(400).json({ 
          success: false, 
          message: "Smartbill integration is not enabled" 
        });
      }

      // Get all products from local database
      const products = await storage.getProducts();
      
      // Initialize Smartbill API
      const smartbillConfig = {
        username: process.env.SMARTBILL_USERNAME || '',
        token: process.env.SMARTBILL_TOKEN || '',
        companyVat: process.env.SMARTBILL_COMPANY_VAT || ''
      };
      
      const smartbillApi = new SmartbillAPI(smartbillConfig);
      
      // Sync products to Smartbill
      const syncResults = await smartbillApi.syncProductsToSmartbill(
        smartbillConfig.companyVat,
        products
      );
      
      res.json({
        success: true,
        message: `Product sync completed: ${syncResults.success} successful, ${syncResults.failed} failed`,
        data: syncResults
      });
      
    } catch (error) {
      console.error("Product sync error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to sync products to Smartbill",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/admin/api/smartbill/sync-stock", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { SmartbillAPI } = await import('./smartbill-api.js');
      
      if (process.env.ENABLE_SMARTBILL !== 'true') {
        return res.status(400).json({ 
          success: false, 
          message: "Smartbill integration is not enabled" 
        });
      }

      // Get all products to create product code mapping
      const products = await storage.getProducts();
      const productMappings = new Map<string, number>();
      
      for (const product of products) {
        const productCode = product.productCode || product.id.toString();
        productMappings.set(productCode, product.id);
      }
      
      // Initialize Smartbill API
      const smartbillConfig = {
        username: process.env.SMARTBILL_USERNAME || '',
        token: process.env.SMARTBILL_TOKEN || '',
        companyVat: process.env.SMARTBILL_COMPANY_VAT || ''
      };
      
      const smartbillApi = new SmartbillAPI(smartbillConfig);
      
      // Sync stock from Smartbill
      const syncResults = await smartbillApi.syncStockFromSmartbill(
        smartbillConfig.companyVat,
        productMappings
      );
      
      // Update local database with stock changes
      for (const stockUpdate of syncResults.stockUpdates) {
        try {
          await storage.updateProductStock(stockUpdate.productId, stockUpdate.newStock);
          console.log(`Updated local stock for product ${stockUpdate.productId}: ${stockUpdate.newStock}`);
        } catch (error) {
          console.error(`Failed to update local stock for product ${stockUpdate.productId}:`, error);
        }
      }
      
      // Refresh memory cache
      await loadAllDataIntoMemory();
      
      res.json({
        success: true,
        message: `Stock sync completed: ${syncResults.success} successful, ${syncResults.failed} failed`,
        data: syncResults
      });
      
    } catch (error) {
      console.error("Stock sync error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to sync stock from Smartbill",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/admin/api/smartbill/create-invoice/:orderId", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.orderId);
      
      if (isNaN(orderId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid order ID" 
        });
      }

      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ 
          success: false, 
          message: "Order not found" 
        });
      }

      // Create invoice via Smartbill
      const invoice = await invoiceService.generateInvoiceAfterPayment(orderId, {
        status: 'completed',
        paymentMethod: 'manual_admin'
      });
      
      res.json({
        success: true,
        message: "Invoice created successfully via Smartbill",
        data: invoice
      });
      
    } catch (error) {
      console.error("Manual invoice creation error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to create invoice via Smartbill",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/admin/api/smartbill/invoice/:invoiceId/pdf", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      
      if (isNaN(invoiceId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid invoice ID" 
        });
      }

      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      
      // Get PDF from Smartbill
      const pdfBuffer = await invoiceService.getInvoicePdf(invoiceId);
      
      if (!pdfBuffer) {
        return res.status(404).json({ 
          success: false, 
          message: "Invoice PDF not available" 
        });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error("PDF download error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to download invoice PDF",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/admin/api/smartbill/invoice/:invoiceId/send-email", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      const { email } = req.body;
      
      if (isNaN(invoiceId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid invoice ID" 
        });
      }

      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      
      // Send invoice via email through Smartbill
      const sent = await invoiceService.sendInvoiceByEmail(invoiceId, email);
      
      res.json({
        success: sent,
        message: sent ? "Invoice sent successfully" : "Failed to send invoice"
      });
      
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send invoice via email",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/admin/api/smartbill/products", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { SmartbillAPI } = await import('./smartbill-api.js');
      
      if (process.env.ENABLE_SMARTBILL !== 'true') {
        return res.status(400).json({ 
          success: false, 
          message: "Smartbill integration is not enabled" 
        });
      }

      const smartbillConfig = {
        username: process.env.SMARTBILL_USERNAME || '',
        token: process.env.SMARTBILL_TOKEN || '',
        companyVat: process.env.SMARTBILL_COMPANY_VAT || ''
      };
      
      const smartbillApi = new SmartbillAPI(smartbillConfig);
      const products = await smartbillApi.getProducts(smartbillConfig.companyVat);
      
      res.json({
        success: true,
        data: products
      });
      
    } catch (error) {
      console.error("Get Smartbill products error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get products from Smartbill",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/admin/api/smartbill/stock", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { SmartbillAPI } = await import('./smartbill-api.js');
      const { productCode } = req.query;
      
      if (process.env.ENABLE_SMARTBILL !== 'true') {
        return res.status(400).json({ 
          success: false, 
          message: "Smartbill integration is not enabled" 
        });
      }

      const smartbillConfig = {
        username: process.env.SMARTBILL_USERNAME || '',
        token: process.env.SMARTBILL_TOKEN || '',
        companyVat: process.env.SMARTBILL_COMPANY_VAT || ''
      };
      
      const smartbillApi = new SmartbillAPI(smartbillConfig);
      const stock = await smartbillApi.getProductStock(
        smartbillConfig.companyVat,
        productCode as string
      );
      
      res.json({
        success: true,
        data: stock
      });
      
    } catch (error) {
      console.error("Get Smartbill stock error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get stock from Smartbill",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Company/Shipping Settings Routes
  app.get("/admin/api/settings", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching company settings:", error);
      res.status(500).json({ message: "Failed to fetch company settings" });
    }
  });

  app.put("/admin/api/settings", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const settings = req.body;
      const updatedSettings = await storage.updateCompanySettings(settings);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating company settings:", error);
      res.status(500).json({ message: "Failed to update company settings" });
    }
  });

  // Shipping/Parcel Company Settings Routes
  app.get("/admin/api/shipping-settings", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const settings = await storage.getShippingSettings();
      res.json(settings || {
        companyName: 'Sameday Courier',
        pickupPointCode: '447249',
        username: '',
        password: '',
        apiBaseUrl: 'https://api.sameday.ro',
        isActive: true,
        serviceId: 7,
        defaultPackageType: 'PARCEL',
        defaultPaymentMethod: 'SENDER'
      });
    } catch (error) {
      console.error("Error fetching shipping settings:", error);
      res.status(500).json({ message: "Failed to fetch shipping settings" });
    }
  });

  app.put("/admin/api/shipping-settings", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const settings = req.body;
      const updatedSettings = await storage.updateShippingSettings(settings);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating shipping settings:", error);
      res.status(500).json({ message: "Failed to update shipping settings" });
    }
  });

  // Voucher Routes
  app.get("/admin/api/vouchers", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      let market = req.query.market as string | undefined;
      const vchAllowed = req.adminMarkets || [];
      const vchIsSuperAdmin = vchAllowed.length === 0;
      if (market && market !== 'all' && !canAccessMarket(req as AdminAuthRequest, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      if (!vchIsSuperAdmin && (!market || market === 'all')) {
        market = vchAllowed[0];
      }
      const vouchers = await storage.getVouchers(market);
      res.json(vouchers);
    } catch (error) {
      console.error("Error fetching vouchers:", error);
      res.status(500).json({ message: "Failed to fetch vouchers" });
    }
  });

  app.get("/admin/api/vouchers/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const voucher = await storage.getVoucher(id);
      if (!voucher) {
        return res.status(404).json({ message: "Voucher not found" });
      }

      // Record-level market ownership check
      if (!canAccessMarket(req as AdminAuthRequest, voucher.marketCode || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      res.json(voucher);
    } catch (error) {
      console.error("Error fetching voucher:", error);
      res.status(500).json({ message: "Failed to fetch voucher" });
    }
  });

  app.post("/admin/api/vouchers", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const voucherData = { ...req.body };
      // Convert date strings to Date objects for database
      if (voucherData.validFrom) {
        voucherData.validFrom = new Date(voucherData.validFrom);
      }
      if (voucherData.validUntil) {
        voucherData.validUntil = new Date(voucherData.validUntil);
      }
      // Default market to 'ro' if not provided
      if (!voucherData.marketCode) voucherData.marketCode = 'ro';
      if (!canAccessMarket(req as AdminAuthRequest, voucherData.marketCode)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const voucher = await storage.createVoucher(voucherData);
      res.status(201).json(voucher);
    } catch (error) {
      console.error("Error creating voucher:", error);
      res.status(500).json({ message: "Failed to create voucher" });
    }
  });

  app.put("/admin/api/vouchers/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const voucherData = { ...req.body };
      // Convert date strings to Date objects for database
      if (voucherData.validFrom) {
        voucherData.validFrom = new Date(voucherData.validFrom);
      }
      if (voucherData.validUntil) {
        voucherData.validUntil = new Date(voucherData.validUntil);
      }

      // Record-level market ownership check
      const existingVch = await storage.getVoucher(id);
      if (!existingVch) return res.status(404).json({ message: "Voucher not found" });
      if (!canAccessMarket(req as AdminAuthRequest, existingVch.marketCode || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      if (voucherData.marketCode && !canAccessMarket(req as AdminAuthRequest, voucherData.marketCode)) {
        return res.status(403).json({ message: "Access denied for target market" });
      }

      const voucher = await storage.updateVoucher(id, voucherData);
      res.json(voucher);
    } catch (error) {
      console.error("Error updating voucher:", error);
      res.status(500).json({ message: "Failed to update voucher" });
    }
  });

  app.delete("/admin/api/vouchers/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Record-level market ownership check
      const vchToDelete = await storage.getVoucher(id);
      if (!vchToDelete) return res.status(404).json({ message: "Voucher not found" });
      if (!canAccessMarket(req as AdminAuthRequest, vchToDelete.marketCode || 'ro')) {
        return res.status(403).json({ message: "Access denied for this market" });
      }

      await storage.deleteVoucher(id);
      res.json({ message: "Voucher deleted successfully" });
    } catch (error) {
      console.error("Error deleting voucher:", error);
      res.status(500).json({ message: "Failed to delete voucher" });
    }
  });

  // ─── Blog Admin Routes ────────────────────────────────────────────────────
  app.get("/admin/api/blog/posts", authenticateAdmin, async (_req: AdminAuthRequest, res: Response) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.patch("/admin/api/blog/posts/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const updated = await storage.updateBlogPost(parseInt(req.params.id), req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update blog post" });
    }
  });

  app.delete("/admin/api/blog/posts/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      await storage.deleteBlogPost(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete blog post" });
    }
  });

  app.post("/admin/api/blog/generate", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    // Extend socket timeout to 110s for Claude AI generation (~40-60s)
    req.socket.setTimeout(110000);
    res.setTimeout(110000);
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ success: false, message: "ANTHROPIC_API_KEY nu este configurat" });
      }
      const { generateBlogPostManually } = await import("./ai-blog-generator");
      const { title, category, language } = req.body;
      const validLanguage: "ro" | "en" | "fr" = (language === "fr" || language === "en") ? language : "ro";
      const langMarket = validLanguage === "fr" ? "fr" : validLanguage === "en" ? "com" : "ro";
      if (!canAccessMarket(req, langMarket)) {
        return res.status(403).json({ success: false, message: "Nu ai acces la piața selectată" });
      }
      const postId = await generateBlogPostManually(title, category, validLanguage);
      res.json({ success: true, message: "Articol generat cu succes", postId });
    } catch (error) {
      console.error("Generate blog post error:", error);
      res.status(500).json({ success: false, message: "Eroare: " + (error as Error).message });
    }
  });

  app.post("/admin/api/blog/generate-weekly", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    req.socket.setTimeout(110000);
    res.setTimeout(110000);
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ success: false, message: "ANTHROPIC_API_KEY nu este configurat" });
      }
      const { generateWeeklyBlogPost } = await import("./ai-blog-generator");
      const { market } = req.body;
      const validMarket: "ro" | "fr" | "com" = (market === "fr" || market === "com") ? market : "ro";
      if (!canAccessMarket(req, validMarket)) {
        return res.status(403).json({ success: false, message: "Nu ai acces la piața selectată" });
      }
      const postId = await generateWeeklyBlogPost(validMarket);
      res.json({ success: true, message: "Articol săptămânal generat", postId });
    } catch (error) {
      res.status(500).json({ success: false, message: "Eroare: " + (error as Error).message });
    }
  });

  app.get("/admin/api/blog/schedule", authenticateAdmin, (_req: AdminAuthRequest, res: Response) => {
    try {
      const config = readScheduleConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to read schedule config" });
    }
  });

  app.post("/admin/api/blog/schedule", authenticateAdmin, (req: AdminAuthRequest, res: Response) => {
    try {
      const { enabled, intervalDays, hour } = req.body;
      const config = {
        enabled: Boolean(enabled),
        intervalDays: Math.max(1, Math.min(30, parseInt(intervalDays) || 7)),
        hour: Math.max(0, Math.min(23, parseInt(hour) || 8)),
      };
      restartBlogScheduler(config);
      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ message: "Failed to update schedule config" });
    }
  });

  // ─── Market Settings CRUD ─────────────────────────────────────────────────

  // GET /admin/api/markets/settings — list all market settings (primary path)
  app.get("/admin/api/markets/settings", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const markets = await storage.getMarketSettings();
      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;
      const filtered = isSuperAdmin ? markets : markets.filter(m => allowedMarkets.includes(m.market));
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market settings" });
    }
  });

  // POST /admin/api/markets/settings — create/upsert a market (body must include `market` key)
  app.post("/admin/api/markets/settings", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { market, ...rest } = req.body;
      if (!market) return res.status(400).json({ message: "market field required" });
      if (!canAccessMarket(req, market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const ms = await storage.upsertMarketSettings(market, rest);
      refreshMarketCaches().catch(console.error);
      res.json(ms);
    } catch (error) {
      res.status(500).json({ message: "Failed to create market settings" });
    }
  });

  // PUT /admin/api/markets/settings/:market — upsert specific market
  app.put("/admin/api/markets/settings/:market", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!canAccessMarket(req, req.params.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const ms = await storage.upsertMarketSettings(req.params.market, req.body);
      refreshMarketCaches().catch(console.error);
      res.json(ms);
    } catch (error) {
      res.status(500).json({ message: "Failed to update market settings" });
    }
  });

  // GET /admin/api/markets — alias: list all market settings
  app.get("/admin/api/markets", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const markets = await storage.getMarketSettings();
      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;
      const filtered = isSuperAdmin ? markets : markets.filter((m: any) => allowedMarkets.includes(m.market));
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market settings" });
    }
  });

  // GET /admin/api/markets/:market — get one market
  app.get("/admin/api/markets/:market", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!canAccessMarket(req, req.params.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const ms = await storage.getMarketSetting(req.params.market);
      if (!ms) return res.status(404).json({ message: "Market not found" });
      res.json(ms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market" });
    }
  });

  // PUT /admin/api/markets/:market — upsert market settings
  app.put("/admin/api/markets/:market", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!canAccessMarket(req, req.params.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      const ms = await storage.upsertMarketSettings(req.params.market, req.body);
      refreshMarketCaches().catch(console.error);
      res.json(ms);
    } catch (error) {
      res.status(500).json({ message: "Failed to update market settings" });
    }
  });

  // DELETE /admin/api/markets/:market — delete a market
  app.delete("/admin/api/markets/:market", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      if (!canAccessMarket(req, req.params.market)) {
        return res.status(403).json({ message: "Access denied for this market" });
      }
      await storage.deleteMarketSettings(req.params.market);
      refreshMarketCaches().catch(console.error);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete market" });
    }
  });

  // ─── Product Markets CRUD ─────────────────────────────────────────────────

  // POST /admin/api/products/markets/bulk — assign multiple products to markets at once
  // body: [{ productId, market, isActive, price, compareAtPrice, currency, inStock, stockQuantity }]
  app.post("/admin/api/products/markets/bulk", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const entries = req.body;
      if (!Array.isArray(entries)) return res.status(400).json({ message: "Array of entries required" });
      const results = [];
      for (const entry of entries) {
        if (!entry.productId || !entry.market) continue;
        const pm = await storage.setProductMarket({
          productId: entry.productId,
          market: entry.market,
          isActive: entry.isActive ?? true,
          price: entry.price ?? null,
          compareAtPrice: entry.compareAtPrice ?? null,
          currency: entry.currency ?? null,
          inStock: entry.inStock ?? null,
          stockQuantity: entry.stockQuantity ?? null,
        });
        results.push(pm);
      }
      refreshMarketCaches().catch(console.error);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to bulk-assign product markets" });
    }
  });

  // GET /admin/api/products/:id/markets — get all market rows for a product
  app.get("/admin/api/products/:id/markets", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const pms = await storage.getProductMarkets(productId);
      res.json(pms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product markets" });
    }
  });

  // PUT /admin/api/products/:id/markets — replace ALL market rows for a product
  // body: [{ market, isActive, price, compareAtPrice, currency, inStock, stockQuantity }]
  // Markets NOT included in the body are deleted (true replace semantics)
  app.put("/admin/api/products/:id/markets", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const markets = req.body;
      if (!Array.isArray(markets)) return res.status(400).json({ message: "Array of market entries required" });
      // Delete existing market rows not present in the new list
      const existingRows = await storage.getProductMarkets(productId);
      const incomingMarkets = new Set(markets.map((m: any) => m.market));
      for (const row of existingRows) {
        if (!incomingMarkets.has(row.market)) {
          await storage.deleteProductMarket(productId, row.market);
        }
      }
      // Upsert all provided rows
      const results = [];
      for (const m of markets) {
        const pm = await storage.setProductMarket({
          productId,
          market: m.market,
          isActive: m.isActive ?? true,
          price: m.price ?? null,
          compareAtPrice: m.compareAtPrice ?? null,
          currency: m.currency ?? null,
          inStock: m.inStock ?? null,
          stockQuantity: m.stockQuantity ?? null,
        });
        results.push(pm);
      }
      refreshMarketCaches().catch(console.error);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product markets" });
    }
  });

  // PUT /admin/api/products/:id/markets/:market — upsert one product market entry
  app.put("/admin/api/products/:id/markets/:market", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const market = req.params.market;
      const { isActive, price, compareAtPrice, currency, inStock, stockQuantity } = req.body;
      const pm = await storage.setProductMarket({
        productId,
        market,
        isActive: isActive ?? true,
        price: price ?? null,
        compareAtPrice: compareAtPrice ?? null,
        currency: currency ?? null,
        inStock: inStock ?? null,
        stockQuantity: stockQuantity ?? null,
      });
      refreshMarketCaches().catch(console.error);
      res.json(pm);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product market" });
    }
  });

  // DELETE /admin/api/products/:id/markets/:market — remove product from a market
  app.delete("/admin/api/products/:id/markets/:market", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      await storage.deleteProductMarket(parseInt(req.params.id), req.params.market);
      refreshMarketCaches().catch(console.error);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove product from market" });
    }
  });

  // POST /admin/api/products/:id/markets/bulk — set all markets for one product at once
  // body: { markets: [{ market, isActive, price, compareAtPrice, currency, inStock, stockQuantity }] }
  app.post("/admin/api/products/:id/markets/bulk", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const { markets } = req.body;
      if (!Array.isArray(markets)) return res.status(400).json({ message: "markets array required" });
      const results = [];
      for (const m of markets) {
        const pm = await storage.setProductMarket({
          productId,
          market: m.market,
          isActive: m.isActive ?? true,
          price: m.price ?? null,
          compareAtPrice: m.compareAtPrice ?? null,
          currency: m.currency ?? null,
          inStock: m.inStock ?? null,
          stockQuantity: m.stockQuantity ?? null,
        });
        results.push(pm);
      }
      refreshMarketCaches().catch(console.error);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to bulk-update product markets" });
    }
  });

  // ==================== Invoice Admin Routes ====================

  // GET /admin/api/invoices - list all invoices with optional market filter
  app.get("/admin/api/invoices", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { pool } = await import('./db.js');
      let market = req.query.market as string | undefined;
      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;

      if (market && market !== 'all' && !isSuperAdmin && !allowedMarkets.includes(market)) {
        return res.status(403).json({ message: 'Access denied for this market' });
      }

      let query = `
        SELECT 
          i.id, i.invoice_number as "invoiceNumber", i.order_id as "orderId", i.user_id as "userId",
          i.issue_date as "issueDate", i.status, i.total_amount as "totalAmount", i.currency,
          i.market, i.pdf_path as "pdfPath", i.efactura_status as "efacturaStatus",
          i.efactura_ref as "efacturaRef", i.external_ref as "externalRef",
          i.smartbill_series as "smartbillSeries", i.smartbill_number as "smartbillNumber",
          i.smartbill_url as "smartbillUrl",
          i.payment_method as "paymentMethod", i.created_at as "createdAt",
          u.first_name as "userFirstName", u.last_name as "userLastName", u.email as "userEmail"
        FROM invoices i
        LEFT JOIN users u ON u.id = i.user_id
      `;
      const params: any[] = [];

      if (!isSuperAdmin && allowedMarkets.length > 0) {
        if (market && market !== 'all') {
          // Specific market requested — already validated above
          query += ` WHERE i.market = $${params.length + 1}`;
          params.push(market);
        } else {
          // Show all markets the admin has access to
          query += ` WHERE i.market = ANY($${params.length + 1})`;
          params.push(allowedMarkets);
        }
      } else if (market && market !== 'all') {
        query += ` WHERE i.market = $${params.length + 1}`;
        params.push(market);
      }

      query += ' ORDER BY i.created_at DESC LIMIT 500';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin invoices:', error);
      res.status(500).json({ message: 'Failed to fetch invoices' });
    }
  });

  // GET /admin/api/invoices/:id - get single invoice details (enriched)
  app.get("/admin/api/invoices/:id", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getInvoice(id);
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

      // Market-scope access control
      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;
      const invoiceMarket = (invoice as any).market || 'ro';
      if (!isSuperAdmin && !allowedMarkets.includes(invoiceMarket)) {
        return res.status(403).json({ message: 'Access denied for this invoice market' });
      }

      // Enrich with order items and user info
      const enriched: any = { ...invoice };

      if ((invoice as any).orderId) {
        try {
          const order = await storage.getOrder((invoice as any).orderId);
          if (order) {
            enriched.items = (order.items as any[]) || [];
            enriched.subtotal = order.subtotalAmount ?? order.totalAmount;
            enriched.taxAmount = (order as any).taxAmount ?? null;
            enriched.paymentMethod = order.paymentMethod;
            enriched.paymentStatus = order.paymentStatus;
            const shippingAddr = order.shippingAddress as any;
            const billingAddr = order.billingAddress as any;
            enriched.buyerName = billingAddr?.companyName ||
              `${shippingAddr?.firstName || ''} ${shippingAddr?.lastName || ''}`.trim() ||
              `${billingAddr?.firstName || ''} ${billingAddr?.lastName || ''}`.trim();
            enriched.buyerEmail = shippingAddr?.email || billingAddr?.email || '';
            enriched.buyerAddress = [shippingAddr?.address, shippingAddr?.city, shippingAddr?.country].filter(Boolean).join(', ');
            enriched.buyerVatCode = billingAddr?.vatNumber || billingAddr?.cui || null;
          }
        } catch { /* ignore enrichment errors */ }
      }

      if ((invoice as any).userId && !enriched.buyerEmail) {
        try {
          const user = await storage.getUser((invoice as any).userId);
          if (user) {
            enriched.userFirstName = user.firstName;
            enriched.userLastName = user.lastName;
            enriched.userEmail = user.email;
          }
        } catch { /* ignore */ }
      }

      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch invoice' });
    }
  });

  // GET /admin/api/invoices/:id/pdf - download invoice PDF
  app.get("/admin/api/invoices/:id/pdf", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getInvoice(id);
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

      // Market-scope access control
      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;
      const invoiceMarket = (invoice as any).market || 'ro';
      if (!isSuperAdmin && !allowedMarkets.includes(invoiceMarket)) {
        return res.status(403).json({ message: 'Access denied for this invoice market' });
      }

      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      const pdfBuffer = await invoiceService.getInvoicePdf(id);

      if (!pdfBuffer) {
        return res.status(404).json({ message: 'PDF not available for this invoice' });
      }

      const filename = `factura_${(invoice as any).invoiceNumber?.replace(/[^a-zA-Z0-9]/g, '_') || id}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error downloading invoice PDF:', error);
      res.status(500).json({ message: 'Failed to download PDF' });
    }
  });

  // GET /admin/api/invoice-counters - list all market counters (superadmin only)
  app.get("/admin/api/invoice-counters", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { getAllInvoiceCounters } = await import('./invoice-counter.js');
      const allCounters = await getAllInvoiceCounters();

      // Non-superadmins see only counters for their allowed markets
      const allowedMarkets = req.adminMarkets || [];
      const isSuperAdmin = allowedMarkets.length === 0;
      const counters = isSuperAdmin ? allCounters : allCounters.filter(c => allowedMarkets.includes(c.market));
      res.json(counters);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch invoice counters' });
    }
  });

  // PUT /admin/api/invoice-settings/:market - update ONLY invoice_series and invoice_number_format
  // Safe: never touches company name/email/address — no cross-market data overwrite risk
  app.put("/admin/api/invoice-settings/:market", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const market = req.params.market;
      if (!['ro', 'fr', 'com'].includes(market)) {
        return res.status(400).json({ message: 'Invalid market' });
      }
      if (!canAccessMarket(req as AdminAuthRequest, market)) {
        return res.status(403).json({ message: 'Access denied for this market' });
      }
      const { invoiceSeries, invoiceNumberFormat } = req.body;
      if (!invoiceSeries && !invoiceNumberFormat) {
        return res.status(400).json({ message: 'At least one of invoiceSeries or invoiceNumberFormat is required' });
      }
      // Only touch invoice fields — never name/email/address
      await pool.query(`
        UPDATE company_settings
        SET invoice_series = COALESCE($1, invoice_series),
            invoice_number_format = COALESCE($2, invoice_number_format),
            updated_at = CURRENT_TIMESTAMP
        WHERE market_code = $3
      `, [invoiceSeries || null, invoiceNumberFormat || null, market]);
      const result = await pool.query(
        `SELECT id, market_code, invoice_series, invoice_number_format, invoice_current_number FROM company_settings WHERE market_code = $1 LIMIT 1`,
        [market]
      );
      res.json(result.rows[0] || { market_code: market, invoiceSeries, invoiceNumberFormat });
    } catch (error) {
      console.error('Failed to update invoice settings:', error);
      res.status(500).json({ message: 'Failed to update invoice settings' });
    }
  });

  // PUT /admin/api/invoice-counters/:market - update series or current number (superadmin only)
  app.put("/admin/api/invoice-counters/:market", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const market = req.params.market;

      // Only superadmin may reset counters
      if (!req.isSuperAdmin) {
        return res.status(403).json({ message: 'Only superadmins can modify invoice counters' });
      }

      const { series, currentNumber } = req.body;
      const { setInvoiceSeries, setInvoiceCurrentNumber, getAllInvoiceCounters } = await import('./invoice-counter.js');
      if (series) await setInvoiceSeries(market, series);
      if (currentNumber !== undefined) await setInvoiceCurrentNumber(market, parseInt(currentNumber));
      const counters = await getAllInvoiceCounters();
      res.json(counters.find(c => c.market === market) || {});
    } catch (error) {
      res.status(500).json({ message: 'Failed to update invoice counter' });
    }
  });

  // POST /admin/api/invoices/:id/submit-efactura — stub: submit .ro invoice to ANAF e-Factura
  app.post("/admin/api/invoices/:id/submit-efactura", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getInvoice(id);
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
      const invoiceMarket = (invoice as any).market || 'ro';
      // Market-scope check
      if (!req.isSuperAdmin && !(req.adminMarkets || []).includes(invoiceMarket)) {
        return res.status(403).json({ message: 'Access denied for this invoice market' });
      }
      const { createInvoiceService } = await import('./invoice-service.js');
      const svc = await createInvoiceService();
      const result = await svc.submitToEfactura(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Failed to submit to e-Factura' });
    }
  });

  // POST /admin/api/invoices/:id/submit-external — stub: submit .com invoice to external API
  app.post("/admin/api/invoices/:id/submit-external", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getInvoice(id);
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
      const invoiceMarket = (invoice as any).market || 'ro';
      if (!req.isSuperAdmin && !(req.adminMarkets || []).includes(invoiceMarket)) {
        return res.status(403).json({ message: 'Access denied for this invoice market' });
      }
      const { createInvoiceService } = await import('./invoice-service.js');
      const svc = await createInvoiceService();
      const result = await svc.submitToExternalApi(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Failed to submit to external API' });
    }
  });

  // POST /admin/api/invoices/manual — create a manual invoice or pro-forma from admin
  app.post("/admin/api/invoices/manual", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const { type, market, currency, buyer, items, subtotal, vatAmount, totalAmount, dueDate, paymentMethod, notes } = req.body;
      if (!market || !['ro','fr','com'].includes(market)) return res.status(400).json({ message: 'Invalid market' });
      if (!buyer?.name || !buyer?.email) return res.status(400).json({ message: 'Buyer name and email are required' });
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one line item is required' });
      if (!canAccessMarket(req as AdminAuthRequest, market)) return res.status(403).json({ message: 'Access denied for this market' });

      // Compute totals server-side for accuracy
      const computedSubtotal = items.reduce((s: number, it: any) => s + (parseFloat(it.quantity) * parseFloat(it.unitPrice)), 0);
      const computedVat = items.reduce((s: number, it: any) => s + (parseFloat(it.quantity) * parseFloat(it.unitPrice) * (parseFloat(it.vatRate || 0) / 100)), 0);
      const computedTotal = computedSubtotal + computedVat;

      // Get seller info from company_settings for this market
      const csResult = await pool.query(
        `SELECT name, address, city, zip_code, country, vat_number, registration_number, email, phone, iban, bank_name
         FROM company_settings WHERE market_code = $1 LIMIT 1`,
        [market]
      );
      const cs = csResult.rows[0] || {};

      // Generate invoice number
      let invoiceNumber: string;
      let invoiceSeries: string | undefined;
      const isProforma = type === 'proforma';

      if (isProforma) {
        const yr = new Date().getFullYear();
        const rand = Math.floor(Math.random() * 9000) + 1000;
        invoiceNumber = `PRO-${market.toUpperCase()}-${yr}-${rand}`;
      } else {
        const { getNextInvoiceNumber } = await import('./invoice-counter.js');
        const counter = await getNextInvoiceNumber(market);
        invoiceNumber = counter.formatted;
        invoiceSeries = counter.series;
      }

      // Generate PDF
      const { generateInvoicePdf } = await import('./pdf-invoice-local.js');
      const pdfData = {
        invoiceNumber,
        documentType: isProforma ? 'DEVIS / PRO-FORMA' : 'FACTURE / INVOICE',
        issueDate: new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        market,
        currency: currency || (market === 'ro' ? 'RON' : 'EUR'),
        seller: {
          name: cs.name || 'xHACCP',
          address: cs.address,
          city: cs.city,
          zipCode: cs.zip_code,
          country: cs.country,
          vatNumber: cs.vat_number,
          registrationNumber: cs.registration_number,
          email: cs.email,
          phone: cs.phone,
          iban: cs.iban,
          bankName: cs.bank_name,
        },
        buyer: {
          name: buyer.name,
          companyName: buyer.companyName,
          address: buyer.address,
          city: buyer.city,
          zipCode: buyer.zipCode,
          country: buyer.country,
          vatNumber: buyer.vatNumber,
          email: buyer.email,
        },
        items: items.map((it: any) => ({
          productName: it.productName,
          productCode: it.productCode,
          quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice),
          vatRate: parseFloat(it.vatRate || 0),
          lineTotal: parseFloat(it.quantity) * parseFloat(it.unitPrice),
        })),
        subtotal: computedSubtotal,
        vatAmount: computedVat,
        totalAmount: computedTotal,
        notes,
        paymentMethod,
      };

      const pdfPath = await generateInvoicePdf(pdfData);

      // Save to DB
      const invoice = await storage.createInvoice({
        invoiceNumber,
        market,
        currency: pdfData.currency,
        status: isProforma ? 'pending' : 'issued',
        subtotal: computedSubtotal.toFixed(2) as any,
        vatAmount: computedVat.toFixed(2) as any,
        totalAmount: computedTotal.toFixed(2) as any,
        pdfPath,
        notes: notes || null,
        paymentMethod: paymentMethod || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        issueDate: new Date(),
      } as any, items.map((it: any) => ({
        productName: it.productName,
        productCode: it.productCode || null,
        quantity: parseInt(it.quantity),
        unitPrice: parseFloat(it.unitPrice).toFixed(2) as any,
        vatRate: parseFloat(it.vatRate || 0).toFixed(2) as any,
        lineTotal: (parseFloat(it.quantity) * parseFloat(it.unitPrice)).toFixed(2) as any,
      })));

      res.json({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, pdfPath });
    } catch (error) {
      console.error('Error creating manual invoice:', error);
      res.status(500).json({ message: 'Failed to create invoice', detail: String(error) });
    }
  });

  // POST /admin/api/invoices/:id/send-email — send invoice PDF to an email address
  app.post("/admin/api/invoices/:id/send-email", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { email, message } = req.body;
      if (!email) return res.status(400).json({ message: 'Email address is required' });

      const invoice = await storage.getInvoice(id);
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

      const invoiceMarket = (invoice as any).market || 'ro';
      if (!canAccessMarket(req as AdminAuthRequest, invoiceMarket)) {
        return res.status(403).json({ message: 'Access denied for this invoice market' });
      }

      // Get PDF buffer
      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();
      const pdfBuffer = await invoiceService.getInvoicePdf(id);
      if (!pdfBuffer) return res.status(404).json({ message: 'PDF not available for this invoice' });

      // Get seller name from company settings
      const csResult = await pool.query(
        `SELECT name FROM company_settings WHERE market_code = $1 LIMIT 1`,
        [invoiceMarket]
      );
      const sellerName = csResult.rows[0]?.name || 'xHACCP';

      const { sendManualInvoiceEmail } = await import('./email-service.js');
      const defaultMsg = `Bonjour,\n\nVeuillez trouver en pièce jointe votre document N° ${(invoice as any).invoiceNumber}.\n\nMerci pour votre confiance.\n\nCordialement,\n${sellerName}`;
      const sent = await sendManualInvoiceEmail({
        pdfBuffer,
        invoiceNumber: (invoice as any).invoiceNumber,
        toEmail: email,
        customMessage: message || defaultMsg,
        sellerName,
        market: invoiceMarket,
      });

      if (sent) {
        res.json({ success: true, message: `Email sent to ${email}` });
      } else {
        res.status(500).json({ message: 'Email delivery failed — check SendGrid configuration' });
      }
    } catch (error) {
      console.error('Error sending invoice email:', error);
      res.status(500).json({ message: 'Failed to send email', detail: String(error) });
    }
  });

  // GET /admin/api/market-products?market=ro — list product market rows for a given market
  // When ?market= is omitted, returns rows for ALL markets (ro + fr + com combined)
  app.get("/admin/api/market-products", authenticateAdmin, async (req: AdminAuthRequest, res: Response) => {
    try {
      const market = req.query.market as string | undefined;
      if (market) {
        const pms = await storage.getProductMarketsByMarket(market);
        res.json(pms);
      } else {
        const [ro, fr, com] = await Promise.all([
          storage.getProductMarketsByMarket("ro"),
          storage.getProductMarketsByMarket("fr"),
          storage.getProductMarketsByMarket("com"),
        ]);
        res.json([...ro, ...fr, ...com]);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch market products" });
    }
  });
}