import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertCategorySchema, insertProductSchema, insertOrderSchema, insertCartItemSchema, insertReviewSchema, insertInvoiceSchema, insertInvoiceItemSchema, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import QRCode from "qrcode";
import path from "path";
import { createInvoiceService } from './invoice-service.js';
import { sendNotificationPreferencesEmail, sendContactFormEmails } from './email-service.js';

const appleOAuthStates = new Map<string, number>();
setInterval(() => {
  const tenMinutesAgo = Date.now() - 600000;
  for (const [key, timestamp] of appleOAuthStates) {
    if (timestamp < tenMinutesAgo) appleOAuthStates.delete(key);
  }
}, 60000);

function generateAppleClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!teamId || !keyId || !clientId || !privateKey) {
    throw new Error('Missing Apple OAuth configuration');
  }

  let formattedKey = privateKey;
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }
  formattedKey = formattedKey.replace(/-----BEGIN PRIVATE KEY-----\s*/, '-----BEGIN PRIVATE KEY-----\n');
  formattedKey = formattedKey.replace(/\s*-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');

  return jwt.sign({}, formattedKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    audience: 'https://appleid.apple.com',
    issuer: teamId,
    subject: clientId,
    keyid: keyId,
    header: {
      alg: 'ES256',
      kid: keyId,
    },
  });
}

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
const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any;
        req.userId = decoded.id;
      } catch (err) {
        // Token invalid — continue as guest
      }
    }
    next();
  } catch (error) {
    next();
  }
};

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
    
    // Load all category translations and attach to categories
    const allCategoryTranslations = await storage.getAllCategoryTranslations();
    const translationsByCategory = new Map<number, Record<string, { name: string; description: string | null }>>();
    for (const t of allCategoryTranslations) {
      if (!translationsByCategory.has(t.categoryId)) {
        translationsByCategory.set(t.categoryId, {});
      }
      translationsByCategory.get(t.categoryId)![t.language] = {
        name: t.name,
        description: t.description,
      };
    }
    for (const category of rawCategories) {
      (category as any).translations = translationsByCategory.get(category.id) || {};
    }

    categoriesData = rawCategories;
    
    // Refresh stringified categories data (now includes productCount and translations)
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
    
    // Attach category translations to products
    for (const product of allProductsData) {
      if (product.category) {
        (product.category as any).translations = translationsByCategory.get(product.category.id) || {};
      }
    }
    // Also attach to products by category
    for (const [slug, products] of productsByCategory) {
      for (const product of products) {
        if (product.category) {
          (product.category as any).translations = translationsByCategory.get(product.category.id) || {};
        }
      }
    }
    
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

      const linkedCount = await storage.linkGuestOrdersToUser(userData.email, user.id);

      const { orderId } = req.body;
      if (orderId && typeof orderId === 'number') {
        const order = await storage.getOrder(orderId);
        const orderEmail = (order?.shippingAddress as any)?.email;
        if (order && !order.userId && orderEmail === userData.email) {
          await storage.updateOrder(orderId, { userId: user.id });
          console.log(`🔗 Explicitly linked order ${orderId} to new user ${user.id}`);
        }
      }

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

      storage.linkGuestOrdersToUser(email, user.id).catch(err => {
        console.error('Error linking guest orders on login:', err);
      });

      res.json({
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/google", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.redirect("/login?error=google_not_configured");
    }
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const redirectUri = `${proto}://${req.get('host')}/api/auth/google/callback`;
    const scope = encodeURIComponent('openid email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;
    res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.redirect("/login?error=google_failed");
      }
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.redirect("/login?error=google_not_configured");
      }
      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      const redirectUri = `${proto}://${req.get('host')}/api/auth/google/callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Google token exchange failed:', await tokenResponse.text());
        return res.redirect("/login?error=google_failed");
      }

      const tokenData = await tokenResponse.json() as any;

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return res.redirect("/login?error=google_failed");
      }

      const googleUser = await userInfoResponse.json() as any;
      const email = googleUser.email;
      const firstName = googleUser.given_name || googleUser.name?.split(' ')[0] || '';
      const lastName = googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '';

      let user = await storage.getUserByEmail(email);
      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        user = await storage.createUser({
          email,
          firstName,
          lastName,
          password: hashedPassword,
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "24h" }
      );

      storage.linkGuestOrdersToUser(email, user.id).catch(err => {
        console.error('Error linking guest orders on Google login:', err);
      });

      res.redirect(`/login?token=${token}&userId=${user.id}`);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect("/login?error=google_failed");
    }
  });

  app.get("/api/auth/apple", (req, res) => {
    const clientId = process.env.APPLE_CLIENT_ID;
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = process.env.APPLE_PRIVATE_KEY;
    if (!clientId || !teamId || !keyId || !privateKey) {
      return res.redirect("/login?error=apple_not_configured");
    }
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const redirectUri = `${proto}://${req.get('host')}/api/auth/apple/callback`;
    const scope = encodeURIComponent('name email');
    const state = crypto.randomBytes(16).toString('hex');
    appleOAuthStates.set(state, Date.now());
    const url = `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&response_mode=form_post&state=${state}`;
    res.redirect(url);
  });

  app.post("/api/auth/apple/callback", async (req, res) => {
    try {
      const { code, state } = req.body;
      
      if (!state || !appleOAuthStates.has(state)) {
        console.error('Apple callback: state mismatch or missing (CSRF check failed)');
        return res.redirect("/login?error=apple_failed");
      }
      appleOAuthStates.delete(state);

      if (!code) {
        console.error('Apple callback: no code received, body:', JSON.stringify(req.body));
        return res.redirect("/login?error=apple_failed");
      }
      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) {
        return res.redirect("/login?error=apple_not_configured");
      }

      let clientSecret: string;
      try {
        clientSecret = generateAppleClientSecret();
      } catch (e) {
        console.error('Apple client secret generation failed:', e);
        return res.redirect("/login?error=apple_not_configured");
      }

      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      const redirectUri = `${proto}://${req.get('host')}/api/auth/apple/callback`;

      const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Apple token exchange failed:', await tokenResponse.text());
        return res.redirect("/login?error=apple_failed");
      }

      const tokenData = await tokenResponse.json() as any;
      const appleIdToken = tokenData.id_token;
      
      if (!appleIdToken) {
        console.error('Apple callback: no id_token in token response');
        return res.redirect("/login?error=apple_failed");
      }

      const payload = JSON.parse(Buffer.from(appleIdToken.split('.')[1], 'base64').toString());
      
      if (payload.iss !== 'https://appleid.apple.com' || payload.aud !== clientId) {
        console.error('Apple id_token validation failed: iss or aud mismatch');
        return res.redirect("/login?error=apple_failed");
      }

      const email = payload.email || payload.sub;

      const userBody = req.body.user ? JSON.parse(req.body.user) : null;
      const firstName = userBody?.name?.firstName || '';
      const lastName = userBody?.name?.lastName || '';

      let user = await storage.getUserByEmail(email);
      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        user = await storage.createUser({
          email,
          firstName: firstName || 'Apple',
          lastName: lastName || 'User',
          password: hashedPassword,
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "24h" }
      );

      storage.linkGuestOrdersToUser(email, user.id).catch(err => {
        console.error('Error linking guest orders on Apple login:', err);
      });

      res.redirect(`/login?token=${token}&userId=${user.id}`);
    } catch (error) {
      console.error("Apple OAuth callback error:", error);
      res.redirect("/login?error=apple_failed");
    }
  });

  app.get("/api/auth/social/status", (req, res) => {
    const googleId = process.env.GOOGLE_CLIENT_ID;
    const appleId = process.env.APPLE_CLIENT_ID;
    const appleTeamId = process.env.APPLE_TEAM_ID;
    const appleKeyId = process.env.APPLE_KEY_ID;
    const applePrivateKey = process.env.APPLE_PRIVATE_KEY;
    const appleConfigured = !!(appleId && appleTeamId && appleKeyId && applePrivateKey);
    res.json({
      google: !!googleId,
      apple: appleConfigured,
    });
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

  app.get("/api/invoices/:invoiceId/pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      const invoice = await storage.getInvoice(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.userId !== req.userId && !req.isAdmin) {
        return res.status(403).json({ message: "Not authorized to access this invoice" });
      }

      if (!invoice.smartbillSeries || !invoice.smartbillNumber) {
        return res.status(404).json({ message: "SmartBill PDF not available for this invoice" });
      }

      const { SmartbillAPI } = await import('./smartbill-api.js');
      const smartbillApi = new SmartbillAPI({
        username: process.env.SMARTBILL_USERNAME || '',
        token: process.env.SMARTBILL_TOKEN || '',
        companyVat: process.env.SMARTBILL_COMPANY_VAT || '',
      });

      const pdfBuffer = await smartbillApi.getInvoicePdf(
        process.env.SMARTBILL_COMPANY_VAT || '',
        invoice.smartbillSeries,
        invoice.smartbillNumber
      );

      const filename = `Factura_${invoice.smartbillSeries}_${invoice.smartbillNumber}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error downloading invoice PDF:", error);
      res.status(500).json({ message: "Failed to download invoice PDF" });
    }
  });

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

  app.get("/api/categories/:id/translation/:language", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      const language = req.params.language;
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      const translation = await storage.getCategoryTranslation(categoryId, language);
      if (!translation) {
        return res.status(404).json({ message: "Translation not found" });
      }
      res.json(translation);
    } catch (error) {
      res.status(500).json({ message: "Failed to get category translation" });
    }
  });

  app.get("/api/category-translations/:language", async (req, res) => {
    try {
      const language = req.params.language;
      const categoryIds = req.query.ids?.toString().split(',').map(Number).filter(id => !isNaN(id)) || [];
      if (categoryIds.length === 0) {
        return res.json({});
      }
      const results = await storage.getCategoryTranslationsBatch(categoryIds, language);
      const translations: Record<number, { name: string; description: string | null }> = {};
      for (const t of results) {
        translations[t.categoryId] = { name: t.name, description: t.description };
      }
      res.json(translations);
    } catch (error) {
      res.status(500).json({ message: "Failed to get category translations" });
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

  app.post("/api/orders", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { shippingAddress, billingAddress, paymentMethod, items, notes, voucherCode, contactPhone, email: bodyEmail } = req.body;
      
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
        
        const productActive = product.status === 'active' || product.isActive === true;
        if (!productActive) {
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
      
      const guestEmail = bodyEmail || shippingAddress?.email || billingAddress?.email || '';
      
      if (!req.userId && guestEmail) {
        orderNotes = `Guest email: ${guestEmail}${contactPhone ? ', Phone: ' + contactPhone : ''}${orderNotes ? '\n' + orderNotes : ''}`;
      }

      const orderData = {
        userId: req.userId || null,
        status: "pending",
        totalAmount: totalAmount.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        shippingAddress: { ...shippingAddress, email: guestEmail || shippingAddress?.email },
        billingAddress,
        paymentMethod,
        paymentStatus: "pending",
        notes: orderNotes || undefined,
      };

      const order = await storage.createOrder(orderData, validatedItems);
      
      if (validatedVoucher && discountAmount > 0) {
        await storage.incrementVoucherUsage(validatedVoucher.id);
      }
      
      const fullOrder = await storage.getOrder(order.id);
      
      if (req.userId) {
        const user = await storage.getUser(req.userId);
        if (fullOrder && user) {
          const { sendOrderConfirmationEmail, sendNewOrderNotificationEmail, getCompanyEmailFromSettings } = await import('./email-service.js');
          sendOrderConfirmationEmail(fullOrder, user, fullOrder.paymentMethod || undefined).catch(error => {
            console.error('Failed to send order confirmation to customer:', error);
          });
          getCompanyEmailFromSettings().then((companyEmail: string | null) => {
            if (companyEmail) {
              sendNewOrderNotificationEmail(fullOrder, user, companyEmail).catch((error: any) => {
                console.error('Failed to send new order notification to company:', error);
              });
            }
          }).catch((err: any) => console.error('Failed to get company email:', err));
        }
        await storage.clearCart(req.userId);
      } else if (fullOrder) {
        const guestUser = {
          id: 0,
          email: guestEmail,
          firstName: shippingAddress?.firstName || 'Guest',
          lastName: shippingAddress?.lastName || '',
          name: `${shippingAddress?.firstName || 'Guest'} ${shippingAddress?.lastName || ''}`.trim(),
        };
        const { sendOrderConfirmationEmail, sendNewOrderNotificationEmail, getCompanyEmailFromSettings } = await import('./email-service.js');
        sendOrderConfirmationEmail(fullOrder, guestUser as any, fullOrder.paymentMethod || undefined).catch(error => {
          console.error('Failed to send guest order confirmation email:', error);
        });
        getCompanyEmailFromSettings().then((companyEmail: string | null) => {
          if (companyEmail) {
            sendNewOrderNotificationEmail(fullOrder, guestUser as any, companyEmail).catch((error: any) => {
              console.error('Failed to send new order notification to company:', error);
            });
          }
        }).catch((err: any) => console.error('Failed to get company email:', err));
      }
      
      res.json(order);
    } catch (error: any) {
      console.error("Create order error:", error);
      const errorMessage = error?.message || "Failed to create order";
      res.status(400).json({ message: errorMessage });
    }
  });

  app.put("/api/orders/:id/status", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      const order = await storage.updateOrderStatus(orderId, status);
      
      res.json(order);

      if (status === 'processing') {
        (async () => {
          try {
            console.log(`🔄 Processing acceptance flow for order #${orderId}...`);
            const fullOrder = await storage.getOrder(orderId);
            if (!fullOrder) return;

            const shippingAddr = fullOrder.shippingAddress as any;
            const billingAddr = fullOrder.billingAddress as any;
            let customerEmail = '';

            if (fullOrder.userId) {
              const user = await storage.getUser(fullOrder.userId);
              if (user) customerEmail = user.email;
            }
            if (!customerEmail) {
              customerEmail = shippingAddr?.email || billingAddr?.email || fullOrder.notes?.match(/Guest email:\s*([^\s,]+)/)?.[1] || '';
            }

            const isCOD = fullOrder.paymentMethod === 'cash_on_delivery' || fullOrder.paymentMethod === 'cod';
            let invoiceGenerated = false;
            let invoiceNumber: string | undefined;
            let invoiceId: number | undefined;
            let awbNumber: string | undefined;

            try {
              console.log(`📄 Generating SmartBill invoice for order #${orderId} (${isCOD ? 'COD' : fullOrder.paymentMethod})...`);
              const { createInvoiceService } = await import('./invoice-service.js');
              const invoiceSvc = await createInvoiceService();
              const invoice = await invoiceSvc.generateInvoiceAfterPayment(
                orderId,
                {
                  status: 'succeeded',
                  paymentMethod: isCOD ? 'cash_on_delivery' : (fullOrder.paymentMethod || 'card'),
                  paymentId: isCOD ? `cod_${orderId}` : `accept_${orderId}`,
                  amount: parseFloat(String(fullOrder.totalAmount)),
                }
              );
              console.log(`✅ Invoice generated for order #${orderId}:`, invoice.invoiceNumber);
              invoiceGenerated = true;
              invoiceNumber = invoice.invoiceNumber;
              invoiceId = invoice.id;
            } catch (invoiceError) {
              console.error(`❌ Failed to generate invoice for order #${orderId}:`, invoiceError);
            }

            try {
              const { createSamedayAPI } = await import('./sameday-api');
              const samedayAPI = createSamedayAPI();
              if (samedayAPI) {
                const currentOrder = await storage.getOrder(orderId);
                if (currentOrder && !currentOrder.awbNumber) {
                  console.log(`📦 Generating AWB for order #${orderId}...`);
                  const [pickupPoints, services] = await Promise.all([
                    samedayAPI.getPickupPoints(),
                    samedayAPI.getServices()
                  ]);
                  console.log(`📦 Pickup points: ${pickupPoints.length}, Services: ${services.length}`);

                  if (pickupPoints.length > 0 && services.length > 0) {
                    const selectedPickupPoint = pickupPoints.find((p: any) => p.id === 447249) || pickupPoints[0];
                    const parcels: any[] = [];
                    let parcelCounter = 1;

                    if (currentOrder.items && currentOrder.items.length > 0) {
                      for (const item of currentOrder.items) {
                        const product = await storage.getProduct(item.productId);
                        if (!product) continue;
                        const piecesPerPackage = (product as any).piecesPerPackage || 1;
                        const weight = (product as any).weight || 1;
                        const numberOfPackages = Math.ceil(item.quantity / piecesPerPackage);
                        for (let i = 0; i < numberOfPackages; i++) {
                          parcels.push({ sequenceNo: parcelCounter++, weight, width: 30, height: 20, length: 40 });
                        }
                      }
                    }
                    if (parcels.length === 0) {
                      parcels.push({ sequenceNo: 1, weight: 1, width: 30, height: 20, length: 40 });
                    }

                    const totalAmount = parseFloat(String(currentOrder.totalAmount));
                    const defaultContact = selectedPickupPoint.contactPersons?.find((c: any) => c.default) || selectedPickupPoint.contactPersons?.[0];
                    const awbData: any = {
                      pickupPoint: selectedPickupPoint.id,
                      contactPerson: defaultContact?.id,
                      service: services[0].id,
                      packageType: 0,
                      packageWeight: parcels.reduce((sum: number, p: any) => sum + p.weight, 0),
                      awbPayment: 1,
                      awbRecipient: {
                        name: `${shippingAddr?.firstName || ''} ${shippingAddr?.lastName || ''}`.trim() || 'Customer',
                        phoneNumber: shippingAddr?.phone || '',
                        personType: 0,
                        address: shippingAddr?.streetAddress || shippingAddr?.address || '',
                        countyString: shippingAddr?.state || shippingAddr?.county || '',
                        cityString: shippingAddr?.city || '',
                        postalCode: shippingAddr?.zipCode || '',
                      },
                      parcels,
                      thirdPartyPickup: 0,
                      insuredValue: totalAmount,
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
                      console.log(`✅ AWB generated for order #${orderId}: ${awbNumber}`);
                    }
                  }
                } else if (currentOrder?.awbNumber) {
                  awbNumber = currentOrder.awbNumber;
                }
              }
            } catch (awbError) {
              console.error(`❌ Failed to generate AWB for order #${orderId}:`, awbError);
            }

            if (awbNumber) {
              const { sendSupplierOrderEmail, sendCustomerShipmentEmail } = await import('./email-service.js');
              const { createSamedayAPI } = await import('./sameday-api');

              let awbPdfBuffer: Buffer | undefined;
              try {
                const samedayAPI = createSamedayAPI();
                if (samedayAPI) {
                  awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
                  console.log(`📄 AWB PDF retrieved for order #${orderId}`);
                }
              } catch (pdfError) {
                console.error(`AWB PDF retrieval failed for ${awbNumber}:`, pdfError);
              }

              const latestOrder = await storage.getOrder(orderId);
              if (latestOrder) {
                const supplierGroups = new Map<number | null, { supplierName: string; supplierEmail: string; items: { productName: string; quantity: number }[] }>();

                for (const item of latestOrder.items) {
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
                      await sendSupplierOrderEmail(group.supplierEmail, group.supplierName, latestOrder, group.items, awbNumber, awbPdfBuffer);
                      console.log(`✅ Supplier email sent to ${group.supplierEmail} for order #${orderId}`);
                    } catch (err) {
                      console.error(`❌ Failed to send supplier email to ${group.supplierEmail}:`, err);
                    }
                  }
                }

                let invoicePdfBuffer: Buffer | null = null;
                if (invoiceGenerated && invoiceId) {
                  try {
                    const { createInvoiceService } = await import('./invoice-service.js');
                    const invoiceSvc = await createInvoiceService();
                    invoicePdfBuffer = await invoiceSvc.getInvoicePdf(invoiceId);
                    console.log(`📄 Invoice PDF retrieved for order #${orderId}`);
                  } catch (pdfError) {
                    console.error(`❌ Failed to retrieve invoice PDF for order #${orderId}:`, pdfError);
                  }
                }

                if (customerEmail) {
                  try {
                    await sendCustomerShipmentEmail(customerEmail, latestOrder, awbNumber, invoicePdfBuffer, invoiceNumber);
                    console.log(`✅ Customer shipment email sent to ${customerEmail} for order #${orderId}`);
                  } catch (err) {
                    console.error(`❌ Failed to send customer shipment email for order #${orderId}:`, err);
                  }
                }
              }
            } else {
              console.log(`⚠️ No AWB generated for order #${orderId}, skipping supplier/customer emails`);
            }

            console.log(`✅ Acceptance flow completed for order #${orderId}`);
          } catch (error) {
            console.error(`❌ Background acceptance flow failed for order #${orderId}:`, error);
          }
        })();
      }
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
        pickupPoint: 447249,
        service: 7,
        packageType: 0,
        packageWeight: parcels.reduce((sum: number, p: any) => sum + p.weight, 0),
        awbPayment: 1,
        awbRecipient: {
          name: `${shippingAddr.firstName} ${shippingAddr.lastName}`,
          phoneNumber: shippingAddr.phone || '+40700000000',
          personType: 0,
          address: shippingAddr.address,
          countyString: shippingAddr.county || shippingAddr.state || '',
          cityString: shippingAddr.city || '',
          postalCode: shippingAddr.zipCode || '',
        },
        parcels: parcels,
        cashOnDelivery: 0,
        insuredValue: parseFloat(order.totalAmount.toString()),
        observation: `Order #${order.id} - xHACCP E-commerce`,
        clientInternalReference: `ORDER_${order.id}`,
      };

      const awbResponse = await samedayAPI.createAWB(awbData);

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
        trackingUrl: `https://sameday.ro/status-colet/?awb=${awbResponse.awbNumber}`,
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
        trackingUrl: `https://sameday.ro/status-colet/?awb=${order.awbNumber}`,
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
        'ro': 'Romanian',
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

  // ============ VIVA PAYMENTS INTEGRATION ============

  // Helper: Get Viva OAuth2 access token
  async function getVivaAccessToken(): Promise<string> {
    const clientId = process.env.VIVA_CLIENT_ID;
    const clientSecret = process.env.VIVA_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error("Viva credentials not configured");
    }

    const response = await fetch("https://accounts.vivapayments.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Viva OAuth error:", response.status, errorText);
      throw new Error(`Viva authentication failed: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  // Create Viva payment order and return checkout URL
  app.post("/api/payments/viva/create-order", async (req, res) => {
    try {
      const { currency, cartItems, voucherCode, orderData } = req.body;

      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ message: "Cart items are required" });
      }

      let subtotal = 0;
      for (const item of cartItems) {
        const quantity = parseInt(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
          return res.status(400).json({ message: `Invalid quantity for product ${item.productId}: must be between 1 and 9999` });
        }
        
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product not found: ${item.productId}` });
        }
        
        if (product.status?.toLowerCase() !== 'active') {
          return res.status(400).json({ message: `Product is not available: ${product.name}` });
        }
        
        subtotal += parseFloat(product.price) * quantity;
      }

      const companySettings = await storage.getCompanySettings();
      const freeShippingThreshold = companySettings?.freeShippingThreshold ? parseFloat(companySettings.freeShippingThreshold) : 500;
      const standardShippingCost = companySettings?.standardShippingCost ? parseFloat(companySettings.standardShippingCost) : 25;
      const shippingCost = subtotal > freeShippingThreshold ? 0 : standardShippingCost;

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

      const discountedSubtotal = Math.max(0, subtotal - discountAmount);
      const finalAmountCents = Math.round((discountedSubtotal + shippingCost) * 100);

      if (finalAmountCents < 30) {
        return res.status(400).json({ message: "Order total is too low" });
      }

      if (!orderData) {
        return res.status(400).json({ message: "Order data is required" });
      }

      const token = req.headers.authorization?.replace('Bearer ', '');
      let userId: number | null = null;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any;
          userId = decoded.userId || decoded.id;
        } catch (e) { }
      }

      const orderItems = orderData.items || cartItems.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price || "0",
        totalPrice: (parseFloat(item.price || "0") * item.quantity).toString(),
      }));

      let dbOrderId: number;
      try {
        let orderNotes = orderData.notes || '';
        if (voucherCode && discountAmount > 0) {
          orderNotes = `Voucher: ${voucherCode} (-${discountAmount.toFixed(2)})${orderNotes ? '\n' + orderNotes : ''}`;
        }

        const newOrder = await storage.createOrder({
          userId: userId,
          status: 'pending',
          totalAmount: (discountedSubtotal + shippingCost).toFixed(2),
          shippingCost: shippingCost.toFixed(2),
          shippingAddress: orderData.shippingAddress || {},
          billingAddress: orderData.billingAddress || {},
          paymentMethod: 'viva',
          paymentStatus: 'pending',
          notes: orderNotes || undefined,
        }, orderItems);

        dbOrderId = newOrder.id;
        console.log(`Created order ${dbOrderId} for Viva payment`);
      } catch (orderError) {
        console.error("Error creating order for Viva payment:", orderError);
        return res.status(500).json({ message: "Failed to create order" });
      }

      const accessToken = await getVivaAccessToken();
      const sourceCode = process.env.VIVA_SOURCE_CODE;
      const merchantId = process.env.VIVA_MERCHANT_ID;

      if (!sourceCode || !merchantId) {
        return res.status(500).json({ message: "Viva payment source not configured" });
      }

      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = `${protocol}://${host}`;

      const vivaOrderPayload: any = {
        amount: finalAmountCents,
        customerTrns: `xHACCP Order #${dbOrderId}`,
        merchantTrns: `order_${dbOrderId}`,
        sourceCode: sourceCode,
      };

      if (orderData?.shippingAddress?.email) {
        const countryName = (orderData.shippingAddress.country || '').toLowerCase();
        const countryMap: Record<string, string> = {
          'romania': 'RO', 'ro': 'RO',
          'germany': 'DE', 'de': 'DE',
          'france': 'FR', 'fr': 'FR',
          'italy': 'IT', 'it': 'IT',
          'spain': 'ES', 'es': 'ES',
          'united kingdom': 'GB', 'uk': 'GB', 'gb': 'GB',
          'netherlands': 'NL', 'nl': 'NL',
          'belgium': 'BE', 'be': 'BE',
          'austria': 'AT', 'at': 'AT',
          'greece': 'GR', 'gr': 'GR',
          'portugal': 'PT', 'pt': 'PT',
          'poland': 'PL', 'pl': 'PL',
          'hungary': 'HU', 'hu': 'HU',
          'czech republic': 'CZ', 'czechia': 'CZ', 'cz': 'CZ',
          'bulgaria': 'BG', 'bg': 'BG',
          'croatia': 'HR', 'hr': 'HR',
          'sweden': 'SE', 'se': 'SE',
          'denmark': 'DK', 'dk': 'DK',
          'finland': 'FI', 'fi': 'FI',
          'ireland': 'IE', 'ie': 'IE',
          'cyprus': 'CY', 'cy': 'CY',
          'luxembourg': 'LU', 'lu': 'LU',
          'malta': 'MT', 'mt': 'MT',
          'slovakia': 'SK', 'sk': 'SK',
          'slovenia': 'SI', 'si': 'SI',
          'estonia': 'EE', 'ee': 'EE',
          'latvia': 'LV', 'lv': 'LV',
          'lithuania': 'LT', 'lt': 'LT',
          'moldova': 'MD', 'md': 'MD',
          'republic of moldova': 'MD',
        };
        const isoCode = countryMap[countryName] || (countryName.length === 2 ? countryName.toUpperCase() : 'RO');

        vivaOrderPayload.customer = {
          email: orderData.shippingAddress.email,
          fullName: `${orderData.shippingAddress.firstName || ''} ${orderData.shippingAddress.lastName || ''}`.trim(),
          phone: orderData.contactPhone || orderData.shippingAddress.phone || '',
          countryCode: isoCode,
          requestLang: 'ro-RO',
        };
      }

      console.log("Viva order payload:", JSON.stringify(vivaOrderPayload));

      // Create payment order via Viva API
      const vivaResponse = await fetch("https://api.vivapayments.com/checkout/v2/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(vivaOrderPayload),
      });

      if (!vivaResponse.ok) {
        const errorText = await vivaResponse.text();
        console.error("Viva create order error:", vivaResponse.status, errorText);
        throw new Error(`Viva API error: ${vivaResponse.status} - ${errorText}`);
      }

      const vivaOrder = await vivaResponse.json() as any;
      const orderCode = vivaOrder.orderCode;

      console.log(`Viva payment order created: ${orderCode} for DB order ${dbOrderId}`);

      const checkoutUrl = `https://www.vivapayments.com/web/checkout?ref=${orderCode}&color=0000ff`;

      res.json({
        orderCode,
        checkoutUrl,
        dbOrderId,
        serverCalculatedAmount: finalAmountCents / 100,
      });
    } catch (error) {
      console.error("Error creating Viva payment order:", error);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  const awbGenerationInProgress = new Set<number>();

  async function generateAWBForOrder(orderId: number): Promise<{ awbNumber: string; cost: number; currency: string } | null> {
    if (awbGenerationInProgress.has(orderId)) {
      console.log(`AWB: Generation already in progress for order ${orderId}, skipping`);
      return null;
    }
    awbGenerationInProgress.add(orderId);

    try {
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`AWB: Order ${orderId} not found`);
        return null;
      }

      if (order.awbNumber) {
        console.log(`AWB: Order ${orderId} already has AWB ${order.awbNumber}, skipping`);
        return { awbNumber: order.awbNumber, cost: parseFloat(order.awbCost || '0'), currency: order.awbCurrency || 'RON' };
      }

      const { createSamedayAPI } = await import('./sameday-api');
      const samedayAPI = createSamedayAPI();
      if (!samedayAPI) {
        console.error('AWB: Sameday API not configured');
        return null;
      }

      const [pickupPoints, services] = await Promise.all([
        samedayAPI.getPickupPoints(),
        samedayAPI.getServices()
      ]);

      if (pickupPoints.length === 0 || services.length === 0) {
        console.error('AWB: No pickup points or services available');
        return null;
      }

      const shippingAddr = order.shippingAddress as any;
      const selectedPickupPoint = pickupPoints.find(p => p.id === 447249) || pickupPoints[0];

      const parcels: any[] = [];
      let parcelCounter = 1;

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const product = await storage.getProduct(item.productId);
          if (!product) continue;

          const quantity = item.quantity;
          const piecesPerPackage = product.piecesPerPackage || 1;
          const weight = product.weight || 1;
          const length = product.length || 10;
          const width = product.width || 10;
          const height = product.height || 10;
          const packagesNeeded = Math.ceil(quantity / piecesPerPackage);

          for (let packageNum = 1; packageNum <= packagesNeeded; packageNum++) {
            const remainingQuantity = quantity - ((packageNum - 1) * piecesPerPackage);
            const itemsInThisPackage = Math.min(remainingQuantity, piecesPerPackage);
            const packageWeight = Math.max(1, Math.round(weight * (itemsInThisPackage / piecesPerPackage)));

            parcels.push({
              weight: packageWeight,
              length, width, height,
              awbParcelNumber: `KTO${order.id.toString().padStart(5, '0')}-P${parcelCounter}`,
            });
            parcelCounter++;
          }
        }
      }

      if (parcels.length === 0) {
        parcels.push({
          weight: 1,
          awbParcelNumber: `KTO${order.id.toString().padStart(5, '0')}-P1`,
        });
      }

      const [counties, cities] = await Promise.all([
        samedayAPI.getCounties(),
        samedayAPI.getCities()
      ]);

      const targetCounty = (shippingAddr.county || shippingAddr.state || 'Cluj').toLowerCase();
      const targetCity = (shippingAddr.city || 'Feleacu').toLowerCase();

      const county = counties.find(c =>
        c.name.toLowerCase().includes(targetCounty) || targetCounty.includes(c.name.toLowerCase())
      ) || counties[0];

      const city = cities.find(c =>
        c.name.toLowerCase().includes(targetCity) || targetCity.includes(c.name.toLowerCase())
      ) || cities[0];

      const awbData = {
        pickupPoint: 447249,
        service: 7,
        packageType: 0,
        packageWeight: parcels.reduce((sum: number, p: any) => sum + p.weight, 0),
        awbPayment: 1,
        awbRecipient: {
          name: `${shippingAddr.firstName} ${shippingAddr.lastName}`,
          phoneNumber: shippingAddr.phone || '+40700000000',
          personType: 0,
          address: shippingAddr.address,
          countyString: shippingAddr.county || shippingAddr.state || '',
          cityString: shippingAddr.city || '',
          postalCode: shippingAddr.zipCode || '',
        },
        parcels,
        cashOnDelivery: 0,
        insuredValue: parseFloat(order.totalAmount.toString()),
        observation: `Order #${order.id} - xHACCP E-commerce`,
        clientInternalReference: `ORDER_${order.id}`,
      };

      const awbResponse = await samedayAPI.createAWB(awbData);

      await storage.updateOrder(orderId, {
        status: 'shipped',
        awbNumber: awbResponse.awbNumber,
        awbCourier: 'sameday',
        awbCost: awbResponse.cost.toString(),
        awbCurrency: awbResponse.currency,
        awbCreatedAt: new Date(),
      });

      console.log(`✅ AWB auto-generated for order ${orderId}: ${awbResponse.awbNumber}`);

      try {
        const updatedOrder = await storage.getOrder(orderId);
        if (updatedOrder) {
          let awbPdfBuffer: Buffer | undefined;
          try {
            awbPdfBuffer = await samedayAPI.getAWBPDF(awbResponse.awbNumber);
          } catch (pdfError) {
            console.error(`AWB PDF retrieval failed for ${awbResponse.awbNumber}:`, pdfError);
          }

          const { sendLogisticsAWBEmail } = await import('./email-service.js');
          await sendLogisticsAWBEmail(updatedOrder, awbResponse.awbNumber, awbPdfBuffer);
        }
      } catch (emailError) {
        console.error(`Failed to send logistics email for order ${orderId}:`, emailError);
      }

      return { awbNumber: awbResponse.awbNumber, cost: awbResponse.cost, currency: awbResponse.currency };
    } catch (error) {
      console.error(`AWB auto-generation failed for order ${orderId}:`, error);
      return null;
    } finally {
      awbGenerationInProgress.delete(orderId);
    }
  }

  // Viva payment success/failure callback
  app.get("/api/payments/viva/callback", async (req, res) => {
    try {
      const { s: transactionId, t: vivaOrderCode, lang } = req.query;
      
      console.log(`Viva callback received - transactionId: ${transactionId}, orderCode: ${vivaOrderCode}, lang: ${lang}`);
      console.log(`Viva callback full query params:`, JSON.stringify(req.query));

      if (transactionId) {
        res.redirect("/?payment=success");

        (async () => {
          try {
            const accessToken = await getVivaAccessToken();
            
            const txResponse = await fetch(`https://api.vivapayments.com/checkout/v2/transactions/${transactionId}`, {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            });

            if (txResponse.ok) {
              const txData = await txResponse.json() as any;
              console.log(`Viva transaction data:`, JSON.stringify(txData));
              const merchantTrns = txData.merchantTrns || '';
              const orderIdMatch = merchantTrns.match(/order_(\d+)/);
              
              if (orderIdMatch) {
                const orderId = parseInt(orderIdMatch[1]);
                
                const existingCallbackOrder = await storage.getOrder(orderId);
                if (existingCallbackOrder && existingCallbackOrder.paymentStatus === 'paid') {
                  console.log(`Viva callback: Order ${orderId} already processed (paid), skipping duplicate`);
                } else {
                await storage.updateOrder(orderId, {
                  paymentStatus: 'paid',
                  status: 'processing',
                });

                console.log(`Viva payment verified and order ${orderId} updated to paid`);

                let invoiceGenerated = false;
                let invoiceNumber: string | undefined;
                let invoiceId: number | undefined;

                try {
                  if (!invoiceService) {
                    invoiceService = await createInvoiceService();
                  }
                  
                  const invoice = await invoiceService.generateInvoiceAfterPayment(
                    orderId,
                    {
                      status: 'succeeded',
                      paymentMethod: 'viva',
                      paymentId: transactionId as string,
                      amount: txData.amount / 100,
                    }
                  );
                  console.log(`Invoice generated for Viva order ${orderId}:`, invoice.invoiceNumber);
                  invoiceGenerated = true;
                  invoiceNumber = invoice.invoiceNumber;
                  invoiceId = invoice.id;
                } catch (invoiceError) {
                  console.error(`Failed to generate invoice for order ${orderId}:`, invoiceError);
                }

                let awbNumber: string | undefined;
                try {
                  const awbResult = await generateAWBForOrder(orderId);
                  if (awbResult) {
                    awbNumber = awbResult.awbNumber;
                  }
                } catch (awbError) {
                  console.error(`AWB auto-generation failed for order ${orderId}:`, awbError);
                }

                if (awbNumber) {
                  try {
                    const { sendSupplierOrderEmail, sendCustomerShipmentEmail } = await import('./email-service.js');
                    const { createSamedayAPI } = await import('./sameday-api');

                    let awbPdfBuffer: Buffer | undefined;
                    try {
                      const samedayAPI = createSamedayAPI();
                      if (samedayAPI) {
                        awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
                        console.log(`📄 AWB PDF retrieved for Viva order #${orderId}`);
                      }
                    } catch (pdfError) {
                      console.error(`❌ AWB PDF retrieval failed for Viva order #${orderId}:`, pdfError);
                    }

                    const latestOrder = await storage.getOrder(orderId);
                    if (latestOrder) {
                      const supplierGroups = new Map<number | null, { supplierName: string; supplierEmail: string; items: { productName: string; quantity: number }[] }>();

                      for (const item of latestOrder.items) {
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
                            await sendSupplierOrderEmail(group.supplierEmail, group.supplierName, latestOrder, group.items, awbNumber, awbPdfBuffer);
                            console.log(`✅ Supplier email sent to ${group.supplierEmail} for Viva order #${orderId}`);
                          } catch (err) {
                            console.error(`❌ Failed to send supplier email for Viva order #${orderId}:`, err);
                          }
                        }
                      }

                      let invoicePdfBuffer: Buffer | null = null;
                      if (invoiceGenerated && invoiceId) {
                        try {
                          const { createInvoiceService } = await import('./invoice-service.js');
                          const invoiceSvc = await createInvoiceService();
                          invoicePdfBuffer = await invoiceSvc.getInvoicePdf(invoiceId);
                          console.log(`📄 Invoice PDF retrieved for Viva order #${orderId}`);
                        } catch (pdfError) {
                          console.error(`❌ Failed to retrieve invoice PDF for Viva order #${orderId}:`, pdfError);
                        }
                      }

                      const shippingAddr = latestOrder.shippingAddress as any;
                      const billingAddr = latestOrder.billingAddress as any;
                      let customerEmail = '';
                      if (latestOrder.userId) {
                        const user = await storage.getUser(latestOrder.userId);
                        if (user) customerEmail = user.email;
                      }
                      if (!customerEmail) {
                        customerEmail = shippingAddr?.email || billingAddr?.email || '';
                      }

                      if (customerEmail) {
                        try {
                          await sendCustomerShipmentEmail(customerEmail, latestOrder, awbNumber, invoicePdfBuffer, invoiceNumber);
                          console.log(`✅ Customer shipment email sent to ${customerEmail} for Viva order #${orderId}`);
                        } catch (err) {
                          console.error(`❌ Failed to send customer shipment email for Viva order #${orderId}:`, err);
                        }
                      }
                    }
                  } catch (emailError) {
                    console.error(`❌ Failed to send supplier/customer emails for Viva order #${orderId}:`, emailError);
                  }
                } else {
                  console.log(`⚠️ No AWB generated for Viva order #${orderId}, skipping supplier/customer emails`);
                }
                }
              } else {
                console.error(`Viva callback: Could not extract orderId from merchantTrns: "${merchantTrns}"`);
              }
            } else {
              const errorText = await txResponse.text();
              console.error(`Viva transaction verification failed: ${txResponse.status}`, errorText);
            }
          } catch (verifyError) {
            console.error("Error in background Viva verification:", verifyError);
          }
        })();
      } else {
        console.log("Viva callback without transactionId - payment likely failed/cancelled");
        res.redirect("/?payment=failed");
      }
    } catch (error) {
      console.error("Error processing Viva callback:", error);
      res.redirect("/?payment=error");
    }
  });

  // Viva webhook for payment notifications
  app.post("/api/payments/viva/webhook", async (req, res) => {
    try {
      const event = req.body;
      console.log("Viva webhook received:", JSON.stringify(event).slice(0, 500));

      const eventTypeId = event.EventTypeId;
      const eventData = event.EventData;

      if (eventTypeId === 1796) {
        // Transaction Payment Created - payment successful
        const transactionId = eventData?.TransactionId;
        const merchantTrns = eventData?.MerchantTrns || '';
        const orderIdMatch = merchantTrns.match(/order_(\d+)/);

        if (orderIdMatch) {
          const orderId = parseInt(orderIdMatch[1]);
          console.log(`Viva webhook: Payment succeeded for order ${orderId}, transaction ${transactionId}`);

          const existingOrder = await storage.getOrder(orderId);
          if (existingOrder && existingOrder.paymentStatus === 'paid') {
            console.log(`Viva webhook: Order ${orderId} already processed (paid), skipping duplicate`);
          } else {
            await storage.updateOrder(orderId, {
              paymentStatus: 'paid',
              status: 'processing',
            });

            (async () => {
              try {
                let invoiceGenerated = false;
                let invoiceNumber: string | undefined;
                let invoiceId: number | undefined;

                try {
                  if (!invoiceService) {
                    invoiceService = await createInvoiceService();
                  }

                  const invoice = await invoiceService.generateInvoiceAfterPayment(
                    orderId,
                    {
                      status: 'succeeded',
                      paymentMethod: 'viva',
                      paymentId: transactionId,
                      amount: (eventData?.Amount || 0) / 100,
                    }
                  );
                  console.log(`Invoice generated via webhook for order ${orderId}:`, invoice.invoiceNumber);
                  invoiceGenerated = true;
                  invoiceNumber = invoice.invoiceNumber;
                  invoiceId = invoice.id;
                } catch (invoiceError) {
                  console.error(`Failed to generate invoice for order ${orderId}:`, invoiceError);
                }

                let awbNumber: string | undefined;
                try {
                  const awbResult = await generateAWBForOrder(orderId);
                  if (awbResult) {
                    awbNumber = awbResult.awbNumber;
                  }
                } catch (awbError) {
                  console.error(`AWB auto-generation via webhook failed for order ${orderId}:`, awbError);
                }

                if (awbNumber) {
                  try {
                    const { sendSupplierOrderEmail, sendCustomerShipmentEmail } = await import('./email-service.js');
                    const { createSamedayAPI } = await import('./sameday-api');

                    let awbPdfBuffer: Buffer | undefined;
                    try {
                      const samedayAPI = createSamedayAPI();
                      if (samedayAPI) {
                        awbPdfBuffer = await samedayAPI.getAWBPDF(awbNumber);
                      }
                    } catch (pdfError) {
                      console.error(`❌ AWB PDF retrieval failed for webhook order #${orderId}:`, pdfError);
                    }

                    const latestOrder = await storage.getOrder(orderId);
                    if (latestOrder) {
                      const supplierGroups = new Map<number | null, { supplierName: string; supplierEmail: string; items: { productName: string; quantity: number }[] }>();

                      for (const item of latestOrder.items) {
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
                            await sendSupplierOrderEmail(group.supplierEmail, group.supplierName, latestOrder, group.items, awbNumber, awbPdfBuffer);
                            console.log(`✅ Supplier email sent via webhook for order #${orderId}`);
                          } catch (err) {
                            console.error(`❌ Failed to send supplier email via webhook for order #${orderId}:`, err);
                          }
                        }
                      }

                      let invoicePdfBuffer: Buffer | null = null;
                      if (invoiceGenerated && invoiceId) {
                        try {
                          const { createInvoiceService } = await import('./invoice-service.js');
                          const invoiceSvc = await createInvoiceService();
                          invoicePdfBuffer = await invoiceSvc.getInvoicePdf(invoiceId);
                        } catch (pdfError) {
                          console.error(`❌ Failed to retrieve invoice PDF via webhook for order #${orderId}:`, pdfError);
                        }
                      }

                      const shippingAddr = latestOrder.shippingAddress as any;
                      const billingAddr = latestOrder.billingAddress as any;
                      let customerEmail = '';
                      if (latestOrder.userId) {
                        const user = await storage.getUser(latestOrder.userId);
                        if (user) customerEmail = user.email;
                      }
                      if (!customerEmail) {
                        customerEmail = shippingAddr?.email || billingAddr?.email || '';
                      }

                      if (customerEmail) {
                        try {
                          await sendCustomerShipmentEmail(customerEmail, latestOrder, awbNumber, invoicePdfBuffer, invoiceNumber);
                          console.log(`✅ Customer shipment email sent via webhook for order #${orderId}`);
                        } catch (err) {
                          console.error(`❌ Failed to send customer shipment email via webhook for order #${orderId}:`, err);
                        }
                      }
                    }
                  } catch (emailError) {
                    console.error(`❌ Failed to send emails via webhook for order #${orderId}:`, emailError);
                  }
                }
              } catch (error) {
                console.error(`❌ Webhook background processing failed for order #${orderId}:`, error);
              }
            })();
          }
        }
      } else if (eventTypeId === 1798) {
        // Transaction Failed
        const merchantTrns = eventData?.MerchantTrns || '';
        const orderIdMatch = merchantTrns.match(/order_(\d+)/);
        
        if (orderIdMatch) {
          const orderId = parseInt(orderIdMatch[1]);
          console.log(`Viva webhook: Payment failed for order ${orderId}`);
          
          await storage.updateOrder(orderId, {
            paymentStatus: 'failed',
            status: 'cancelled',
          });
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error processing Viva webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Viva webhook verification endpoint (GET - Viva sends verification key check)
  app.get("/api/payments/viva/webhook", async (req, res) => {
    try {
      const merchantId = process.env.VIVA_MERCHANT_ID;
      const apiKey = process.env.VIVA_API_KEY;

      if (!merchantId || !apiKey) {
        return res.status(500).json({ message: "Viva credentials not configured" });
      }

      const verificationResponse = await fetch("https://www.vivapayments.com/api/messages/config/token", {
        headers: {
          "Authorization": "Basic " + Buffer.from(`${merchantId}:${apiKey}`).toString("base64"),
        },
      });

      if (verificationResponse.ok) {
        const verificationData = await verificationResponse.json() as any;
        const key = verificationData.Key || verificationData;
        console.log("Viva webhook verification key retrieved:", key);
        res.json({ Key: key });
      } else {
        const errorText = await verificationResponse.text();
        console.error("Viva verification error:", verificationResponse.status, errorText);
        res.status(500).json({ error: "Verification failed" });
      }
    } catch (error) {
      console.error("Error getting Viva webhook verification:", error);
      res.status(500).send("Verification error");
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
