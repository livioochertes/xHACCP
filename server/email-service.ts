import { MailService } from '@sendgrid/mail';
import type { OrderWithItems, User } from '../shared/schema';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const VERIFIED_SENDER = process.env.SENDGRID_FROM_EMAIL;

let mailService: MailService | null = null;

if (!SENDGRID_API_KEY) {
  console.warn("Warning: SENDGRID_API_KEY environment variable is not set. Email sending will be disabled.");
} else if (!VERIFIED_SENDER) {
  console.warn("Warning: SENDGRID_FROM_EMAIL environment variable is not set. Email sending will be disabled.");
} else {
  mailService = new MailService();
  mailService.setApiKey(SENDGRID_API_KEY);
  console.log(`Email service initialized with verified sender: ${VERIFIED_SENDER}`);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!mailService) {
    console.warn("Email service not configured. Skipping email send.");
    return false;
  }
  try {
    console.log(`Attempting to send email: from=${params.from}, to=${params.to}, subject=${params.subject.substring(0, 50)}...`);
    
    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    };
    
    if (params.replyTo) {
      emailData.replyTo = params.replyTo;
    }
    
    await mailService.send(emailData);
    console.log(`✅ Email sent successfully to: ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('❌ SendGrid email error:', {
      code: error.code,
      message: error.message,
      response: error.response?.body,
      to: params.to,
      from: params.from
    });
    
    // More detailed error information for debugging
    if (error.response?.body?.errors) {
      console.error('SendGrid error details:', error.response.body.errors);
    }
    
    return false;
  }
}

export async function sendOrderConfirmationEmail(
  order: OrderWithItems,
  user: User
): Promise<boolean> {
  const shippingAddress = order.shippingAddress as any;
  const billingAddress = order.billingAddress as any;
  
  const orderItemsHtml = order.items
    .map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.totalPrice}</td>
      </tr>
    `)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #27ae60; margin-top: 0;">Order Confirmation</h2>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Hello ${user.firstName} ${user.lastName},</h3>
        <p>Thank you for your order! We're pleased to confirm that your order has been accepted and is now being processed.</p>
        
        <div style="margin: 20px 0;">
          <strong>Order Details:</strong><br>
          Order ID: #${order.id}<br>
          Order Date: ${new Date(order.createdAt!).toLocaleDateString()}<br>
          Status: <span style="color: #27ae60; font-weight: bold;">Accepted</span><br>
          Customer Email: ${user.email}<br>
          Contact Phone: ${shippingAddress.phone}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50;">Order Items:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 12px 8px; text-align: right; font-weight: bold; border-top: 2px solid #dee2e6;">
                Total Amount:
              </td>
              <td style="padding: 12px 8px; text-align: right; font-weight: bold; border-top: 2px solid #dee2e6;">
                $${order.totalAmount}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #2c3e50;">Delivery Address</h4>
          <p style="margin: 0; line-height: 1.5;">
            ${shippingAddress.firstName} ${shippingAddress.lastName}<br>
            ${shippingAddress.address}<br>
            ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}<br>
            ${shippingAddress.country}<br>
            <strong>Phone:</strong> ${shippingAddress.phone}
          </p>
        </div>
        
        <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #2c3e50;">Billing Address</h4>
          <p style="margin: 0; line-height: 1.5;">
            ${billingAddress.firstName} ${billingAddress.lastName}<br>
            ${billingAddress.address}<br>
            ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}<br>
            ${billingAddress.country}<br>
            <strong>Phone:</strong> ${billingAddress.phone}
          </p>
        </div>
      </div>

      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #27ae60;">What's Next?</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Our team will prepare your order for shipping</li>
          <li>You'll receive a shipping confirmation with tracking information</li>
          <li>Your order will be delivered to the address provided</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666;">
          Questions about your order? Contact us at 
          <a href="mailto:info@xhaccp.com" style="color: #27ae60;">info@xhaccp.com</a>
        </p>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          Thank you for choosing xHACCP - Your Professional Kitchen Partner
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    xHACCP - Order Confirmation
    
    Hello ${user.firstName} ${user.lastName},
    
    Thank you for your order! We're pleased to confirm that your order has been accepted and is now being processed.
    
    Order Details:
    - Order ID: #${order.id}
    - Order Date: ${new Date(order.createdAt!).toLocaleDateString()}
    - Status: Accepted
    - Customer Email: ${user.email}
    - Contact Phone: ${shippingAddress.phone}
    - Total Amount: $${order.totalAmount}
    
    Delivery Address:
    ${shippingAddress.firstName} ${shippingAddress.lastName}
    ${shippingAddress.address}
    ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}
    ${shippingAddress.country}
    Phone: ${shippingAddress.phone}
    
    Billing Address:
    ${billingAddress.firstName} ${billingAddress.lastName}
    ${billingAddress.address}
    ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}
    ${billingAddress.country}
    Phone: ${billingAddress.phone}
    
    Your order will be prepared for shipping and you'll receive tracking information soon.
    
    Questions? Contact us at info@xhaccp.com
    
    Thank you for choosing xHACCP!
  `;

  return await sendEmail({
    to: user.email,
    from: VERIFIED_SENDER,
    subject: `Order Confirmation #${order.id} - xHACCP`,
    text: textContent,
    html: html,
  });
}

export async function sendNewOrderNotificationEmail(
  order: OrderWithItems,
  user: User,
  logisticsEmail?: string
): Promise<boolean> {
  // Get logistics email from company settings if not provided
  if (!logisticsEmail) {
    logisticsEmail = await getLogisticsEmailFromSettings() || 'liviu.chertes@gmail.com';
  }
  const shippingAddress = order.shippingAddress as any;
  const billingAddress = order.billingAddress as any;
  
  // Create admin URL for order management
  const adminOrderUrl = `https://xhaccp.com/admin#orders-${order.id}`;
  
  const orderItemsText = order.items
    .map(item => `- ${item.product.name} (Qty: ${item.quantity}) - ${item.totalPrice} lei`)
    .join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Order Created - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #f39c12; margin-top: 0;">🔔 New Order Created</h2>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="margin-top: 0; color: #856404;">Order Awaiting Review</h3>
        <p><strong>Order ID:</strong> #${order.id}</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt!).toLocaleDateString()}</p>
        <p><strong>Customer:</strong> ${user.firstName} ${user.lastName}</p>
        <p><strong>Customer Email:</strong> ${user.email}</p>
        <p><strong>Customer Phone:</strong> ${shippingAddress.phone}</p>
        <p><strong>Total Amount:</strong> ${order.totalAmount} lei</p>
        <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
        <p><strong>Status:</strong> <span style="color: #f39c12; font-weight: bold;">PENDING REVIEW</span></p>
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${adminOrderUrl}" 
           style="display: inline-block; background-color: #27ae60; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          🎯 VIEW & ACCEPT ORDER
        </a>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          Click the button above to review and accept this order
        </p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50;">Order Items:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Quantity</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Unit Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product.name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price} lei</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.totalPrice} lei</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #2c3e50;">Delivery Address</h4>
          <p style="margin: 0; line-height: 1.5;">
            ${shippingAddress.firstName} ${shippingAddress.lastName}<br>
            ${shippingAddress.address}<br>
            ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}<br>
            ${shippingAddress.country}<br>
            <strong>Phone:</strong> ${shippingAddress.phone}
          </p>
        </div>
        
        <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #2c3e50;">Billing Address</h4>
          <p style="margin: 0; line-height: 1.5;">
            ${billingAddress.firstName} ${billingAddress.lastName}<br>
            ${billingAddress.address}<br>
            ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}<br>
            ${billingAddress.country}<br>
            <strong>Phone:</strong> ${billingAddress.phone || shippingAddress.phone}
          </p>
        </div>
      </div>

      ${order.notes ? `
        <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #0c5460;">Customer Notes</h3>
          <p style="margin: 0;">${order.notes}</p>
        </div>
      ` : ''}

      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #856404;">🚨 Action Required</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li><strong>Review order details above</strong></li>
          <li><strong>Click "VIEW & ACCEPT ORDER" button</strong></li>
          <li><strong>Verify product availability</strong></li>
          <li><strong>Accept the order to begin processing</strong></li>
        </ol>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666;">
          Direct admin link: 
          <a href="${adminOrderUrl}" style="color: #27ae60;">xhaccp.com/admin#orders-${order.id}</a>
        </p>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          xHACCP - Order Management System
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    xHACCP - New Order Created
    
    🔔 NEW ORDER AWAITING REVIEW
    
    Order Details:
    - Order ID: #${order.id}
    - Order Date: ${new Date(order.createdAt!).toLocaleDateString()}
    - Customer: ${user.firstName} ${user.lastName}
    - Customer Email: ${user.email}
    - Customer Phone: ${shippingAddress.phone}
    - Total Amount: ${order.totalAmount} lei
    - Payment Method: ${order.paymentMethod}
    - Status: PENDING REVIEW
    
    Items Ordered:
    ${orderItemsText}
    
    Delivery Address:
    ${shippingAddress.firstName} ${shippingAddress.lastName}
    ${shippingAddress.address}
    ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}
    ${shippingAddress.country}
    Phone: ${shippingAddress.phone}
    
    Billing Address:
    ${billingAddress.firstName} ${billingAddress.lastName}
    ${billingAddress.address}
    ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}
    ${billingAddress.country}
    Phone: ${billingAddress.phone || shippingAddress.phone}
    
    ${order.notes ? `Customer Notes: ${order.notes}` : ''}
    
    🚨 ACTION REQUIRED:
    1. Review order details above
    2. Access admin panel: ${adminOrderUrl}
    3. Verify product availability
    4. Accept the order to begin processing
    
    Direct link: xhaccp.com/admin#orders-${order.id}
  `;

  return await sendEmail({
    to: logisticsEmail,
    from: VERIFIED_SENDER,
    subject: `🔔 New Order #${order.id} - Awaiting Review & Acceptance`,
    text: textContent,
    html: html,
  });
}

export async function sendLogisticsNotificationEmail(
  order: OrderWithItems,
  user: User,
  logisticsEmail?: string
): Promise<boolean> {
  // Get logistics email from company settings if not provided
  if (!logisticsEmail) {
    logisticsEmail = await getLogisticsEmailFromSettings() || 'liviu.chertes@gmail.com';
  }
  const shippingAddress = order.shippingAddress as any;
  const orderItemsText = order.items
    .map(item => `- ${item.product.name} (Qty: ${item.quantity}) - $${item.totalPrice}`)
    .join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Order for Processing - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #e74c3c; margin-top: 0;">New Order for Processing</h2>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="margin-top: 0; color: #856404;">Order Accepted - Ready for Processing</h3>
        <p><strong>Order ID:</strong> #${order.id}</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt!).toLocaleDateString()}</p>
        <p><strong>Customer:</strong> ${user.firstName} ${user.lastName}</p>
        <p><strong>Customer Email:</strong> ${user.email}</p>
        <p><strong>Customer Phone:</strong> ${shippingAddress.phone}</p>
        <p><strong>Total Amount:</strong> $${order.totalAmount}</p>
        <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
        <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #2c3e50;">Items to Prepare:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Quantity</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Unit Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product.name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.totalPrice}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Shipping Information</h3>
        <p style="margin: 0; line-height: 1.5;">
          <strong>Deliver to:</strong><br>
          ${shippingAddress.firstName} ${shippingAddress.lastName}<br>
          ${shippingAddress.streetAddress}<br>
          ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}<br>
          ${shippingAddress.country}
        </p>
      </div>

      ${order.notes ? `
        <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #0c5460;">Special Notes</h3>
          <p style="margin: 0;">${order.notes}</p>
        </div>
      ` : ''}

      <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #155724;">Next Steps</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li>Verify product availability and prepare items</li>
          <li>Package the order securely</li>
          <li>Generate shipping label and tracking number</li>
          <li>Update order status to "shipped" in the system</li>
          <li>Send tracking information to customer</li>
        </ol>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666;">
          Access the admin panel at 
          <a href="https://xhaccp.com/admin" style="color: #e74c3c;">xhaccp.com/admin</a>
          to manage this order
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    xHACCP - New Order for Processing
    
    ORDER ACCEPTED - READY FOR PROCESSING
    
    Order Details:
    - Order ID: #${order.id}
    - Order Date: ${new Date(order.createdAt!).toLocaleDateString()}
    - Customer: ${user.firstName} ${user.lastName}
    - Customer Email: ${user.email}
    - Customer Phone: ${shippingAddress.phone}
    - Total Amount: $${order.totalAmount}
    - Payment Method: ${order.paymentMethod}
    - Payment Status: ${order.paymentStatus}
    
    Items to Prepare:
    ${orderItemsText}
    
    Shipping Address:
    ${shippingAddress.firstName} ${shippingAddress.lastName}
    ${shippingAddress.address}
    ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}
    ${shippingAddress.country}
    Phone: ${shippingAddress.phone}
    
    ${order.notes ? `Special Notes: ${order.notes}` : ''}
    
    Next Steps:
    1. Verify product availability and prepare items
    2. Package the order securely
    3. Generate shipping label and tracking number
    4. Update order status to "shipped" in the system
    5. Send tracking information to customer
    
    Access the admin panel at xhaccp.com/admin to manage this order.
  `;

  return await sendEmail({
    to: logisticsEmail,
    from: VERIFIED_SENDER,
    subject: `New Order #${order.id} - Ready for Processing`,
    text: textContent,
    html: html,
  });
}

// Helper function to get logistics email from company settings
async function getLogisticsEmailFromSettings(): Promise<string | null> {
  try {
    const { pool } = await import('./db.js');
    const result = await pool.query('SELECT logistics_email FROM company_settings ORDER BY created_at DESC LIMIT 1');
    return result.rows.length > 0 ? result.rows[0].logistics_email : null;
  } catch (error) {
    console.error('Error fetching logistics email from settings:', error);
    return null;
  }
}

export async function sendNotificationPreferencesEmail(
  user: User,
  preferences: {
    emailNotifications: boolean;
    orderUpdates: boolean;
    productRestocks: boolean;
    priceDrops: boolean;
    promotions: boolean;
  }
): Promise<boolean> {
  const preferencesHtml = `
    <ul style="list-style-type: none; padding: 0;">
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>Email notifications:</strong> 
        <span style="color: ${preferences.emailNotifications ? '#27ae60' : '#e74c3c'};">
          ${preferences.emailNotifications ? 'Enabled' : 'Disabled'}
        </span>
      </li>
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>Order updates:</strong> 
        <span style="color: ${preferences.orderUpdates ? '#27ae60' : '#e74c3c'};">
          ${preferences.orderUpdates ? 'Enabled' : 'Disabled'}
        </span>
      </li>
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>Product restocks:</strong> 
        <span style="color: ${preferences.productRestocks ? '#27ae60' : '#e74c3c'};">
          ${preferences.productRestocks ? 'Enabled' : 'Disabled'}
        </span>
      </li>
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>Price drops:</strong> 
        <span style="color: ${preferences.priceDrops ? '#27ae60' : '#e74c3c'};">
          ${preferences.priceDrops ? 'Enabled' : 'Disabled'}
        </span>
      </li>
      <li style="padding: 8px 0;">
        <strong>Promotions:</strong> 
        <span style="color: ${preferences.promotions ? '#27ae60' : '#e74c3c'};">
          ${preferences.promotions ? 'Enabled' : 'Disabled'}
        </span>
      </li>
    </ul>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Notification Preferences Updated - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #27ae60; margin-top: 0;">Notification Preferences Updated</h2>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Hello ${user.firstName} ${user.lastName},</h3>
        <p>Your notification preferences have been successfully updated. Here are your current settings:</p>
      </div>

      <div style="margin-bottom: 20px; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Current Notification Settings:</h3>
        ${preferencesHtml}
      </div>

      <div style="margin-top: 30px; padding: 15px; background-color: #e8f5e8; border-radius: 8px;">
        <p style="margin: 0; color: #2c3e50;">
          <strong>Need to make changes?</strong><br>
          You can update your notification preferences anytime by visiting your account settings.
        </p>
      </div>
      
      <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
        <p>This is a confirmation email from xHACCP.</p>
        <p>© 2025 xHACCP. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: user.email,
    from: VERIFIED_SENDER,
    subject: 'Notification Preferences Updated - xHACCP',
    html,
    text: `Hello ${user.firstName}, your notification preferences have been updated successfully. Email notifications: ${preferences.emailNotifications ? 'Enabled' : 'Disabled'}, Order updates: ${preferences.orderUpdates ? 'Enabled' : 'Disabled'}, Product restocks: ${preferences.productRestocks ? 'Enabled' : 'Disabled'}, Price drops: ${preferences.priceDrops ? 'Enabled' : 'Disabled'}, Promotions: ${preferences.promotions ? 'Enabled' : 'Disabled'}.`
  });
}

// Contact form email interface
interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  category: string;
  message: string;
  orderNumber?: string;
}

// Send contact form emails - to business and confirmation to customer
export async function sendContactFormEmails(data: ContactFormData): Promise<{ toBusinessSent: boolean; toCustomerSent: boolean }> {
  const BUSINESS_EMAIL = 'info@xhaccp.com';
  const ticketId = `TICKET_${Date.now()}`;
  const timestamp = new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' });

  // Email to business (info@xhaccp.com)
  const businessHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Mesaj nou de contact - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #e74c3c; margin-top: 0;">📩 Mesaj nou de contact</h2>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="margin-top: 0; color: #856404;">Detalii Contact</h3>
        <p><strong>ID Ticket:</strong> ${ticketId}</p>
        <p><strong>Data:</strong> ${timestamp}</p>
        <p><strong>Nume:</strong> ${data.name}</p>
        <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
        <p><strong>Telefon:</strong> ${data.phone || 'Nu a fost furnizat'}</p>
        <p><strong>Categorie:</strong> ${data.category}</p>
        <p><strong>Subiect:</strong> ${data.subject}</p>
        ${data.orderNumber ? `<p><strong>Număr comandă:</strong> #${data.orderNumber}</p>` : ''}
      </div>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Mesaj:</h3>
        <p style="white-space: pre-wrap; margin: 0;">${data.message}</p>
      </div>

      <div style="background-color: #d4edda; padding: 15px; border-radius: 8px;">
        <p style="margin: 0; color: #155724;">
          <strong>Acțiune necesară:</strong> Răspundeți clientului în termen de 24 de ore.
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666; font-size: 14px;">
          Răspundeți direct la acest email pentru a contacta clientul.
        </p>
      </div>
    </body>
    </html>
  `;

  const businessText = `
    xHACCP - Mesaj nou de contact
    
    ID Ticket: ${ticketId}
    Data: ${timestamp}
    
    Detalii Contact:
    - Nume: ${data.name}
    - Email: ${data.email}
    - Telefon: ${data.phone || 'Nu a fost furnizat'}
    - Categorie: ${data.category}
    - Subiect: ${data.subject}
    ${data.orderNumber ? `- Număr comandă: #${data.orderNumber}` : ''}
    
    Mesaj:
    ${data.message}
    
    Răspundeți clientului în termen de 24 de ore.
  `;

  // Confirmation email to customer
  const customerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Confirmare mesaj - xHACCP</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin-bottom: 10px;">xHACCP</h1>
        <h2 style="color: #27ae60; margin-top: 0;">✅ Am primit mesajul dumneavoastră</h2>
      </div>
      
      <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #155724;">Bună ${data.name},</h3>
        <p>Vă mulțumim că ne-ați contactat! Am primit mesajul dumneavoastră și vă vom răspunde în cel mai scurt timp posibil, de obicei în 24 de ore.</p>
        <p><strong>ID Ticket:</strong> ${ticketId}</p>
      </div>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2c3e50;">Rezumat mesaj trimis:</h3>
        <p><strong>Categorie:</strong> ${data.category}</p>
        <p><strong>Subiect:</strong> ${data.subject}</p>
        ${data.orderNumber ? `<p><strong>Număr comandă:</strong> #${data.orderNumber}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
        <p><strong>Mesaj:</strong></p>
        <p style="white-space: pre-wrap; background-color: #fff; padding: 10px; border-radius: 4px; border: 1px solid #eee;">${data.message}</p>
      </div>

      <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #0c5460;">Aveți nevoie de ajutor urgent?</h3>
        <p style="margin: 0;">Dacă aveți întrebări urgente, ne puteți contacta la:</p>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Email: <a href="mailto:info@xhaccp.com" style="color: #27ae60;">info@xhaccp.com</a></li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666;">
          Vă mulțumim că ați ales xHACCP!
        </p>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          © 2025 xHACCP. Toate drepturile rezervate.
        </p>
      </div>
    </body>
    </html>
  `;

  const customerText = `
    xHACCP - Confirmare mesaj
    
    Bună ${data.name},
    
    Vă mulțumim că ne-ați contactat! Am primit mesajul dumneavoastră și vă vom răspunde în cel mai scurt timp posibil, de obicei în 24 de ore.
    
    ID Ticket: ${ticketId}
    
    Rezumat mesaj trimis:
    - Categorie: ${data.category}
    - Subiect: ${data.subject}
    ${data.orderNumber ? `- Număr comandă: #${data.orderNumber}` : ''}
    
    Mesaj:
    ${data.message}
    
    Aveți nevoie de ajutor urgent?
    Email: info@xhaccp.com
    
    Vă mulțumim că ați ales xHACCP!
  `;

  // Send both emails
  console.log(`📧 Sending contact form emails - Business: ${BUSINESS_EMAIL}, Customer: ${data.email}`);
  
  const toBusinessSent = await sendEmail({
    to: BUSINESS_EMAIL,
    from: VERIFIED_SENDER,
    subject: `📩 [${data.category}] ${data.subject} - ${data.name}`,
    text: businessText,
    html: businessHtml,
    replyTo: data.email, // Allow direct reply to customer
  });

  const toCustomerSent = await sendEmail({
    to: data.email,
    from: VERIFIED_SENDER,
    subject: `Confirmare mesaj - xHACCP (${ticketId})`,
    text: customerText,
    html: customerHtml,
  });

  console.log(`📧 Contact form email results - toBusiness: ${toBusinessSent}, toCustomer: ${toCustomerSent}`);
  return { toBusinessSent, toCustomerSent };
}