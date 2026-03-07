import fetch from 'node-fetch';

export interface SamedayConfig {
  baseUrl: string; // https://sameday-api.demo.zitec.com for sandbox, production URL to be confirmed
  username: string;
  password: string;
}

export interface SamedayAuthResponse {
  token: string;
  expire_at: string; // Format: "2018-05-25 23:07"
}

export interface SamedayPickupPoint {
  id: number;
  name: string;
  county: string;
  city: string;
  address: string;
  contactPersons: Array<{
    id: number;
    name: string;
    phone: string;
    email: string;
    default: boolean;
  }>;
}

export interface SamedayService {
  id: number;
  name: string;
  serviceOptionalTaxes: Array<{
    id: number;
    name: string;
    tax: number;
  }>;
}

export interface SamedayCounty {
  id: number;
  name: string;
  code: string;
}

export interface SamedayCity {
  id: number;
  name: string;
  county: string;
  postalCode: string;
}

export interface AWBParcel {
  weight: number;
  width?: number;
  length?: number;
  height?: number;
  awbParcelNumber?: string;
}

export interface AWBRecipient {
  name: string;
  phoneNumber: string;
  personType: number; // Numeric: 1=individual, 2=company
  companyName?: string;
  address: string;
  countyId?: number;
  cityId?: number;
  county?: string;    // Alternative: county name as string
  city?: string;      // Alternative: city name as string
  postalCode?: string;
}

export interface CreateAWBRequest {
  pickupPoint: number;              // Correct field name
  contactPerson?: number;           // Contact person ID
  service: number;                  // Correct field name
  packageType: number;              // Numeric: 0=PARCEL, 1=ENVELOPE, 2=LARGE
  packageWeight: number;            // Total weight in kg
  awbPayment: number;               // Numeric: 1=SENDER, 2=RECIPIENT, 3=THIRD_PARTY
  awbRecipient: AWBRecipient;       // Correct field name
  parcels: AWBParcel[];
  cashOnDelivery?: number;
  insuredValue?: number;
  thirdPartyPickup?: number;
  clientInternalReference?: string;
}

export interface CreateAWBResponse {
  awbNumber: string;
  parcels: Array<{
    parcelAwbNumber: string;
    position: number;
  }>;
  cost: number;
  currency: string;
  pdfLink?: string;
}

export class SamedayAPI {
  private config: SamedayConfig;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private authPromise: Promise<string> | null = null;

  constructor(config: SamedayConfig) {
    this.config = config;
  }

  private async authenticate(): Promise<string> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = this._doAuthenticate().finally(() => {
      this.authPromise = null;
    });
    return this.authPromise;
  }

  private async _doAuthenticate(): Promise<string> {
    console.log('🔄 Authenticating with Sameday API...');
    
    // According to the latest API documentation v3.0 - 2024
    // Endpoint: POST /api/authenticate (not /api/authentication)
    const possibleBaseUrls = [
      this.config.baseUrl, // User-configured base URL first
      'https://api.sameday.ro', // Production URL - confirmed working with user credentials
      'https://sameday-api.ro', // Alternative production URL pattern
      'https://api-sameday.ro' // Another possible production URL pattern
    ];

    const authAttempts = [];
    
    // Try each base URL with different authentication approaches
    for (const baseUrl of possibleBaseUrls) {
      authAttempts.push(
        {
          name: `${baseUrl} - remember_me=1`,
          url: `${baseUrl}/api/authenticate?remember_me=1`,
          method: 'POST',
          headers: {
            'X-AUTH-USERNAME': this.config.username,
            'X-AUTH-PASSWORD': this.config.password,
          }
        },
        {
          name: `${baseUrl} - basic auth`,
          url: `${baseUrl}/api/authenticate`,
          method: 'POST',
          headers: {
            'X-AUTH-USERNAME': this.config.username,
            'X-AUTH-PASSWORD': this.config.password,
          }
        }
      );
    }

    for (const attempt of authAttempts) {
      try {
        console.log(`🔍 Trying ${attempt.name}: ${attempt.url}`);
        
        const response = await fetch(attempt.url, {
          method: attempt.method as string,
          headers: attempt.headers
        });

        console.log(`📡 Response: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const authData = await response.json() as SamedayAuthResponse;
            this.token = authData.token;
            // Parse the date format from Sameday: "2018-05-25 23:07"
            this.tokenExpiry = new Date(authData.expire_at.replace(' ', 'T') + ':00');
            
            console.log('✅ Sameday authentication successful, token expires:', authData.expire_at);
            return this.token;
          }
        }
        
        const errorText = await response.text();
        console.warn(`❌ ${attempt.name} failed: ${response.status} - ${errorText.substring(0, 200)}`);
        
      } catch (error: any) {
        console.warn(`❌ ${attempt.name} network error:`, error.message);
      }
    }

    throw new Error('All Sameday API authentication attempts failed. Please verify credentials and API endpoints.');
  }

  private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.authenticate();
    
    console.log(`🔗 Making Sameday API request: ${endpoint}`);
    console.log(`🔑 Using token: ${token.substring(0, 20)}...`);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'X-AUTH-TOKEN': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string>),
        },
      });

      clearTimeout(timeoutId);
      console.log(`📡 API response status: ${response.status} for ${endpoint}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Sameday API error details:`, {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500),
          token: token.substring(0, 20) + '...'
        });
        throw new Error(`Sameday API error: ${response.statusText} - ${errorText}`);
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Sameday API request timeout - server not responding');
      }
      throw error;
    }
  }

  async getPickupPoints(): Promise<SamedayPickupPoint[]> {
    const response = await this.apiRequest<{ data: SamedayPickupPoint[] }>('/api/client/pickup-points');
    return response.data;
  }

  async getServices(): Promise<SamedayService[]> {
    const response = await this.apiRequest<{ data: SamedayService[] }>('/api/client/services');
    return response.data;
  }

  async getCounties(): Promise<SamedayCounty[]> {
    const response = await this.apiRequest<{ data: SamedayCounty[] }>('/api/geolocation/county');
    return response.data;
  }

  async getCities(countyFilter?: string): Promise<SamedayCity[]> {
    let endpoint = '/api/geolocation/city?countPerPage=1000';
    if (countyFilter) {
      endpoint += `&county=${encodeURIComponent(countyFilter)}`;
    }
    const response = await this.apiRequest<{ data: SamedayCity[] }>(endpoint);
    return response.data;
  }

  async createAWB(awbData: CreateAWBRequest): Promise<CreateAWBResponse> {
    console.log('🚚 Creating AWB with Sameday:', JSON.stringify(awbData, null, 2));
    
    // Force fresh authentication before AWB creation to prevent token expiry
    console.log('🔄 Ensuring fresh token for AWB creation...');
    this.token = null; // Clear cached token
    
    const response = await this.apiRequest<CreateAWBResponse>('/api/awb', {
      method: 'POST',
      body: JSON.stringify(awbData),
    });

    console.log('✅ AWB created successfully:', response.awbNumber);
    return response;
  }

  async getAWBPDF(awbNumber: string): Promise<Buffer> {
    const token = await this.authenticate();
    
    const response = await fetch(`${this.config.baseUrl}/api/awb/${awbNumber}/pdf`, {
      headers: {
        'X-AUTH-TOKEN': token,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get AWB PDF: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async trackAWB(awbNumber: string): Promise<any> {
    return this.apiRequest(`/api/awb/${awbNumber}/status-history`);
  }
}

// Factory function to create Sameday API instance
let samedayInstance: SamedayAPI | null = null;

export function createSamedayAPI(): SamedayAPI | null {
  if (samedayInstance) {
    return samedayInstance;
  }

  const username = process.env.SAMEDAY_USERNAME;
  const password = process.env.SAMEDAY_PASSWORD;
  const baseUrl = process.env.SAMEDAY_BASE_URL || 'https://api.sameday.ro';

  if (!username || !password) {
    console.warn('⚠️ Sameday credentials not configured');
    return null;
  }

  samedayInstance = new SamedayAPI({
    baseUrl,
    username,
    password,
  });
  return samedayInstance;
}