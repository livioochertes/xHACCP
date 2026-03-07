import { db } from "./db";
import { categories, categoryTranslations, products, users, orders, orderItems, invoices, invoiceItems } from "../shared/schema";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  try {
    // Check if data already exists to prevent overwriting user data
    const existingUsers = await db.select().from(users);
    const existingCategories = await db.select().from(categories);
    const existingProducts = await db.select().from(products);
    
    // Only seed if no data exists (first run)
    if (existingUsers.length > 0 || existingCategories.length > 0 || existingProducts.length > 0) {
      console.log("🔄 Database already contains data, skipping seeding to preserve user data");
      return;
    }

    console.log("🌱 First run detected, seeding database with sample data...");



    // Create categories with homepage positioning
    const insertedCategories = await db.insert(categories).values([
      {
        name: "Food Labels",
        slug: "food-labels",
        description: "Professional food labeling solutions for restaurants and food service",
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop",
        showOnMainTop: true,
        showOnMainShop: true,
        sortOrder: 2
      },
      {
        name: "HACCP Equipment",
        slug: "haccp-equipment",
        description: "Essential equipment for HACCP compliance and food safety",
        imageUrl: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=400&h=300&fit=crop",
        showOnMainTop: true,
        showOnMainShop: true,
        sortOrder: 3
      },
      {
        name: "Kitchen Supplies",
        slug: "kitchen-supplies",
        description: "Professional kitchen tools and supplies for commercial use",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop",
        showOnMainTop: false,
        showOnMainShop: false,
        sortOrder: 0
      },
      {
        name: "Cleaning & Sanitizing",
        slug: "cleaning-sanitizing",
        description: "Professional cleaning and sanitizing products for food service",
        imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=300&fit=crop",
        showOnMainTop: true,
        showOnMainShop: true,
        sortOrder: 1
      },
      {
        name: "Storage Solutions",
        slug: "storage-solutions",
        description: "Food storage containers and organization systems",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
        showOnMainTop: true,
        showOnMainShop: false,
        sortOrder: 4
      }
    ]).returning();

    // Create sample products
    const sampleProducts = [
      // Food Labels
      {
        name: "Expiration Date Labels - 500 pack",
        slug: "expiration-date-labels-500",
        description: "Professional expiration date labels for food safety compliance. Waterproof and freezer-safe.",
        price: "24.99",
        compareAtPrice: "29.99",
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[0].id,
        inStock: true,
        stockQuantity: 150,
        featured: true,
        rating: "4.8",
        reviewCount: 24,
        vatValue: "21.00",
        productCode: "FDL-EXP-500",
        ncCode: "4821.10.90",
        cpvCode: "39224110-8",
        status: "active"
      },
      {
        name: "Day of the Week Labels - Complete Set",
        slug: "day-of-week-labels-set",
        description: "Color-coded day of the week labels for easy food rotation. Complete 7-day set.",
        price: "19.99",
        compareAtPrice: "24.99",
        imageUrl: "https://images.unsplash.com/photo-1543362906-acfc16c67564?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[0].id,
        inStock: true,
        stockQuantity: 200,
        featured: true,
        rating: "4.7",
        reviewCount: 18,
        vatValue: "21.00",
        productCode: "FDL-DOW-SET",
        ncCode: "4821.10.90",
        cpvCode: "39224110-8",
        status: "inactive"
      },
      {
        name: "Custom Food Labels - 1000 pack",
        slug: "custom-food-labels-1000",
        description: "Customizable food labels with your restaurant name. Professional quality.",
        price: "45.99",
        compareAtPrice: "55.99",
        imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[0].id,
        inStock: true,
        stockQuantity: 75,
        featured: false,
        rating: "4.9",
        reviewCount: 31,
        vatValue: "21.00",
        productCode: "FDL-CST-1000",
        ncCode: "4821.10.90",
        cpvCode: "39224110-8",
        status: "draft"
      },
      
      // HACCP Equipment
      {
        name: "Digital Food Thermometer",
        slug: "digital-food-thermometer",
        description: "Instant-read digital thermometer for HACCP temperature monitoring. Waterproof design.",
        price: "34.99",
        compareAtPrice: "39.99",
        imageUrl: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[1].id,
        inStock: true,
        stockQuantity: 120,
        featured: true,
        rating: "4.6",
        reviewCount: 42,
        vatValue: "21.00",
        productCode: "HACP-THM-DIG",
        ncCode: "9025.19.80",
        cpvCode: "38500000-8",
        status: "active"
      },
      {
        name: "Temperature Log Book",
        slug: "temperature-log-book",
        description: "Professional temperature logging book for HACCP compliance. 100 pages.",
        price: "12.99",
        compareAtPrice: "15.99",
        imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[1].id,
        inStock: true,
        stockQuantity: 300,
        featured: false,
        rating: "4.5",
        reviewCount: 15,
        vatValue: "21.00",
        productCode: "HACP-LOG-100",
        ncCode: "4820.10.90",
        cpvCode: "30192140-8",
        status: "discontinued"
      },
      {
        name: "Infrared Thermometer Gun",
        slug: "infrared-thermometer-gun",
        description: "Non-contact infrared thermometer for quick temperature checks. Professional grade.",
        price: "89.99",
        compareAtPrice: "109.99",
        imageUrl: "https://images.unsplash.com/photo-1585435557343-3b092031d4c1?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[1].id,
        inStock: true,
        stockQuantity: 45,
        featured: true,
        rating: "4.8",
        reviewCount: 38,
        vatValue: "21.00",
        productCode: "HACP-CLN-SOL",
        ncCode: "3402.20.90",
        cpvCode: "39831200-8",
        status: "active"
      },
      
      // Kitchen Supplies
      {
        name: "Commercial Cutting Board Set",
        slug: "commercial-cutting-board-set",
        description: "Color-coded cutting boards for preventing cross-contamination. NSF certified.",
        price: "67.99",
        compareAtPrice: "79.99",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
        categoryId: insertedCategories[2].id,
        inStock: true,
        stockQuantity: 85,
        featured: true,
        rating: "4.7",
        reviewCount: 29,
        vatValue: "21.00",
        productCode: "KIT-CUT-SET",
        ncCode: "3926.90.97",
        cpvCode: "39224400-2",
        status: "draft"
      },
      {
        name: "Professional Chef Knife Set",
        slug: "professional-chef-knife-set",
        description: "High-quality stainless steel knife set for professional kitchens. Includes sharpener.",
        price: "124.99",
        compareAtPrice: "149.99",
        imageUrl: "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[2].id,
        inStock: true,
        stockQuantity: 35,
        featured: false,
        rating: "4.9",
        reviewCount: 56,
        vatValue: "21.00",
        productCode: "KIT-KNF-SET",
        ncCode: "8211.91.00",
        cpvCode: "39224200-6",
        status: "inactive"
      },
      {
        name: "Stainless Steel Mixing Bowls",
        slug: "stainless-steel-mixing-bowls",
        description: "Professional grade mixing bowls. Set of 6 different sizes. Dishwasher safe.",
        price: "39.99",
        compareAtPrice: "49.99",
        imageUrl: "https://images.unsplash.com/photo-1556909114-be3ab0b3a5e2?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[2].id,
        inStock: true,
        stockQuantity: 95,
        featured: false,
        rating: "4.6",
        reviewCount: 22,
        vatValue: "21.00",
        productCode: "KIT-MIX-6SET",
        ncCode: "7615.20.00",
        cpvCode: "39224300-7",
        status: "active"
      },
      
      // Cleaning & Sanitizing
      {
        name: "Food-Safe Sanitizer Spray",
        slug: "food-safe-sanitizer-spray",
        description: "EPA-approved sanitizer spray for food contact surfaces. 32 oz bottle.",
        price: "16.99",
        compareAtPrice: "19.99",
        imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=400&fit=crop",
        categoryId: insertedCategories[3].id,
        inStock: true,
        stockQuantity: 180,
        featured: true,
        rating: "4.5",
        reviewCount: 35
      },
      {
        name: "Degreaser Concentrate",
        slug: "degreaser-concentrate",
        description: "Heavy-duty degreaser concentrate. Makes 10 gallons. Commercial grade.",
        price: "28.99",
        compareAtPrice: "34.99",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
        categoryId: insertedCategories[3].id,
        inStock: true,
        stockQuantity: 120,
        featured: false,
        rating: "4.7",
        reviewCount: 18
      },
      
      // Storage Solutions
      {
        name: "Food Storage Container Set",
        slug: "food-storage-container-set",
        description: "Airtight food storage containers. Set of 12 with labels. BPA-free.",
        price: "54.99",
        compareAtPrice: "64.99",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&auto=format&q=80",
        categoryId: insertedCategories[4].id,
        inStock: true,
        stockQuantity: 75,
        featured: true,
        rating: "4.8",
        reviewCount: 41
      },
      {
        name: "Commercial Food Storage Bins",
        slug: "commercial-food-storage-bins",
        description: "Large capacity food storage bins with wheels. NSF certified. Set of 3.",
        price: "189.99",
        compareAtPrice: "229.99",
        imageUrl: "https://images.unsplash.com/photo-1563220552-5a5b5f3d7b5b?w=400&h=400&fit=crop",
        categoryId: insertedCategories[4].id,
        inStock: true,
        stockQuantity: 25,
        featured: false,
        rating: "4.6",
        reviewCount: 12
      },
      
      // Additional Food Labels
      {
        name: "Allergen Warning Labels - 1000 pack",
        slug: "allergen-warning-labels-1000",
        description: "Bright yellow allergen warning labels. Contains common allergens list. 1000 pack.",
        price: "34.99",
        compareAtPrice: "39.99",
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop",
        categoryId: insertedCategories[0].id,
        inStock: true,
        stockQuantity: 200,
        featured: true,
        rating: "4.9",
        reviewCount: 32
      },
      {
        name: "Temperature Control Labels",
        slug: "temperature-control-labels",
        description: "Color-changing temperature labels for monitoring food safety. 500 pack.",
        price: "29.99",
        compareAtPrice: "34.99",
        imageUrl: "https://images.unsplash.com/photo-1543362906-acfc16c67564?w=400&h=400&fit=crop",
        categoryId: insertedCategories[0].id,
        inStock: true,
        stockQuantity: 150,
        featured: false,
        rating: "4.7",
        reviewCount: 28
      },
      {
        name: "Prep Date Labels - Roll",
        slug: "prep-date-labels-roll",
        description: "Preparation date labels on convenient roll. 2000 labels per roll.",
        price: "22.99",
        compareAtPrice: "26.99",
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop",
        categoryId: insertedCategories[0].id,
        inStock: true,
        stockQuantity: 300,
        featured: false,
        rating: "4.6",
        reviewCount: 15
      },
      
      // Additional HACCP Equipment
      {
        name: "Wireless Temperature Monitoring System",
        slug: "wireless-temperature-monitoring",
        description: "WiFi-enabled temperature monitoring with alerts. Includes 4 sensors.",
        price: "299.99",
        compareAtPrice: "349.99",
        imageUrl: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=400&h=400&fit=crop",
        categoryId: insertedCategories[1].id,
        inStock: true,
        stockQuantity: 40,
        featured: true,
        rating: "4.8",
        reviewCount: 67
      },
      {
        name: "HACCP Compliance Chart Set",
        slug: "haccp-compliance-chart-set",
        description: "Laminated HACCP compliance charts for kitchen display. Set of 12.",
        price: "45.99",
        compareAtPrice: "54.99",
        imageUrl: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=400&h=400&fit=crop",
        categoryId: insertedCategories[1].id,
        inStock: true,
        stockQuantity: 85,
        featured: false,
        rating: "4.5",
        reviewCount: 23
      },
      {
        name: "Food Safety Inspection Kit",
        slug: "food-safety-inspection-kit",
        description: "Complete food safety inspection kit with thermometer, pH strips, and more.",
        price: "89.99",
        compareAtPrice: "109.99",
        imageUrl: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=400&h=400&fit=crop",
        categoryId: insertedCategories[1].id,
        inStock: true,
        stockQuantity: 60,
        featured: true,
        rating: "4.7",
        reviewCount: 45
      },
      
      // Additional Kitchen Supplies
      {
        name: "Stainless Steel Prep Tables",
        slug: "stainless-steel-prep-tables",
        description: "Commercial grade stainless steel prep table. 48\" x 24\" with undershelf.",
        price: "349.99",
        compareAtPrice: "399.99",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
        categoryId: insertedCategories[2].id,
        inStock: true,
        stockQuantity: 15,
        featured: true,
        rating: "4.9",
        reviewCount: 89
      },
      {
        name: "Professional Can Opener Set",
        slug: "professional-can-opener-set",
        description: "Heavy-duty can opener set for commercial use. Includes table mount.",
        price: "79.99",
        compareAtPrice: "94.99",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
        categoryId: insertedCategories[2].id,
        inStock: true,
        stockQuantity: 35,
        featured: false,
        rating: "4.6",
        reviewCount: 34
      },
      {
        name: "Commercial Mixing Bowls Set",
        slug: "commercial-mixing-bowls-set",
        description: "Stainless steel mixing bowls set. 6 bowls from 1 qt to 8 qt capacity.",
        price: "124.99",
        compareAtPrice: "144.99",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
        categoryId: insertedCategories[2].id,
        inStock: true,
        stockQuantity: 50,
        featured: false,
        rating: "4.8",
        reviewCount: 56
      },
      
      // Additional Cleaning & Sanitizing
      {
        name: "All-Purpose Cleaner - Gallon",
        slug: "all-purpose-cleaner-gallon",
        description: "Commercial all-purpose cleaner. EPA registered. 1 gallon concentrate.",
        price: "24.99",
        compareAtPrice: "29.99",
        imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=400&fit=crop",
        categoryId: insertedCategories[3].id,
        inStock: true,
        stockQuantity: 100,
        featured: false,
        rating: "4.4",
        reviewCount: 67
      },
      {
        name: "Sanitizing Wipes - 12 Pack",
        slug: "sanitizing-wipes-12-pack",
        description: "Food-safe sanitizing wipes. 12 canister pack. 80 wipes per canister.",
        price: "89.99",
        compareAtPrice: "104.99",
        imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=400&fit=crop",
        categoryId: insertedCategories[3].id,
        inStock: true,
        stockQuantity: 75,
        featured: true,
        rating: "4.7",
        reviewCount: 43
      },
      {
        name: "Floor Sanitizer Concentrate",
        slug: "floor-sanitizer-concentrate",
        description: "Heavy-duty floor sanitizer concentrate. Makes 50 gallons. Non-slip formula.",
        price: "39.99",
        compareAtPrice: "49.99",
        imageUrl: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=400&fit=crop",
        categoryId: insertedCategories[3].id,
        inStock: true,
        stockQuantity: 60,
        featured: false,
        rating: "4.6",
        reviewCount: 29
      },
      
      // Additional Storage Solutions
      {
        name: "Vacuum Storage Bags - 50 Pack",
        slug: "vacuum-storage-bags-50-pack",
        description: "Commercial vacuum storage bags. Various sizes. 50 pack with pump.",
        price: "49.99",
        compareAtPrice: "59.99",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
        categoryId: insertedCategories[4].id,
        inStock: true,
        stockQuantity: 120,
        featured: false,
        rating: "4.5",
        reviewCount: 38
      },
      {
        name: "Ingredient Dispensers Set",
        slug: "ingredient-dispensers-set",
        description: "Gravity-fed ingredient dispensers. Set of 6 with portion control.",
        price: "149.99",
        compareAtPrice: "179.99",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
        categoryId: insertedCategories[4].id,
        inStock: true,
        stockQuantity: 45,
        featured: true,
        rating: "4.8",
        reviewCount: 52
      },
      {
        name: "Mobile Storage Racks",
        slug: "mobile-storage-racks",
        description: "Heavy-duty mobile storage racks with locking wheels. Set of 2.",
        price: "199.99",
        compareAtPrice: "239.99",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
        categoryId: insertedCategories[4].id,
        inStock: true,
        stockQuantity: 30,
        featured: false,
        rating: "4.7",
        reviewCount: 41
      }
    ];

    // Add default values for new fields to all products
    const productsWithNewFields = sampleProducts.map((product, index) => ({
      ...product,
      vatValue: product.vatValue || "21.00",
      vatPercentage: product.vatPercentage || "21.00", // Default VAT percentage
      currency: product.currency || "EUR", // Default currency
      productCode: product.productCode || `PROD-${String(index + 1).padStart(3, '0')}`,
      ncCode: product.ncCode || "9999.99.99",
      cpvCode: product.cpvCode || "39000000-0"
    }));

    const insertedProducts = await db.insert(products).values(productsWithNewFields).returning();

    // Create users
    const adminPassword = await bcrypt.hash("admin123", 10);
    const testPassword = await bcrypt.hash("123456", 10);
    
    const insertedUsers = await db.insert(users).values([
      {
        email: "admin@xhaccp.com",
        password: adminPassword,
        firstName: "Admin",
        lastName: "User",
        isAdmin: true
      },
      {
        email: "liviu.chertes@gmail.com",
        password: testPassword,
        firstName: "Liviu",
        lastName: "Chertes",
        isAdmin: false
      }
    ]).returning();

    // Create sample orders
    const sampleOrders = [
      {
        userId: insertedUsers[1].id,
        status: "pending",
        totalAmount: "94.97",
        shippingAddress: {
          firstName: "Liviu",
          lastName: "Chertes",
          address: "Calea Mosilor 158",
          city: "Bucharest",
          state: "Bucharest",
          zipCode: "020883",
          country: "Romania",
          phone: "+40 745 009 000"
        },
        billingAddress: {
          firstName: "Liviu",
          lastName: "Chertes",
          address: "Calea Mosilor 158",
          city: "Bucharest",
          state: "Bucharest",
          zipCode: "020883",
          country: "Romania",
          phone: "+40 745 009 000"
        },
        paymentMethod: "credit_card",
        paymentStatus: "pending",
        notes: "Please deliver during business hours"
      },
      {
        userId: insertedUsers[1].id,
        status: "processing",
        totalAmount: "349.99",
        shippingAddress: {
          firstName: "Maria",
          lastName: "Popescu",
          address: "Strada Republicii 25",
          city: "Cluj-Napoca",
          state: "Cluj",
          zipCode: "400015",
          country: "Romania",
          phone: "+40 264 123 456"
        },
        billingAddress: {
          firstName: "Maria",
          lastName: "Popescu",
          address: "Strada Republicii 25",
          city: "Cluj-Napoca",
          state: "Cluj",
          zipCode: "400015",
          country: "Romania",
          phone: "+40 264 123 456"
        },
        paymentMethod: "bank_transfer",
        paymentStatus: "paid",
        notes: "Urgent order - needed for health inspection"
      },
      {
        userId: insertedUsers[1].id,
        status: "shipped",
        totalAmount: "189.97",
        shippingAddress: {
          firstName: "Alexandru",
          lastName: "Ionescu",
          address: "Bulevardul Unirii 12",
          city: "Iași",
          state: "Iași",
          zipCode: "700056",
          country: "Romania",
          phone: "+40 232 987 654"
        },
        billingAddress: {
          firstName: "Alexandru",
          lastName: "Ionescu",
          address: "Bulevardul Unirii 12",  
          city: "Iași",
          state: "Iași",
          zipCode: "700056",
          country: "Romania",
          phone: "+40 232 987 654"
        },
        paymentMethod: "credit_card",
        paymentStatus: "paid",
        notes: "Standard delivery"
      },
      {
        userId: insertedUsers[1].id,
        status: "delivered",
        totalAmount: "124.98",
        shippingAddress: {
          firstName: "Giuseppe",
          lastName: "Romano",
          address: "Strada Lipscani 45",
          city: "Bucharest",
          state: "Bucharest",
          zipCode: "030167",
          country: "Romania",
          phone: "+40 21 555 1234"
        },
        billingAddress: {
          firstName: "Giuseppe",
          lastName: "Romano",
          address: "Strada Lipscani 45",
          city: "Bucharest", 
          state: "Bucharest",
          zipCode: "030167",
          country: "Romania",
          phone: "+40 21 555 1234"
        },
        paymentMethod: "credit_card",
        paymentStatus: "paid",
        notes: "Delivered successfully"
      },
      {
        userId: insertedUsers[1].id,
        status: "cancelled",
        totalAmount: "79.99",
        shippingAddress: {
          firstName: "Ana",
          lastName: "Dumitrescu",
          address: "Piața Sfatului 10",
          city: "Brașov",
          state: "Brașov",
          zipCode: "500025",
          country: "Romania",
          phone: "+40 268 111 222"
        },
        billingAddress: {
          firstName: "Ana",
          lastName: "Dumitrescu",
          address: "Piața Sfatului 10",
          city: "Brașov",
          state: "Brașov", 
          zipCode: "500025",
          country: "Romania",
          phone: "+40 268 111 222"
        },
        paymentMethod: "credit_card",
        paymentStatus: "refunded",
        notes: "Customer cancelled - refund processed"
      }
    ];

    const insertedOrders = await db.insert(orders).values(sampleOrders).returning();

    // Create sample order items
    const sampleOrderItems = [
      // Order 1 items
      {
        orderId: insertedOrders[0].id,
        productId: insertedProducts[0].id, // Expiration Date Labels
        quantity: 2,
        price: "24.99",
        totalPrice: "49.98"
      },
      {
        orderId: insertedOrders[0].id,
        productId: insertedProducts[1].id, // Day of Week Labels
        quantity: 1,
        price: "19.99",
        totalPrice: "19.99"
      },
      {
        orderId: insertedOrders[0].id,
        productId: insertedProducts[2].id, // Custom Food Labels
        quantity: 1,
        price: "25.00",
        totalPrice: "25.00"
      },
      // Order 2 items
      {
        orderId: insertedOrders[1].id,
        productId: insertedProducts[20].id, // Stainless Steel Prep Tables
        quantity: 1,
        price: "349.99",
        totalPrice: "349.99"
      },
      // Order 3 items
      {
        orderId: insertedOrders[2].id,
        productId: insertedProducts[11].id, // Food Storage Container Set
        quantity: 2,
        price: "54.99",
        totalPrice: "109.98"
      },
      {
        orderId: insertedOrders[2].id,
        productId: insertedProducts[21].id, // Professional Can Opener Set
        quantity: 1,
        price: "79.99",
        totalPrice: "79.99"
      },
      // Order 4 items
      {
        orderId: insertedOrders[3].id,
        productId: insertedProducts[22].id, // Commercial Mixing Bowls Set
        quantity: 1,
        price: "124.99",
        totalPrice: "124.99"
      },
      // Order 5 items
      {
        orderId: insertedOrders[4].id,
        productId: insertedProducts[21].id, // Professional Can Opener Set
        quantity: 1,
        price: "79.99",
        totalPrice: "79.99"
      }
    ];

    // Insert all order items
    const insertedOrderItems = await db.insert(orderItems).values(sampleOrderItems).returning();
    console.log(`Inserted ${insertedOrderItems.length} order items for ${insertedOrders.length} orders`);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

export async function seedCategoryTranslations() {
  try {
    const existing = await db.select().from(categoryTranslations);
    if (existing.length > 0) {
      return;
    }

    const allCategories = await db.select().from(categories);
    if (allCategories.length === 0) return;

    const categoryMap: Record<string, number> = {};
    for (const cat of allCategories) {
      categoryMap[cat.slug] = cat.id;
    }

    const translationData: { slug: string; language: string; name: string; description: string }[] = [
      { slug: 'food-labels', language: 'ro', name: 'Etichete Alimentare', description: 'Soluții profesionale de etichetare alimentară pentru restaurante și servicii alimentare' },
      { slug: 'food-labels', language: 'de', name: 'Lebensmitteletiketten', description: 'Professionelle Lebensmitteletikettierungslösungen für Restaurants und Gastronomie' },
      { slug: 'food-labels', language: 'fr', name: 'Étiquettes Alimentaires', description: 'Solutions professionnelles d\'étiquetage alimentaire pour restaurants et services alimentaires' },
      { slug: 'food-labels', language: 'es', name: 'Etiquetas de Alimentos', description: 'Soluciones profesionales de etiquetado de alimentos para restaurantes y servicios alimentarios' },
      { slug: 'food-labels', language: 'it', name: 'Etichette Alimentari', description: 'Soluzioni professionali per l\'etichettatura alimentare per ristoranti e servizi alimentari' },
      { slug: 'food-labels', language: 'pt', name: 'Etiquetas de Alimentos', description: 'Soluções profissionais de etiquetagem de alimentos para restaurantes e serviços alimentares' },
      { slug: 'food-labels', language: 'nl', name: 'Voedseletiketten', description: 'Professionele voedseletiketteringsoplossingen voor restaurants en foodservices' },
      { slug: 'food-labels', language: 'pl', name: 'Etykiety Żywnościowe', description: 'Profesjonalne rozwiązania do etykietowania żywności dla restauracji i usług gastronomicznych' },
      { slug: 'food-labels', language: 'hu', name: 'Élelmiszercímkék', description: 'Professzionális élelmiszer-címkézési megoldások éttermek és vendéglátóhelyek számára' },
      { slug: 'food-labels', language: 'ar', name: 'ملصقات الطعام', description: 'حلول احترافية لتصنيف الأغذية للمطاعم وخدمات الطعام' },

      { slug: 'equipment-software', language: 'ro', name: 'Echipamente & Software', description: 'Echipamente HACCP și soluții software pentru bucătăria profesională' },
      { slug: 'equipment-software', language: 'de', name: 'Ausrüstung & Software', description: 'HACCP-Ausrüstung und Softwarelösungen für die professionelle Küche' },
      { slug: 'equipment-software', language: 'fr', name: 'Équipement & Logiciel', description: 'Équipements HACCP et solutions logicielles pour la cuisine professionnelle' },
      { slug: 'equipment-software', language: 'es', name: 'Equipos & Software', description: 'Equipos HACCP y soluciones de software para cocinas profesionales' },
      { slug: 'equipment-software', language: 'it', name: 'Attrezzature & Software', description: 'Attrezzature HACCP e soluzioni software per la cucina professionale' },
      { slug: 'equipment-software', language: 'pt', name: 'Equipamentos & Software', description: 'Equipamentos HACCP e soluções de software para cozinhas profissionais' },
      { slug: 'equipment-software', language: 'nl', name: 'Apparatuur & Software', description: 'HACCP-apparatuur en softwareoplossingen voor de professionele keuken' },
      { slug: 'equipment-software', language: 'pl', name: 'Sprzęt & Oprogramowanie', description: 'Sprzęt HACCP i rozwiązania programowe dla profesjonalnej kuchni' },
      { slug: 'equipment-software', language: 'hu', name: 'Berendezések & Szoftver', description: 'HACCP berendezések és szoftvermegoldások professzionális konyhákhoz' },
      { slug: 'equipment-software', language: 'ar', name: 'معدات وبرمجيات', description: 'معدات HACCP وحلول البرمجيات للمطابخ المهنية' },

      { slug: 'kitchen-supplies', language: 'ro', name: 'Articole de Bucătărie', description: 'Articole esențiale pentru bucătăria profesională' },
      { slug: 'kitchen-supplies', language: 'de', name: 'Küchenbedarf', description: 'Unverzichtbare Küchenutensilien für die professionelle Küche' },
      { slug: 'kitchen-supplies', language: 'fr', name: 'Fournitures de Cuisine', description: 'Fournitures essentielles pour la cuisine professionnelle' },
      { slug: 'kitchen-supplies', language: 'es', name: 'Suministros de Cocina', description: 'Suministros esenciales para la cocina profesional' },
      { slug: 'kitchen-supplies', language: 'it', name: 'Forniture da Cucina', description: 'Forniture essenziali per la cucina professionale' },
      { slug: 'kitchen-supplies', language: 'pt', name: 'Materiais de Cozinha', description: 'Materiais essenciais para a cozinha profissional' },
      { slug: 'kitchen-supplies', language: 'nl', name: 'Keukenbenodigdheden', description: 'Essentiële keukenbenodigdheden voor de professionele keuken' },
      { slug: 'kitchen-supplies', language: 'pl', name: 'Artykuły Kuchenne', description: 'Niezbędne artykuły kuchenne dla profesjonalnej kuchni' },
      { slug: 'kitchen-supplies', language: 'hu', name: 'Konyhai Kellékek', description: 'Nélkülözhetetlen konyhai kellékek professzionális konyhákhoz' },
      { slug: 'kitchen-supplies', language: 'ar', name: 'مستلزمات المطبخ', description: 'مستلزمات أساسية للمطبخ المهني' },

      { slug: 'cleaning-sanitizing', language: 'ro', name: 'Curățenie & Igienizare', description: 'Produse profesionale de curățenie și igienizare pentru industria HORECA' },
      { slug: 'cleaning-sanitizing', language: 'de', name: 'Reinigung & Desinfektion', description: 'Professionelle Reinigungs- und Desinfektionsprodukte für die HORECA-Branche' },
      { slug: 'cleaning-sanitizing', language: 'fr', name: 'Nettoyage & Désinfection', description: 'Produits professionnels de nettoyage et de désinfection pour l\'industrie HORECA' },
      { slug: 'cleaning-sanitizing', language: 'es', name: 'Limpieza & Desinfección', description: 'Productos profesionales de limpieza y desinfección para la industria HORECA' },
      { slug: 'cleaning-sanitizing', language: 'it', name: 'Pulizia & Igienizzazione', description: 'Prodotti professionali di pulizia e igienizzazione per il settore HORECA' },
      { slug: 'cleaning-sanitizing', language: 'pt', name: 'Limpeza & Higienização', description: 'Produtos profissionais de limpeza e higienização para a indústria HORECA' },
      { slug: 'cleaning-sanitizing', language: 'nl', name: 'Reiniging & Desinfectie', description: 'Professionele reinigings- en desinfectieproducten voor de HORECA-sector' },
      { slug: 'cleaning-sanitizing', language: 'pl', name: 'Czyszczenie & Dezynfekcja', description: 'Profesjonalne produkty do czyszczenia i dezynfekcji dla branży HORECA' },
      { slug: 'cleaning-sanitizing', language: 'hu', name: 'Tisztítás & Fertőtlenítés', description: 'Professzionális tisztító- és fertőtlenítőszerek a HORECA ipar számára' },
      { slug: 'cleaning-sanitizing', language: 'ar', name: 'تنظيف وتعقيم', description: 'منتجات تنظيف وتعقيم مهنية لقطاع الضيافة' },

      { slug: 'storage-solutions', language: 'ro', name: 'Soluții de Depozitare', description: 'Soluții profesionale de depozitare pentru bucătăria comercială' },
      { slug: 'storage-solutions', language: 'de', name: 'Aufbewahrungslösungen', description: 'Professionelle Aufbewahrungslösungen für die Großküche' },
      { slug: 'storage-solutions', language: 'fr', name: 'Solutions de Stockage', description: 'Solutions professionnelles de stockage pour la cuisine commerciale' },
      { slug: 'storage-solutions', language: 'es', name: 'Soluciones de Almacenamiento', description: 'Soluciones profesionales de almacenamiento para la cocina comercial' },
      { slug: 'storage-solutions', language: 'it', name: 'Soluzioni di Stoccaggio', description: 'Soluzioni professionali di stoccaggio per la cucina commerciale' },
      { slug: 'storage-solutions', language: 'pt', name: 'Soluções de Armazenamento', description: 'Soluções profissionais de armazenamento para cozinhas comerciais' },
      { slug: 'storage-solutions', language: 'nl', name: 'Opslagoplossingen', description: 'Professionele opslagoplossingen voor de commerciële keuken' },
      { slug: 'storage-solutions', language: 'pl', name: 'Rozwiązania Magazynowe', description: 'Profesjonalne rozwiązania magazynowe dla kuchni komercyjnych' },
      { slug: 'storage-solutions', language: 'hu', name: 'Tárolási Megoldások', description: 'Professzionális tárolási megoldások kereskedelmi konyhákhoz' },
      { slug: 'storage-solutions', language: 'ar', name: 'حلول التخزين', description: 'حلول تخزين مهنية للمطابخ التجارية' },
    ];

    const toInsert = translationData
      .filter(t => categoryMap[t.slug])
      .map(t => ({
        categoryId: categoryMap[t.slug],
        language: t.language,
        name: t.name,
        description: t.description,
      }));

    if (toInsert.length > 0) {
      await db.insert(categoryTranslations).values(toInsert);
      console.log(`✅ Seeded ${toInsert.length} category translations`);
    }
  } catch (error) {
    console.error("Error seeding category translations:", error);
  }
}