import fetch from 'node-fetch';

export interface SamedayConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface SamedayAuthResponse {
  token: string;
  expire_at: string;
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
}

export interface CreateAWBRequest {
  pickupPoint: number;
  contactPerson?: number;
  service: number;
  packageType: number;
  packageWeight: number;
  awbPayment: number;
  awbRecipient: {
    name: string;
    phoneNumber: string;
    personType: number;
    companyName?: string;
    address: string;
    county?: number;
    city?: number;
    countyString?: string;
    cityString?: string;
    postalCode?: string;
  };
  parcels: AWBParcel[];
  cashOnDelivery?: number;
  insuredValue?: number;
  thirdPartyPickup?: number;
  observation?: string;
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

    const url = `${this.config.baseUrl}/api/authenticate?remember_me=1`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-AUTH-USERNAME': this.config.username,
          'X-AUTH-PASSWORD': this.config.password,
        }
      });

      console.log(`📡 Auth response: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Sameday auth failed: ${response.status} - ${errorText.substring(0, 200)}`);
        throw new Error(`Sameday authentication failed: ${response.status}`);
      }

      const authData = await response.json() as SamedayAuthResponse;
      this.token = authData.token;
      this.tokenExpiry = new Date(authData.expire_at.replace(' ', 'T') + ':00');
      
      console.log('✅ Sameday authenticated, token expires:', authData.expire_at);
      return this.token;
    } catch (error: any) {
      console.error(`❌ Sameday auth error:`, error.message);
      throw error;
    }
  }

  private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.authenticate();
    
    console.log(`🔗 Sameday API: ${options.method || 'GET'} ${endpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'X-AUTH-TOKEN': token,
          'Accept': 'application/json',
          ...(options.headers as Record<string, string>),
        },
      });

      clearTimeout(timeoutId);
      console.log(`📡 Sameday response: ${response.status} for ${endpoint}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Sameday API error: ${response.status} - ${errorText}`);
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.errors?.children) {
            const fieldErrors: string[] = [];
            for (const [field, val] of Object.entries(errorJson.errors.children)) {
              const v = val as any;
              if (v?.errors?.length > 0) {
                fieldErrors.push(`${field}: ${v.errors.join(', ')}`);
              }
              if (v?.children) {
                for (const [subField, subVal] of Object.entries(v.children)) {
                  const sv = subVal as any;
                  if (sv?.errors?.length > 0) {
                    fieldErrors.push(`${field}.${subField}: ${sv.errors.join(', ')}`);
                  }
                }
              }
            }
            if (fieldErrors.length > 0) {
              console.error(`❌ Sameday validation field errors:`, fieldErrors);
            } else {
              console.error(`❌ Sameday validation failed with no specific field errors (root-level constraint)`);
            }
          }
        } catch (_) {}
        throw new Error(`Sameday API error: ${response.status} - ${errorText}`);
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Sameday API timeout for ${endpoint}`);
      }
      throw error;
    }
  }

  async getPickupPoints(): Promise<SamedayPickupPoint[]> {
    const response = await this.apiRequest<{ data: SamedayPickupPoint[] }>('/api/client/pickup-points');
    return response.data || [];
  }

  async getServices(): Promise<SamedayService[]> {
    const response = await this.apiRequest<{ data: SamedayService[] }>('/api/client/services');
    return response.data || [];
  }

  async getCounties(): Promise<SamedayCounty[]> {
    const response = await this.apiRequest<{ data: SamedayCounty[] }>('/api/geolocation/county');
    return response.data || [];
  }

  async getCities(countyFilter?: string): Promise<SamedayCity[]> {
    let endpoint = '/api/geolocation/city?countPerPage=1000';
    if (countyFilter) {
      endpoint += `&county=${encodeURIComponent(countyFilter)}`;
    }
    const response = await this.apiRequest<{ data: SamedayCity[] }>(endpoint);
    return response.data || [];
  }

  async createAWB(awbData: CreateAWBRequest): Promise<CreateAWBResponse> {
    const formBody = new URLSearchParams();
    
    formBody.append('pickupPoint', String(awbData.pickupPoint));
    if (awbData.contactPerson) {
      formBody.append('contactPerson', String(awbData.contactPerson));
    }
    formBody.append('service', String(awbData.service));
    formBody.append('packageType', String(awbData.packageType));
    formBody.append('packageNumber', String(awbData.parcels.length));
    
    let totalWeight = 0;
    awbData.parcels.forEach((parcel, i) => {
      const parcelWeight = parseFloat(String(parcel.weight)) || 1;
      formBody.append(`parcels[${i}][weight]`, parcelWeight.toFixed(2));
      if (parcel.width) formBody.append(`parcels[${i}][width]`, String(parcel.width));
      if (parcel.length) formBody.append(`parcels[${i}][length]`, String(parcel.length));
      if (parcel.height) formBody.append(`parcels[${i}][height]`, String(parcel.height));
      totalWeight += parcelWeight;
    });
    const finalWeight = parseFloat(String(awbData.packageWeight || totalWeight)) || 1;
    formBody.append('packageWeight', finalWeight.toFixed(2));
    
    formBody.append('awbPayment', String(awbData.awbPayment));
    formBody.append('cashOnDelivery', String(awbData.cashOnDelivery || 0));
    formBody.append('insuredValue', String(awbData.insuredValue || 0));
    formBody.append('thirdPartyPickup', String(awbData.thirdPartyPickup || 0));
    
    formBody.append('awbRecipient[name]', awbData.awbRecipient.name);
    formBody.append('awbRecipient[phoneNumber]', awbData.awbRecipient.phoneNumber);
    formBody.append('awbRecipient[personType]', String(awbData.awbRecipient.personType));
    formBody.append('awbRecipient[address]', awbData.awbRecipient.address);
    
    if (awbData.awbRecipient.companyName) {
      formBody.append('awbRecipient[companyName]', awbData.awbRecipient.companyName);
    }
    if (awbData.awbRecipient.postalCode) {
      formBody.append('awbRecipient[postalCode]', awbData.awbRecipient.postalCode);
    }
    
    if (awbData.awbRecipient.county) {
      formBody.append('awbRecipient[county]', String(awbData.awbRecipient.county));
    } else if (awbData.awbRecipient.countyString) {
      formBody.append('awbRecipient[countyString]', awbData.awbRecipient.countyString);
    }
    
    if (awbData.awbRecipient.city) {
      formBody.append('awbRecipient[city]', String(awbData.awbRecipient.city));
    } else if (awbData.awbRecipient.cityString) {
      formBody.append('awbRecipient[cityString]', awbData.awbRecipient.cityString);
    }
    
    if (awbData.observation) {
      formBody.append('observation', awbData.observation);
    }
    if (awbData.clientInternalReference) {
      formBody.append('clientInternalReference', awbData.clientInternalReference);
    }

    const formString = formBody.toString();
    console.log('🚚 Creating AWB with form data:', formString);
    
    const response = await this.apiRequest<CreateAWBResponse>('/api/awb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formString,
    });

    console.log('✅ AWB created:', response.awbNumber);
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
