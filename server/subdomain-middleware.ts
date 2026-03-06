import { Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Subdomain detection middleware
export function subdomainMiddleware(req: Request, res: Response, next: NextFunction) {
  const host = req.get('host');
  const subdomain = extractSubdomain(host);
  
  // Add subdomain info to request
  (req as any).subdomain = subdomain;
  
  next();
}

function extractSubdomain(host: string | undefined): string | null {
  if (!host) return null;
  
  // Handle localhost development
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return null;
  }
  
  const parts = host.split('.');
  
  // For xhaccp.com, admin.xhaccp.com
  if (parts.length >= 3 && parts[parts.length - 2] === 'xhaccp') {
    return parts[0];
  }
  
  // Handle Replit domains - admin.xhaccp.replit.app
  if (parts.length >= 4 && parts[parts.length - 3] === 'xhaccp' && parts[parts.length - 2] === 'replit') {
    return parts[0];
  }
  
  // Handle other deployment scenarios
  if (parts.length >= 2 && parts[0] === 'admin') {
    return 'admin';
  }
  
  return null;
}

// Admin subdomain handler
export function adminSubdomainHandler(req: Request, res: Response, next: NextFunction) {
  const subdomain = (req as any).subdomain;
  
  if (subdomain === 'admin') {
    // Serve admin application
    serveAdminApp(req, res, next);
  } else {
    // Continue to main application
    next();
  }
}

function serveAdminApp(req: Request, res: Response, next: NextFunction) {
  // If it's an API request, let it go through to the admin routes
  if (req.path.startsWith('/admin/api/')) {
    console.log("Admin API request detected, passing through:", req.path);
    return next();
  }
  
  // For asset requests, let them go through normal static handling
  if (req.path.startsWith('/src/') || req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.svg') || req.path.endsWith('.png') || req.path.endsWith('.ico')) {
    return next();
  }
  
  // For admin subdomain, serve the admin index.html
  try {
    // Try different possible paths for admin index.html
    const possiblePaths = [
      path.resolve('./admin/index.html'),
      path.join(__dirname, '..', 'admin', 'index.html'),
      path.join(process.cwd(), 'admin', 'index.html'),
      path.resolve('./client/admin/index.html'),
      path.join(__dirname, '..', 'client', 'admin', 'index.html'),
      path.join(process.cwd(), 'client', 'admin', 'index.html'),
      path.join(__dirname, '..', 'dist', 'admin', 'index.html'),
      path.join(process.cwd(), 'dist', 'admin', 'index.html')
    ];
    
    // Try each path until one works
    for (const htmlPath of possiblePaths) {
      try {
        res.sendFile(htmlPath);
        return;
      } catch (error) {
        continue;
      }
    }
    
    // If no admin index.html found, create a minimal one
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>xHACCP Admin</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 400px; margin: 50px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 20px; }
    .info { background: #e3f2fd; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    .button { background: #2196F3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
    .button:hover { background: #1976D2; }
  </style>
</head>
<body>
  <div class="container">
    <h1>xHACCP Admin</h1>
    <div class="info">
      <p><strong>Admin Access:</strong></p>
      <p>Email: admin@xhaccp.com</p>
      <p>Password: admin123</p>
    </div>
    <p>The admin interface is being loaded. If you see this message, please access the admin panel directly at:</p>
    <a href="/admin" class="button">Go to Admin Panel</a>
  </div>
</body>
</html>`);
  } catch (error) {
    console.error('Error serving admin app:', error);
    res.status(500).send('Admin interface temporarily unavailable');
  }
}