import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

async function testR2Connection() {
  console.log("🧪 Testing R2 Connection...\n");

  const config = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    cdnUrl: process.env.R2_CDN_URL
  };

  console.log("📋 R2 Configuration:");
  console.log("  - Account ID:", config.accountId ? config.accountId.slice(0, 8) + "..." : "NOT SET");
  console.log("  - Bucket Name:", config.bucketName || "NOT SET");
  console.log("  - CDN URL:", config.cdnUrl || "NOT SET");
  console.log("");

  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    console.error("❌ R2 is not fully configured. Missing required environment variables.");
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  // Test 1: List objects in bucket
  console.log("📂 Test 1: Listing objects in bucket...");
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucketName,
      MaxKeys: 10
    });
    const listResult = await client.send(listCommand);
    console.log("  ✅ Successfully connected to bucket!");
    console.log("  📁 Objects in bucket:", listResult.KeyCount || 0);
    if (listResult.Contents && listResult.Contents.length > 0) {
      console.log("  📄 First few objects:");
      listResult.Contents.slice(0, 5).forEach(obj => {
        console.log(`     - ${obj.Key} (${obj.Size} bytes)`);
      });
    }
  } catch (error: any) {
    console.error("  ❌ Failed to list objects:", error.message);
    console.error("  🔍 Error details:", error.Code || error.name);
    return;
  }

  // Test 2: Upload a test file
  console.log("\n📤 Test 2: Uploading test file...");
  const testContent = `Test file uploaded at ${new Date().toISOString()}`;
  const testKey = `test/r2-test-${Date.now()}.txt`;
  
  try {
    const putCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });
    await client.send(putCommand);
    console.log("  ✅ Successfully uploaded test file!");
    console.log("  📍 Key:", testKey);
    
    if (config.cdnUrl) {
      const publicUrl = `${config.cdnUrl.replace(/\/$/, '')}/${testKey}`;
      console.log("  🌐 Public URL:", publicUrl);
      console.log("\n  👉 Try opening this URL in your browser to verify public access!");
    }
  } catch (error: any) {
    console.error("  ❌ Failed to upload test file:", error.message);
    console.error("  🔍 Error details:", error.Code || error.name);
    return;
  }

  console.log("\n✅ All R2 tests passed! R2 is working correctly.");
}

testR2Connection().catch(console.error);
