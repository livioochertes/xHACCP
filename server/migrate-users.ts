import { db } from "./db";
import { users } from "../shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function migrateUsersFromSeed() {
  try {
    const seedPath = path.join(process.cwd(), "server", "seeds", "users-seed.json");

    if (!fs.existsSync(seedPath)) {
      return;
    }

    const existingUsers = await db.select({ id: users.id }).from(users);
    if (existingUsers.length >= 137) {
      console.log(`✅ Users already migrated (${existingUsers.length} users found), skipping`);
      return;
    }

    console.log(`🔄 Found ${existingUsers.length} users, migrating from seed...`);

    const seedData = JSON.parse(fs.readFileSync(seedPath, "utf8"));

    let inserted = 0;
    let updated = 0;

    for (const u of seedData) {
      const result = await db.execute(sql`
        INSERT INTO users (email, password, first_name, last_name, is_admin,
          company_name, vat_number, registration_number, tax_id,
          company_address, company_city, company_state, company_zip, company_country, company_county,
          billing_email, billing_phone,
          delivery_address, delivery_city, delivery_state, delivery_zip, delivery_country, delivery_county,
          delivery_instructions)
        VALUES (${u.email}, ${u.password}, ${u.first_name}, ${u.last_name}, ${u.is_admin},
          ${u.company_name}, ${u.vat_number}, ${u.registration_number}, ${u.tax_id},
          ${u.company_address}, ${u.company_city}, ${u.company_state}, ${u.company_zip}, ${u.company_country}, ${u.company_county},
          ${u.billing_email}, ${u.billing_phone},
          ${u.delivery_address}, ${u.delivery_city}, ${u.delivery_state}, ${u.delivery_zip}, ${u.delivery_country}, ${u.delivery_county},
          ${u.delivery_instructions})
        ON CONFLICT (email) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          company_name = EXCLUDED.company_name,
          vat_number = EXCLUDED.vat_number,
          registration_number = EXCLUDED.registration_number,
          company_address = EXCLUDED.company_address,
          company_city = EXCLUDED.company_city,
          company_state = EXCLUDED.company_state,
          company_zip = EXCLUDED.company_zip,
          company_country = EXCLUDED.company_country,
          company_county = EXCLUDED.company_county,
          billing_email = EXCLUDED.billing_email,
          billing_phone = EXCLUDED.billing_phone,
          delivery_address = EXCLUDED.delivery_address,
          delivery_city = EXCLUDED.delivery_city,
          delivery_state = EXCLUDED.delivery_state,
          delivery_zip = EXCLUDED.delivery_zip,
          delivery_country = EXCLUDED.delivery_country,
          delivery_county = EXCLUDED.delivery_county,
          delivery_instructions = EXCLUDED.delivery_instructions
      `);
      
      inserted++;
    }

    console.log(`✅ User migration complete: ${inserted} users processed`);
  } catch (error) {
    console.error("❌ User migration failed:", error);
  }
}
