import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactInquirySchema, insertCareerApplicationSchema, insertBlogPostSchema, insertNewsletterSubscriptionSchema } from "@shared/schema";
import { z } from "zod";
import { sendContactEmails, sendCareerApplicationEmails } from "./email-service.js";
import { hashPassword, verifyPassword, createSession, validateSession, removeSession, generate2FASecret, generateQRCode, verify2FAToken } from "./auth-utils";
import { generateBlogPostManually, generateWeeklyBlogPost } from './ai-blog-generator';
import multer from 'multer';

// Admin authentication middleware
function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.adminToken;
  
  // console.log('Auth check - Token from cookies:', req.cookies?.adminToken);
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  const username = validateSession(token);
  
  if (!username) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
  
  (req as any).adminUser = username;
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactInquirySchema.parse(req.body);
      const inquiry = await storage.createContactInquiry(validatedData);
      
      // Send confirmation emails
      const emailSent = await sendContactEmails(validatedData);
      
      if (emailSent) {
        res.json({ 
          success: true, 
          message: "Thank you for your inquiry! Confirmation emails have been sent. We'll get back to you within 24 hours.",
          id: inquiry.id 
        });
      } else {
        // Even if email fails, still save the inquiry
        res.json({ 
          success: true, 
          message: "Thank you for your inquiry! We've received your message and will get back to you within 24 hours.",
          id: inquiry.id,
          emailWarning: "Email confirmation may be delayed"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false, 
          message: "Please check your form data", 
          errors: error.errors 
        });
      } else {
        console.error("Contact form error:", error);
        res.status(500).json({ 
          success: false, 
          message: "Something went wrong. Please try again." 
        });
      }
    }
  });

  // Get all inquiries (for admin purposes if needed)
  app.get("/api/inquiries", async (req, res) => {
    try {
      const inquiries = await storage.getContactInquiries();
      res.json(inquiries);
    } catch (error) {
      console.error("Get inquiries error:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  // Setup multer for file upload
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf' || 
          file.mimetype === 'application/msword' || 
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF and Word documents are allowed'));
      }
    }
  });

  // Career application submission
  app.post("/api/careers/apply", upload.single('resume'), async (req, res) => {
    try {
      const applicationData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        position: req.body.position,
        experience: req.body.experience,
        coverLetter: req.body.coverLetter,
        resumeFileName: req.file?.originalname || null
      };

      const validatedData = insertCareerApplicationSchema.parse(applicationData);
      const application = await storage.createCareerApplication(validatedData);
      
      // Send confirmation emails
      const emailSent = await sendCareerApplicationEmails(validatedData);
      
      if (emailSent) {
        res.json({ 
          success: true, 
          message: "Thank you for your application! Confirmation emails have been sent. Our HR team will review your submission and contact you soon.",
          id: application.id 
        });
      } else {
        // Even if email fails, still save the application
        res.json({ 
          success: true, 
          message: "Thank you for your application! Our HR team will review your submission and contact you soon.",
          id: application.id,
          emailWarning: "Email confirmation may be delayed"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false, 
          message: "Please check your form data", 
          errors: error.errors 
        });
      } else if (error && typeof error === 'object' && 'code' in error) {
        res.status(400).json({ 
          success: false, 
          message: "File upload error. Please ensure your file is under 5MB and is a PDF or Word document." 
        });
      } else {
        console.error("Career application error:", error);
        res.status(500).json({ 
          success: false, 
          message: "Something went wrong. Please try again." 
        });
      }
    }
  });

  // Get all applications (for admin purposes if needed)
  app.get("/api/careers/applications", async (req, res) => {
    try {
      const applications = await storage.getCareerApplications();
      res.json(applications);
    } catch (error) {
      console.error("Get applications error:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Blog posts endpoints
  app.get("/api/blog/posts", async (req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (error) {
      console.error("Get blog posts error:", error);
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog/posts/:id", async (req, res) => {
    try {
      const post = await storage.getBlogPost(req.params.id);
      if (!post) {
        res.status(404).json({ message: "Blog post not found" });
        return;
      }
      res.json(post);
    } catch (error) {
      console.error("Get blog post error:", error);
      res.status(500).json({ message: "Failed to fetch blog post" });
    }
  });

  app.post("/api/blog/posts", async (req, res) => {
    try {
      const validatedData = insertBlogPostSchema.parse(req.body);
      const post = await storage.createBlogPost(validatedData);
      res.json({ success: true, post });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false, 
          message: "Please check your blog post data", 
          errors: error.errors 
        });
      } else {
        console.error("Create blog post error:", error);
        res.status(500).json({ 
          success: false, 
          message: "Failed to create blog post" 
        });
      }
    }
  });

  // Newsletter subscription endpoints
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const validatedData = insertNewsletterSubscriptionSchema.parse(req.body);
      
      // Check if email already exists
      const existingSubscription = await storage.getNewsletterSubscription(validatedData.email);
      if (existingSubscription) {
        if (existingSubscription.isActive === "true") {
          res.status(409).json({ 
            success: false, 
            message: "This email is already subscribed to our newsletter" 
          });
          return;
        } else {
          // Reactivate subscription
          const updated = await storage.updateNewsletterSubscription(validatedData.email, {
            isActive: "true",
            firstName: validatedData.firstName,
            lastName: validatedData.lastName,
            preferences: validatedData.preferences,
            language: validatedData.language
          });
          if (updated) {
            res.json({ success: true, message: "Welcome back! Your subscription has been reactivated" });
            return;
          }
        }
      }

      const subscription = await storage.createNewsletterSubscription(validatedData);
      
      res.json({ 
        success: true, 
        message: "Thank you for subscribing to our newsletter!",
        subscription: {
          email: subscription.email,
          subscriptionDate: subscription.subscriptionDate
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false, 
          message: "Please provide a valid email address", 
          errors: error.errors 
        });
      } else {
        console.error("Newsletter subscription error:", error);
        res.status(500).json({ 
          success: false, 
          message: "Failed to subscribe to newsletter" 
        });
      }
    }
  });

  app.get("/api/newsletter/subscribers", async (req, res) => {
    try {
      const subscribers = await storage.getNewsletterSubscriptions();
      res.json(subscribers);
    } catch (error) {
      console.error("Get subscribers error:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  });

  // Admin-only newsletter subscriber management
  app.get("/api/admin/newsletter/subscribers", requireAuth, async (req, res) => {
    try {
      const subscribers = await storage.getNewsletterSubscriptions();
      res.json(subscribers);
    } catch (error) {
      console.error("Get admin subscribers error:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  });

  app.patch("/api/admin/newsletter/subscribers/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (!["true", "false"].includes(isActive)) {
        return res.status(400).json({ 
          success: false, 
          message: "isActive must be 'true' or 'false'" 
        });
      }

      const updated = await storage.updateSubscriberStatus(id, isActive);
      if (!updated) {
        return res.status(404).json({ 
          success: false, 
          message: "Subscriber not found" 
        });
      }

      res.json({ 
        success: true, 
        message: `Subscriber ${isActive === "true" ? "activated" : "deactivated"} successfully`,
        subscriber: updated
      });
    } catch (error) {
      console.error("Update subscriber status error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update subscriber status" 
      });
    }
  });

  app.post("/api/newsletter/unsubscribe", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: "Email is required" });
        return;
      }

      const updated = await storage.updateNewsletterSubscription(email, { isActive: "false" });
      if (!updated) {
        res.status(404).json({ success: false, message: "Subscription not found" });
        return;
      }

      res.json({ success: true, message: "Successfully unsubscribed from newsletter" });
    } catch (error) {
      console.error("Unsubscribe error:", error);
      res.status(500).json({ success: false, message: "Failed to unsubscribe" });
    }
  });

  // AI Blog Generation endpoints
  app.post("/api/admin/blog/generate", requireAuth, async (req, res) => {
    try {
      const { topic, category } = req.body;
      console.log(`Admin generating blog post: ${topic || 'auto-generated topic'}`);
      
      const postId = await generateBlogPostManually(topic, category);
      
      res.json({ 
        success: true, 
        message: "Blog post generated successfully", 
        postId 
      });
    } catch (error) {
      console.error("Generate blog post error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate blog post: " + (error as Error).message 
      });
    }
  });

  app.post("/api/admin/blog/generate-weekly", requireAuth, async (req, res) => {
    try {
      console.log("Admin generating weekly blog post");
      
      const postId = await generateWeeklyBlogPost();
      
      res.json({ 
        success: true, 
        message: "Weekly blog post generated successfully", 
        postId 
      });
    } catch (error) {
      console.error("Generate weekly blog post error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate weekly blog post: " + (error as Error).message 
      });
    }
  });

  // Admin authentication routes
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password, twoFactorToken } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      // Direct database query for admin user
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [adminUser] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
      
      if (!adminUser || adminUser.isActive !== "true") {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      const isValidPassword = await verifyPassword(password, adminUser.passwordHash);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Check 2FA if enabled
      if (adminUser.twoFactorEnabled === "true") {
        if (!twoFactorToken) {
          return res.status(200).json({ 
            requiresTwoFactor: true,
            message: 'Two-factor authentication required'
          });
        }
        
        if (!adminUser.twoFactorSecret) {
          return res.status(500).json({ message: '2FA configuration error' });
        }
        
        const isValid2FA = verify2FAToken(twoFactorToken, adminUser.twoFactorSecret);
        if (!isValid2FA) {
          return res.status(401).json({ message: 'Invalid two-factor authentication code' });
        }
      }
      
      const token = createSession(username);
      
      // Update last login
      await db.update(adminUsers)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(adminUsers.username, username));
      
      // Set secure cookie
      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
      
      res.json({ 
        success: true, 
        message: 'Login successful',
        token // Also return token for client-side storage if needed
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post("/api/admin/logout", requireAuth, (req, res) => {
    const token = req.cookies?.adminToken;
    if (token) {
      removeSession(token);
      res.clearCookie('adminToken');
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  app.get("/api/admin/me", requireAuth, async (req, res) => {
    try {
      // Direct database query for admin user
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [adminUser] = await db.select().from(adminUsers).where(eq(adminUsers.username, (req as any).adminUser));
      
      if (!adminUser) {
        return res.status(404).json({ message: 'Admin user not found' });
      }
      
      // Don't send password hash or 2FA secret
      const { passwordHash, twoFactorSecret, ...safeUser } = adminUser;
      res.json(safeUser);
    } catch (error) {
      console.error('Get admin user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // User management routes
  app.get("/api/admin/users", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      
      const allUsers = await db.select().from(adminUsers);
      
      // Remove sensitive data
      const safeUsers = allUsers.map(user => {
        const { passwordHash, twoFactorSecret, ...safeUser } = user;
        return safeUser;
      });
      
      res.json(safeUsers);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post("/api/admin/users", requireAuth, async (req, res) => {
    try {
      const { username, password, role = "admin" } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Check if username already exists
      const [existingUser] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
      if (existingUser) {
        return res.status(409).json({ message: 'Username already exists' });
      }
      
      const hashedPassword = await hashPassword(password);
      
      const [newUser] = await db.insert(adminUsers).values({
        username,
        passwordHash: hashedPassword,
        role,
        isActive: "true",
        twoFactorEnabled: "false"
      }).returning();
      
      const { passwordHash, twoFactorSecret, ...safeUser } = newUser;
      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.patch("/api/admin/users/:userId/password", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: 'Password is required' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const hashedPassword = await hashPassword(password);
      
      const [updatedUser] = await db.update(adminUsers)
        .set({ 
          passwordHash: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(adminUsers.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({ message: 'Failed to update password' });
    }
  });

  app.delete("/api/admin/users/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Check if this is the last admin user
      const allUsers = await db.select().from(adminUsers);
      if (allUsers.length <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
      
      const [deletedUser] = await db.delete(adminUsers)
        .where(eq(adminUsers.id, userId))
        .returning();
      
      if (!deletedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // 2FA setup endpoints
  app.post("/api/admin/users/:userId/2fa/setup", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const secret = generate2FASecret();
      const qrCodeUrl = await generateQRCode(user.username, secret);
      
      // Store the secret temporarily (not enabled yet)
      await db.update(adminUsers)
        .set({ 
          twoFactorSecret: secret,
          updatedAt: new Date()
        })
        .where(eq(adminUsers.id, userId));
      
      res.json({ 
        success: true, 
        secret,
        qrCodeUrl
      });
    } catch (error) {
      console.error('Setup 2FA error:', error);
      res.status(500).json({ message: 'Failed to setup 2FA' });
    }
  });

  app.post("/api/admin/users/:userId/2fa/verify", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }
      
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId));
      if (!user || !user.twoFactorSecret) {
        return res.status(404).json({ message: 'User not found or 2FA not setup' });
      }
      
      const isValidToken = verify2FAToken(token, user.twoFactorSecret);
      if (!isValidToken) {
        return res.status(400).json({ message: 'Invalid token' });
      }
      
      // Enable 2FA
      await db.update(adminUsers)
        .set({ 
          twoFactorEnabled: "true",
          updatedAt: new Date()
        })
        .where(eq(adminUsers.id, userId));
      
      res.json({ success: true, message: '2FA enabled successfully' });
    } catch (error) {
      console.error('Verify 2FA error:', error);
      res.status(500).json({ message: 'Failed to verify 2FA' });
    }
  });

  app.post("/api/admin/users/:userId/2fa/disable", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const { db } = await import("./db");
      const { adminUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      await db.update(adminUsers)
        .set({ 
          twoFactorEnabled: "false",
          twoFactorSecret: null,
          updatedAt: new Date()
        })
        .where(eq(adminUsers.id, userId));
      
      res.json({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
      console.error('Disable 2FA error:', error);
      res.status(500).json({ message: 'Failed to disable 2FA' });
    }
  });

  // Protected admin routes
  app.get("/api/admin/newsletter/subscribers", requireAuth, async (req, res) => {
    try {
      // Direct database query for newsletter subscriptions
      const { db } = await import("./db");
      const { newsletterSubscriptions } = await import("@shared/schema");
      
      const subscribers = await db.select().from(newsletterSubscriptions);
      res.json(subscribers);
    } catch (error) {
      console.error('Get subscribers error:', error);
      res.status(500).json({ message: 'Failed to fetch subscribers' });
    }
  });

  // Admin blog management routes
  app.get("/api/admin/blog/posts", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { blogPosts } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      
      const posts = await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
      res.json(posts);
    } catch (error) {
      console.error('Get blog posts error:', error);
      res.status(500).json({ message: 'Failed to fetch blog posts' });
    }
  });

  app.post("/api/admin/blog/posts", requireAuth, async (req, res) => {
    try {
      const validatedData = insertBlogPostSchema.parse(req.body);
      const post = await storage.createBlogPost(validatedData);
      res.json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid blog post data', errors: error.errors });
        return;
      }
      console.error('Create blog post error:', error);
      res.status(500).json({ message: 'Failed to create blog post' });
    }
  });

  app.put("/api/admin/blog/posts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertBlogPostSchema.partial().parse(req.body);
      const post = await storage.updateBlogPost(id, validatedData);
      res.json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid blog post data', errors: error.errors });
        return;
      }
      console.error('Update blog post error:', error);
      res.status(500).json({ message: 'Failed to update blog post' });
    }
  });

  app.delete("/api/admin/blog/posts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBlogPost(id);
      res.json({ success: true, message: 'Blog post deleted successfully' });
    } catch (error) {
      console.error('Delete blog post error:', error);
      res.status(500).json({ message: 'Failed to delete blog post' });
    }
  });

  // Send newsletter to all subscribers
  app.post("/api/admin/newsletter/send", requireAuth, async (req, res) => {
    try {
      const { subject, content, language = 'en' } = req.body;

      if (!subject || !content) {
        return res.status(400).json({ message: 'Subject and content are required' });
      }

      // Get all active subscribers
      const { db } = await import("./db");
      const { newsletterSubscriptions } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const subscribers = await db.select()
        .from(newsletterSubscriptions)
        .where(eq(newsletterSubscriptions.isActive, "true"));

      if (subscribers.length === 0) {
        return res.json({ success: true, message: 'No active subscribers found', sent: 0 });
      }

      // Send newsletter to each subscriber
      let sentCount = 0;
      let failedCount = 0;

      for (const subscriber of subscribers) {
        try {
          // Generate unsubscribe token
          const unsubscribeToken = Buffer.from(`${subscriber.id}:${subscriber.email}:${Date.now()}`).toString('base64url');
          const unsubscribeUrl = `${req.protocol}://${req.get('host')}/unsubscribe?token=${unsubscribeToken}`;

          // Read logo for embedding
          const fs = await import('fs');
          const path = await import('path');
          let logoBase64 = '';
          
          try {
            // Always read from PNG file directly for consistent results
            const logoPath = path.join(process.cwd(), 'attached_assets', 'logo_mare_1753787900041.png');
            const logoBuffer = fs.readFileSync(logoPath);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            console.log(`Newsletter logo loaded successfully, size: ${logoBuffer.length} bytes`);
          } catch (logoError: unknown) {
            console.log('Newsletter logo file not found, proceeding without logo:', logoError instanceof Error ? logoError.message : String(logoError));
            logoBase64 = '';
          }

          // GDPR-compliant newsletter content
          const newsletterHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${subject}</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
              <!-- Header with Logo -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 30px;">
                <tr>
                  <td style="text-align: center; padding: 20px; background-color: #ffffff; border-bottom: 2px solid #0b0628;">
                    <!-- Company Logo and Brand -->
                    <div style="background-color: #0b0628; color: white; padding: 15px 30px; display: inline-block; border-radius: 8px; font-family: Arial, sans-serif; text-align: center; margin-bottom: 10px;">
                      <h1 style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 2px;">NAMARTE CCL</h1>
                      <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">AI-Powered App Development</p>
                    </div>
                    <p style="color: #666; font-size: 14px; margin: 15px 0 0 0; font-family: Arial, sans-serif;">
                      Professional AI Solutions • Bucharest, Romania
                    </p>
                  </td>
                </tr>
              </table>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h1 style="color: #0b0628; margin-top: 0;">${subject}</h1>
                <div style="white-space: pre-wrap;">${content}</div>
              </div>

              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666;">
                <p><strong>Namarte CCL</strong><br>
                AI-Powered App Development Services<br>
                Bucharest, Romania</p>
                
                <p style="margin-top: 20px;">
                  ${language === 'ro' ? 
                    'Primești acest email pentru că te-ai abonat la newsletter-ul nostru.' : 
                    'You are receiving this email because you subscribed to our newsletter.'
                  }
                </p>
                
                <p>
                  <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">
                    ${language === 'ro' ? 'Dezabonează-te' : 'Unsubscribe'}
                  </a> | 
                  <a href="mailto:dpo@namarteccl.com" style="color: #666; text-decoration: underline;">
                    ${language === 'ro' ? 'Contact DPO' : 'Contact DPO'}
                  </a>
                </p>
                
                <p style="margin-top: 15px; font-size: 11px;">
                  ${language === 'ro' ? 
                    'Conform GDPR, ai dreptul să accesezi, să rectifici, să ștergi datele personale sau să limitezi prelucrarea acestora. Pentru mai multe informații, contactează DPO-ul nostru la dpo@namarteccl.com.' :
                    'Under GDPR, you have the right to access, rectify, delete your personal data or limit its processing. For more information, contact our DPO at dpo@namarteccl.com.'
                  }
                </p>
              </div>
            </body>
            </html>
          `;

          // Send email using SendGrid
          const { sendEmail } = await import("./email-service.js");
          const emailSent = await sendEmail({
            to: subscriber.email,
            from: 'info@namarteccl.com',
            subject: subject,
            html: newsletterHtml,
            text: `${subject}\n\n${content}\n\nUnsubscribe: ${unsubscribeUrl}\n\nNamearte CCL - AI-Powered App Development Services\nBucharest, Romania`
          });

          if (emailSent) {
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (emailError) {
          console.error(`Failed to send newsletter to ${subscriber.email}:`, emailError);
          failedCount++;
        }
      }

      res.json({
        success: true,
        message: `Newsletter sent successfully`,
        sent: sentCount,
        failed: failedCount,
        total: subscribers.length
      });

    } catch (error) {
      console.error('Send newsletter error:', error);
      res.status(500).json({ message: 'Failed to send newsletter' });
    }
  });

  // GDPR-compliant unsubscribe endpoint
  app.get("/unsubscribe", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html><head><title>Invalid Unsubscribe Link</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1>Invalid Unsubscribe Link</h1>
            <p>The unsubscribe link is invalid or has expired.</p>
            <p>If you need assistance, please contact us at <a href="mailto:dpo@namarteccl.com">dpo@namarteccl.com</a></p>
          </body></html>
        `);
      }

      // Decode and validate token
      const decoded = Buffer.from(token as string, 'base64url').toString();
      const [userId, email] = decoded.split(':');

      const { db } = await import("./db");
      const { newsletterSubscriptions } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      // Find and update subscription
      const [subscription] = await db.select()
        .from(newsletterSubscriptions)
        .where(and(
          eq(newsletterSubscriptions.id, userId),
          eq(newsletterSubscriptions.email, email)
        ));

      if (!subscription) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html><head><title>Subscription Not Found</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1>Subscription Not Found</h1>
            <p>We couldn't find your subscription in our database.</p>
            <p>If you need assistance, please contact us at <a href="mailto:dpo@namarteccl.com">dpo@namarteccl.com</a></p>
          </body></html>
        `);
      }

      // Update subscription to inactive
      await db.update(newsletterSubscriptions)
        .set({ 
          isActive: "false", 
          updatedAt: new Date() 
        })
        .where(eq(newsletterSubscriptions.id, userId));

      // Send GDPR-compliant unsubscribe confirmation
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Successfully Unsubscribed</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 40px; }
            .container { background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center; }
            .logo { width: 150px; margin-bottom: 20px; }
            h1 { color: #0b0628; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Successfully Unsubscribed</h1>
            <p>You have been successfully removed from our newsletter mailing list.</p>
            <p><strong>Email:</strong> ${email}</p>
            <p>You will no longer receive marketing emails from Namarte CCL.</p>
            
            <div style="margin: 30px 0; padding: 20px; background: #e3f2fd; border-radius: 6px;">
              <h3 style="margin-top: 0; color: #1976d2;">Your GDPR Rights</h3>
              <p style="text-align: left; font-size: 14px;">
                Under the General Data Protection Regulation (GDPR), you have the following rights regarding your personal data:
              </p>
              <ul style="text-align: left; font-size: 14px;">
                <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
                <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
                <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
                <li><strong>Right to Restrict Processing:</strong> Request limitation of data processing</li>
                <li><strong>Right to Data Portability:</strong> Receive your data in a structured format</li>
                <li><strong>Right to Object:</strong> Object to processing of your personal data</li>
              </ul>
            </div>

            <p>To exercise any of these rights or if you have questions about our data practices, please contact our Data Protection Officer (DPO) at:</p>
            <p><a href="mailto:dpo@namarteccl.com" style="color: #1976d2;">dpo@namarteccl.com</a></p>
            
            <div class="footer">
              <p><strong>Namarte CCL</strong><br>
              AI-Powered App Development Services<br>
              Company Registration: RO16582983<br>
              Bucharest, Romania</p>
              
              <p>This confirmation page complies with GDPR Article 7(3) requirements for withdrawal of consent.</p>
            </div>
          </div>
        </body>
        </html>
      `);

    } catch (error) {
      console.error('Unsubscribe error:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html><head><title>Unsubscribe Error</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
          <h1>Error Processing Unsubscribe</h1>
          <p>We encountered an error while processing your unsubscribe request.</p>
          <p>Please contact us directly at <a href="mailto:dpo@namarteccl.com">dpo@namarteccl.com</a></p>
        </body></html>
      `);
    }
  });

  // Register AI Agent routes
  const aiAgentRoutes = await import('./ai-agent-routes');
  app.use('/api/ai-agent', aiAgentRoutes.default);

  const httpServer = createServer(app);
  return httpServer;
}
