#!/usr/bin/env node

// Test script to verify Smartbill API fixes:
// 1. X-SB-Access-Token header added
// 2. Empty vatCode and regCom fields omitted

const credentials = {
  username: 'liviu.chertes@gmail.com',
  token: '001|2af8fcdc3ea579cb7a81093ca404b31e',
  companyVat: 'RO16582983'
};

function getAuthHeader() {
  const base64Credentials = Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64');
  return `Basic ${base64Credentials}`;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': getAuthHeader(),
    'X-SB-Access-Token': credentials.token, // ✅ FIXED: Added missing header
  };
}

// Test invoice data with corrected client format
const testInvoiceData = {
  companyVatCode: credentials.companyVat,
  client: {
    name: "Liviu Chertes",
    address: "Calea Mosilor 158",
    isTaxPayer: false,
    saveToDb: true,
    city: "Bucharest",
    country: "Romania",
    email: "liviu.chertes@gmail.com"
    // ✅ FIXED: vatCode and regCom completely omitted (not empty strings)
  },
  issueDate: "2025-07-23",
  seriesName: "KTO",
  isDraft: false,
  dueDate: "2025-08-22",
  mentions: "Factura cu TVA 19% conform legislației române",
  observations: "",
  deliveryDate: "2025-07-23",
  precision: 2,
  currency: "RON", // ✅ FIXED: Currency at invoice level
  products: [{
    name: "Test Product - API Fix",
    code: "TEST-001",
    isDiscount: false,
    measuringUnitName: "buc",
    // ✅ FIXED: Removed currency from product level
    quantity: 1,
    price: 100.00,
    isTaxIncluded: true,
    taxName: "Normala",
    taxPercentage: 19,
    // ✅ FIXED: Removed vatPercentage and vatAmount (Smartbill calculates automatically)
    saveToDb: true,
    isService: false
  }]
};

async function testSmartbillAPI() {
  console.log('🚀 TESTING SMARTBILL API WITH FIXES');
  console.log('=====================================\n');

  // Test 1: Verify series endpoint still works
  console.log('1️⃣ Testing series endpoint (should work)...');
  try {
    const seriesUrl = `https://ws.smartbill.ro/SBORO/api/series?cif=${encodeURIComponent(credentials.companyVat)}`;
    console.log('   URL:', seriesUrl);
    
    const seriesResponse = await fetch(seriesUrl, {
      method: 'GET',
      headers: getHeaders()
    });

    console.log('   Response status:', seriesResponse.status);
    if (seriesResponse.ok) {
      const seriesData = await seriesResponse.json();
      console.log('   ✅ Series endpoint working!');
      console.log('   Available series:', JSON.stringify(seriesData, null, 4));
    } else {
      const errorText = await seriesResponse.text();
      console.log('   ❌ Series endpoint failed:', errorText);
    }
  } catch (error) {
    console.log('   ❌ Series endpoint error:', error.message);
  }

  console.log('\n');

  // Test 2: Test invoice creation with fixes
  console.log('2️⃣ Testing invoice creation with API fixes...');
  try {
    console.log('   Request data:', JSON.stringify(testInvoiceData, null, 4));
    
    const invoiceResponse = await fetch('https://ws.smartbill.ro/SBORO/api/invoice', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(testInvoiceData)
    });

    console.log('   Response status:', invoiceResponse.status);
    console.log('   Response headers:', Object.fromEntries(invoiceResponse.headers.entries()));

    if (invoiceResponse.ok) {
      const responseData = await invoiceResponse.json();
      console.log('   🎉 ✅ INVOICE CREATION SUCCESSFUL!');
      console.log('   Response:', JSON.stringify(responseData, null, 4));
    } else {
      const errorText = await invoiceResponse.text();
      console.log('   ❌ Invoice creation failed - Status:', invoiceResponse.status);
      console.log('   Error response:', errorText);
      
      // Analyze the error
      if (invoiceResponse.status === 500) {
        console.log('   🔍 Still getting HTTP 500 - likely server-side issue at Smartbill');
      } else if (invoiceResponse.status === 400) {
        console.log('   🔍 HTTP 400 - possible data format issue');
      } else if (invoiceResponse.status === 401) {
        console.log('   🔍 HTTP 401 - authentication issue');
      }
    }
  } catch (error) {
    console.log('   ❌ Invoice creation error:', error.message);
  }

  console.log('\n=====================================');
  console.log('🏁 Test completed. Check results above.');
}

// Run the test
testSmartbillAPI().catch(console.error);