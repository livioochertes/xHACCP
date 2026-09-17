// Test minimal SmartBill invoice payload using Replit/local environment secrets.
const smartbillCredentials = {
  username: process.env.SMARTBILL_USERNAME,
  token: process.env.SMARTBILL_TOKEN,
  companyVat: process.env.SMARTBILL_COMPANY_VAT,
};

if (!smartbillCredentials.username || !smartbillCredentials.token || !smartbillCredentials.companyVat) {
  throw new Error('SMARTBILL_USERNAME, SMARTBILL_TOKEN and SMARTBILL_COMPANY_VAT are required');
}

const baseUrl = 'https://ws.smartbill.ro/SBORO/api';

function getAuthHeaders() {
  const credentials = `${smartbillCredentials.username}:${smartbillCredentials.token}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Basic ${base64Credentials}`,
  };
}

const minimalInvoicePayload = {
  companyVatCode: smartbillCredentials.companyVat,
  client: {
    name: 'Test Customer',
    address: 'Test Address',
    city: 'Bucharest',
    country: 'Romania',
  },
  issueDate: new Date().toISOString().split('T')[0],
  seriesName: process.env.SMARTBILL_SERIES || 'KTO',
  isDraft: true,
  products: [
    {
      name: 'Test Product',
      code: 'TEST-001',
      isDiscount: false,
      measuringUnitName: 'buc',
      currency: 'RON',
      quantity: 1,
      price: 100,
      isTaxIncluded: true,
      taxName: 'Normala',
      taxPercentage: 21,
      saveToDb: false,
      isService: false,
    },
  ],
};

console.log('Testing minimal SmartBill invoice payload...');

fetch(`${baseUrl}/invoice/v2`, {
  method: 'POST',
  headers: getAuthHeaders(),
  body: JSON.stringify(minimalInvoicePayload),
})
  .then(async (response) => {
    const body = await response.json().catch(() => ({}));
    console.log(JSON.stringify({
      status: response.status,
      ok: response.ok,
      errorText: body.errorText || '',
      message: body.message || '',
      documentId: body.documentId,
    }, null, 2));
  })
  .catch((error) => {
    console.error('SmartBill request failed:', error.message);
    process.exitCode = 1;
  });