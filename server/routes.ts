import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertCategorySchema, insertProductSchema, insertOrderSchema, insertCartItemSchema, insertReviewSchema, insertInvoiceSchema, insertInvoiceItemSchema, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import OpenAI from "openai";
import QRCode from "qrcode";
import path from "path";
import { createInvoiceService } from './invoice-service.js';
import { sendNotificationPreferencesEmail, sendContactFormEmails } from './email-service.js';

// Authentication interfaces
interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
  user?: {
    id: number;
    email: string;
    isAdmin?: boolean;
  };
}

// JWT authentication middleware
const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('❌ No token provided in Authorization header');
      return res.status(401).json({ message: "Access token required" });
    }

    console.log('🔍 Attempting to verify token:', token?.substring(0, 20) + '...');
    
    let decoded: any;
    let isAdminToken = false;
    
    // Try to decode as regular user token first
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any;
      console.log('✅ Token decoded as user token:', { id: decoded.id, email: decoded.email });
    } catch (err) {
      // Try to decode as admin token
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any;
        if (decoded.adminId) {
          isAdminToken = true;
          decoded.id = decoded.adminId; // Map adminId to id for consistency
          console.log('✅ Token decoded as admin token:', { adminId: decoded.adminId });
        }
      } catch (adminErr) {
        console.log('❌ Token verification failed for both user and admin:', err);
        return res.status(403).json({ message: "Invalid token" });
      }
    }
    
    // Get user to check admin status
    const user = await storage.getUser(decoded.id);
    if (!user) {
      console.log('❌ User not found for id:', decoded.id);
      return res.status(401).json({ message: "Invalid token" });
    }

    console.log('✅ User found:', { id: user.id, email: user.email, isAdmin: user.isAdmin });
    req.userId = decoded.id;
    req.isAdmin = user.isAdmin || isAdminToken;
    req.user = { id: user.id, email: user.email, isAdmin: user.isAdmin || isAdminToken };
    next();
  } catch (error: any) {
    console.log('❌ Token verification failed:', error.message);
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Ultra-aggressive permanent in-memory cache
const cache = new Map<string, any>();
const CACHE_REFRESH_INTERVAL = 300000; // 5 minutes

// Initialize OpenAI client (optional - only if API key is provided)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

if (!openai) {
  console.warn("Warning: OPENAI_API_KEY environment variable is not set. AI chat will be disabled.");
}

// Initialize Invoice Service with Smartbill enabled
process.env.ENABLE_SMARTBILL = 'true';
let invoiceService: any;

function getCachedData(key: string) {
  return cache.get(key) || null;
}

function setCachedData(key: string, data: any) {
  cache.set(key, data);
}

// Permanent data storage - never expires, pre-compiled for ultra-fast access
let categoriesData: any[] = [];
let productsByCategory = new Map<string, any[]>();
let allProductsData: any[] = [];
let productsBySlug = new Map<string, any>();
let stringifiedProductsData: string = '';
let stringifiedCategoriesData: string = '';
let dataVersion: number = Date.now();

// Load ALL data into memory at startup - never hit database again
export async function loadAllDataIntoMemory() {
  try {
    console.log('Loading all data into permanent memory...');
    
    // Update version to invalidate caches
    dataVersion = Date.now();
    
    // Load categories
    const rawCategories = await storage.getCategories();
    setCachedData('categories-all', rawCategories);
    
    // Load products for each category and add product count
    for (const category of rawCategories) {
      const products = await storage.getProducts({
        categoryId: category.id
      });
      // Filter only active products for public display (case-insensitive)
      const activeProducts = products.filter(p => p.status?.toLowerCase() === 'active');
      // Sort products by priority (1 = highest, then 2, 3, etc. Products with 0 or null come last)
      const sortedProducts = [...activeProducts].sort((a, b) => {
        const priorityA = a.priority || 999;
        const priorityB = b.priority || 999;
        return priorityA - priorityB;
      });
      productsByCategory.set(category.slug, sortedProducts);
      // Add product count to category (only active products)
      (category as any).productCount = activeProducts.length;
    }
    
    categoriesData = rawCategories;
    
    // Refresh stringified categories data (now includes productCount)
    stringifiedCategoriesData = JSON.stringify(categoriesData);
    
    // Load all products (no filter, no limit)
    const rawAllProducts = await storage.getProducts({});
    // Filter only active products for public display (case-insensitive)
    const activeProducts = rawAllProducts.filter(p => p.status?.toLowerCase() === 'active');
    // Sort all products by priority (1 = highest, then 2, 3, etc. Products with 0 or null come last)
    allProductsData = [...activeProducts].sort((a, b) => {
      const priorityA = a.priority || 999;
      const priorityB = b.priority || 999;
      return priorityA - priorityB;
    });
    
    // Pre-compile data structures for ultra-fast access
    for (const product of allProductsData) {
      productsBySlug.set(product.slug, product);
    }
    
    // Pre-stringify JSON for fastest possible responses
    stringifiedProductsData = JSON.stringify(allProductsData);
    
    console.log('✅ All data loaded into permanent memory - database queries eliminated');
    console.log(`📊 Memory data loaded: ${allProductsData.length} total products`);
    
    // Log products with priority for debugging
    const productsWithPriority = allProductsData.filter(p => p.priority && p.priority > 0);
    if (productsWithPriority.length > 0) {
      console.log(`📊 Products with priority set: ${productsWithPriority.map(p => `${p.name}(${p.priority})`).join(', ')}`);
    }
    console.log(`📊 First 5 products in memory:`, allProductsData.slice(0, 5).map(p => ({ id: p.id, name: p.name })));
    console.log(`📊 All products data variable type:`, typeof allProductsData);
    console.log(`📊 All products data is array:`, Array.isArray(allProductsData));
  } catch (error) {
    console.error('Failed to load data into memory:', error);
  }
}

// Refresh data periodically (but not too frequently to avoid product disappearing)
let isRefreshing = false;
setInterval(async () => {
  if (!isRefreshing) {
    isRefreshing = true;
    await loadAllDataIntoMemory();
    isRefreshing = false;
  }
}, CACHE_REFRESH_INTERVAL);

// Remove duplicate - using the one defined above

const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Access token required" });
  }

  const user = await storage.getUser(req.userId);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/r2/:prefix/:filename", async (req, res) => {
    try {
      const { getImageFromR2 } = await import("./r2-storage");
      const key = `${req.params.prefix}/${req.params.filename}`;
      const result = await getImageFromR2(key);
      if (!result) {
        return res.status(404).send("Not found");
      }
      res.set({
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      const stream = result.body;
      stream.pipe(res);
    } catch (e) {
      res.status(500).send("Error");
    }
  });

  // Admin interface route (original flow preserved)
  app.get("/admin", (req, res) => {
    try {
      const adminPath = path.resolve('./admin/index.html');
      console.log('Serving admin interface from:', adminPath);
      
      // Set cache headers for better performance
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });
      
      res.sendFile(adminPath);
    } catch (error) {
      console.error('Error serving admin interface:', error);
      res.status(500).send('Admin interface not available');
    }
  });

  // Fast admin interface route (instant loading - no Babel)
  app.get("/admin-fast", (req, res) => {
    try {
      const adminPath = path.resolve('./admin/admin-production.html');
      console.log('Serving fast admin interface from:', adminPath);
      
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });
      
      res.sendFile(adminPath);
    } catch (error) {
      console.error('Error serving fast admin interface:', error);
      res.status(500).send('Fast admin interface not available');
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "24h" }
      );

      res.json({
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "24h" }
      );

      res.json({
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        // Invoice details fields
        companyName: user.companyName,
        vatNumber: user.vatNumber,
        registrationNumber: user.registrationNumber,
        taxId: user.taxId,
        companyAddress: user.companyAddress,
        companyCity: user.companyCity,
        companyState: user.companyState,
        companyCounty: user.companyCounty, // Add missing county field
        companyZip: user.companyZip,
        companyCountry: user.companyCountry,
        billingEmail: user.billingEmail,
        billingPhone: user.billingPhone,
        // Delivery address
        deliveryAddress: user.deliveryAddress,
        deliveryCity: user.deliveryCity,
        deliveryState: user.deliveryState,
        deliveryCounty: user.deliveryCounty, // Add missing delivery county field
        deliveryZip: user.deliveryZip,
        deliveryCountry: user.deliveryCountry,
        deliveryInstructions: user.deliveryInstructions,
        // Notification preferences
        emailNotifications: user.emailNotifications,
        orderUpdates: user.orderUpdates,
        productRestocks: user.productRestocks,
        priceDrops: user.priceDrops,
        promotions: user.promotions,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.put("/api/auth/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      
      // Check if email is already taken by another user
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== req.userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      const updatedUser = await storage.updateUser(req.userId!, {
        firstName,
        lastName,
        email,
      });

      res.json({ 
        id: updatedUser.id, 
        email: updatedUser.email, 
        firstName: updatedUser.firstName, 
        lastName: updatedUser.lastName, 
        isAdmin: updatedUser.isAdmin,
        // Include invoice fields in profile response too
        companyName: updatedUser.companyName,
        vatNumber: updatedUser.vatNumber,
        registrationNumber: updatedUser.registrationNumber,
        taxId: updatedUser.taxId,
        companyAddress: updatedUser.companyAddress,
        companyCity: updatedUser.companyCity,
        companyState: updatedUser.companyState,
        companyCounty: updatedUser.companyCounty,
        companyZip: updatedUser.companyZip,
        companyCountry: updatedUser.companyCountry,
        billingEmail: updatedUser.billingEmail,
        billingPhone: updatedUser.billingPhone,
        deliveryAddress: updatedUser.deliveryAddress,
        deliveryCity: updatedUser.deliveryCity,
        deliveryState: updatedUser.deliveryState,
        deliveryCounty: updatedUser.deliveryCounty,
        deliveryZip: updatedUser.deliveryZip,
        deliveryCountry: updatedUser.deliveryCountry,
        deliveryInstructions: updatedUser.deliveryInstructions,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });



  // Update invoice details endpoint
  app.put("/api/auth/invoice", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const {
        companyName,
        vatNumber,
        registrationNumber,
        taxId,
        companyAddress,
        companyCity,
        companyState,
        companyCounty,
        companyZip,
        companyCountry,
        billingEmail,
        billingPhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryCounty,
        deliveryZip,
        deliveryCountry,
        deliveryInstructions,
      } = req.body;

      console.log('🔄 Updating user profile data for user:', req.userId);
      console.log('📊 Profile data received:', {
        companyName, companyAddress, companyCity, companyCounty, 
        billingEmail, billingPhone
      });

      const updatedUser = await storage.updateUser(req.userId!, {
        companyName,
        vatNumber,
        registrationNumber,
        taxId,
        companyAddress,
        companyCity,
        companyState,
        companyCounty,
        companyZip,
        companyCountry,
        billingEmail,
        billingPhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryCounty,
        deliveryZip,
        deliveryCountry,
        deliveryInstructions,
      });

      console.log('✅ User profile updated successfully:', {
        id: updatedUser.id,
        companyName: updatedUser.companyName,
        companyAddress: updatedUser.companyAddress,
        companyCity: updatedUser.companyCity
      });

      res.json({ 
        id: updatedUser.id, 
        email: updatedUser.email, 
        firstName: updatedUser.firstName, 
        lastName: updatedUser.lastName, 
        isAdmin: updatedUser.isAdmin,
        // Include all invoice/company fields
        companyName: updatedUser.companyName,
        vatNumber: updatedUser.vatNumber,
        registrationNumber: updatedUser.registrationNumber,
        taxId: updatedUser.taxId,
        companyAddress: updatedUser.companyAddress,
        companyCity: updatedUser.companyCity,
        companyState: updatedUser.companyState,
        companyCounty: updatedUser.companyCounty,
        companyZip: updatedUser.companyZip,
        companyCountry: updatedUser.companyCountry,
        billingEmail: updatedUser.billingEmail,
        billingPhone: updatedUser.billingPhone,
        deliveryAddress: updatedUser.deliveryAddress,
        deliveryCity: updatedUser.deliveryCity,
        deliveryState: updatedUser.deliveryState,
        deliveryCounty: updatedUser.deliveryCounty,
        deliveryZip: updatedUser.deliveryZip,
        deliveryCountry: updatedUser.deliveryCountry,
        deliveryInstructions: updatedUser.deliveryInstructions,
        // Include notification preferences too
        emailNotifications: updatedUser.emailNotifications,
        orderUpdates: updatedUser.orderUpdates,
        productRestocks: updatedUser.productRestocks,
        priceDrops: updatedUser.priceDrops,
        promotions: updatedUser.promotions,
      });
    } catch (error) {
      console.error("❌ Error updating invoice details:", error);
      console.error("❌ Error stack:", (error as Error).stack);
      res.status(500).json({ message: "Failed to update invoice details" });
    }
  });

  // Change password endpoint
  app.put("/api/auth/change-password", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      // Get current user
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      const updatedUser = await storage.updateUser(req.userId!, {
        password: hashedNewPassword,
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Update notification preferences endpoint
  app.put("/api/auth/notifications", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const {
        emailNotifications,
        orderUpdates,
        productRestocks,
        priceDrops,
        promotions,
      } = req.body;

      // Update user notification preferences in the database
      const [updatedUser] = await db
        .update(users)
        .set({
          emailNotifications,
          orderUpdates,
          productRestocks,
          priceDrops,
          promotions,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user!.id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Send confirmation email to test user (liviu.chertes@gmail.com)
      const preferences = {
        emailNotifications: updatedUser.emailNotifications,
        orderUpdates: updatedUser.orderUpdates,
        productRestocks: updatedUser.productRestocks,
        priceDrops: updatedUser.priceDrops,
        promotions: updatedUser.promotions,
      };

      try {
        await sendNotificationPreferencesEmail(updatedUser, {
          emailNotifications: updatedUser.emailNotifications || false,
          orderUpdates: updatedUser.orderUpdates || false,
          productRestocks: updatedUser.productRestocks || false,
          priceDrops: updatedUser.priceDrops || false,
          promotions: updatedUser.promotions || false
        });
        console.log('✅ Notification preferences email sent successfully to:', updatedUser.email);
      } catch (emailError) {
        console.error('❌ Failed to send notification preferences email:', emailError);
        // Continue with success response even if email fails
      }
      
      res.json({ 
        message: "Notification preferences updated successfully",
        preferences
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const invoices = await storage.getInvoices(userId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check if user owns this invoice or is admin
      if (invoice.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/invoices/number/:invoiceNumber", async (req, res) => {
    try {
      const invoiceNumber = req.params.invoiceNumber;
      const invoice = await storage.getInvoiceByNumber(invoiceNumber);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice by number:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Create invoice from order
  // Create invoice from order - both endpoints for compatibility
  app.post("/api/orders/:orderId/create-invoice", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const { paymentMethod = 'wire_transfer' } = req.body;
      
      // Get the order with items
      const order = await storage.getOrder(orderId);
      console.log(`Fetched order ${orderId}:`, JSON.stringify(order, null, 2));
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order or is admin
      if (order.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if order has items
      if (!order.items || order.items.length === 0) {
        console.error(`Order ${orderId} has no items:`, order.items);
        return res.status(400).json({ message: "Order has no items to create invoice" });
      }

      // Generate unique invoice number
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      // Create payment link for wire transfer
      let paymentLink = '';
      if (paymentMethod === 'wire_transfer') {
        paymentLink = `https://www.xhaccp.com/pay/invoice/${invoiceNumber}`;
      }

      // Calculate totals with 21% VAT for RON
      const subtotal = parseFloat(order.totalAmount);
      const vatRate = 21; // 21% VAT for Romanian invoices
      const vatAmount = (subtotal * vatRate) / (100 + vatRate); // Extract VAT from total
      const subtotalWithoutVat = subtotal - vatAmount;
      const totalAmount = subtotal; // Total already includes VAT

      // Create invoice
      const invoiceData = {
        invoiceNumber,
        orderId,
        userId: order.userId!,
        issueDate: new Date(),
        supplyDate: new Date(),
        subtotal: subtotalWithoutVat.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        currency: 'RON',
        paymentMethod,
        paymentLink: paymentLink || null,
        notes: 'Factura cu TVA 21% conform legislației române',
      };

      // Create invoice items
      const invoiceItems = order.items.map(item => ({
        invoiceId: 0, // Will be set after invoice creation
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.productCode || null,
        quantity: item.quantity,
        unitPrice: item.price,
        vatRate: '21.00',
        lineTotal: item.totalPrice,
      }));

      const invoice = await storage.createInvoice(invoiceData as any, invoiceItems);
      
      // Get the full invoice with items for response
      const fullInvoice = await storage.getInvoice(invoice.id);
      
      res.json(fullInvoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.post("/api/orders/:orderId/invoice", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const { paymentMethod = 'wire_transfer' } = req.body;
      
      console.log(`🧾 CREATING INVOICE for order ${orderId} using Smartbill integration`);
      console.log(`📋 Smartbill Configuration: enabled=${process.env.ENABLE_SMARTBILL === 'true'}, series=${process.env.SMARTBILL_SERIES}`);
      
      // Get the order with items
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order or is admin
      if (order.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get user details for Smartbill invoice
      const user = await storage.getUser(order.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Initialize InvoiceService with corrected Smartbill configuration
      const { createInvoiceService } = await import('./invoice-service.js');
      const invoiceService = await createInvoiceService();

      console.log(`📋 Smartbill enabled: ${process.env.ENABLE_SMARTBILL === 'true'}, Series: ${process.env.SMARTBILL_SERIES}`);

      // Create invoice using InvoiceService (will use Smartbill if enabled)
      const invoice = await invoiceService.createInvoiceForOrder(order, user, { paymentMethod });
      
      console.log(`✅ Invoice created successfully:`, {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        smartbillId: invoice.smartbillId,
        source: invoice.smartbillId ? 'Smartbill' : 'Local'
      });
      
      res.json(invoice);
    } catch (error) {
      console.error(`❌ Error creating invoice for order ${req.params.orderId}:`, error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Download invoice as PDF (placeholder for now)
  app.get("/api/invoices/:id/download", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check if user owns this invoice or is admin
      if (invoice.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // For now, return a message that PDF generation is not implemented
      // In a real application, you would generate a PDF here using a library like puppeteer
      res.status(501).json({ message: "PDF generation not yet implemented" });
    } catch (error) {
      console.error("Error downloading invoice:", error);
      res.status(500).json({ message: "Failed to download invoice" });
    }
  });

  // Category routes - instant response from memory
  app.get("/api/categories", (req, res) => {
    // No browser caching to ensure admin changes are visible immediately
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'ETag': `categories-${dataVersion}`,
      'Content-Type': 'application/json'
    });
    res.send(stringifiedCategoriesData);
  });

  app.post("/api/categories", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      await loadAllDataIntoMemory();
      res.json(category);
    } catch (error) {
      console.error("Create category error:", error);
      res.status(400).json({ message: "Invalid category data" });
    }
  });

  app.put("/api/categories/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const categoryData = req.body;
      const category = await storage.updateCategory(categoryId, categoryData);
      await loadAllDataIntoMemory();
      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(400).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      await storage.deleteCategory(categoryId);
      await loadAllDataIntoMemory();
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Product routes - ultra-fast response from memory
  app.get("/api/products", (req, res) => {
    const { categorySlug, search, limit = "20", featured } = req.query;
    
    let products: any[] = [];
    
    // Get from memory - no database queries, no async operations
    if (categorySlug) {
      products = productsByCategory.get(categorySlug as string) || [];
    } else {
      products = allProductsData;
    }
    
    // Apply featured filter if requested
    if (featured === 'true') {
      products = products.filter(product => product.featured === true);
    }
    
    // Apply search filter if needed (optimized string operations)
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      products = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply limit (optimized slice operation)
    const limitNum = parseInt(limit as string) || 20;
    if (limitNum > 0 && products.length > limitNum) {
      products = products.slice(0, limitNum);
    }
    
    // Set aggressive caching headers for performance
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'ETag': `products-${categorySlug || 'all'}-${featured || 'all'}-${limitNum}`,
      'Content-Type': 'application/json'
    });
    
    // For full product list, use pre-stringified data when possible
    if (!categorySlug && !search && !featured && limitNum >= allProductsData.length) {
      res.send(stringifiedProductsData);
    } else {
      res.json(products);
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      // Hide inactive products from public access (case-insensitive)
      if (product.status?.toLowerCase() !== 'active') {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({ message: "Failed to get product" });
    }
  });

  app.get("/api/products/slug/:slug", async (req, res) => {
    try {
      const product = await storage.getProductBySlug(req.params.slug);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      // Hide inactive products from public access (case-insensitive)
      if (product.status?.toLowerCase() !== 'active') {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Get product by slug error:", error);
      res.status(500).json({ message: "Failed to get product" });
    }
  });

  // Get product translation by language (public endpoint)
  app.get("/api/products/:id/translation/:language", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const language = req.params.language;
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const translation = await storage.getProductTranslation(productId, language);
      if (!translation) {
        return res.status(404).json({ message: "Translation not found" });
      }
      res.json(translation);
    } catch (error) {
      console.error("Get product translation error:", error);
      res.status(500).json({ message: "Failed to get product translation" });
    }
  });

  // Get all translations for multiple products by language (batch endpoint)
  app.get("/api/translations/:language", async (req, res) => {
    try {
      const language = req.params.language;
      const productIds = req.query.ids?.toString().split(',').map(Number).filter(id => !isNaN(id)) || [];
      
      if (productIds.length === 0) {
        return res.json({});
      }
      
      const translations: Record<number, { name: string; description: string | null }> = {};
      
      for (const productId of productIds) {
        const translation = await storage.getProductTranslation(productId, language);
        if (translation) {
          translations[productId] = {
            name: translation.name,
            description: translation.description
          };
        }
      }
      
      res.json(translations);
    } catch (error) {
      console.error("Get batch translations error:", error);
      res.status(500).json({ message: "Failed to get translations" });
    }
  });

  app.post("/api/products", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error) {
      console.error("Create product error:", error);
      res.status(400).json({ message: "Invalid product data" });
    }
  });

  app.put("/api/products/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const productData = req.body;
      const product = await storage.updateProduct(productId, productData);
      res.json(product);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(400).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      await storage.deleteProduct(productId);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Cart routes
  app.get("/api/cart", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const cartItems = await storage.getCartItems(req.userId!);
      res.json(cartItems);
    } catch (error) {
      console.error("Get cart error:", error);
      res.status(500).json({ message: "Failed to get cart" });
    }
  });

  app.post("/api/cart", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const cartItemData = insertCartItemSchema.parse({
        ...req.body,
        userId: req.userId,
      });
      const cartItem = await storage.addToCart(cartItemData);
      res.json(cartItem);
    } catch (error) {
      console.error("Add to cart error:", error);
      res.status(400).json({ message: "Failed to add to cart" });
    }
  });

  app.put("/api/cart/:id", authenticateToken, async (req, res) => {
    try {
      const cartItemId = parseInt(req.params.id);
      const { quantity } = req.body;
      const cartItem = await storage.updateCartItem(cartItemId, quantity);
      res.json(cartItem);
    } catch (error) {
      console.error("Update cart item error:", error);
      res.status(400).json({ message: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/:id", authenticateToken, async (req, res) => {
    try {
      const cartItemId = parseInt(req.params.id);
      await storage.removeFromCart(cartItemId);
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Remove from cart error:", error);
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });

  app.delete("/api/cart", authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.clearCart(req.userId!);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      console.error("Clear cart error:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // Voucher validation route (public for checkout)
  app.post("/api/vouchers/validate", async (req, res) => {
    try {
      const { code, orderTotal } = req.body;
      
      if (!code) {
        return res.status(400).json({ valid: false, message: "Voucher code is required" });
      }

      const voucher = await storage.getVoucherByCode(code);
      
      if (!voucher) {
        return res.status(404).json({ valid: false, message: "Voucher code not found" });
      }

      // Check if voucher is active
      if (!voucher.isActive) {
        return res.status(400).json({ valid: false, message: "This voucher is no longer active" });
      }

      // Check validity dates
      const now = new Date();
      if (voucher.validFrom && new Date(voucher.validFrom) > now) {
        return res.status(400).json({ valid: false, message: "This voucher is not yet valid" });
      }
      if (voucher.validUntil && new Date(voucher.validUntil) < now) {
        return res.status(400).json({ valid: false, message: "This voucher has expired" });
      }

      // Check max uses
      if (voucher.maxUses && voucher.usedCount !== null && voucher.usedCount >= voucher.maxUses) {
        return res.status(400).json({ valid: false, message: "This voucher has reached its usage limit" });
      }

      // Check minimum order amount
      if (voucher.minOrderAmount && orderTotal && parseFloat(orderTotal) < parseFloat(voucher.minOrderAmount)) {
        return res.status(400).json({ 
          valid: false, 
          message: `Minimum order amount for this voucher is ${voucher.minOrderAmount}` 
        });
      }

      // Calculate discount
      let discountAmount = 0;
      if (voucher.discountType === 'percentage') {
        discountAmount = orderTotal ? (parseFloat(orderTotal) * parseFloat(voucher.discountValue)) / 100 : 0;
      } else {
        discountAmount = parseFloat(voucher.discountValue);
      }

      res.json({
        valid: true,
        voucher: {
          id: voucher.id,
          code: voucher.code,
          name: voucher.name,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          discountAmount: discountAmount.toFixed(2)
        }
      });
    } catch (error) {
      console.error("Validate voucher error:", error);
      res.status(500).json({ valid: false, message: "Failed to validate voucher" });
    }
  });

  // Order routes
  app.get("/api/orders", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orders = await storage.getOrders(req.userId);
      res.json(orders);
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ message: "Failed to get orders" });
    }
  });

  app.get("/api/orders/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({ message: "Failed to get order" });
    }
  });

  app.post("/api/orders", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { shippingAddress, billingAddress, paymentMethod, items, notes, voucherCode } = req.body;
      
      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Cart items are required" });
      }
      
      // SECURITY: Look up product prices from database - NEVER trust client-provided prices or quantities
      const validatedItems = await Promise.all(items.map(async (item: any) => {
        // Validate quantity - must be positive integer
        const quantity = parseInt(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
          throw new Error(`Invalid quantity for product ${item.productId}: must be between 1 and 9999`);
        }
        
        const product = await storage.getProduct(item.productId);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        
        // Check if product is active
        if (!product.isActive) {
          throw new Error(`Product is not available: ${product.name}`);
        }
        
        return {
          productId: item.productId,
          quantity: quantity, // Use validated quantity
          price: product.price, // Use server-side price
          totalPrice: (parseFloat(product.price) * quantity).toFixed(2),
        };
      }));
      
      // Calculate subtotal from validated items (using server-side prices)
      const subtotal = validatedItems.reduce((sum: number, item: any) => sum + parseFloat(item.price) * item.quantity, 0);
      
      // Get shipping settings for threshold and cost
      const companySettings = await storage.getCompanySettings();
      const freeShippingThreshold = companySettings?.freeShippingThreshold ? parseFloat(companySettings.freeShippingThreshold) : 500;
      const standardShippingCost = companySettings?.standardShippingCost ? parseFloat(companySettings.standardShippingCost) : 25;
      
      // Calculate shipping cost
      const shippingCost = subtotal > freeShippingThreshold ? 0 : standardShippingCost;
      
      // Server-side voucher validation (do NOT trust client-provided discount amounts)
      let discountAmount = 0;
      let validatedVoucher: { id: number; code: string; discountType: string; discountValue: string } | null = null;
      
      if (voucherCode) {
        const voucher = await storage.getVoucherByCode(voucherCode);
        if (voucher && voucher.isActive) {
          const now = new Date();
          const validFrom = voucher.validFrom ? new Date(voucher.validFrom) : null;
          const validUntil = voucher.validUntil ? new Date(voucher.validUntil) : null;
          const maxUsesReached = voucher.maxUses && voucher.usedCount && voucher.usedCount >= voucher.maxUses;
          const minOrderMet = !voucher.minOrderAmount || subtotal >= parseFloat(voucher.minOrderAmount);
          
          if (!maxUsesReached && minOrderMet && 
              (!validFrom || now >= validFrom) && 
              (!validUntil || now <= validUntil)) {
            // Calculate discount based on voucher type
            if (voucher.discountType === 'percentage') {
              discountAmount = subtotal * (parseFloat(voucher.discountValue) / 100);
            } else {
              discountAmount = parseFloat(voucher.discountValue);
            }
            validatedVoucher = voucher;
          }
        }
      }
      
      // Apply voucher discount (to subtotal only, not shipping)
      const discountedSubtotal = Math.max(0, subtotal - discountAmount);
      
      // Final total = discounted subtotal + shipping (prices already include VAT)
      const totalAmount = discountedSubtotal + shippingCost;
      
      // Add voucher info to notes if applied
      let orderNotes = notes || '';
      if (validatedVoucher && discountAmount > 0) {
        orderNotes = `Voucher: ${validatedVoucher.code} (-${discountAmount.toFixed(2)})${orderNotes ? '\n' + orderNotes : ''}`;
      }
      
      const orderData = {
        userId: req.userId!,
        status: "pending",
        totalAmount: totalAmount.toFixed(2),
        shippingAddress,
        billingAddress,
        paymentMethod,
        paymentStatus: "pending",
        notes: orderNotes || undefined,
      };

      const order = await storage.createOrder(orderData, validatedItems);
      
      // Increment voucher usage AFTER order creation succeeds
      if (validatedVoucher && discountAmount > 0) {
        await storage.incrementVoucherUsage(validatedVoucher.id);
      }
      
      // Get full order with items for email notification
      const fullOrder = await storage.getOrder(order.id);
      
      // Get user details for email notification
      const user = await storage.getUser(req.userId!);
      
      if (fullOrder && user) {
        // Import and send new order notification email immediately
        const { sendNewOrderNotificationEmail } = await import('./email-service.js');
        sendNewOrderNotificationEmail(fullOrder, user).catch(error => {
          console.error('Failed to send new order notification email:', error);
        });
      }
      
      // Clear cart after successful order
      await storage.clearCart(req.userId!);
      
      res.json(order);
    } catch (error) {
      console.error("Create order error:", error);
      res.status(400).json({ message: "Failed to create order" });
    }
  });

  app.put("/api/orders/:id/status", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      const order = await storage.updateOrderStatus(orderId, status);
      res.json(order);
    } catch (error) {
      console.error("Update order status error:", error);
      res.status(400).json({ message: "Failed to update order status" });
    }
  });

  // AWB Generation routes
  app.post("/api/orders/:id/generate-awb", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      
      if (!samedayAPI) {
        return res.status(500).json({ message: "Sameday API not configured. Please add SAMEDAY_USERNAME and SAMEDAY_PASSWORD environment variables." });
      }

      // Get pickup points and services
      const [pickupPoints, services] = await Promise.all([
        samedayAPI.getPickupPoints(),
        samedayAPI.getServices()
      ]);

      if (pickupPoints.length === 0) {
        return res.status(500).json({ message: "No pickup points configured for Sameday" });
      }

      if (services.length === 0) {
        return res.status(500).json({ message: "No services configured for Sameday" });
      }

      const shippingAddr = order.shippingAddress as any;
      
      console.log('📦 Available pickup points:', pickupPoints.length);
      console.log('📦 First 3 pickup points:', pickupPoints.slice(0, 3).map(p => ({ id: p.id, name: p.name, county: p.county })));
      console.log('🚚 Available services:', services.length);
      console.log('🚚 First 3 services:', services.slice(0, 3).map(s => ({ id: s.id, name: s.name })));
      
      // Use specified pickup point code 447249
      const selectedPickupPoint = pickupPoints.find(p => p.id === 447249) || pickupPoints[0];
      const selectedService = services.find(s => s.name.toLowerCase().includes('standard')) || services[0];
      
      console.log('📦 Selected pickup point:', { id: selectedPickupPoint.id, name: selectedPickupPoint.name });
      console.log('🚚 Selected service:', { id: selectedService.id, name: selectedService.name });

      // Calculate parcels based on product logistics data and pieces per package
      const parcels = [];
      let parcelCounter = 1;

      // Group order items by product and calculate required packages
      if (order.items && order.items.length > 0) {
        console.log('📦 Processing order items for intelligent package calculation:');
        
        for (const item of order.items) {
          const product = await storage.getProduct(item.productId);
          if (!product) {
            console.log(`⚠️ Product not found for item ${item.productId}, using defaults`);
            continue;
          }

          const quantity = item.quantity;
          const piecesPerPackage = product.piecesPerPackage || 1;
          const weight = product.weight || 1;
          const length = product.length || 10;
          const width = product.width || 10;
          const height = product.height || 10;

          // Calculate number of packages needed for this product
          const packagesNeeded = Math.ceil(quantity / piecesPerPackage);
          
          console.log(`📦 Product: ${product.name}`);
          console.log(`   - Quantity ordered: ${quantity}`);
          console.log(`   - Pieces per package: ${piecesPerPackage}`);
          console.log(`   - Packages needed: ${packagesNeeded}`);
          console.log(`   - Weight per package: ${weight}kg`);
          console.log(`   - Dimensions: ${length}x${width}x${height}cm`);

          // Create parcels for this product
          for (let packageNum = 1; packageNum <= packagesNeeded; packageNum++) {
            const remainingQuantity = quantity - ((packageNum - 1) * piecesPerPackage);
            const itemsInThisPackage = Math.min(remainingQuantity, piecesPerPackage);
            const packageWeight = Math.max(1, Math.round(weight * (itemsInThisPackage / piecesPerPackage)));

            parcels.push({
              weight: packageWeight,
              length: length,
              width: width,
              height: height,
              awbParcelNumber: `KTO${order.id.toString().padStart(5, '0')}-P${parcelCounter}`,
            });

            console.log(`   📦 Package ${parcelCounter}: ${itemsInThisPackage} items, ${packageWeight}kg`);
            parcelCounter++;
          }
        }
      }

      // Fallback: if no parcels created, create one default parcel
      if (parcels.length === 0) {
        console.log('⚠️ No parcels calculated, using fallback single parcel');
        parcels.push({
          weight: 1,
          awbParcelNumber: `KTO${order.id.toString().padStart(5, '0')}-P1`,
        });
      }

      console.log(`📦 Total parcels to ship: ${parcels.length}`);
      console.log('📦 Parcel summary:', parcels.map(p => ({ number: p.awbParcelNumber, weight: `${p.weight}kg` })));

      // Get real counties and cities from Sameday API for proper ID mapping
      const [counties, cities] = await Promise.all([
        samedayAPI.getCounties(),
        samedayAPI.getCities()
      ]);

      console.log('📍 Total counties available:', counties.length);
      console.log('📍 First 3 counties:', counties.slice(0, 3).map(c => ({ id: c.id, name: c.name })));
      console.log('📍 Total cities available:', cities.length);
      console.log('📍 First 3 cities:', cities.slice(0, 3).map(c => ({ id: c.id, name: c.name })));

      // Find county and city IDs based on shipping address
      const targetCounty = (shippingAddr.county || shippingAddr.state || 'Cluj').toLowerCase();
      const targetCity = (shippingAddr.city || 'Feleacu').toLowerCase();
      
      const county = counties.find(c => 
        c.name.toLowerCase().includes(targetCounty) || targetCounty.includes(c.name.toLowerCase())
      ) || counties[0]; // Use first available county as fallback
      
      const city = cities.find(c => 
        c.name.toLowerCase().includes(targetCity) || targetCity.includes(c.name.toLowerCase())
      ) || cities[0]; // Use first available city as fallback
      
      console.log('🎯 Found county:', county ? { id: county.id, name: county.name } : 'None');
      console.log('🎯 Found city:', city ? { id: city.id, name: city.name } : 'None');

      // Use your exact working AWB format with pickup point 447249
      const awbData = {
        pickupPointId: 447249,
        serviceId: 7, // Use service ID 7 from your working example  
        packageType: "PARCEL",
        awbPayment: "SENDER",
        recipient: {
          name: `${shippingAddr.firstName} ${shippingAddr.lastName}`,
          phoneNumber: shippingAddr.phone || '+40700000000',
          personType: "individual",
          companyName: shippingAddr.companyName || `${shippingAddr.firstName} ${shippingAddr.lastName}`,
          address: shippingAddr.address,
          countyId: county?.id || 14, // Use found county ID or Cluj fallback
          cityId: city?.id || 7, // Use found city ID or fallback
        },
        parcels: parcels,
        codAmount: 0,
        insuredValue: parseFloat(order.totalAmount.toString()),
        observation: `Order #${order.id} - xHACCP E-commerce`,
        reference: `ORDER_${order.id}`,
      };

      // Create AWB with Sameday
      const awbResponse = await samedayAPI.createAWB(awbData);

      // Update order with AWB information
      const updatedOrder = await storage.updateOrder(orderId, {
        status: 'shipped',
        awbNumber: awbResponse.awbNumber,
        awbCourier: 'sameday',
        awbCost: awbResponse.cost.toString(),
        awbCurrency: awbResponse.currency,
        awbCreatedAt: new Date(),
      });

      console.log('✅ AWB generated successfully:', awbResponse.awbNumber);

      res.json({
        success: true,
        awbNumber: awbResponse.awbNumber,
        awbCost: awbResponse.cost,
        currency: awbResponse.currency,
        order: updatedOrder,
        trackingUrl: `https://sameday.ro/track/${awbResponse.awbNumber}`,
      });

    } catch (error) {
      console.error("Generate AWB error:", error);
      res.status(500).json({ 
        message: "Failed to generate AWB", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get AWB PDF
  app.get("/api/orders/:id/awb-pdf", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order || !order.awbNumber) {
        return res.status(404).json({ message: "Order or AWB not found" });
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      
      if (!samedayAPI) {
        return res.status(500).json({ message: "Sameday API not configured" });
      }

      const pdfBuffer = await samedayAPI.getAWBPDF(order.awbNumber);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="AWB_${order.awbNumber}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error("Get AWB PDF error:", error);
      res.status(500).json({ message: "Failed to get AWB PDF" });
    }
  });

  // Track AWB
  app.get("/api/orders/:id/track-awb", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order or is admin
      if (order.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!order.awbNumber) {
        return res.status(404).json({ message: "AWB not found for this order" });
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      
      if (!samedayAPI) {
        return res.status(500).json({ message: "Sameday API not configured" });
      }

      const trackingInfo = await samedayAPI.trackAWB(order.awbNumber);

      res.json({
        awbNumber: order.awbNumber,
        trackingUrl: `https://sameday.ro/track/${order.awbNumber}`,
        trackingInfo,
      });

    } catch (error) {
      console.error("Track AWB error:", error);
      res.status(500).json({ message: "Failed to track AWB" });
    }
  });

  // Review routes
  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ message: "Failed to get reviews" });
    }
  });

  app.post("/api/products/:id/reviews", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const productId = parseInt(req.params.id);
      const reviewData = insertReviewSchema.parse({
        ...req.body,
        productId,
        userId: req.userId,
      });
      const review = await storage.createReview(reviewData);
      res.json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(400).json({ message: "Failed to create review" });
    }
  });

  // Admin routes
  app.get("/api/admin/orders", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      console.error("Get admin orders error:", error);
      res.status(500).json({ message: "Failed to get orders" });
    }
  });

  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, phone, subject, category, message, orderNumber } = req.body;
      
      // Validate required fields
      if (!name || !email || !subject || !message || !category) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: name, email, subject, message, and category are required" 
        });
      }

      // Log the contact form submission
      console.log("Contact form submission:", {
        name,
        email,
        phone: phone || 'Not provided',
        subject,
        category,
        message,
        orderNumber: orderNumber || 'Not provided',
        timestamp: new Date().toISOString(),
        ip: req.ip || 'unknown'
      });

      // Send emails: to business (info@xhaccp.com) and confirmation to customer
      const emailResults = await sendContactFormEmails({
        name,
        email,
        phone,
        subject,
        category,
        message,
        orderNumber
      });

      console.log("Contact form email results:", emailResults);

      if (emailResults.toBusinessSent || emailResults.toCustomerSent) {
        res.json({
          success: true,
          message: "Vă mulțumim că ne-ați contactat! Am primit mesajul dumneavoastră și vă vom răspunde în cel mai scurt timp posibil.",
          ticketId: `TICKET_${Date.now()}`,
          timestamp: new Date().toISOString(),
          emailsSent: emailResults
        });
      } else {
        console.error("Failed to send contact form emails");
        res.status(500).json({ 
          success: false, 
          message: "A apărut o eroare la trimiterea mesajului. Vă rugăm să încercați din nou." 
        });
      }
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(500).json({ 
        success: false, 
        message: "A apărut o eroare la trimiterea mesajului. Vă rugăm să încercați din nou." 
      });
    }
  });

  // AI Assistant routes
  app.post("/api/ai/connect", async (req, res) => {
    try {
      // Simulate AI connection process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      res.json({ 
        success: true, 
        message: "Connected to AI Assistant",
        sessionId: `ai_session_${Date.now()}`,
        capabilities: [
          "Product recommendations",
          "Kitchen setup advice", 
          "HACCP compliance help",
          "Equipment comparisons",
          "Order status & invoices"
        ]
      });
    } catch (error) {
      console.error("AI connect error:", error);
      res.status(500).json({ message: "Failed to connect to AI Assistant" });
    }
  });

  app.post("/api/ai/chat", async (req: AuthRequest, res) => {
    try {
      const { message, sessionId, language } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Get current products for context
      const products = allProductsData.slice(0, 15); // Use first 15 products for context
      const productList = products.map(p => `${p.name} - $${p.price} (ID: ${p.id}, Slug: ${p.slug})`).join(', ');

      // Extract user ID from JWT token if present (optional authentication)
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
          userId = decoded.userId;
        } catch (error) {
          // Token is invalid or expired, continue without authentication
          console.log("Invalid or expired token, continuing as guest");
        }
      }

      // Check if user is authenticated for order-related queries
      let userContext = "";
      let userOrders: any[] = [];
      
      if (userId) {
        try {
          userOrders = await storage.getOrders(userId);
          userContext = `\n\nUser is logged in. Available user services:
- Order Status: User has ${userOrders.length} order(s) in their account
- Invoice Information: Can provide invoice details for completed orders
- Order History: Can show past purchases and order tracking

When user asks about orders, invoices, or order status, provide specific information from their order history.`;
        } catch (error) {
          console.error("Error fetching user orders:", error);
        }
      } else {
        userContext = `\n\nUser is not logged in. For order status and invoice information, they need to sign in to their account first.`;
      }

      // Language context for multilingual support
      const languageMap = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French', 
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'ar': 'Arabic'
      };
      
      const userLanguage = (languageMap as any)[language] || 'English';
      const languageInstruction = language && language !== 'en' 
        ? `\n\nIMPORTANT: Respond in ${userLanguage} language. The user interface is in ${userLanguage}, so provide your response in the same language to ensure consistency.`
        : '';

      // Create system prompt with xHACCP context
      const systemPrompt = `You are an AI assistant for xHACCP, a professional kitchen equipment and supplies company. You help customers with:

1. Product recommendations from our catalog
2. Kitchen setup advice for commercial and home kitchens
3. HACCP compliance and food safety guidance
4. Equipment comparisons and technical specifications
5. Order status and invoice information (for signed-in users)

Our current featured products include: ${productList}${userContext}

IMPORTANT: When recommending specific products from our catalog, always format them as clickable links using this exact format:
[Product Name](/products/product-slug)

For example: [Digital Food Thermometer](/products/digital-food-thermometer)

Always be helpful, professional, and focus on practical solutions. When recommending products, mention specific items from our catalog when relevant and provide direct links. Keep responses concise but informative.${languageInstruction}`;

      // Prepare user message with order context if relevant
      let enhancedMessage = message;
      
      // If user is asking about orders and is logged in, add order details
      if (userId && userOrders.length > 0 && (
        message.toLowerCase().includes('order') || 
        message.toLowerCase().includes('invoice') || 
        message.toLowerCase().includes('status') ||
        message.toLowerCase().includes('purchase')
      )) {
        const orderDetails = userOrders.map(order => {
          const orderTotal = order.items.reduce((sum: number, item: any) => sum + (parseFloat(item.product.price) * item.quantity), 0);
          return `Order #${order.id} - Status: ${order.status} - Total: $${orderTotal.toFixed(2)} - Date: ${new Date(order.createdAt).toLocaleDateString()} - Items: ${order.items.length}`;
        }).join('\n');
        
        enhancedMessage = `${message}\n\nUser's Order History:\n${orderDetails}`;
      }

      if (!openai) {
        return res.json({
          response: "AI chat is currently unavailable. Please contact us directly for assistance with your kitchen equipment needs.",
          sessionId,
          timestamp: new Date().toISOString(),
          suggestedActions: []
        });
      }

      // Call OpenAI ChatGPT API with timeout and error handling
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: enhancedMessage }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI API timeout')), 30000)
        )
      ]);

      const response = (completion as any).choices[0].message.content || "I'm here to help with your kitchen equipment needs! How can I assist you today?";

      res.json({
        response,
        sessionId,
        timestamp: new Date().toISOString(),
        suggestedActions: [
          "View recommended products",
          "Get compliance checklist",
          "Compare equipment options",
          "Schedule consultation"
        ]
      });
    } catch (error: any) {
      console.error("AI chat error:", error);
      
      // Provide specific error messages based on error type
      let errorMessage = "I'm temporarily unavailable. Please try again in a moment.";
      
      if (error.message?.includes('timeout')) {
        errorMessage = "The AI service is taking too long to respond. Please try again with a shorter question.";
      } else if (error.message?.includes('rate limit')) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (error.message?.includes('API key')) {
        errorMessage = "AI service configuration issue. Please contact support.";
      }
      
      res.status(500).json({ 
        message: errorMessage,
        response: errorMessage
      });
    }
  });

  // Stripe Payment Routes
  app.post("/api/payments/stripe/create-payment-intent", async (req, res) => {
    try {
      const { currency, orderId, cartItems, voucherCode } = req.body;

      if (!currency) {
        return res.status(400).json({ message: "Currency is required" });
      }
      
      // SECURITY: Cart items are required - no fallback to client amount
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ message: "Cart items are required" });
      }
      
      // SECURITY: Look up product prices from database - NEVER trust client-provided prices or quantities
      let subtotal = 0;
      for (const item of cartItems) {
        // Validate quantity - must be positive integer
        const quantity = parseInt(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
          return res.status(400).json({ message: `Invalid quantity for product ${item.productId}: must be between 1 and 9999` });
        }
        
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product not found: ${item.productId}` });
        }
        
        // Check if product is active
        if (!product.isActive) {
          return res.status(400).json({ message: `Product is not available: ${product.name}` });
        }
        
        subtotal += parseFloat(product.price) * quantity;
      }
      
      // Get shipping settings
      const companySettings = await storage.getCompanySettings();
      const freeShippingThreshold = companySettings?.freeShippingThreshold ? parseFloat(companySettings.freeShippingThreshold) : 500;
      const standardShippingCost = companySettings?.standardShippingCost ? parseFloat(companySettings.standardShippingCost) : 25;
      
      // Calculate shipping
      const shippingCost = subtotal > freeShippingThreshold ? 0 : standardShippingCost;
      
      // Validate voucher if provided
      let discountAmount = 0;
      if (voucherCode) {
        const voucher = await storage.getVoucherByCode(voucherCode);
        if (voucher && voucher.isActive) {
          const now = new Date();
          const validFrom = voucher.validFrom ? new Date(voucher.validFrom) : null;
          const validUntil = voucher.validUntil ? new Date(voucher.validUntil) : null;
          const maxUsesReached = voucher.maxUses && voucher.usedCount && voucher.usedCount >= voucher.maxUses;
          const minOrderMet = !voucher.minOrderAmount || subtotal >= parseFloat(voucher.minOrderAmount);
          
          if (!maxUsesReached && minOrderMet && 
              (!validFrom || now >= validFrom) && 
              (!validUntil || now <= validUntil)) {
            if (voucher.discountType === 'percentage') {
              discountAmount = subtotal * (parseFloat(voucher.discountValue) / 100);
            } else {
              discountAmount = parseFloat(voucher.discountValue);
            }
          }
        }
      }
      
      // Calculate final total (prices already include VAT)
      const discountedSubtotal = Math.max(0, subtotal - discountAmount);
      const finalAmount = (discountedSubtotal + shippingCost) * 100; // Convert to cents
      
      // SECURITY: Ensure final amount is positive
      if (finalAmount < 50) { // Stripe minimum is 50 cents
        return res.status(400).json({ message: "Order total is too low" });
      }

      // Create payment intent with Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2020-08-27' as any,
      });
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(finalAmount),
        currency: currency.toLowerCase(),
        metadata: {
          source: 'xhaccp',
          orderId: orderId?.toString() || '',
          voucherCode: voucherCode || ''
        }
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        serverCalculatedAmount: Math.round(finalAmount) / 100 // Return for verification
      });
    } catch (error) {
      console.error("Error creating Stripe payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Stripe webhook for payment completion
  app.post("/api/payments/stripe/webhook", async (req, res) => {
    try {
      const event = req.body;

      console.log("Stripe webhook received:", event.type);

      // Handle different webhook events
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.orderId;

        if (orderId) {
          console.log(`Payment succeeded for order ${orderId}`);
          
          // Update order status
          await storage.updateOrder(parseInt(orderId), {
            paymentStatus: 'paid',
            status: 'processing'
          });

          // Generate invoice automatically via Smartbill API
          try {
            // Initialize invoice service if needed
            if (!invoiceService) {
              invoiceService = await createInvoiceService();
            }
            
            const invoice = await invoiceService.generateInvoiceAfterPayment(
              parseInt(orderId),
              {
                status: 'succeeded',
                paymentMethod: 'card',
                paymentId: paymentIntent.id,
                amount: paymentIntent.amount / 100 // Convert from cents
              }
            );

            console.log(`Invoice generated automatically for order ${orderId}:`, invoice.invoiceNumber);
          } catch (invoiceError) {
            console.error(`Failed to generate invoice for order ${orderId}:`, invoiceError);
            // Don't fail the webhook - invoice can be generated manually later
          }
        }
      } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.orderId;

        if (orderId) {
          console.log(`Payment failed for order ${orderId}`);
          
          await storage.updateOrder(parseInt(orderId), {
            paymentStatus: 'failed',
            status: 'cancelled'
          });
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Revolut Payment Routes
  app.post("/api/payments/revolut/create-order", async (req, res) => {
    try {
      const { amount, currency } = req.body;

      if (!amount || !currency) {
        return res.status(400).json({ message: "Amount and currency are required" });
      }

      // Create order with Revolut
      const orderData = {
        amount: Math.round(amount), // Amount in cents
        currency: currency.toUpperCase(),
        description: "KitchenPro Supply Order",
        capture_mode: "automatic",
        merchant_order_ext_ref: `order_${Date.now()}`,
        settlement_currency: "USD",
      };

      // Create real Revolut order using the API
      const revolutApiUrl = "https://merchant.revolut.com/api/1.0/orders";
      
      const revolutResponse = await fetch(revolutApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.REVOLUT_API_KEY}`,
          "Revolut-Api-Version": "2024-12-01",
        },
        body: JSON.stringify(orderData),
      });

      if (!revolutResponse.ok) {
        const errorText = await revolutResponse.text();
        console.error("Revolut API Error:", revolutResponse.status, errorText);
        throw new Error(`Revolut API error: ${revolutResponse.status}`);
      }

      const revolutOrder = await revolutResponse.json();
      console.log("Revolut order created:", revolutOrder);
      
      res.json(revolutOrder);
    } catch (error) {
      console.error("Error creating Revolut order:", error);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  app.post("/api/payments/revolut/webhook", async (req, res) => {
    try {
      const { event, data } = req.body;

      console.log("Revolut webhook received:", event, data);

      // Handle different webhook events
      switch (event) {
        case "ORDER_PAYMENT_COMPLETED":
          console.log("Payment completed for order:", data.merchant_order_ext_ref);
          
          // Extract order ID from merchant reference
          const orderIdMatch = data.merchant_order_ext_ref?.match(/order_(\d+)/);
          if (orderIdMatch) {
            const orderId = parseInt(orderIdMatch[1]);
            
            // Update order status
            await storage.updateOrder(orderId, {
              paymentStatus: 'paid',
              status: 'processing'
            });

            // Generate invoice automatically via Smartbill API
            try {
              // Initialize invoice service if needed
              if (!invoiceService) {
                invoiceService = await createInvoiceService();
              }
              
              const invoice = await invoiceService.generateInvoiceAfterPayment(
                orderId,
                {
                  status: 'completed',
                  paymentMethod: 'revolut_pay',
                  paymentId: data.id,
                  amount: data.order_amount?.value / 100 || 0
                }
              );

              console.log(`Invoice generated automatically for order ${orderId}:`, invoice.invoiceNumber);
            } catch (invoiceError) {
              console.error(`Failed to generate invoice for order ${orderId}:`, invoiceError);
            }
          }
          break;
          
        case "ORDER_PAYMENT_FAILED":
          console.log("Payment failed for order:", data.merchant_order_ext_ref);
          
          const failedOrderIdMatch = data.merchant_order_ext_ref?.match(/order_(\d+)/);
          if (failedOrderIdMatch) {
            await storage.updateOrder(parseInt(failedOrderIdMatch[1]), {
              paymentStatus: 'failed',
              status: 'cancelled'
            });
          }
          break;
          
        case "ORDER_PAYMENT_CANCELLED":
          console.log("Payment cancelled for order:", data.merchant_order_ext_ref);
          
          const cancelledOrderIdMatch = data.merchant_order_ext_ref?.match(/order_(\d+)/);
          if (cancelledOrderIdMatch) {
            await storage.updateOrder(parseInt(cancelledOrderIdMatch[1]), {
              paymentStatus: 'cancelled',
              status: 'cancelled'
            });
          }
          break;
          
        default:
          console.log("Unknown webhook event:", event);
      }

      res.status(200).json({ message: "Webhook processed" });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Public shipping settings endpoint (no auth required)
  app.get("/api/shipping-settings", async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json({
        freeShippingThreshold: settings?.freeShippingThreshold || "500.00",
        standardShippingCost: settings?.standardShippingCost || "25.00",
        currency: settings?.defaultCurrency || "EUR",
        vatPercentage: settings?.defaultVatPercentage || "19.00",
      });
    } catch (error) {
      console.error("Error fetching shipping settings:", error);
      res.status(500).json({ message: "Failed to fetch shipping settings" });
    }
  });

  // Smartbill API Test endpoints
  app.get("/api/smartbill/test", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Initialize invoice service if needed
      if (!invoiceService) {
        invoiceService = await createInvoiceService();
      }
      
      const connected = await invoiceService.testConnection();
      res.json({ 
        connected,
        smartbillEnabled: process.env.ENABLE_SMARTBILL === 'true',
        hasCredentials: !!(process.env.SMARTBILL_USERNAME && process.env.SMARTBILL_TOKEN && process.env.SMARTBILL_COMPANY_VAT)
      });
    } catch (error) {
      console.error("Error testing Smartbill connection:", error);
      res.status(500).json({ message: "Failed to test connection", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/orders/:orderId/generate-invoice-smartbill", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const orderId = parseInt(req.params.orderId);
      const { paymentMethod = 'card' } = req.body;

      // Initialize invoice service if needed
      if (!invoiceService) {
        invoiceService = await createInvoiceService();
      }
      
      const invoice = await invoiceService.generateInvoiceAfterPayment(orderId, {
        status: 'succeeded',
        paymentMethod,
        paymentId: `manual_${Date.now()}`,
        amount: 0 // Will be calculated from order
      });

      res.json(invoice);
    } catch (error) {
      console.error("Error generating test invoice:", error);
      res.status(500).json({ message: "Failed to generate invoice", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Admin access routes for testing and fallback
  app.get('/admin', (req, res) => {
    try {
      res.sendFile(path.resolve('./client/admin/index.html'));
    } catch (error) {
      // Fallback admin interface
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>xHACCP Admin</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
    .container { max-width: 400px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
    h1 { color: #333; margin-bottom: 30px; text-align: center; font-size: 28px; }
    .logo { text-align: center; margin-bottom: 30px; font-size: 24px; font-weight: bold; color: #667eea; }
    .info { background: #f8f9ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #667eea; }
    .credentials { font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .button { background: #667eea; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; width: 100%; text-align: center; font-size: 16px; margin-top: 20px; }
    .button:hover { background: #5a6fd8; }
    .note { font-size: 14px; color: #666; margin-top: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🍴 xHACCP</div>
    <h1>Admin Panel</h1>
    <div class="info">
      <p><strong>Admin Credentials:</strong></p>
      <div class="credentials">Email: admin@xhaccp.com</div>
      <div class="credentials">Password: admin123</div>
    </div>
    <p>Welcome to the xHACCP admin interface. Please use the credentials above to access your dashboard.</p>
    <a href="/admin" class="button">Enter Admin Panel</a>
    <div class="note">
      <p>🔐 Features: JWT Authentication, 2FA Support, Real-time Dashboard</p>
    </div>
  </div>
  <script>
    // Redirect to admin interface after showing credentials
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  </script>
</body>
</html>`);
    }
  });

  // Admin UI routes (non-API routes only)
  app.get('/admin', (req, res) => {
    try {
      res.sendFile(path.resolve('./client/admin/index.html'));
    } catch (error) {
      res.redirect('/admin');
    }
  });

  const httpServer = createServer(app);
  
  // Load all data into memory after server setup
  setTimeout(loadAllDataIntoMemory, 2000); // Wait 2 seconds for database to be ready
  
  return httpServer;
}
