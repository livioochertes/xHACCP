import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { useTranslation, I18nextProvider } from "react-i18next";
import i18n from "./i18n.js";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import {
  broadcastCategoryTranslationUpdate,
  subscribeToCategoryTranslationUpdates,
} from "./categoryTranslationSync.js";

    
    // Define global functions first before React components
    console.log('Defining uploadCategoryImage function on window object');
    window.uploadCategoryImage = async (categoryId, file) => {
      try {
        const token = localStorage.getItem('adminToken');
        console.log('uploadCategoryImage called with:', { categoryId, fileName: file.name, fileSize: file.size, fileType: file.type });
        console.log('Current token:', token);
        
        // Validate file
        if (!file) {
          return { success: false, message: 'No file provided' };
        }
        
        if (!file.type.startsWith('image/')) {
          return { success: false, message: 'File must be an image' };
        }
        
        const formData = new FormData();
        formData.append('image', file);
        
        console.log('FormData created successfully');
        console.log('FormData entries:', [...formData.entries()].map(([key, value]) => [key, value instanceof File ? `File: ${value.name}` : value]));
        
        const url = `/admin/api/categories/${categoryId}/upload-image`;
        console.log('Making request to:', url);
        
        // Test if the URL is reachable first
        try {
          const testResponse = await fetch(url, {
            method: 'OPTIONS',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          console.log('OPTIONS request status:', testResponse.status);
        } catch (optionsError) {
          console.error('OPTIONS request failed:', optionsError);
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        console.log('POST response received');
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        if (response.ok) {
          const result = JSON.parse(responseText);
          console.log('Upload successful, result:', result);
          return { success: true, message: result.message, imageUrl: result.imageUrl };
        } else {
          try {
            const error = JSON.parse(responseText);
            console.log('Upload failed, error:', error);
            return { success: false, message: error.message };
          } catch (parseError) {
            console.log('Failed to parse error response:', parseError);
            return { success: false, message: `HTTP ${response.status}: ${responseText}` };
          }
        }
      } catch (error) {
        console.error('Error uploading category image:', error);
        console.error('Error stack:', error.stack);
        return { success: false, message: `Network error: ${error.message}` };
      }
    };
    
    window.fetchCategories = async (setCategoriesCallback) => {
      try {
        const token = localStorage.getItem('adminToken');
        const market = sessionStorage.getItem('adminMarketTab');
        const params = new URLSearchParams();
        if (market && market !== 'all') params.set('market', market);
        if (i18n.language) params.set('language', i18n.language);
        const query = params.toString();
        const response = await fetch(`/admin/api/categories${query ? `?${query}` : ''}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // Update React state if callback provided
          if (setCategoriesCallback && typeof setCategoriesCallback === 'function') {
            setCategoriesCallback(data);
          }
          return data;
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    
    console.log('Global functions defined successfully');
    
    // Admin Login Component
    function AdminLogin({ onLoginSuccess }) {
      const { t } = useTranslation();
      const [formData, setFormData] = useState({ email: '', password: '' });
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const [showPassword, setShowPassword] = useState(false);

      // Forgot password state
      const [showForgot, setShowForgot] = useState(false);
      const [forgotEmail, setForgotEmail] = useState('');
      const [forgotLoading, setForgotLoading] = useState(false);
      const [forgotMsg, setForgotMsg] = useState('');
      const [forgotError, setForgotError] = useState('');
      
      const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
          const response = await fetch('/admin/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });
          const data = await response.json();
          if (response.ok) {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.admin));
            onLoginSuccess(data.token, data.admin);
          } else {
            setError(data.message || 'Login failed');
          }
        } catch (err) {
          setError('Network error. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      const handleForgot = async (e) => {
        e.preventDefault();
        setForgotLoading(true);
        setForgotMsg('');
        setForgotError('');
        try {
          const response = await fetch('/admin/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: forgotEmail }),
          });
          const data = await response.json();
          if (response.ok) {
            setForgotMsg(data.message || 'Email trimis. Verificați inbox-ul.');
          } else {
            setForgotError(data.message || 'Eroare la trimiterea emailului.');
          }
        } catch (err) {
          setForgotError('Eroare de rețea. Încercați din nou.');
        } finally {
          setForgotLoading(false);
        }
      };
      
      return (
        <>
        <div className="login-container">
          <div className="login-header">
            <div className="login-logo">
              <img src="/attached_assets/logo_xHACCP-S1_1772812623761.png" alt="xHACCP Logo" />
            </div>
            <h1 className="login-title">Admin Panel</h1>
            <p className="login-subtitle">Welcome back! Please sign in to continue.</p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="admin@xhaccp.com"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(formData.email); setForgotMsg(''); setForgotError(''); }}
                  style={{background:'none', border:'none', color:'#6c63ff', fontSize:'13px', cursor:'pointer', padding:'0', fontWeight:'500'}}
                >
                  Forgot password?
                </button>
              </label>
              <div style={{position:'relative'}}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  placeholder="Enter your password"
                  style={{paddingRight:'44px'}}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', cursor:'pointer', padding:'0',
                    color:'#888', fontSize:'18px', lineHeight:1, display:'flex', alignItems:'center'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            
            <button type="submit" className="btn" disabled={loading}>
              {loading && <span className="loading"></span>}
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>

        {/* Forgot Password Modal — outside login-container to avoid grey box */}
        {showForgot && (
            <div style={{
              position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
              display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999
            }} onClick={() => setShowForgot(false)}>
              <div style={{
                background:'white', borderRadius:'12px', padding:'32px', width:'100%',
                maxWidth:'400px', margin:'16px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)'
              }} onClick={e => e.stopPropagation()}>
                <h3 style={{margin:'0 0 8px', color:'#333', fontSize:'20px'}}>Reset Password</h3>
                <p style={{margin:'0 0 20px', color:'#666', fontSize:'14px'}}>
                  Introduceți adresa de email. Veți primi un email cu o parolă temporară.
                </p>
                {forgotMsg ? (
                  <div style={{padding:'12px 16px', background:'#d4edda', borderRadius:'8px', color:'#155724', marginBottom:'16px', fontSize:'14px'}}>
                    ✅ {forgotMsg}
                  </div>
                ) : (
                  <form onSubmit={handleForgot}>
                    {forgotError && (
                      <div style={{padding:'10px 14px', background:'#f8d7da', borderRadius:'6px', color:'#721c24', marginBottom:'12px', fontSize:'13px'}}>
                        {forgotError}
                      </div>
                    )}
                    <div style={{marginBottom:'16px'}}>
                      <label style={{display:'block', marginBottom:'6px', fontSize:'13px', fontWeight:'600', color:'#555'}}>Email</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        required
                        placeholder="admin@xhaccp.com"
                        style={{width:'100%', padding:'10px 14px', border:'1px solid #ddd', borderRadius:'8px', fontSize:'14px', boxSizing:'border-box'}}
                      />
                    </div>
                    <div style={{display:'flex', gap:'10px'}}>
                      <button
                        type="button"
                        onClick={() => setShowForgot(false)}
                        style={{flex:1, padding:'10px', border:'1px solid #ddd', borderRadius:'8px', background:'white', cursor:'pointer', fontSize:'14px', color:'#555'}}
                      >
                        Anulează
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        style={{flex:1, padding:'10px', border:'none', borderRadius:'8px', background:'#6c63ff', color:'white', cursor:forgotLoading?'not-allowed':'pointer', fontSize:'14px', fontWeight:'600', opacity:forgotLoading?0.7:1}}
                      >
                        {forgotLoading ? 'Se trimite...' : 'Trimite email'}
                      </button>
                    </div>
                  </form>
                )}
                {forgotMsg && (
                  <button
                    onClick={() => setShowForgot(false)}
                    style={{width:'100%', marginTop:'12px', padding:'10px', border:'none', borderRadius:'8px', background:'#6c63ff', color:'white', cursor:'pointer', fontSize:'14px', fontWeight:'600'}}
                  >
                    Închide
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      );
    }
    
    // Admin Dashboard Component
    function AdminDashboard({ token, admin, onLogout }) {
      const { t } = useTranslation();
      const getCategoryName = (category) => category?.localizedName || category?.name || 'N/A';
      const marketCurrencies = { ro: 'RON', fr: 'EUR', com: 'EUR' };
      const getMarketCurrency = (market) => marketCurrencies[market] || '';
      const getProductCurrency = (product) => {
        const currency = typeof product?.currency === 'string'
          ? product.currency.trim().toUpperCase()
          : product?.currency;
        return currency || (selectedMarketTab !== 'all' ? getMarketCurrency(selectedMarketTab) : '—');
      };
      const formatAdminPrice = (price, currency) => {
        if (price === null || price === undefined || price === '' || !Number.isFinite(Number(price))) {
          return '—';
        }
        return `${Number(price).toFixed(2)} ${currency || '—'}`;
      };
      // Helper function to extract URL from image (handles both objects and strings)
      const getImageUrlGlobal = (image) => {
        if (!image) return '';
        if (typeof image === 'string') {
          if (image.startsWith('{') && image.includes('"url"')) {
            try {
              const parsed = JSON.parse(image);
              return parsed.thumbnailUrl || parsed.url || '';
            } catch {
              return image;
            }
          }
          return image;
        }
        if (typeof image === 'object') {
          return image.thumbnailUrl || image.url || '';
        }
        return '';
      };

      const [stats, setStats] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState('');
      const [showTwoFactor, setShowTwoFactor] = useState(false);
      const [activeView, setActiveView] = useState('dashboard');
      const adminIsSuperAdmin = !admin?.adminMarkets || admin.adminMarkets.length === 0;
      const [selectedMarketTab, setSelectedMarketTab] = useState(() => {
        const saved = sessionStorage.getItem('adminMarketTab');
        const allowed = admin?.adminMarkets || [];
        if (allowed.length > 0) return (saved && allowed.includes(saved)) ? saved : allowed[0];
        return saved || 'all';
      });
      const [orders, setOrders] = useState([]);
      const [wmsOverview, setWmsOverview] = useState({ partners: [], routing: [] });
      const [wmsLoading, setWmsLoading] = useState(false);
      const [wmsPartnerForm, setWmsPartnerForm] = useState({ name: '', code: '' });
      const [wmsKeyForm, setWmsKeyForm] = useState({ partnerId: '', environment: 'production' });
      const [wmsKeys, setWmsKeys] = useState([]);
      const [wmsSelectedPartner, setWmsSelectedPartner] = useState(null);
      const [wmsPlaintextKey, setWmsPlaintextKey] = useState('');
      const [wmsAudit, setWmsAudit] = useState([]);
      const [wmsOrderId, setWmsOrderId] = useState('');
      const [wmsOrderTimeline, setWmsOrderTimeline] = useState(null);
      const [wmsFocusedMarket, setWmsFocusedMarket] = useState('ro');
      const [wmsOriginAddresses, setWmsOriginAddresses] = useState({
        ro: { market: 'ro', samedayPickupPointId: '', companyName: '', address: '', city: '', state: '', zipCode: '', country: 'RO', phone: '', email: '' },
        fr: { market: 'fr', samedayPickupPointId: '', companyName: '', address: '', city: '', state: '', zipCode: '', country: 'FR', phone: '', email: '' },
        com: { market: 'com', samedayPickupPointId: '', companyName: '', address: '', city: '', state: '', zipCode: '', country: 'RO', phone: '', email: '' }
      });
      const [wmsOriginLoading, setWmsOriginLoading] = useState(false);
      const [wmsOriginSaving, setWmsOriginSaving] = useState(false);
      const [wmsSamedayPickupPoints, setWmsSamedayPickupPoints] = useState([]);
      const [wmsSamedayPickupPointsLoading, setWmsSamedayPickupPointsLoading] = useState(false);
      const [users, setUsers] = useState([]);
      const [products, setProducts] = useState([]);
      const [categories, setCategories] = useState([]);
      const categoriesRequestIdRef = React.useRef(0);
      const [suppliers, setSuppliers] = useState([]);
      const [showAddUserModal, setShowAddUserModal] = useState(false);
      const [showAddProductModal, setShowAddProductModal] = useState(false);
      const [showAddOrderModal, setShowAddOrderModal] = useState(false);
      const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
      const [editingUser, setEditingUser] = useState(null);
      const [editingProduct, setEditingProduct] = useState(null);
      const [editingCategory, setEditingCategory] = useState(null);
      const [selectedOrders, setSelectedOrders] = useState([]);
      const [showBulkModal, setShowBulkModal] = useState(false);
      const [bulkOperation, setBulkOperation] = useState('');
      const [bulkResults, setBulkResults] = useState(null);
      const [searchTerm, setSearchTerm] = useState('');
      const [companySearch, setCompanySearch] = useState('');
      const [statusFilter, setStatusFilter] = useState('all');
      const [showSearchFilter, setShowSearchFilter] = useState(false);
      const [filteredOrders, setFilteredOrders] = useState([]);
      const [ordersPage, setOrdersPage] = useState(1);
      const [selectedOrder, setSelectedOrder] = useState(null);
      const [showOrderDetails, setShowOrderDetails] = useState(false);
      const [statusChangeOrderId, setStatusChangeOrderId] = useState(null);
      const [statusChangeValue, setStatusChangeValue] = useState('');
      const [showOrderTools, setShowOrderTools] = useState(false);
      const [selectedProducts, setSelectedProducts] = useState([]);
      const [showProductBulkActions, setShowProductBulkActions] = useState(false);
      const [productSearchTerm, setProductSearchTerm] = useState('');
      const [productCategoryFilter, setProductCategoryFilter] = useState('all');
      const [productStatusFilter, setProductStatusFilter] = useState('all');
      const [filteredProducts, setFilteredProducts] = useState([]);
      const [productPage, setProductPage] = useState(1);
      const productsRequestIdRef = React.useRef(0);
      const productsPerPage = 20;
      const [showProductAnalytics, setShowProductAnalytics] = useState(false);
      const [analyticsData, setAnalyticsData] = useState(null);
      const [showExcelActions, setShowExcelActions] = useState(false);
      const [editingSupplier, setEditingSupplier] = useState(null);
      const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
      const [viewingSupplier, setViewingSupplier] = useState(null);
      const [showViewSupplierModal, setShowViewSupplierModal] = useState(false);
      const [supplierDetails, setSupplierDetails] = useState(null);
      const [selectedSuppliers, setSelectedSuppliers] = useState([]);
      const [showSupplierBulkModal, setShowSupplierBulkModal] = useState(false);
      const [supplierBulkOperation, setSupplierBulkOperation] = useState('');
      // Ref for initial supplier data - used to pass data to ModalsComponent without causing re-renders
      const supplierInitialDataRef = React.useRef(null);
      
      // Trigger for ModalsComponent to know when to load new supplier data
      const [supplierLoadTrigger, setSupplierLoadTrigger] = useState(0);
      
      const [showHomepageConfigModal, setShowHomepageConfigModal] = useState(false);
      const [homepageConfig, setHomepageConfig] = useState({
        mainTop: [],
        mainShop: []
      });
      const emptyHeroSlide = () => ({
        slideType: 'text',
        imageUrl: '',
        imageAlt: '',
        title: '',
        subtitle: '',
        ctaLabel: '',
        ctaUrl: '/products',
        ctaType: 'link',
        destinationType: 'none',
        destinationId: '',
        destinationUrl: '',
        isActive: true
      });
      const [heroSlides, setHeroSlides] = useState([]);
      const [heroSettings, setHeroSettings] = useState({ autoplaySeconds: 5 });
      const [heroForm, setHeroForm] = useState(emptyHeroSlide());
      const [editingHeroSlide, setEditingHeroSlide] = useState(null);
      const [heroLoading, setHeroLoading] = useState(false);
      const [heroSaving, setHeroSaving] = useState(false);
      const [heroUploading, setHeroUploading] = useState(false);
      
      // Blog state
      const [blogPosts, setBlogPosts] = useState([]);
      const [blogGenerating, setBlogGenerating] = useState(false);
      const [blogGenerateForm, setBlogGenerateForm] = useState({ title: '', category: 'HACCP', language: (() => { const _m = sessionStorage.getItem('adminMarketTab'); return _m === 'fr' ? 'fr' : _m === 'com' ? 'en' : 'ro'; })() });
      const [editingBlogPost, setEditingBlogPost] = useState(null);
      const [previewBlogPost, setPreviewBlogPost] = useState(null);
      const [blogEditForm, setBlogEditForm] = useState({ title: '', excerpt: '', content: '', imageUrl: '', category: '', published: true });
      const [scheduleConfig, setScheduleConfig] = useState({ enabled: true, intervalDays: 7, hour: 8 });
      const [scheduleLoaded, setScheduleLoaded] = useState(false);
      const [googleFeedData, setGoogleFeedData] = useState(null);
      const [googleFeedLoading, setGoogleFeedLoading] = useState(false);
      const [googleFeedSaving, setGoogleFeedSaving] = useState(false);
      const [googleFeedProductSearch, setGoogleFeedProductSearch] = useState('');

      // Invoices state
      const [adminInvoices, setAdminInvoices] = useState([]);
      const [invoiceCounters, setInvoiceCounters] = useState([]);
      const [invoicesLoading, setInvoicesLoading] = useState(false);
      const [invoiceMarketFilter, setInvoiceMarketFilter] = useState('all');
      const [invoiceDetailModal, setInvoiceDetailModal] = useState(null);
      const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
      const [showManualInvoiceModal, setShowManualInvoiceModal] = useState(false);
      const [sendInvoiceEmailModal, setSendInvoiceEmailModal] = useState(null);

      // Voucher state
      const [vouchers, setVouchers] = useState([]);
      const [showAddVoucherModal, setShowAddVoucherModal] = useState(false);
      const [editingVoucher, setEditingVoucher] = useState(null);
      const [eventVoucherData, setEventVoucherData] = useState(null);
      const [eventVoucherLoading, setEventVoucherLoading] = useState(false);
      const [eventVoucherSaving, setEventVoucherSaving] = useState(false);
      const [voucherForm, setVoucherForm] = useState({
        code: '',
        name: '',
        discountType: 'fixed',
        discountValue: '',
        minOrderAmount: '',
        maxUses: '',
        isActive: true,
        validFrom: '',
        validUntil: '',
        marketCode: 'ro'
      });
      const [marketsData, setMarketsData] = useState({ro: null, fr: null, com: null});
      const [marketsLoading, setMarketsLoading] = useState(false);
      const [marketFilter, setMarketFilter] = useState('all');
      const [marketingSegments, setMarketingSegments] = useState([]);
      const [marketingCampaigns, setMarketingCampaigns] = useState([]);
      const [marketingLoading, setMarketingLoading] = useState(false);
      const [marketingSaving, setMarketingSaving] = useState(false);
      const [marketingPreview, setMarketingPreview] = useState(null);
      const [eventVoucherContacts, setEventVoucherContacts] = useState([]);
      const [eventVoucherContactsLoading, setEventVoucherContactsLoading] = useState(false);
      const [eventVoucherContactSearch, setEventVoucherContactSearch] = useState('');
      const [marketingSegmentForm, setMarketingSegmentForm] = useState({
        name: '', hasOrders: 'any', hasAbandonedCart: 'any', eventVoucherCampaign: 'any'
      });
      const [marketingCampaignForm, setMarketingCampaignForm] = useState({
        name: '', market: 'ro', segmentId: '', subject: '', htmlContent: '', textContent: ''
      });
      const [reminderThresholds, setReminderThresholds] = useState({
        ro: [24, null, null, null, null],
        fr: [24, null, null, null, null],
        com: [24, null, null, null, null]
      });
      const [productMarketsMap, setProductMarketsMap] = useState({});
      const [editingProductMarkets, setEditingProductMarkets] = useState({ro: null, fr: null, com: null});

      const [companySettings, setCompanySettings] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        contactPerson: '',
        website: '',
        vatNumber: '',
        registrationNumber: '',
        description: ''
      });
      const [showCompanySettingsModal, setShowCompanySettingsModal] = useState(false);
      const [showExcelImportModal, setShowExcelImportModal] = useState(false);
      const [excelFile, setExcelFile] = useState(null);
      const [importResults, setImportResults] = useState(null);
      const [importDuplicates, setImportDuplicates] = useState(null); // { duplicates, parseErrors, total, strategies }
      
      // Initial product data for new products - passed to ModalsComponent
      const [initialProductData, setInitialProductData] = useState(null);
      const [modalKey, setModalKey] = useState(0); // Used to force re-mount of modal with fresh state
      
      // Product translations state - at top level to survive modal remount
      const [productTranslations, setProductTranslations] = useState([]);
      const [showTranslationsTab, setShowTranslationsTab] = useState(false);
      // newTranslation and editingTranslation moved to ModalsComponent to prevent focus loss
      
      // Ref to track last loaded product ID - at AdminDashboard level to survive modal remount
      const lastLoadedProductIdRef = React.useRef(null);
      
      // Ref for initial product data - used to pass data to ModalsComponent without causing re-renders
      const initialProductDataRef = React.useRef(null);
      
      // Trigger for ModalsComponent to know when to load new product data
      const [productLoadTrigger, setProductLoadTrigger] = useState(0);
      
      // Initialize editing data - stores in ref to avoid re-renders, then triggers modal
      useEffect(() => {
        if (editingProduct) {
          // Only initialize if this is a different product than what we already loaded
          if (lastLoadedProductIdRef.current === editingProduct.id) {
            return; // Already loaded this product, skip re-initialization
          }
          
          console.log('Loading product for editing:', editingProduct.id);
          
          // Mark this product as loaded
          lastLoadedProductIdRef.current = editingProduct.id;
          
          // Store initial data in ref (doesn't cause re-render)
          initialProductDataRef.current = {
            name: editingProduct.name || '',
            description: editingProduct.description || '',
            price: editingProduct.price || '',
            compareAtPrice: editingProduct.compareAtPrice || '',
            categoryId: editingProduct.categoryId || '',
            supplierId: editingProduct.supplierId || '',
            imageUrl: editingProduct.imageUrl || '',
            stockQuantity: editingProduct.stockQuantity || '',
            featured: editingProduct.featured || false,
            vatValue: editingProduct.vatValue || '',
            // Older products were created with the obsolete 21% fallback.
            // When editing them from the French market, present the French
            // standard rate so saving the product corrects that old default.
            vatPercentage: selectedMarketTab === 'fr' && (!editingProduct.vatPercentage || Number(editingProduct.vatPercentage) === 21)
              ? '20.00'
              : (editingProduct.vatPercentage || (selectedMarketTab === 'ro' ? '19.00' : '0.00')),
            currency: editingProduct.currency || 'EUR',
            productCode: editingProduct.productCode || '',
            ean: editingProduct.ean || '',
            ncCode: editingProduct.ncCode || '',
            cpvCode: editingProduct.cpvCode || '',
            status: editingProduct.status || 'active',
            images: editingProduct.images || [],
            weight: editingProduct.weight?.toString() || '',
            length: editingProduct.length?.toString() || '',
            width: editingProduct.width?.toString() || '',
            height: editingProduct.height?.toString() || '',
            piecesPerPackage: editingProduct.piecesPerPackage?.toString() || '',
            productQuantity: editingProduct.productQuantity || '',
            specs: Array.isArray(editingProduct.specs) ? editingProduct.specs : [],
            volumeDiscounts: Array.isArray(editingProduct.volumeDiscounts) ? editingProduct.volumeDiscounts : [],
            priority: editingProduct.priority || 0,
            productType: editingProduct.productType || (editingProduct.isService ? 'service' : 'standard'),
            isService: editingProduct.isService || false,
            isComposite: editingProduct.isComposite || false
          };
          
          // Trigger ModalsComponent to load the data
          setProductLoadTrigger(prev => prev + 1);
          setShowAddProductModal(true);
          
          // Fetch translations for the product
          const fetchTranslations = async () => {
            try {
              const response = await fetch(`/admin/api/products/${editingProduct.id}/translations`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                const translations = await response.json();
                setProductTranslations(translations);
              }
            } catch (error) {
              console.error('Error fetching translations:', error);
              setProductTranslations([]);
            }
          };
          fetchTranslations();
          
          const fetchProductMarketData = async () => {
            try {
              const response = await fetch(`/admin/api/products/${editingProduct.id}/markets`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                const data = await response.json();
                const map = { ro: null, fr: null, com: null };
                data.forEach(pm => { map[pm.market] = pm; });
                setEditingProductMarkets(map);
              }
            } catch (error) {
              console.error('Error fetching product markets:', error);
              setEditingProductMarkets({ ro: null, fr: null, com: null });
            }
          };
          fetchProductMarketData();
        } else {
          // Reset ref when modal is closed (editingProduct becomes null)
          lastLoadedProductIdRef.current = null;
          initialProductDataRef.current = null;
          setEditingProductMarkets({ ro: null, fr: null, com: null });
        }
      }, [editingProduct?.id]);
      
      useEffect(() => {
        fetchStats();
      }, []);
      
      // Re-normalize selectedMarketTab when admin data is confirmed — ensures market-restricted
      // admins never land on 'all' (e.g. from stale sessionStorage before auth resolves)
      useEffect(() => {
        if (admin?.adminMarkets && admin.adminMarkets.length > 0) {
          const allowed = admin.adminMarkets;
          if (selectedMarketTab === 'all' || !allowed.includes(selectedMarketTab)) {
            setSelectedMarketTab(allowed[0]);
          }
        }
      }, [admin]);

      // Sync selectedMarketTab → marketFilter (and save to sessionStorage)
      // Also refetch active-tab data so switching marketplace filters all views
      useEffect(() => {
        sessionStorage.setItem('adminMarketTab', selectedMarketTab);
        setMarketFilter(selectedMarketTab);
        setProductCategoryFilter('all');
        setProductPage(1);
        fetchStats(selectedMarketTab);
        if (activeView === 'users') fetchUsers();
        else if (activeView === 'products') {
          fetchProducts(selectedMarketTab);
        }
        else if (activeView === 'suppliers') fetchSuppliers();
        else if (activeView === 'vouchers') {
          fetchVouchers();
          fetchEventVoucher();
        }
        else if (activeView === 'blog') fetchBlogPosts();
        else if (activeView === 'google-feed') fetchGoogleFeed();
        else if (activeView === 'invoices') { setInvoiceMarketFilter('all'); fetchInvoices(selectedMarketTab); fetchInvoiceCounters(); }
        else if (activeView === 'homepage-hero') {
          fetchHeroSlides();
          fetchProducts(selectedMarketTab);
        }
        else if (activeView === 'company-settings') { fetchCompanySettings(); fetchMarkets(); fetchInvoiceCounters(); }
        else if (activeView === 'marketing') { fetchMarkets(); fetchMarketing(); }
        else if (activeView === 'wms') { fetchWmsOverview(); }
      }, [selectedMarketTab, i18n.language]);

      useEffect(() => {
        if (selectedMarketTab !== 'all') {
          setWmsFocusedMarket(selectedMarketTab);
          return;
        }
        const allowedMarkets = adminIsSuperAdmin ? ['ro', 'fr', 'com'] : (admin?.adminMarkets || []);
        if (!allowedMarkets.includes(wmsFocusedMarket)) {
          setWmsFocusedMarket(allowedMarkets[0] || 'ro');
        }
      }, [selectedMarketTab, admin]);

      // Category labels are consumed by the category list, product editor and
      // filter, and homepage selectors. Refresh them independently of the
      // active tab so every open consumer receives the same localized rows.
      useEffect(() => {
        refreshCategorySelectors();
      }, [selectedMarketTab]);

      useEffect(() => {
        return subscribeToCategoryTranslationUpdates(({ market } = {}) => {
          if (market && selectedMarketTab !== 'all' && market !== selectedMarketTab) {
            return;
          }
          refreshCategorySelectors();
        });
      }, [selectedMarketTab]);

      // A category belongs to exactly one marketplace. Never carry a selected
      // category into another marketplace while editing a Cover slide.
      useEffect(() => {
        if (activeView === 'homepage-hero') {
          setHeroForm(prev => (
            prev.destinationType === 'category'
              ? { ...prev, destinationId: '' }
              : prev
          ));
        }
      }, [selectedMarketTab]);

      // Refetch orders from server when market filter changes (server-side filtering)
      useEffect(() => {
        if (activeView === 'orders') {
          fetchOrders(marketFilter);
        }
      }, [marketFilter, activeView]);

      // Filter orders based on search, status and market
      useEffect(() => {
        let filtered = orders;
        
        if (searchTerm) {
          filtered = filtered.filter(order => 
            order.id.toString().includes(searchTerm) ||
            ((order.shippingAddress.firstName || '') + ' ' + (order.shippingAddress.lastName || '')).toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.shippingAddress.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.status.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        if (companySearch) {
          filtered = filtered.filter(order =>
            (order.billingAddress?.companyName || '').toLowerCase().includes(companySearch.toLowerCase())
          );
        }
        
        if (statusFilter !== 'all') {
          filtered = filtered.filter(order => order.status === statusFilter);
        }

        if (marketFilter !== 'all') {
          filtered = filtered.filter(order => (order.market || 'ro') === marketFilter);
        }
        
        setFilteredOrders(filtered);
        setOrdersPage(1);
      }, [orders, searchTerm, companySearch, statusFilter, marketFilter]);
      
      // Filter products based on search and filters
      useEffect(() => {
        let filtered = products;

        const normalizedSearchTerm = productSearchTerm.trim().toLowerCase();
        if (normalizedSearchTerm.length >= 3) {
          filtered = filtered.filter(product => 
            product.name.toLowerCase().includes(normalizedSearchTerm) ||
            product.id.toString().includes(normalizedSearchTerm) ||
            getCategoryName(product.category).toLowerCase().includes(normalizedSearchTerm)
          );
        }
        
        if (productCategoryFilter !== 'all') {
          filtered = filtered.filter(product => product.categoryId === parseInt(productCategoryFilter));
        }
        
        if (productStatusFilter !== 'all') {
          filtered = filtered.filter(product => (product.status || 'active') === productStatusFilter);
        }
        
        setFilteredProducts(filtered);
        setProductPage(1);
        console.log('Products filtered:', {
          searchTerm: productSearchTerm,
          categoryFilter: productCategoryFilter,
          statusFilter: productStatusFilter,
          totalProducts: products.length,
          filteredProducts: filtered.length
        });
      }, [products, productSearchTerm, productCategoryFilter, productStatusFilter]);
      
      const fetchStats = async (market) => {
        const mkt = market !== undefined ? market : selectedMarketTab;
        const marketParam = mkt && mkt !== 'all' ? `?market=${mkt}` : '';
        try {
          const response = await fetch(`/admin/api/stats${marketParam}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setStats(data);
          } else {
            setError(data.message || 'Failed to fetch stats');
          }
        } catch (err) {
          setError('Network error. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      const fetchUsers = async () => {
        try {
          const marketParam = selectedMarketTab && selectedMarketTab !== 'all' ? `?market=${selectedMarketTab}` : '';
          const response = await fetch(`/admin/api/users${marketParam}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setUsers(data);
          } else {
            console.error('Failed to fetch users:', data.message);
          }
        } catch (err) {
          console.error('Network error fetching users:', err);
        }
      };

      const fetchOrders = async (mktFilter) => {
        try {
          const mkt = mktFilter || marketFilter;
          const url = (mkt && mkt !== 'all') ? `/admin/api/orders?market=${mkt}` : '/admin/api/orders';
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setOrders(data);
          } else {
            console.error('Failed to fetch orders:', data.message);
          }
        } catch (err) {
          console.error('Network error fetching orders:', err);
        }
      };

      const fetchWmsOriginAddresses = async (markets) => {
        const requestedMarkets = [...new Set(markets.filter(market => ['ro', 'fr', 'com'].includes(market)))];
        if (!requestedMarkets.length) return;
        setWmsOriginLoading(true);
        try {
          const results = await Promise.all(requestedMarkets.map(async market => {
            const response = await fetch(`/admin/api/wms/origin-address?market=${market}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || t('wms.loadOriginFailed'));
            return {
              market,
              originAddress: data.originAddress || {
                market,
                companyName: '',
                address: '',
                city: '',
                state: '',
                zipCode: '',
                country: market === 'fr' ? 'FR' : 'RO',
                phone: '',
                email: '',
                samedayPickupPointId: ''
              }
            };
          }));
          setWmsOriginAddresses(previous => results.reduce((next, result) => ({
            ...next,
            [result.market]: result.originAddress
          }), { ...previous }));
        } catch (error) {
          alert(error.message);
        } finally {
          setWmsOriginLoading(false);
        }
      };

      const fetchWmsSamedayPickupPoints = async () => {
        setWmsSamedayPickupPointsLoading(true);
        try {
          const response = await fetch('/admin/api/wms/sameday-pickup-points?market=ro', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || t('wms.loadPickupPointsFailed'));
          setWmsSamedayPickupPoints(data.pickupPoints || []);
        } catch (error) {
          alert(error.message);
        } finally {
          setWmsSamedayPickupPointsLoading(false);
        }
      };

      const saveWmsOriginAddress = async () => {
        const wmsOriginAddress = wmsOriginAddresses[wmsFocusedMarket];
        const requiredFields = ['companyName', 'address', 'city', 'state', 'zipCode', 'country', 'phone', 'email'];
        if (requiredFields.some(field => !String(wmsOriginAddress[field] || '').trim()) ||
          (wmsFocusedMarket === 'ro' &&
            (!String(wmsOriginAddress.samedayPickupPointId || '').trim() ||
             !Number.isInteger(Number(wmsOriginAddress.samedayPickupPointId)) ||
             Number(wmsOriginAddress.samedayPickupPointId) <= 0))) {
          return alert(t('wms.originRequiredError'));
        }
        setWmsOriginSaving(true);
        try {
          const response = await fetch(`/admin/api/wms/origin-address?market=${wmsFocusedMarket}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...wmsOriginAddress, market: wmsFocusedMarket })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || t('wms.saveOriginFailed'));
          setWmsOriginAddresses(previous => ({ ...previous, [wmsFocusedMarket]: data.originAddress }));
          alert(t('wms.originSaved', { market: `.${wmsFocusedMarket}` }));
        } catch (error) {
          alert(error.message);
        } finally {
          setWmsOriginSaving(false);
        }
      };

      const fetchWmsOverview = async () => {
        setWmsLoading(true);
        try {
          const response = await fetch('/admin/api/wms/overview', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || t('wms.loadFailed'));
          setWmsOverview(data);
          const auditResponse = await fetch('/admin/api/wms/audit?limit=20', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (auditResponse.ok) setWmsAudit(await auditResponse.json());
          const visibleMarkets = adminIsSuperAdmin
            ? ['ro', 'fr', 'com']
            : (admin?.adminMarkets || []);
          await fetchWmsOriginAddresses(selectedMarketTab === 'all' ? visibleMarkets : [selectedMarketTab]);
        } catch (error) {
          alert(error.message);
        } finally {
          setWmsLoading(false);
        }
      };

      const createWmsPartner = async () => {
        const response = await fetch('/admin/api/wms/partners', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(wmsPartnerForm)
        });
        const data = await response.json();
        if (!response.ok) return alert(data.message || t('wms.createPartnerFailed'));
        setWmsPartnerForm({ name: '', code: '' });
        fetchWmsOverview();
      };

      const routeWmsMarket = async (market, partnerId, isActive = true) => {
        const response = partnerId
          ? await fetch(`/admin/api/wms/routing/${market}`, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ partnerId: Number(partnerId), isActive })
            })
          : await fetch(`/admin/api/wms/routing/${market}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
        const data = await response.json();
        if (!response.ok) return alert(data.message || t('wms.updateRoutingFailed'));
        fetchWmsOverview();
      };

      const loadWmsKeys = async (partner) => {
        const response = await fetch(`/admin/api/wms/partners/${partner.id}/keys`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) return alert(data.message || t('wms.loadKeysFailed'));
        setWmsSelectedPartner(partner);
        setWmsKeys(data.keys || []);
        setWmsKeyForm({ partnerId: String(partner.id), environment: 'production' });
      };

      const createWmsKey = async () => {
        if (!wmsKeyForm.partnerId) return alert(t('wms.selectPartnerError'));
        const response = await fetch(`/admin/api/wms/partners/${wmsKeyForm.partnerId}/keys`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ environment: wmsKeyForm.environment })
        });
        const data = await response.json();
        if (!response.ok) return alert(data.message || t('wms.createKeyFailed'));
        setWmsPlaintextKey(data.plaintext);
        loadWmsKeys(wmsSelectedPartner || { id: Number(wmsKeyForm.partnerId) });
      };

      const revokeWmsKey = async (keyId) => {
        if (!window.confirm(t('wms.revokeConfirm'))) return;
        const response = await fetch(`/admin/api/wms/keys/${keyId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) return alert(data.message || t('wms.revokeFailed'));
        if (wmsSelectedPartner) loadWmsKeys(wmsSelectedPartner);
        fetchWmsOverview();
      };

      const loadWmsOrderTimeline = async () => {
        const orderId = Number(wmsOrderId);
        if (!Number.isInteger(orderId) || orderId < 1) return alert(t('wms.validOrderId'));
        const response = await fetch(`/admin/api/orders/${orderId}/wms`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) return alert(data.message || t('wms.timelineUnavailable'));
        setWmsOrderTimeline(data);
      };

      const fetchProducts = async (marketOverride) => {
        const requestId = ++productsRequestIdRef.current;
        try {
          const effectiveMarket = marketOverride !== undefined ? marketOverride : selectedMarketTab;
          const params = new URLSearchParams();
          if (effectiveMarket && effectiveMarket !== 'all') params.set('market', effectiveMarket);
          if (i18n.language) params.set('language', i18n.language);
          const query = params.toString();
          const response = await fetch(`/admin/api/products${query ? `?${query}` : ''}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            if (requestId === productsRequestIdRef.current) {
              setProducts(data);
              setProductPage(1);
            }
          } else {
            console.error('Failed to fetch products:', data.message);
          }
        } catch (err) {
          console.error('Network error fetching products:', err);
        }
      };

      const fetchCategories = async (
        marketOverride = selectedMarketTab,
        { requireMarket = false } = {}
      ) => {
        try {
          const requestId = ++categoriesRequestIdRef.current;
          const market = marketOverride && marketOverride !== 'all' ? marketOverride : '';
          if (requireMarket && !market) {
            setCategories([]);
            return [];
          }
          const params = new URLSearchParams();
          if (market) params.set('market', market);
          if (i18n.language) params.set('language', i18n.language);
          const query = params.toString();
          const response = await fetch(`/admin/api/categories${query ? `?${query}` : ''}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok && requestId === categoriesRequestIdRef.current) {
            setCategories(data);
            return data;
          } else {
            if (!response.ok) {
              console.error('Failed to fetch categories:', data.message);
            }
          }
        } catch (err) {
          console.error('Network error fetching categories:', err);
        }
        return [];
      };

      const refreshCategorySelectors = async () => {
        // Do not reset productCategoryFilter, productFormData.categoryId, or
        // homepageConfig here: category IDs and marketplace scope are stable.
        return fetchCategories(selectedMarketTab);
      };

      const fetchSuppliers = async () => {
        try {
          const marketParam = selectedMarketTab && selectedMarketTab !== 'all' ? `?market=${selectedMarketTab}` : '';
          const response = await fetch(`/admin/api/suppliers${marketParam}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setSuppliers(data);
          } else {
            console.error('Failed to fetch suppliers:', data.message);
          }
        } catch (err) {
          console.error('Network error fetching suppliers:', err);
        }
      };

      const fetchVouchers = async () => {
        try {
          const marketParam = selectedMarketTab && selectedMarketTab !== 'all' ? `?market=${selectedMarketTab}` : '';
          const response = await fetch(`/admin/api/vouchers${marketParam}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setVouchers(data);
          } else {
            console.error('Failed to fetch vouchers:', data.message);
          }
        } catch (err) {
          console.error('Network error fetching vouchers:', err);
        }
      };

      const fetchEventVoucher = async () => {
        if (selectedMarketTab !== 'fr' && selectedMarketTab !== 'all') return;
        setEventVoucherLoading(true);
        try {
          const response = await fetch('/admin/api/event-voucher', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok) setEventVoucherData(data);
          else console.error('Failed to fetch event voucher:', data.message);
        } catch (err) {
          console.error('Network error fetching event voucher:', err);
        } finally {
          setEventVoucherLoading(false);
        }
      };

      const updateEventVoucherCampaign = async (isActive) => {
        setEventVoucherSaving(true);
        try {
          const response = await fetch('/admin/api/event-voucher/campaign', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isActive })
          });
          const data = await response.json();
          if (response.ok) {
            setEventVoucherData((current) => current ? { ...current, campaign: data } : current);
          } else {
            alert(data.message || 'Impossible de modifier la campagne.');
          }
        } catch (err) {
          alert('Erreur réseau pendant la mise à jour de la campagne.');
        } finally {
          setEventVoucherSaving(false);
        }
      };

      const resendEventVoucherEmail = async (registrationId) => {
        try {
          const response = await fetch(`/admin/api/event-voucher/registrations/${registrationId}/resend`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (!response.ok) {
            alert(data.message || 'Impossible de renvoyer l’email.');
            return;
          }
          await fetchEventVoucher();
        } catch (err) {
          alert('Erreur réseau pendant le renvoi de l’email.');
        }
      };

      const fetchInvoices = async (mktFilter) => {
        setInvoicesLoading(true);
        try {
          const mkt = mktFilter || invoiceMarketFilter;
          // Always scope to the active market tab — a .fr admin must never see .ro invoices
          const effectiveMkt = (mkt && mkt !== 'all') ? mkt : selectedMarketTab;
          const mktParam = effectiveMkt && effectiveMkt !== 'all' ? `?market=${effectiveMkt}` : '';
          const response = await fetch(`/admin/api/invoices${mktParam}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setAdminInvoices(data);
          }
        } catch (err) {
          console.error('Error fetching invoices:', err);
        } finally {
          setInvoicesLoading(false);
        }
      };

      const fetchInvoiceCounters = async () => {
        try {
          const response = await fetch('/admin/api/invoice-counters', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setInvoiceCounters(data);
          }
        } catch (err) {
          console.error('Error fetching invoice counters:', err);
        }
      };

      const downloadAdminInvoicePdf = async (invoiceId, invoiceNumber) => {
        try {
          const response = await fetch(`/admin/api/invoices/${invoiceId}/pdf`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) {
            alert('PDF not available for this invoice.');
            return;
          }
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `factura_${(invoiceNumber || invoiceId).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Error downloading PDF:', err);
          alert('Error downloading PDF.');
        }
      };

      const openInvoiceDetail = async (invoiceId) => {
        setInvoiceDetailLoading(true);
        setInvoiceDetailModal({ id: invoiceId, loading: true });
        try {
          const response = await fetch(`/admin/api/invoices/${invoiceId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setInvoiceDetailModal(data);
          } else {
            setInvoiceDetailModal(null);
            alert('Failed to load invoice details.');
          }
        } catch (err) {
          setInvoiceDetailModal(null);
        } finally {
          setInvoiceDetailLoading(false);
        }
      };

      const fetchBlogPosts = async () => {
        try {
          const _bMkt = selectedMarketTab;
          const _bMktQ = _bMkt && _bMkt !== 'all' ? '?market=' + _bMkt : '';
          const response = await fetch('/admin/api/blog/posts' + _bMktQ, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok) setBlogPosts(data);
        } catch (err) {
          console.error('Error fetching blog posts:', err);
        }
      };

      const generateBlogPost = async () => {
        setBlogGenerating(true);
        try {
          const response = await fetch('/admin/api/blog/generate', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(blogGenerateForm)
          });
          const data = await response.json();
          if (response.ok) {
            alert('✅ Articol generat cu succes! ID: ' + data.postId);
            setBlogGenerateForm({ title: '', category: 'HACCP', language: 'ro' });
            fetchBlogPosts();
          } else {
            alert('❌ Eroare: ' + (data.message || 'Necunoscut'));
          }
        } catch (err) {
          alert('❌ Eroare rețea la generare articol');
        } finally {
          setBlogGenerating(false);
        }
      };

      const generateWeeklyForMarket = async (market) => {
        setBlogGenerating(true);
        try {
          const response = await fetch('/admin/api/blog/generate-weekly', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ market })
          });
          const data = await response.json();
          if (response.ok) {
            const marketLabel = market === 'fr' ? '🇫🇷 FR' : market === 'com' ? '🇬🇧 COM' : '🇷🇴 RO';
            alert('✅ Articol săptămânal generat pentru piața ' + marketLabel + '! ID: ' + data.postId);
            fetchBlogPosts();
          } else {
            alert('❌ Eroare: ' + (data.message || 'Necunoscut'));
          }
        } catch (err) {
          alert('❌ Eroare rețea la generare articol săptămânal');
        } finally {
          setBlogGenerating(false);
        }
      };

      const toggleBlogPostPublished = async (post) => {
        try {
          const response = await fetch('/admin/api/blog/posts/' + post.id, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ published: !post.published })
          });
          if (response.ok) fetchBlogPosts();
        } catch (err) {
          console.error('Error toggling blog post:', err);
        }
      };

      const deleteBlogPost = async (id) => {
        if (!confirm('Ești sigur că vrei să ștergi acest articol?')) return;
        try {
          await fetch('/admin/api/blog/posts/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          fetchBlogPosts();
        } catch (err) {
          console.error('Error deleting blog post:', err);
        }
      };

      const openEditBlogPost = (post) => {
        setBlogEditForm({
          title: post.title || '',
          excerpt: post.excerpt || '',
          content: post.content || '',
          imageUrl: post.imageUrl || '',
          category: post.category || '',
          published: post.published,
        });
        setEditingBlogPost(post);
      };

      const saveBlogPost = async () => {
        try {
          const response = await fetch('/admin/api/blog/posts/' + editingBlogPost.id, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(blogEditForm)
          });
          if (response.ok) {
            setEditingBlogPost(null);
            fetchBlogPosts();
            alert('Articol actualizat cu succes!');
          } else {
            alert('Eroare la salvare!');
          }
        } catch (err) {
          alert('Eroare: ' + err.message);
        }
      };

      const fetchScheduleConfig = async () => {
        try {
          const res = await fetch('/admin/api/blog/schedule', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) { setScheduleConfig(await res.json()); setScheduleLoaded(true); }
        } catch (_) {}
      };

      const saveScheduleConfig = async () => {
        try {
          const res = await fetch('/admin/api/blog/schedule', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduleConfig)
          });
          if (res.ok) { alert('Configurație salvată! Scheduler-ul a fost repornit.'); }
          else { alert('Eroare la salvare!'); }
        } catch (err) { alert('Eroare: ' + err.message); }
      };

      const fetchGoogleFeed = async (marketOverride) => {
        const market = marketOverride || (selectedMarketTab !== 'all' ? selectedMarketTab : 'ro');
        setGoogleFeedLoading(true);
        try {
          const response = await fetch(`/admin/api/google-feed?market=${market}&language=${encodeURIComponent(i18n.language || '')}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok) setGoogleFeedData(data);
          else alert(data.message || 'Nu s-a putut încărca feedul Google');
        } catch (err) {
          console.error('Error fetching Google Merchant feed:', err);
          alert('Eroare de rețea la încărcarea feedului Google');
        } finally {
          setGoogleFeedLoading(false);
        }
      };

      const saveGoogleFeed = async () => {
        if (!googleFeedData?.feed) return;
        const market = googleFeedData.feed.market || (selectedMarketTab !== 'all' ? selectedMarketTab : 'ro');
        const categoryIds = googleFeedData.feed.categoryIds || [];
        const productIds = googleFeedData.feed.productIds || [];
        if (googleFeedData.feed.enabled && categoryIds.length === 0 && productIds.length === 0) {
          alert('Selectează cel puțin o categorie sau un produs înainte de activarea feedului.');
          return;
        }
        setGoogleFeedSaving(true);
        try {
          const response = await fetch('/admin/api/google-feed', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              market,
              language: i18n.language,
              enabled: googleFeedData.feed.enabled,
              includeOutOfStock: googleFeedData.feed.includeOutOfStock,
              categoryIds,
              productIds
            })
          });
          const data = await response.json();
          if (response.ok) {
            setGoogleFeedData(data.data);
            alert('✅ Configurația feedului Google a fost salvată.');
          } else {
            alert(data.message || 'Nu s-a putut salva configurația feedului.');
          }
        } catch (err) {
          console.error('Error saving Google Merchant feed:', err);
          alert('Eroare de rețea la salvarea feedului Google');
        } finally {
          setGoogleFeedSaving(false);
        }
      };

      const fetchMarkets = async () => {
        setMarketsLoading(true);
        try {
          const res = await fetch('/admin/api/markets/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const map = { ro: null, fr: null, com: null };
            data.forEach(m => {
              map[m.market] = m;
              if (Array.isArray(m.abandonedCartReminderHours)) {
                setReminderThresholds(prev => ({
                  ...prev,
                  [m.market]: Array.from({length: 5}, (_, index) => m.abandonedCartReminderHours[index] ?? null)
                }));
              }
            });
            setMarketsData(map);
          }
        } catch (err) {
          console.error('Error fetching markets:', err);
        }
        setMarketsLoading(false);
      };

      const saveMarket = async (market, data) => {
        try {
          const res = await fetch(`/admin/api/markets/${market}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (res.ok) {
            fetchMarkets();
            alert('✅ Piața a fost salvată!');
          } else {
            const err = await res.json();
            alert('❌ Eroare: ' + (err.message || 'Necunoscută'));
          }
        } catch (err) {
          alert('❌ Eroare rețea: ' + err.message);
        }
      };

      const fetchMarketing = async () => {
        setMarketingLoading(true);
        const isFranceVisible = selectedMarketTab === 'fr' || selectedMarketTab === 'all';
        setEventVoucherContactsLoading(isFranceVisible);
        try {
          const market = selectedMarketTab || 'all';
          const [segmentsRes, campaignsRes, contactsRes] = await Promise.all([
            fetch(`/admin/api/marketing/segments?market=${encodeURIComponent(market)}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`/admin/api/marketing/campaigns?market=${encodeURIComponent(market)}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            isFranceVisible
              ? fetch('/admin/api/marketing/event-voucher-contacts?campaign=chef-event-fr', { headers: { 'Authorization': `Bearer ${token}` } })
              : Promise.resolve(null)
          ]);
          if (segmentsRes.ok) setMarketingSegments(await segmentsRes.json());
          if (campaignsRes.ok) setMarketingCampaigns(await campaignsRes.json());
          if (contactsRes?.ok) {
            const contactsData = await contactsRes.json();
            setEventVoucherContacts(contactsData.contacts || []);
          } else if (!isFranceVisible) {
            setEventVoucherContacts([]);
          }
        } catch (err) {
          console.error('Error fetching marketing data:', err);
          alert(t('marketing.loadFailed'));
        } finally {
          setMarketingLoading(false);
          setEventVoucherContactsLoading(false);
        }
      };

      const saveReminderThresholds = async (market) => {
        setMarketingSaving(true);
        try {
          const res = await fetch(`/admin/api/markets/${market}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ abandonedCartReminderHours: reminderThresholds[market] })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || t('marketing.thresholdsSaveFailed'));
          setReminderThresholds(prev => ({
            ...prev,
            [market]: Array.from({length: 5}, (_, index) => data.abandonedCartReminderHours?.[index] ?? null)
          }));
          alert(`✅ ${t('marketing.thresholdsSaved', { market })}`);
          fetchMarkets();
        } catch (err) {
          alert(`❌ ${err.message}`);
        } finally {
          setMarketingSaving(false);
        }
      };

      const createMarketingSegment = async () => {
         if (!marketingSegmentForm.name.trim()) return alert(t('marketing.segmentNameRequired'));
        const market = marketingSegmentForm.eventVoucherCampaign === 'chef-event-fr'
          ? 'fr'
          : (selectedMarketTab || 'all');
        try {
          const res = await fetch('/admin/api/marketing/segments', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: marketingSegmentForm.name,
              market,
              criteria: {
                market,
                hasOrders: marketingSegmentForm.hasOrders,
                hasAbandonedCart: marketingSegmentForm.hasAbandonedCart,
                eventVoucherCampaign: marketingSegmentForm.eventVoucherCampaign
              }
            })
          });
          const data = await res.json();
           if (!res.ok) throw new Error(data.message || t('marketing.segmentCreateFailed'));
          setMarketingSegmentForm({name: '', hasOrders: 'any', hasAbandonedCart: 'any', eventVoucherCampaign: 'any'});
          fetchMarketing();
        } catch (err) {
          alert(`❌ ${err.message}`);
        }
      };

      const previewMarketingSegment = async (segment) => {
        try {
          const res = await fetch(`/admin/api/marketing/segments/${segment.id}/recipients`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
           if (!res.ok) throw new Error(data.message || t('marketing.previewFailed'));
          setMarketingPreview({segment, ...data});
        } catch (err) {
          alert(`❌ ${err.message}`);
        }
      };

      const createMarketingCampaign = async () => {
        const form = marketingCampaignForm;
        if (!form.name.trim() || !form.segmentId || !form.subject.trim() || !form.htmlContent.trim()) {
           return alert(t('marketing.campaignFieldsRequired'));
        }
        try {
          const res = await fetch('/admin/api/marketing/campaigns', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
          });
          const data = await res.json();
           if (!res.ok) throw new Error(data.message || t('marketing.campaignCreateFailed'));
          setMarketingCampaignForm({name: '', market: form.market, segmentId: '', subject: '', htmlContent: '', textContent: ''});
          fetchMarketing();
        } catch (err) {
          alert(`❌ ${err.message}`);
        }
      };

      const sendMarketingCampaign = async (campaign) => {
        try {
          const previewRes = await fetch(`/admin/api/marketing/segments/${campaign.segmentId}/recipients`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const preview = await previewRes.json();
           if (!previewRes.ok) throw new Error(preview.message || t('marketing.campaignPreviewFailed'));
           if (!window.confirm(t('marketing.sendConfirm', { name: campaign.name, count: preview.count }))) return;
          const res = await fetch(`/admin/api/marketing/campaigns/${campaign.id}/send`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
           if (!res.ok) throw new Error(data.message || t('marketing.campaignSendFailed'));
           alert(`✅ ${t('marketing.campaignSent', { sent: data.sentCount, failed: data.failedCount })}`);
          fetchMarketing();
        } catch (err) {
          alert(`❌ ${err.message}`);
        }
      };

      const downloadEventVoucherContactsCsv = () => {
        const csvCell = (value) => {
          const text = String(value ?? '');
          const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
          return `"${safeText.replace(/"/g, '""')}"`;
        };
        const rows = [
          ['Prenume', 'Nume', 'Restaurant', 'Email', 'Telefon', 'Cod voucher', 'Status email', 'Data înscrierii', 'Termen activare', 'Activat la', 'Status voucher'],
          ...filteredEventVoucherContacts.map(contact => [
            contact.firstName,
            contact.lastName,
            contact.restaurant,
            contact.email,
            contact.phone,
            contact.voucherCode,
            contact.emailStatus,
            contact.createdAt ? new Date(contact.createdAt).toISOString() : '',
            contact.activationDeadline ? new Date(contact.activationDeadline).toISOString() : '',
            contact.activatedAt ? new Date(contact.activatedAt).toISOString() : '',
            contact.activatedAt ? 'activat' : 'neactivat'
          ])
        ];
        const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'chef-event-fr-contacte.csv';
        link.click();
        URL.revokeObjectURL(url);
      };

      const filteredEventVoucherContacts = eventVoucherContacts.filter(contact => {
        const query = eventVoucherContactSearch.trim().toLowerCase();
        if (!query) return true;
        return [contact.firstName, contact.lastName, contact.restaurant, contact.email, contact.phone, contact.voucherCode]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(query));
      });

      const fetchProductMarkets = async () => {
        try {
          const res = await fetch('/admin/api/market-products', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const map = {};
            data.forEach(pm => {
              if (!map[pm.productId]) map[pm.productId] = {};
              map[pm.productId][pm.market] = pm;
            });
            setProductMarketsMap(map);
          }
        } catch (err) {
          console.error('Error fetching product markets:', err);
        }
      };

      const toggleProductMarket = async (productId, market, currentIsActive) => {
        try {
          const res = await fetch(`/admin/api/products/${productId}/markets/${market}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !currentIsActive })
          });
          if (res.ok) {
            setProductMarketsMap(prev => ({
              ...prev,
              [productId]: {
                ...(prev[productId] || {}),
                [market]: { ...(prev[productId]?.[market] || {}), isActive: !currentIsActive, market }
              }
            }));
          }
        } catch (err) {
          console.error('Error toggling product market:', err);
        }
      };

      // Create category
      const createCategory = async (categoryData) => {
        try {
          const token = localStorage.getItem('adminToken');
          const response = await fetch('/admin/api/categories', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            await fetchCategories(); // Refresh categories list
            return { success: true, message: 'Category created successfully' };
          } else {
            return { success: false, message: data.message || 'Failed to create category' };
          }
        } catch (error) {
          console.error('Error creating category:', error);
          return { success: false, message: 'Network error. Please try again.' };
        }
      };

      // Update category
      const updateCategory = async (categoryId, categoryData) => {
        try {
          const response = await fetch(`/admin/api/categories/${categoryId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            await fetchCategories(); // Refresh categories list
            return { success: true, message: 'Category updated successfully' };
          } else {
            return { success: false, message: data.message || 'Failed to update category' };
          }
        } catch (error) {
          console.error('Error updating category:', error);
          return { success: false, message: 'Network error. Please try again.' };
        }
      };

      // Sync supplier prices
      const syncSupplierPrices = async (supplierId) => {
        try {
          const response = await fetch(`/admin/api/suppliers/${supplierId}/sync-prices`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await response.json();
          
          if (response.ok) {
            alert(`✅ Price Sync Successful!\n\n${data.message}\n\nUpdated Products:\n${data.data.filter(r => r.success).map(r => `• ${r.productName}: €${r.oldPrice} → €${r.newPrice}`).join('\n')}`);
            // Refresh products data
            fetchProducts();
          } else {
            alert(`❌ Price Sync Failed\n\n${data.message}`);
          }
        } catch (error) {
          console.error('Error syncing prices:', error);
          alert('❌ Network error during price sync');
        }
      };

      // Sync supplier stock
      const syncSupplierStock = async (supplierId) => {
        try {
          const response = await fetch(`/admin/api/suppliers/${supplierId}/sync-stock`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await response.json();
          
          if (response.ok) {
            alert(`✅ Stock Sync Successful!\n\n${data.message}\n\nUpdated Products:\n${data.data.filter(r => r.success).map(r => `• ${r.productName}: ${r.oldStock} → ${r.newStock} units`).join('\n')}`);
            // Refresh products data
            fetchProducts();
          } else {
            alert(`❌ Stock Sync Failed\n\n${data.message}`);
          }
        } catch (error) {
          console.error('Error syncing stock:', error);
          alert('❌ Network error during stock sync');
        }
      };

      // Forward order to suppliers
      const forwardOrderToSuppliers = async (orderId) => {
        try {
          const response = await fetch('/admin/api/suppliers/forward-order', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orderId })
          });
          const data = await response.json();
          
          if (response.ok) {
            const results = data.data.map(r => 
              `• ${r.supplierName}: ${r.success ? '✅ Forwarded' : '❌ Failed'} (${r.itemCount} items)`
            ).join('\n');
            alert(`📤 Order Forward Results\n\n${data.message}\n\nSupplier Results:\n${results}`);
          } else {
            alert(`❌ Order Forward Failed\n\n${data.message}`);
          }
        } catch (error) {
          console.error('Error forwarding order:', error);
          alert('❌ Network error during order forwarding');
        }
      };

      // Update supplier
      const updateSupplier = async (supplierId, supplierData) => {
        try {
          const response = await fetch(`/admin/api/suppliers/${supplierId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(supplierData)
          });
          const data = await response.json();
          
          if (response.ok) {
            return { success: true, data };
          } else {
            return { success: false, message: data.message };
          }
        } catch (error) {
          console.error('Error updating supplier:', error);
          return { success: false, message: 'Network error during supplier update' };
        }
      };

      // Fetch supplier details with related data
      const fetchSupplierDetails = async (supplierId) => {
        try {
          // Fetch supplier info
          const supplierResponse = await fetch(`/admin/api/suppliers/${supplierId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const supplier = await supplierResponse.json();

          // Fetch products associated with this supplier
          const productsResponse = await fetch(`/admin/api/products?supplierId=${supplierId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const supplierProducts = await productsResponse.json();

          // Fetch orders containing products from this supplier
          const ordersResponse = await fetch(`/admin/api/orders?supplierId=${supplierId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const supplierOrders = await ordersResponse.json();

          return {
            supplier,
            products: supplierProducts || [],
            orders: supplierOrders || [],
            totalProducts: supplierProducts?.length || 0,
            totalOrders: supplierOrders?.length || 0,
            totalRevenue: supplierOrders?.reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0) || 0
          };
        } catch (error) {
          console.error('Error fetching supplier details:', error);
          return null;
        }
      };

      // Handle supplier selection
      const handleSupplierSelection = (supplierId, isChecked) => {
        setSelectedSuppliers(prev => {
          if (isChecked) {
            return [...prev, supplierId];
          } else {
            return prev.filter(id => id !== supplierId);
          }
        });
      };

      // Handle select all suppliers
      const handleSelectAllSuppliers = (isChecked) => {
        if (isChecked) {
          setSelectedSuppliers(suppliers.map(s => s.id));
        } else {
          setSelectedSuppliers([]);
        }
      };

      // Perform bulk operations on suppliers
      const performSupplierBulkOperation = async (operation, formData) => {
        try {
          const response = await fetch('/admin/api/suppliers/bulk', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              operation,
              supplierIds: selectedSuppliers,
              ...formData
            })
          });

          const result = await response.json();
          
          if (response.ok) {
            alert(`✅ Bulk operation completed successfully!\n\n${result.message}\nProcessed: ${result.processed} suppliers\nSuccess: ${result.success}\nFailed: ${result.failed}`);
            
            // Refresh suppliers list
            fetchSuppliers();
            
            // Reset selection
            setSelectedSuppliers([]);
            setShowSupplierBulkModal(false);
          } else {
            alert(`❌ Bulk operation failed: ${result.message}`);
          }
        } catch (error) {
          console.error('Error performing bulk operation:', error);
          alert('❌ Network error during bulk operation');
        }
      };

      const generateProductAnalytics = () => {
        const activeProducts = products.filter(product => (product.status || 'active') === 'active');

        console.log('Generating product analytics with data:', activeProducts.length, 'active products');
        console.log('Categories available:', categories.length, 'categories');
        
        if (activeProducts.length === 0) {
          setAnalyticsData({
            error: 'No active products found to analyze'
          });
          return;
        }
        
        // Make sure categories are loaded
        if (categories.length === 0) {
          fetchCategories();
        }

        // Determine the display currency for the current market view:
        // use the most common currency among the loaded products.
        const currencyCounts = activeProducts.reduce((acc, p) => {
          const cur = p.currency || 'RON';
          acc[cur] = (acc[cur] || 0) + 1;
          return acc;
        }, {});
        const displayCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'RON';

        // Calculate analytics based on actual product data
        const analytics = {
          totalProducts: activeProducts.length,
          currency: displayCurrency,
          
          // Category analysis
          categoryBreakdown: categories.reduce((acc, cat) => {
            const categoryProducts = activeProducts.filter(p => p.categoryId === cat.id);
            if (categoryProducts.length > 0) {
              acc[getCategoryName(cat)] = {
                count: categoryProducts.length,
                percentage: ((categoryProducts.length / activeProducts.length) * 100).toFixed(1)
              };
            }
            return acc;
          }, {}),
          
          // Status analysis
          statusBreakdown: {
            active: activeProducts.length
          },
          
          // Price analysis
          priceAnalysis: (() => {
            const prices = activeProducts.map(p => parseFloat(p.price) || 0).filter(p => p > 0);
            if (prices.length === 0) return { avg: 0, min: 0, max: 0 };
            
            return {
              avg: (prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(2),
              min: Math.min(...prices).toFixed(2),
              max: Math.max(...prices).toFixed(2)
            };
          })(),
          
          // Stock analysis
          stockAnalysis: {
            totalStock: activeProducts.reduce((sum, p) => sum + (p.stockQuantity || 0), 0),
            inStock: activeProducts.filter(p => (p.stockQuantity || 0) > 0).length,
            outOfStock: activeProducts.filter(p => (p.stockQuantity || 0) === 0).length,
            lowStock: activeProducts.filter(p => (p.stockQuantity || 0) > 0 && (p.stockQuantity || 0) < 10).length
          },
          
          // Top products by price
          topPriceProducts: activeProducts
            .filter(p => p.price && parseFloat(p.price) > 0)
            .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
            .slice(0, 5)
            .map(p => ({
              name: p.name,
              price: parseFloat(p.price).toFixed(2),
              category: getCategoryName(categories.find(c => c.id === p.categoryId))
            })),
          
          // Generated timestamp
          generatedAt: new Date().toLocaleString()
        };

        console.log('Analytics generated:', analytics);
        setAnalyticsData(analytics);
      };

      // CRUD Operations
      const createUser = async (userData) => {
        try {
          const response = await fetch('/admin/api/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchUsers(); // Refresh user list
            return { success: true, message: data.message };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const updateUser = async (userId, userData) => {
        try {
          const response = await fetch(`/admin/api/users/${userId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchUsers(); // Refresh user list
            return { success: true, message: data.message };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const deleteUser = async (userId) => {
        try {
          const response = await fetch(`/admin/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchUsers(); // Refresh user list
            return { success: true, message: data.message };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const createProduct = async (productData) => {
        try {
          const response = await fetch('/admin/api/products', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchProducts(); // Refresh product list
            return { success: true, message: data.message, product: data.product, productMarket: data.productMarket };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const updateProduct = async (productId, productData) => {
        try {
          const response = await fetch(`/admin/api/products/${productId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchProducts(); // Refresh product list
            return { success: true, message: data.message };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const deleteProduct = async (productId, market) => {
        try {
          const marketQuery = market && market !== 'all' ? `?market=${encodeURIComponent(market)}` : '';
          const response = await fetch(`/admin/api/products/${productId}${marketQuery}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchProducts(); // Refresh product list
            return { success: true, message: data.message };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      // Download Excel template for bulk product import
      const downloadExcelTemplate = () => {
        // Create sample data structure for Excel template
        const templateData = [
          {
            'Product Name': 'Example Product',
            'Description': 'This is an example product description',
            'Price': '29.99',
            'Stock Quantity': '100',
            'Category ID': '1',
            'Category Name': 'Cleaning & Sanitizing',
            'Status': 'active',
            'VAT %': '21',
            'Product Code': 'KO001',
            'EAN': '5941234567890',
            'NC Code': '3924100000',
            'CPV Code': '39830000-9',
            'Supplier Name': 'xHACCP Direct',
            'Weight (kg)': '2.5',
            'Length (cm)': '25.0',
            'Width (cm)': '15.0',
            'Height (cm)': '10.0',
            'Pieces Per Package': '6'
          },
          {
            'Product Name': 'Another Product',
            'Description': 'Second example product',
            'Price': '45.50',
            'Stock Quantity': '50',
            'Category ID': '2',
            'Category Name': 'Food Labels',
            'Status': 'active',
            'VAT %': '21',
            'Product Code': 'KO002',
            'EAN': '',
            'NC Code': '4821100000',
            'CPV Code': '30199700-3',
            'Supplier Name': 'xHACCP Direct',
            'Weight (kg)': '1.0',
            'Length (cm)': '20.0',
            'Width (cm)': '15.0',
            'Height (cm)': '5.0',
            'Pieces Per Package': '12'
          }
        ];

        // Create workbook and worksheet
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Products');

        // Add instructions sheet
        const instructionsData = [
          { Field: 'Product Name', Required: 'Yes', Description: 'Unique product name' },
          { Field: 'Description', Required: 'No', Description: 'Product description' },
          { Field: 'Price', Required: 'Yes', Description: 'Product price in decimal format (e.g., 29.99)' },
          { Field: 'Stock Quantity', Required: 'Yes', Description: 'Available stock quantity' },
          { Field: 'Category ID', Required: 'Yes', Description: 'Category ID number from system' },
          { Field: 'Category Name', Required: 'No', Description: 'Category name for reference only' },
          { Field: 'Status', Required: 'No', Description: 'Product status: active, inactive, draft, discontinued' },
          { Field: 'VAT %', Required: 'No', Description: 'VAT percentage (default: 19)' },
          { Field: 'Product Code', Required: 'No', Description: 'Alphanumeric product code' },
          { Field: 'EAN', Required: 'No', Description: 'Optional EAN/GTIN identifier (8, 12, 13, or 14 digits)' },
          { Field: 'NC Code', Required: 'No', Description: 'Nomenclature code' },
          { Field: 'CPV Code', Required: 'No', Description: 'Common Procurement Vocabulary code' },
          { Field: 'Supplier Name', Required: 'No', Description: 'Supplier name (default: xHACCP Direct)' },
          { Field: 'Weight (kg)', Required: 'No', Description: 'Product weight in kilograms (minimum 1kg for parcel compliance)' },
          { Field: 'Length (cm)', Required: 'No', Description: 'Product length in centimeters for shipping calculations' },
          { Field: 'Width (cm)', Required: 'No', Description: 'Product width in centimeters for shipping calculations' },
          { Field: 'Height (cm)', Required: 'No', Description: 'Product height in centimeters for shipping calculations' },
          { Field: 'Pieces Per Package', Required: 'No', Description: 'Maximum pieces per shipping package for AWB generation (default: 1)' }
        ];

        const instructionsWs = XLSX.utils.json_to_sheet(instructionsData);
        XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

        // Download file
        XLSX.writeFile(wb, 'xHACCP_Products_Import_Template.xlsx');
        alert('✅ Excel template downloaded successfully!\\n\\nPlease fill in the template with your product data and use "Import from Excel" to upload it.');
      };

      // Export all products to Excel in the same format as the import template
      const exportProductsToExcel = async () => {
        try {
          const headers = { 'Authorization': `Bearer ${token}` };
          const marketQS = selectedMarketTab && selectedMarketTab !== 'all' ? `&market=${selectedMarketTab}` : '';
          const marketParam = selectedMarketTab && selectedMarketTab !== 'all' ? `?market=${selectedMarketTab}` : '';
          const [productsRes, categoriesRes, suppliersRes] = await Promise.all([
            fetch(`/admin/api/products?limit=100000${marketQS}`, { headers }),
            fetch(`/admin/api/categories${marketParam}`, { headers }),
            fetch(`/admin/api/suppliers${marketParam}`, { headers })
          ]);
          const [allProducts, allCategories, allSuppliers] = await Promise.all([
            productsRes.json(), categoriesRes.json(), suppliersRes.json()
          ]);

          if (!productsRes.ok || !Array.isArray(allProducts) || allProducts.length === 0) {
            alert(t('products.exportEmpty'));
            return;
          }

          const categoryById = new Map((Array.isArray(allCategories) ? allCategories : []).map(c => [c.id, c.name]));
          const supplierById = new Map((Array.isArray(allSuppliers) ? allSuppliers : []).map(s => [s.id, s.name]));

          const exportData = allProducts.map(p => ({
            'Product Name': p.name || '',
            'Description': p.description || '',
            'Price': p.price != null ? String(p.price) : '',
            'Stock Quantity': p.stockQuantity != null ? String(p.stockQuantity) : '0',
            'Category ID': p.categoryId != null ? String(p.categoryId) : '',
            'Category Name': categoryById.get(p.categoryId) || '',
            'Status': p.status || 'active',
            'VAT %': p.vatValue != null ? String(p.vatValue) : (p.vatPercentage != null ? String(p.vatPercentage) : ''),
            'Product Code': p.productCode || '',
            'EAN': p.ean || '',
            'NC Code': p.ncCode || '',
            'CPV Code': p.cpvCode || '',
            'Supplier Name': supplierById.get(p.supplierId) || '',
            'Weight (kg)': p.weight != null ? String(p.weight) : '',
            'Length (cm)': p.length != null ? String(p.length) : '',
            'Width (cm)': p.width != null ? String(p.width) : '',
            'Height (cm)': p.height != null ? String(p.height) : '',
            'Pieces Per Package': p.piecesPerPackage != null ? String(p.piecesPerPackage) : ''
          }));

          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Products');

          const dateStr = new Date().toISOString().slice(0, 10);
          XLSX.writeFile(wb, `xHACCP_Products_Export_${dateStr}.xlsx`);
        } catch (err) {
          console.error('Error exporting products to Excel:', err);
          alert(t('products.exportError'));
        }
      };

      // Import products from Excel file
      // duplicateStrategy: { [productCode]: 'update'|'skip' } — null on first call
      const importProductsFromExcel = async (file, duplicateStrategy) => {
        if (!file) {
          alert('Please select an Excel file to import.');
          return;
        }

        try {
          setImportResults({ loading: true });
          setImportDuplicates(null);

          const formData = new FormData();
          formData.append('excelFile', file);
          if (selectedMarketTab && selectedMarketTab !== 'all') {
            formData.append('market', selectedMarketTab);
          }
          if (duplicateStrategy) {
            formData.append('duplicateStrategy', JSON.stringify(duplicateStrategy));
          }

          const response = await fetch('/admin/api/products/import-excel', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          const result = await response.json();

          // Server detected code duplicates — needs user decision before continuing
          if (response.ok && result.needsConfirmation) {
            setImportResults(null);
            setImportDuplicates({
              duplicates: result.duplicates || [],
              parseErrors: result.parseErrors || [],
              total: result.total || 0,
              strategies: Object.fromEntries((result.duplicates || []).map(d => [d.code, 'skip'])),
            });
            return;
          }

          if (response.ok) {
            setImportDuplicates(null);
            setImportResults({
              success: true,
              imported: result.imported || 0,
              updated: result.updated || 0,
              skipped: result.skipped || 0,
              errors: result.errors || [],
              total: result.total || 0
            });
            await fetchProducts();
            setTimeout(() => fetchProducts(), 1000);
          } else {
            setImportResults({ success: false, message: result.message || 'Import failed' });
          }
        } catch (error) {
          console.error('Error importing Excel:', error);
          setImportResults({ success: false, message: 'Network error during import' });
        }
      };

      const updateOrderStatus = async (orderId, status) => {
        try {
          const response = await fetch(`/admin/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchOrders(); // Refresh order list
            return { success: true, message: data.message };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      // AWB Generation Function
      const generateAWB = async (orderId) => {
        try {
          console.log(`🚚 Generating AWB for order ${orderId}...`);
          
          const response = await fetch(`/admin/api/orders/${orderId}/generate-awb`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log(`📡 AWB response status: ${response.status}`);
          
          const data = await response.json();
          console.log('📦 AWB response data:', data);
          
          if (response.ok && data.success) {
            await fetchOrders();
            alert(`✅ AWB generat cu succes!\\n\\nAWB: ${data.awbNumber}\\nCurier: ${data.courier}\\nCost: ${data.awbCost || data.cost} ${data.currency}\\n\\nStatus comandă: in_delivery\\nTracking: ${data.trackingUrl || 'Disponibil în portalul Sameday'}`);
          } else if (response.status === 503 && data.retryAfter) {
            alert(`⏳ Sameday API Rate Limited\\n\\n${data.message}\\n\\nPlease wait ${data.retryAfter} seconds before trying again.`);
          } else {
            console.error('AWB generation failed:', data);
            alert(`❌ Generare AWB eșuată\\n\\n${data.message || 'Eroare necunoscută'}\\n\\n${data.error ? 'Detalii: ' + data.error.substring(0, 150) : ''}\\n\\nPoți reîncerca sau crea AWB manual în portalul Sameday.`);
          }
        } catch (err) {
          console.error('AWB generation error:', err);
          alert('❌ Network error during AWB generation. Check console for details.');
        }
      };

      const acceptOrder = async (orderId) => {
        try {
          const response = await fetch(`/admin/api/orders/${orderId}/accept`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchOrders(); // Refresh order list
            return { 
              success: true, 
              message: data.message, 
              notifications: data.notifications 
            };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const processManualOrder = async (orderId) => {
        try {
          const response = await fetch(`/admin/api/orders/${orderId}/process-manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok && data.success) {
            fetchOrders();
            alert('🖐 Procesare manuala pornita pentru comanda #' + orderId + '\n\nAWB + factura se genereaza in fundal. Fara mailuri trimise.\nRefresh dupa cateva secunde.');
          } else {
            alert('❌ Eroare: ' + (data.message || 'Procesare manuala esuata'));
          }
        } catch (err) {
          alert('❌ Eroare retea la procesarea manuala');
        }
      };

      const sendAcceptanceEmailFn = async (orderId) => {
        try {
          const response = await fetch(`/admin/api/orders/${orderId}/send-acceptance-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok && data.success) {
            alert('✅ ' + data.message);
          } else {
            alert('❌ Eroare: ' + (data.message || 'Trimitere esuata'));
          }
        } catch (err) {
          alert('❌ Eroare retea la trimiterea mailului');
        }
      };

      const performBulkOperation = async (operation, orderIds, data = {}) => {
        try {
          let endpoint = '';
          let payload = { orderIds, ...data };
          
          switch (operation) {
            case 'status':
              endpoint = '/admin/api/orders/bulk/status';
              break;
            case 'shipping':
              endpoint = '/admin/api/orders/bulk/shipping-labels';
              break;
            case 'notifications':
              endpoint = '/admin/api/orders/bulk/notifications';
              break;
            case 'refunds':
              endpoint = '/admin/api/orders/bulk/refunds';
              break;
            default:
              return { success: false, message: 'Invalid operation' };
          }
          
          const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          
          const result = await response.json();
          
          if (response.ok) {
            fetchOrders(); // Refresh order list
            return { success: true, message: result.message, results: result.results };
          } else {
            return { success: false, message: result.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const performProductBulkOperation = async (operation, productIds, data = {}) => {
        try {
          let endpoint = '';
          let payload = { productIds, ...data };
          
          switch (operation) {
            case 'update-prices':
              endpoint = '/admin/api/products/bulk/prices';
              break;
            case 'update-categories':
              endpoint = '/admin/api/products/bulk/categories';
              break;
            case 'update-status':
              endpoint = '/admin/api/products/bulk/status';
              break;
            case 'update-stock':
              endpoint = '/admin/api/products/bulk/stock';
              break;
            case 'export':
              endpoint = '/admin/api/products/bulk/export';
              break;
            case 'delete':
              endpoint = '/admin/api/products/bulk/delete';
              if (selectedMarketTab && selectedMarketTab !== 'all') {
                payload.market = selectedMarketTab;
              }
              break;
            default:
              return { success: false, message: 'Invalid operation' };
          }
          
          const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            let errorMessage = 'Bulk operation failed';
            try {
              const errorResult = await response.json();
              errorMessage = errorResult.message || errorMessage;
            } catch {
              // Keep the generic message when the server does not return JSON.
            }
            return { success: false, message: errorMessage };
          }

          if (operation === 'export') {
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = 'products_export.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(downloadUrl);
            return { success: true, message: 'Products exported successfully' };
          }

          const result = await response.json();
          return {
            success: true,
            message: result.message || 'Bulk operation completed successfully',
            results: result.results
          };
        } catch (err) {
          console.error('Product bulk operation failed:', err);
          return { success: false, message: 'Network error' };
        }
      };

      const initializeMarketCategories = async () => {
        const targetMarket = selectedMarketTab && selectedMarketTab !== 'all' ? selectedMarketTab : null;
        if (!targetMarket) {
          return { success: false, message: 'Selectează mai întâi o piață concretă.' };
        }
        if (!confirm(`Creează în ${targetMarket.toUpperCase()} copii independente ale categoriilor RO?\n\nCategoriile deja existente în ${targetMarket.toUpperCase()} nu vor fi modificate.`)) {
          return { success: false, message: 'Acțiune anulată' };
        }
        try {
          const response = await fetch('/admin/api/categories/initialize-market', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sourceMarket: 'ro', targetMarket })
          });
          const data = await response.json();
          if (response.ok) {
            await fetchCategories();
            return { success: true, message: data.message };
          }
          return { success: false, message: data.message || 'Nu s-au putut inițializa categoriile' };
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const deleteCategory = async (categoryId) => {
        try {
          const token = localStorage.getItem('adminToken');
          const response = await fetch(`/admin/api/categories/${categoryId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchCategories(); // Refresh category list
            return { success: true, message: data.message };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const updateHomepageCategories = async (mainTopCategories, mainShopCategories) => {
        try {
          const token = localStorage.getItem('adminToken');
          const response = await fetch('/admin/api/categories/bulk/homepage', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              mainTopCategories,
              mainShopCategories,
              marketCode: selectedMarketTab && selectedMarketTab !== 'all' ? selectedMarketTab : undefined
            })
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchCategories(); // Refresh category list
            return { success: true, message: data.message };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const getHeroMarket = () => selectedMarketTab && selectedMarketTab !== 'all' ? selectedMarketTab : null;

      const fetchHeroSlides = async () => {
        const market = getHeroMarket();
        if (!market) {
          setHeroSlides([]);
          return;
        }
        setHeroLoading(true);
        try {
          const response = await fetch(`/admin/api/homepage-hero?market=${market}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || t('homepageHero.loadFailed'));
          setHeroSlides(data.slides || []);
          setHeroSettings({ autoplaySeconds: data.autoplaySeconds || 5 });
        } catch (error) {
          alert(t('homepageHero.error', { message: error.message }));
        } finally {
          setHeroLoading(false);
        }
      };

      const saveHeroSettings = async () => {
        const market = getHeroMarket();
        if (!market) return alert(t('homepageHero.marketRequired'));
        const response = await fetch(`/admin/api/homepage-hero/settings?market=${market}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoplaySeconds: heroSettings.autoplaySeconds })
        });
        const data = await response.json();
        if (!response.ok) return alert(t('homepageHero.error', { message: data.message || t('homepageHero.settingsSaveFailed') }));
        setHeroSettings({ autoplaySeconds: data.autoplaySeconds });
      };

      const saveHeroSlide = async () => {
        const market = getHeroMarket();
        if (!market) return alert(t('homepageHero.marketRequired'));
        if (heroForm.slideType === 'image' && !heroForm.imageUrl.trim()) {
          return alert(t('homepageHero.imageRequired'));
        }
        setHeroSaving(true);
        try {
          const endpoint = editingHeroSlide
            ? `/admin/api/homepage-hero/${editingHeroSlide.id}?market=${market}`
            : `/admin/api/homepage-hero?market=${market}`;
          const payload = {
            ...heroForm,
            ctaUrl: heroForm.destinationType === 'none' ? heroForm.ctaUrl : ''
          };
          const response = await fetch(endpoint, {
            method: editingHeroSlide ? 'PUT' : 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || t('homepageHero.saveFailed'));
          setHeroForm(emptyHeroSlide());
          setEditingHeroSlide(null);
          await fetchHeroSlides();
        } catch (error) {
          alert(t('homepageHero.error', { message: error.message }));
        } finally {
          setHeroSaving(false);
        }
      };

      const editHeroSlide = (slide) => {
        setEditingHeroSlide(slide);
        setHeroForm({
          slideType: slide.slideType || 'text',
          imageUrl: slide.imageUrl || '',
          imageAlt: slide.imageAlt || '',
          title: slide.title || '',
          subtitle: slide.subtitle || '',
          ctaLabel: slide.ctaLabel || '',
          ctaUrl: slide.ctaUrl || '/products',
          ctaType: slide.ctaType || 'link',
           destinationType: slide.destinationType || 'none',
           destinationId: slide.destinationId || '',
           destinationUrl: slide.destinationUrl || '',
          isActive: slide.isActive !== false
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      const deleteHeroSlide = async (slide) => {
        if (!window.confirm(t('homepageHero.deleteConfirm'))) return;
        const market = getHeroMarket();
        const response = await fetch(`/admin/api/homepage-hero/${slide.id}?market=${market}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) return alert(t('homepageHero.error', { message: data.message || t('homepageHero.deleteFailed') }));
        fetchHeroSlides();
        if (editingHeroSlide?.id === slide.id) {
          setEditingHeroSlide(null);
          setHeroForm(emptyHeroSlide());
        }
      };

      const reorderHeroSlide = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= heroSlides.length) return;
        const reordered = [...heroSlides];
        [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
        const market = getHeroMarket();
        const response = await fetch(`/admin/api/homepage-hero/reorder?market=${market}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: reordered.map(slide => slide.id) })
        });
        const data = await response.json();
        if (!response.ok) return alert(t('homepageHero.error', { message: data.message || t('homepageHero.reorderFailed') }));
        setHeroSlides(data);
      };

      const uploadHeroImage = async (file) => {
        if (!file || !file.type.startsWith('image/')) return alert(t('homepageHero.imageFileRequired'));
        setHeroUploading(true);
        try {
          const formData = new FormData();
          formData.append('images', file);
          const response = await fetch('/admin/api/upload-images', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });
          const data = await response.json();
          if (!response.ok || !data.files?.[0]) throw new Error(data.message || t('homepageHero.uploadFailed'));
          const uploaded = data.files[0];
          setHeroForm(prev => ({ ...prev, imageUrl: uploaded.url || uploaded.thumbnailUrl || uploaded }));
        } catch (error) {
          alert(t('homepageHero.error', { message: error.message }));
        } finally {
          setHeroUploading(false);
        }
      };

      // Fetch company settings
      const fetchCompanySettings = async () => {
        try {
          const mkt = sessionStorage.getItem('adminMarketTab');
          const mktParam = mkt && mkt !== 'all' ? `?market=${mkt}` : '';
          const response = await fetch(`/admin/api/company-settings${mktParam}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok && data) {
            setCompanySettings(data);
          } else {
            // Set default values if no company settings exist
            setCompanySettings({
              name: 'xHACCP',
              email: 'info@xhaccp.com',
              phone: '+40 123 456 789',
              address: 'Calea Mosilor 158',
              city: 'Bucharest',
              state: 'Bucuresti',
              zipCode: '020883',
              country: 'Romania',
              contactPerson: 'Company Administrator',
              website: 'https://xhaccp.com',
              vatNumber: '',
              registrationNumber: '',
              defaultCurrency: 'EUR',
              defaultVatPercentage: '19.00',
              reverseChargeVat: '0.00',
              freeShippingThreshold: '500.00',
              standardShippingCost: '25.00',
              description: 'Professional kitchen equipment and supplies for the HORECA industry.'
            });
          }
        } catch (err) {
          console.error('Network error fetching company settings:', err);
        }
      };
      
      // Fetch company defaults for new products
      const fetchCompanyDefaults = async () => {
        try {
          const market = selectedMarketTab && selectedMarketTab !== 'all' ? selectedMarketTab : '';
          const response = await fetch(`/admin/api/company-settings${market ? `?market=${market}` : ''}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok && data) {
            return {
              currency: data.defaultCurrency || 'EUR',
              vatPercentage: data.defaultVatPercentage || (market === 'fr' ? '20.00' : market === 'ro' ? '19.00' : '0.00')
            };
          }
        } catch (err) {
          console.error('Error fetching company defaults:', err);
        }
        
        // Return defaults if fetch fails
        return {
          currency: 'EUR',
          vatPercentage: selectedMarketTab === 'fr' ? '20.00' : selectedMarketTab === 'ro' ? '19.00' : '0.00'
        };
      };

      // Currency conversion rates (approximate)
      const exchangeRates = {
        'EUR': { 'RON': 4.95, 'USD': 1.10, 'GBP': 0.86 },
        'RON': { 'EUR': 0.20, 'USD': 0.22, 'GBP': 0.17 },
        'USD': { 'EUR': 0.91, 'RON': 4.50, 'GBP': 0.78 },
        'GBP': { 'EUR': 1.16, 'RON': 5.88, 'USD': 1.28 }
      };

      // Handle currency change for shipping values
      const handleCurrencyChange = (event) => {
        const newCurrency = event.target.value;
        const currentCurrency = companySettings.defaultCurrency || 'EUR';
        
        if (newCurrency === currentCurrency) return;
        
        const form = event.target.closest('form');
        const shippingThresholdInput = form.querySelector('input[name="freeShippingThreshold"]');
        const shippingCostInput = form.querySelector('input[name="standardShippingCost"]');
        
        if (shippingThresholdInput && shippingCostInput) {
          const currentThreshold = parseFloat(shippingThresholdInput.value) || 500;
          const currentCost = parseFloat(shippingCostInput.value) || 25;
          
          // Convert values to new currency
          const rate = exchangeRates[currentCurrency]?.[newCurrency] || 1;
          const newThreshold = (currentThreshold * rate).toFixed(2);
          const newCost = (currentCost * rate).toFixed(2);
          
          shippingThresholdInput.value = newThreshold;
          shippingCostInput.value = newCost;
          
          // Update shipping threshold label
          const thresholdLabel = shippingThresholdInput.parentNode.querySelector('label');
          if (thresholdLabel) {
            thresholdLabel.innerHTML = `Free Shipping Threshold (${newCurrency})`;
          }
          
          // Update shipping cost label
          const costLabel = shippingCostInput.parentNode.querySelector('label');
          if (costLabel) {
            costLabel.innerHTML = `Standard Shipping Cost (${newCurrency})`;
          }
          
          console.log(`Currency changed from ${currentCurrency} to ${newCurrency}: Threshold ${currentThreshold} → ${newThreshold}, Cost ${currentCost} → ${newCost}`);
        }
      };

      // Update company settings
      const updateCompanySettings = async (settingsData) => {
        try {
          const mkt = sessionStorage.getItem('adminMarketTab');
          const mktParam = mkt && mkt !== 'all' ? `?market=${mkt}` : '';
          const response = await fetch(`/admin/api/company-settings${mktParam}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(settingsData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            return { success: true, message: 'Company settings updated successfully' };
          } else {
            return { success: false, message: data.message || 'Failed to update company settings' };
          }
        } catch (error) {
          console.error('Error updating company settings:', error);
          return { success: false, message: 'Network error. Please try again.' };
        }
      };

      const handleViewChange = (view) => {
        setActiveView(view);
        if (view === 'users') {
          fetchUsers(); // Always refetch — ensures market context is current
        } else if (view === 'orders' && orders.length === 0) {
          fetchOrders();
        } else if (view === 'products') {
          if (products.length === 0) {
            fetchProducts();
          }
          // The product create/edit form uses the marketplace-scoped
          // category list, so load it when entering Products as well.
          fetchCategories();
          if (suppliers.length === 0) {
            fetchSuppliers();
          }
          fetchProductMarkets();
        } else if (view === 'categories') {
          fetchCategories();
        } else if (view === 'homepage-hero') {
          fetchHeroSlides();
          fetchProducts(selectedMarketTab);
          fetchCategories(getHeroMarket(), { requireMarket: true });
        } else if (view === 'suppliers') {
          fetchSuppliers();
        } else if (view === 'company-settings') {
          fetchCompanySettings();
          fetchMarkets();
        } else if (view === 'marketing') {
          fetchMarkets();
          fetchMarketing();
        } else if (view === 'vouchers') {
          fetchVouchers();
        } else if (view === 'blog') {
          fetchBlogPosts();
        } else if (view === 'google-feed') {
          fetchGoogleFeed();
        } else if (view === 'wms') {
          fetchWmsOverview();
        }
      };
      
      const handleLogout = async () => {
        try {
          await fetch('/admin/api/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        } catch (err) {
          console.error('Logout error:', err);
        } finally {
          // Clear all admin session data
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          // Force page reload to ensure clean state
          window.location.reload();
        }
      };
      
      if (loading) {
        return (
          <div className="container">
            <div className="text-center">
              <div className="loading"></div>
              <p>Loading dashboard...</p>
            </div>
          </div>
        );
      }
      
      if (error) {
        return (
          <div className="container">
            <div className="error-message">{error}</div>
            <button onClick={handleLogout} className="btn btn-secondary">
              {t('header.logout')}
            </button>
          </div>
        );
      }
      
      const renderContent = () => {
        switch (activeView) {
          case 'wms': {
            const visibleMarkets = adminIsSuperAdmin ? ['ro', 'fr', 'com'] : (admin?.adminMarkets || []);
            const activeWmsRoute = wmsOverview.routing.find(route => route.market === wmsFocusedMarket);
            const activeWmsDecision = wmsOverview.routingDecisions?.find(route => route.market === wmsFocusedMarket);
            const activeOriginAddress = wmsOriginAddresses[wmsFocusedMarket] || wmsOriginAddresses.ro;
            const marketPartners = wmsOverview.partners.filter(partner => partner.markets?.includes(wmsFocusedMarket));
            const isSelectedPartnerInMarket = marketPartners.some(partner => partner.id === wmsSelectedPartner?.id);
            return (
              <div style={{background:'white',padding:'30px',borderRadius:'8px',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'18px',marginBottom:'18px'}}>
                  <div>
                    <h3 style={{color:'#172b4d',margin:'0 0 6px'}}>{t('wms.title')}</h3>
                    <p style={{color:'#6c757d',margin:0}}>{t('wms.description')}</p>
                  </div>
                  <button className="btn" onClick={fetchWmsOverview} style={{width:'auto',padding:'8px 16px',background:'#0d6efd'}}>
                    {wmsLoading ? t('wms.loading') : `↻ ${t('wms.reload')}`}
                  </button>
                </div>

                {selectedMarketTab === 'all' && (
                  <div style={{border:'1px solid #d8e5f5',background:'#f7fbff',borderRadius:'8px',padding:'14px 16px',marginBottom:'20px'}}>
                    <div style={{fontSize:'12px',fontWeight:700,color:'#526581',marginBottom:'8px'}}>{t('wms.marketSelection')}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                      {visibleMarkets.map(market => (
                        <button
                          key={market}
                          onClick={() => setWmsFocusedMarket(market)}
                          style={{
                            border:'1px solid',
                            borderColor:wmsFocusedMarket === market ? '#0d6efd' : '#ced9e8',
                            background:wmsFocusedMarket === market ? '#e8f2ff' : 'white',
                            color:wmsFocusedMarket === market ? '#0a58ca' : '#495057',
                            borderRadius:'6px',
                            padding:'7px 13px',
                            fontWeight:600,
                            cursor:'pointer'
                          }}
                        >
                          .{market}
                        </button>
                      ))}
                    </div>
                    <p style={{margin:'9px 0 0',fontSize:'12px',color:'#6c757d'}}>{t('wms.marketSelectionHint')}</p>
                  </div>
                )}

                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',marginBottom:'12px'}}>
                  <div>
                    <span style={{fontSize:'12px',fontWeight:700,color:'#6c757d'}}>{t('wms.activeMarket')}</span>
                    <h4 style={{margin:'3px 0 0',color:'#172b4d'}}>.{wmsFocusedMarket}</h4>
                  </div>
                  <span style={{fontSize:'12px',fontWeight:600,color:activeWmsDecision?.decision === 'active' ? '#198754' : activeWmsDecision?.decision === 'inactive' ? '#6c757d' : '#dc3545'}}>
                    {activeWmsDecision?.decision === 'active' ? t('wms.active') : activeWmsDecision?.decision === 'inactive' ? t('wms.inactive') : t('wms.unconfigured')}
                  </span>
                </div>

                <div style={{border:'1px solid #dee2e6',borderRadius:'8px',padding:'18px',marginBottom:'20px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'16px',marginBottom:'16px'}}>
                    <div>
                      <h4 style={{margin:'0 0 5px',color:'#333'}}>{t('wms.partnersTitle')}</h4>
                      <p style={{margin:0,color:'#6c757d',fontSize:'13px'}}>{t('wms.partnerListDescription')}</p>
                    </div>
                    <span style={{fontSize:'12px',color:'#6c757d'}}>{marketPartners.length} {t('wms.providersCount')}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'minmax(230px,.8fr) minmax(300px,1.5fr) minmax(220px,.8fr)',gap:'16px'}}>
                    <div style={{display:'grid',alignContent:'start',gap:'8px'}}>
                      {marketPartners.map(partner => (
                        <button
                          key={partner.id}
                          onClick={() => loadWmsKeys(partner)}
                          style={{
                            border:'1px solid',
                            borderColor:wmsSelectedPartner?.id === partner.id ? '#6197ee' : '#e0e6ef',
                            background:wmsSelectedPartner?.id === partner.id ? '#f1f7ff' : 'white',
                            borderRadius:'7px',
                            padding:'12px',
                            textAlign:'left',
                            cursor:'pointer'
                          }}
                        >
                          <strong style={{display:'block',color:'#172b4d'}}>{partner.name}</strong>
                          <span style={{display:'block',fontSize:'12px',color:'#6c757d',marginTop:'4px'}}>{partner.code}</span>
                          <span style={{display:'inline-block',fontSize:'11px',fontWeight:600,color:partner.isActive ? '#198754' : '#dc3545',marginTop:'7px'}}>{partner.isActive ? t('wms.active') : t('wms.inactive')}</span>
                        </button>
                      ))}
                      {!marketPartners.length && <p style={{color:'#6c757d',fontSize:'13px',margin:0}}>{t('wms.noMarketPartners')}</p>}
                    </div>

                    <div style={{border:'1px solid #e6ebf2',borderRadius:'7px',background:'#fbfdff',padding:'15px'}}>
                      {isSelectedPartnerInMarket ? (
                        <>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px',marginBottom:'14px'}}>
                            <div>
                              <h4 style={{margin:'0 0 4px',color:'#172b4d'}}>{t('wms.partnerDetails')}: {wmsSelectedPartner.name}</h4>
                              <span style={{fontSize:'12px',color:'#6c757d'}}>{wmsSelectedPartner.code} · {t('wms.markets')}: {wmsSelectedPartner.markets?.join(', ') || '—'}</span>
                            </div>
                            <span style={{fontSize:'12px',fontWeight:600,color:wmsSelectedPartner.isActive ? '#198754' : '#dc3545'}}>{wmsSelectedPartner.isActive ? t('wms.active') : t('wms.inactive')}</span>
                          </div>
                          <strong style={{fontSize:'13px',color:'#333'}}>{t('wms.keyTitle')}</strong>
                          {wmsKeys.map(key => <div key={key.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',padding:'10px 0',borderBottom:'1px solid #edf1f6',fontSize:'12px'}}>
                            <span><code>{key.keyPrefix}…</code> · {key.environment} · {key.isRevoked ? t('wms.revoked') : t('wms.active')}</span>
                            {!key.isRevoked && <button onClick={()=>revokeWmsKey(key.id)} className="btn" style={{width:'auto',padding:'5px 10px',background:'#dc3545'}}>{t('wms.revoke')}</button>}
                          </div>)}
                          {!wmsKeys.length && <p style={{color:'#6c757d',fontSize:'13px'}}>{t('wms.noKeys')}</p>}
                        </>
                      ) : (
                        <p style={{color:'#6c757d',fontSize:'13px',margin:0}}>{t('wms.selectPartnerPrompt')}</p>
                      )}
                    </div>

                    <div style={{border:'1px solid #e6ebf2',borderRadius:'7px',padding:'15px'}}>
                      <h4 style={{margin:'0 0 12px',color:'#333'}}>{t('wms.newKey')}</h4>
                      <select value={wmsKeyForm.partnerId} onChange={e=>setWmsKeyForm({...wmsKeyForm,partnerId:e.target.value})} style={{width:'100%',padding:'9px',marginBottom:'8px',border:'1px solid #ced4da',borderRadius:'5px'}}>
                        <option value="">{t('wms.selectPartner')}</option>
                        {marketPartners.map(partner => <option key={partner.id} value={partner.id}>{partner.name} ({partner.code})</option>)}
                      </select>
                      <select value={wmsKeyForm.environment} onChange={e=>setWmsKeyForm({...wmsKeyForm,environment:e.target.value})} style={{width:'100%',padding:'9px',marginBottom:'10px',border:'1px solid #ced4da',borderRadius:'5px'}}>
                        <option value="production">{t('wms.production')}</option>
                        <option value="sandbox">{t('wms.sandbox')}</option>
                      </select>
                      <button onClick={createWmsKey} className="btn" style={{width:'100%',padding:'8px 12px',background:'#6f42c1'}}>🔑 {t('wms.generateKey')}</button>
                    </div>
                  </div>
                </div>

                {wmsPlaintextKey && (
                  <div style={{background:'#fff3cd',border:'1px solid #ffecb5',padding:'14px',borderRadius:'7px',marginBottom:'20px'}}>
                    <strong>{t('wms.keyShownOnce')}</strong>
                    <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                      <input readOnly value={wmsPlaintextKey} style={{flex:1,padding:'9px',fontFamily:'monospace',border:'1px solid #ced4da',borderRadius:'4px'}} />
                      <button onClick={()=>navigator.clipboard?.writeText(wmsPlaintextKey)} className="btn" style={{width:'auto',padding:'8px 12px'}}>{t('wms.copy')}</button>
                      <button onClick={()=>setWmsPlaintextKey('')} className="btn btn-secondary" style={{width:'auto',padding:'8px 12px'}}>{t('common.close')}</button>
                    </div>
                  </div>
                )}

                <div style={{border:'1px solid #dee2e6',borderRadius:'8px',padding:'18px',marginBottom:'20px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'16px',marginBottom:'14px'}}>
                    <div>
                      <h4 style={{margin:'0 0 5px',color:'#333'}}>{t('wms.routingTitle')} · .{wmsFocusedMarket}</h4>
                      <p style={{margin:0,color:'#6c757d',fontSize:'13px'}}>{t('wms.routingForMarketDescription', { market: `.${wmsFocusedMarket}` })}</p>
                    </div>
                    <span style={{fontSize:'12px',fontWeight:600,color:activeWmsDecision?.decision === 'active' ? '#198754' : activeWmsDecision?.decision === 'inactive' ? '#6c757d' : '#dc3545'}}>
                      {activeWmsDecision?.decision === 'active' ? t('wms.active') : activeWmsDecision?.decision === 'inactive' ? t('wms.inactive') : t('wms.unconfigured')}
                    </span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'minmax(260px,1fr) minmax(220px,.6fr)',gap:'14px',alignItems:'end'}}>
                    <select value={activeWmsRoute?.partnerId || ''} onChange={e=>routeWmsMarket(wmsFocusedMarket,e.target.value)} style={{width:'100%',padding:'9px',border:'1px solid #ced4da',borderRadius:'5px'}}>
                      <option value="">{t('wms.noRouting')}</option>
                      {wmsOverview.partners.filter(partner=>partner.isActive || partner.id === activeWmsRoute?.partnerId).map(partner=><option key={partner.id} value={partner.id}>{partner.name}{!partner.isActive ? ` (${t('wms.inactive')})` : ''}</option>)}
                    </select>
                    {activeWmsRoute?.partnerId && <label style={{display:'flex',alignItems:'center',gap:'7px',minHeight:'38px',fontSize:'13px',color:'#495057'}}>
                      <input type="checkbox" checked={activeWmsRoute.isActive} onChange={e=>routeWmsMarket(wmsFocusedMarket,activeWmsRoute.partnerId,e.target.checked)} />
                      {t('wms.activeRouting')}
                    </label>}
                  </div>
                </div>

                <div style={{border:'1px solid #b8daff',background:'#f0f7ff',borderRadius:'8px',padding:'18px',marginBottom:'20px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'16px',marginBottom:'14px'}}>
                    <div>
                      <h4 style={{margin:'0 0 6px',color:'#145da0'}}>{t('wms.originTitle', { market: `.${wmsFocusedMarket}` })}</h4>
                      <p style={{margin:0,color:'#495057',fontSize:'13px'}}>{t('wms.originDescription', { market: `.${wmsFocusedMarket}` })}</p>
                    </div>
                    <span style={{fontSize:'12px',fontWeight:600,color:activeOriginAddress.id ? '#198754' : '#dc3545',whiteSpace:'nowrap'}}>
                      {activeOriginAddress.id ? t('wms.configured') : t('wms.required')}
                    </span>
                  </div>
                  {wmsOriginLoading ? (
                    <p style={{color:'#6c757d'}}>{t('wms.originLoading')}</p>
                  ) : (
                    <>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'12px'}}>
                        {[
                          ['companyName', t('wms.companyName')],
                          ['address', t('wms.address')],
                          ['city', t('wms.city')],
                          ['state', t('wms.state')],
                          ['zipCode', t('wms.zipCode')],
                          ['country', t('wms.country')],
                          ['phone', t('wms.phone')],
                          ['email', t('wms.email')]
                        ].map(([field, label]) => (
                          <label key={field} style={{fontSize:'12px',fontWeight:600,color:'#495057'}}>
                            {label} *
                            <input
                              value={activeOriginAddress[field] || ''}
                              onChange={e=>setWmsOriginAddresses(previous=>({...previous,[wmsFocusedMarket]:{...previous[wmsFocusedMarket],[field]:e.target.value}}))}
                              required
                              style={{display:'block',width:'100%',boxSizing:'border-box',padding:'9px',marginTop:'4px',border:'1px solid #ced4da',borderRadius:'5px',background:'white'}}
                            />
                          </label>
                        ))}
                      </div>
                      {wmsFocusedMarket === 'ro' && (
                        <div style={{marginTop:'14px',padding:'12px',border:'1px solid #b8daff',borderRadius:'6px',background:'#fff'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:'12px'}}>
                            <label style={{flex:1,fontSize:'12px',fontWeight:600,color:'#495057'}}>
                              {t('wms.samedayPickupPoint')} *
                              <select
                                value={activeOriginAddress.samedayPickupPointId || ''}
                                onChange={e=>setWmsOriginAddresses(previous=>({...previous,[wmsFocusedMarket]:{...previous[wmsFocusedMarket],samedayPickupPointId:e.target.value}}))}
                                required
                                style={{display:'block',width:'100%',boxSizing:'border-box',padding:'9px',marginTop:'4px',border:'1px solid #ced4da',borderRadius:'5px',background:'white'}}
                              >
                                <option value="">{t('wms.selectPickupPoint')}</option>
                                {wmsSamedayPickupPoints.map(point => (
                                  <option key={point.id} value={point.id}>
                                    {point.id} · {point.name} · {point.city} · {point.address}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              onClick={fetchWmsSamedayPickupPoints}
                              disabled={wmsSamedayPickupPointsLoading}
                              className="btn"
                              style={{width:'auto',padding:'8px 12px',background:'#0d6efd'}}
                            >
                              {wmsSamedayPickupPointsLoading ? t('wms.loading') : t('wms.loadPickupPoints')}
                            </button>
                          </div>
                          <p style={{margin:'8px 0 0',fontSize:'12px',color:'#6c757d'}}>
                            {t('wms.samedayPickupPointHint')}
                          </p>
                        </div>
                      )}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',marginTop:'14px'}}>
                        <span style={{fontSize:'12px',color:'#6c757d'}}>{t('wms.stateHint')}</span>
                        <button onClick={saveWmsOriginAddress} disabled={wmsOriginSaving} className="btn" style={{width:'auto',padding:'8px 16px',background:'#198754'}}>
                          {wmsOriginSaving ? t('wms.savingOrigin') : t('wms.saveOrigin')}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'minmax(280px,1fr) minmax(280px,1fr)',gap:'20px',marginTop:'24px'}}>
                  <div style={{border:'1px solid #dee2e6',borderRadius:'8px',padding:'18px'}}>
                    <h4 style={{margin:'0 0 12px',color:'#333'}}>{t('wms.timelineTitle')}</h4>
                    <div style={{display:'flex',gap:'8px'}}>
                      <input value={wmsOrderId} onChange={e=>setWmsOrderId(e.target.value)} placeholder={t('wms.orderIdPlaceholder')} style={{flex:1,padding:'9px',border:'1px solid #ced4da',borderRadius:'5px'}} />
                      <button onClick={loadWmsOrderTimeline} className="btn" style={{width:'auto',padding:'7px 12px',background:'#0d6efd'}}>{t('wms.load')}</button>
                    </div>
                    {wmsOrderTimeline && (
                      <div style={{marginTop:'12px',fontSize:'13px'}}>
                        <div><strong>{t('wms.fulfillment')}:</strong> {wmsOrderTimeline.fulfillmentStatus || '—'} · <strong>{t('wms.partner')}:</strong> {wmsOrderTimeline.partnerId || '—'}</div>
                        <div style={{marginTop:'8px'}}><strong>{t('wms.shipments')}</strong> ({wmsOrderTimeline.shipments?.length || 0})</div>
                        {wmsOrderTimeline.shipments?.map(shipment => <div key={shipment.id} style={{padding:'5px 0',color:'#495057'}}>{shipment.parcelId} · {shipment.trackingNumber || 'fără tracking'} · {shipment.status}</div>)}
                        <div style={{marginTop:'8px'}}><strong>{t('wms.events')}</strong> ({wmsOrderTimeline.events?.length || 0})</div>
                        {wmsOrderTimeline.events?.slice(0,6).map(event => <div key={event.id} style={{padding:'5px 0',color:'#495057'}}>{event.status} · {new Date(event.occurredAt).toLocaleString()}</div>)}
                      </div>
                    )}
                  </div>
                  <div style={{border:'1px solid #dee2e6',borderRadius:'8px',padding:'18px'}}>
                    <h4 style={{margin:'0 0 12px',color:'#333'}}>{t('wms.latestRequests')}</h4>
                    {wmsAudit.slice(0,8).map(entry => <div key={entry.id} style={{padding:'6px 0',borderBottom:'1px solid #f1f3f5',fontSize:'12px'}}>
                      <strong>{entry.statusCode}</strong> · {entry.method} {entry.path}<br />
                      <span style={{color:'#6c757d'}}>{entry.requestId} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
                    </div>)}
                    {!wmsAudit.length && <p style={{color:'#6c757d',fontSize:'13px'}}>{t('wms.noRequests')}</p>}
                  </div>
                </div>
              </div>
            );
          }
          case 'orders':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>📋 Order Management</h3>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button
                      className="btn"
                      style={{background: '#28a745', width: 'auto', padding: '8px 16px'}}
                      onClick={() => setShowAddOrderModal(true)}
                    >
                      ➕ Comandă nouă
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#17a2b8', width: 'auto', padding: '8px 16px'}}
                      onClick={() => alert('Export orders functionality:\n\n• Export to CSV/Excel\n• Filter by date range\n• Include customer details\n• Sales reports\n• Tax documentation')}
                    >
                      📊 Export Orders
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#6c757d', width: 'auto', padding: '8px 16px'}}
                      onClick={() => alert('Order analytics:\n\n• Sales performance\n• Revenue trends\n• Customer behavior\n• Popular products\n• Seasonal patterns')}
                    >
                      📈 Analytics
                    </button>
                  </div>
                </div>
                
                <div style={{marginBottom: '20px'}}>
                  <h4 style={{color: '#333', marginBottom: '15px'}}>Order Actions</h4>
                   <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                    <button 
                      className="btn" 
                      style={{background: '#007bff', width: 'auto', padding: '8px 16px'}}
                      onClick={() => setShowSearchFilter(!showSearchFilter)}
                    >
                      🔍 Search & Filter
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#28a745', width: 'auto', padding: '8px 16px'}}
                      onClick={() => {
                        if (selectedOrders.length === 0) {
                          alert('Please select orders first by checking the checkboxes.');
                          return;
                        }
                        setBulkOperation('status');
                        setShowBulkModal(true);
                      }}
                    >
                      🔄 Bulk Operations
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#dc3545', width: 'auto', padding: '8px 16px'}}
                      onClick={() => {
                        if (selectedOrders.length === 0) {
                          alert('Please select orders first by checking the checkboxes.');
                          return;
                        }
                        setShowOrderTools(true);
                      }}
                    >
                      🛠️ Order Tools
                    </button>
                  </div>
                </div>
                
                {showSearchFilter && (
                  <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #dee2e6'}}>
                    <h4 style={{color: '#333', marginBottom: '15px'}}>🔍 Search & Filter Orders</h4>
                    <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center'}}>
                      <div style={{flex: '1', minWidth: '200px'}}>
                        <input
                          type="text"
                          placeholder="Caută după ID, client, oraș..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div style={{flex: '1', minWidth: '180px'}}>
                        <input
                          type="text"
                          placeholder="Caută după firmă..."
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div style={{minWidth: '150px'}}>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '14px'
                          }}
                        >
                          <option value="all">{t('common.allStatus')}</option>
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="in_delivery">In Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div style={{minWidth: '130px'}}>
                        <select
                          value={marketFilter}
                          onChange={(e) => setMarketFilter(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            fontSize: '14px'
                          }}
                        >
                          <option value="all">🌍 Toate piețele</option>
                          <option value="ro">🇷🇴 .ro</option>
                          <option value="fr">🇫🇷 .fr</option>
                          <option value="com">🌐 .com</option>
                        </select>
                      </div>
                      <button
                        className="btn"
                        style={{background: '#6c757d', width: 'auto', padding: '8px 16px'}}
                        onClick={() => {
                          setSearchTerm('');
                          setCompanySearch('');
                          setStatusFilter('all');
                          setMarketFilter('all');
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div style={{marginTop: '10px', color: '#666', fontSize: '14px'}}>
                      Showing {filteredOrders.length} of {orders.length} orders
                    </div>
                  </div>
                )}
                
                {orders.length > 0 ? (
                  <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed'}}>
                      <thead>
                        <tr style={{backgroundColor: '#f5f5f5'}}>
                          <th style={{padding: '8px', textAlign: 'center', borderBottom: '2px solid #ddd', width: '40px', minWidth: '40px', whiteSpace: 'nowrap'}}>
                            <input 
                              type="checkbox" 
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOrders(filteredOrders.map(order => order.id));
                                } else {
                                  setSelectedOrders([]);
                                }
                              }}
                              checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                            />
                          </th>
                          <th style={{padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '70px'}}>Order ID</th>
                          <th style={{padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '150px'}}>Client</th>
                          <th style={{padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '280px'}}>Firmă</th>
                          <th style={{padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '90px'}}>Total</th>
                          <th style={{padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '100px'}}>Status</th>
                          <th style={{padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '90px'}}>Dată</th>
                          <th style={{padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Acțiuni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.slice((ordersPage - 1) * 50, ordersPage * 50).map((order, index) => (
                          <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                            <td style={{padding: '8px', textAlign: 'center'}}>
                              <input 
                                type="checkbox" 
                                checked={selectedOrders.includes(order.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrders([...selectedOrders, order.id]);
                                  } else {
                                    setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                                  }
                                }}
                              />
                            </td>
                            <td style={{padding: '8px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                              #{order.id}
                              <span style={{marginLeft: '4px', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', background: (order.market||'ro')==='ro' ? '#fff3cd' : (order.market==='fr' ? '#cfe2ff' : '#d1e7dd'), color: '#333'}}>{(order.market||'ro').toUpperCase()}</span>
                            </td>
                            <td style={{padding: '8px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={(() => { const sa = order.shippingAddress; const name = [sa?.firstName, sa?.lastName].filter(Boolean).join(' '); return name || `#${order.userId}`; })()}>{(() => { const sa = order.shippingAddress; const name = [sa?.firstName, sa?.lastName].filter(Boolean).join(' '); return name || `#${order.userId}`; })()}</td>
                            <td style={{padding: '8px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px'}} title={order.billingAddress?.companyName || ''}>{order.billingAddress?.companyName || ''}</td>
                            <td style={{padding: '8px 12px', color: '#28a745', fontWeight: 'bold', whiteSpace: 'nowrap'}}>{parseFloat(order.totalAmount).toFixed(2)} lei</td>
                            <td style={{padding: '8px 12px', whiteSpace: 'nowrap'}}>
                              <span style={{
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                backgroundColor: order.status === 'pending' ? '#fff3cd' : 
                                                order.status === 'accepted' ? '#d1ecf1' : 
                                                order.status === 'processing' ? '#cce5ff' : 
                                                order.status === 'shipped' ? '#d4edda' : 
                                                order.status === 'in_delivery' ? '#d4f4f4' : 
                                                order.status === 'delivered' ? '#d4edda' : 
                                                order.status === 'cancelled' ? '#f8d7da' : order.status === 'manual_processing' ? '#fff0d6' : order.status === 'manual_failed' ? '#f8d7da' : '#e2e3e5',
                                color: order.status === 'pending' ? '#856404' : 
                                       order.status === 'accepted' ? '#0c5460' : 
                                       order.status === 'processing' ? '#0056b3' : 
                                       order.status === 'shipped' ? '#155724' : 
                                       order.status === 'in_delivery' ? '#0e7c7b' : 
                                       order.status === 'delivered' ? '#155724' : 
                                       order.status === 'cancelled' ? '#721c24' : order.status === 'manual_processing' ? '#8a4a00' : order.status === 'manual_failed' ? '#7a1a1a' : '#383d41'
                              }}>
                                {order.status === 'in_delivery' ? 'In Delivery' : order.status === 'manual_processing' ? '⏳ Manual...' : order.status === 'manual_failed' ? '❌ Manual eșuat' : order.status === 'cash_on_delivery' ? 'COD' : order.status}
                              </span>
                              {order.source === 'manual_admin' && (
                                <span style={{display:'inline-block',marginLeft:'4px',padding:'2px 5px',borderRadius:'3px',backgroundColor:'#fd7e14',color:'white',fontSize:'10px',fontWeight:'bold',verticalAlign:'middle'}} title="Comanda procesata manual de admin">🖐 Manual</span>
                              )}
                            </td>
                            <td style={{padding: '8px 12px', whiteSpace: 'nowrap'}}>{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td style={{padding: '8px 12px', whiteSpace: 'nowrap'}}>
                              <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                                <button 
                                  style={{
                                    padding: '4px 8px', 
                                    border: 'none', 
                                    borderRadius: '3px', 
                                    backgroundColor: '#007bff', 
                                    color: 'white', 
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setShowOrderDetails(true);
                                  }}
                                >
                                  👁️ View
                                </button>
                                {order.status === 'pending' && (
                                  <button 
                                    style={{
                                      padding: '4px 8px', 
                                      border: 'none', 
                                      borderRadius: '3px', 
                                      backgroundColor: '#17a2b8', 
                                      color: 'white', 
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                    onClick={async () => {
                                      if (confirm(`Accept order #${order.id}?\n\nThis will:\n• Update order status to 'processing'\n• Send confirmation email to customer\n• Send notification to logistics team\n• Enable AWB generation button`)) {
                                        const result = await acceptOrder(order.id);
                                        if (result.success) {
                                          let message = 'Order accepted successfully!';
                                          if (result.notifications) {
                                            message += '\n\nEmail notifications:';
                                            message += result.notifications.customerEmail ? '\n✅ Customer confirmation sent' : '\n❌ Customer email failed';
                                            message += result.notifications.logisticsEmail ? '\n✅ Logistics notification sent' : '\n❌ Logistics email failed';
                                          }
                                          alert(message);
                                        } else {
                                          alert('Error: ' + result.message);
                                        }
                                      }
                                    }}
                                  >
                                    ✅ Accept
                                  </button>
                                )}
                                {order.status === 'pending' && !order.awbNumber && order.source !== 'manual_admin' && (
                                  <button
                                    style={{padding:'4px 8px',border:'none',borderRadius:'3px',backgroundColor:'#e67e22',color:'white',cursor:'pointer',fontSize:'12px'}}
                                    onClick={() => {
                                      if (confirm('🖐 Procesare manuala comanda #' + order.id + '\n\nVa genera AWB + factura\nFara mailuri trimise.\n\nContinui?')) {
                                        processManualOrder(order.id);
                                      }
                                    }}
                                  >🖐 Manual</button>
                                )}
                                {order.source === 'manual_admin' && order.status === 'manual_failed' && (
                                  <button
                                    style={{padding:'4px 8px',border:'none',borderRadius:'3px',backgroundColor:'#dc3545',color:'white',cursor:'pointer',fontSize:'12px'}}
                                    onClick={() => {
                                      if (confirm('🔄 Reîncearcă procesarea manuală pentru comanda #' + order.id + '?\n\nVa relua generarea AWB/facturii (cele deja existente NU se duplică).')) {
                                        processManualOrder(order.id);
                                      }
                                    }}
                                  >🔄 Retry Manual</button>
                                )}
                                {!['delivered','cancelled'].includes(order.status) && (!order.awbNumber || order.awbNumber.includes('-API') || order.awbNumber.includes('-MANUAL-')) && (
                                  <button 
                                    style={{
                                      padding: '4px 8px', 
                                      border: 'none', 
                                      borderRadius: '3px', 
                                      backgroundColor: '#8e44ad', 
                                      color: 'white', 
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                    onClick={() => generateAWB(order.id)}
                                  >
                                    🚛 Generate AWB
                                  </button>
                                )}
                                {order.awbNumber && !order.awbNumber.includes('-API') && !order.awbNumber.includes('-MANUAL-') && (
                                  <button 
                                    style={{
                                      padding: '4px 8px', 
                                      border: 'none', 
                                      borderRadius: '3px', 
                                      backgroundColor: '#17a2b8', 
                                      color: 'white', 
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                    onClick={() => window.open(`https://sameday.ro/status-colet/?awb=${order.awbNumber}`, '_blank')}
                                  >
                                    📦 Track Package
                                  </button>
                                )}
                                {order.awbNumber && !order.awbNumber.includes('-API') && !order.awbNumber.includes('-MANUAL-') && (
                                  <button
                                    style={{padding:'4px 8px',border:'none',borderRadius:'3px',backgroundColor:'#20c997',color:'white',cursor:'pointer',fontSize:'12px'}}
                                    onClick={() => {
                                      if (confirm('✉️ Trimite mail acceptare comanda #' + order.id + '?\n\nVa trimite mailul cu AWB atasat catre client.')) {
                                        sendAcceptanceEmailFn(order.id);
                                      }
                                    }}
                                  >✉️ Mail AWB</button>
                                )}
                                <button 
                                  style={{
                                    padding: '4px 8px', 
                                    border: 'none', 
                                    borderRadius: '3px', 
                                    backgroundColor: '#fd7e14', 
                                    color: 'white', 
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => forwardOrderToSuppliers(order.id)}
                                >
                                  📤 Forward to Suppliers
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px', 
                                    border: 'none', 
                                    borderRadius: '3px', 
                                    backgroundColor: '#28a745', 
                                    color: 'white', 
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => {
                                    setStatusChangeOrderId(order.id);
                                    setStatusChangeValue(order.status);
                                  }}
                                >
                                  ✏️ Update
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredOrders.length > 50 && (
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #dee2e6', background: '#f8f9fa'}}>
                        <button
                          onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                          disabled={ordersPage === 1}
                          style={{padding: '6px 14px', border: '1px solid #ced4da', borderRadius: '4px', background: ordersPage === 1 ? '#e9ecef' : 'white', cursor: ordersPage === 1 ? 'default' : 'pointer', color: ordersPage === 1 ? '#aaa' : '#333'}}
                        >← Anterior</button>
                        <span style={{fontSize: '13px', color: '#555'}}>
                          Pagina <strong>{ordersPage}</strong> din <strong>{Math.ceil(filteredOrders.length / 50)}</strong> &nbsp;·&nbsp; {filteredOrders.length} comenzi total
                        </span>
                        <button
                          onClick={() => setOrdersPage(p => Math.min(Math.ceil(filteredOrders.length / 50), p + 1))}
                          disabled={ordersPage >= Math.ceil(filteredOrders.length / 50)}
                          style={{padding: '6px 14px', border: '1px solid #ced4da', borderRadius: '4px', background: ordersPage >= Math.ceil(filteredOrders.length / 50) ? '#e9ecef' : 'white', cursor: ordersPage >= Math.ceil(filteredOrders.length / 50) ? 'default' : 'pointer', color: ordersPage >= Math.ceil(filteredOrders.length / 50) ? '#aaa' : '#333'}}
                        >Următor →</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <p style={{color: '#666', fontSize: '18px', marginBottom: '15px'}}>No orders found</p>
                    <p style={{color: '#6c757d', marginBottom: '20px'}}>Orders will appear here once customers start purchasing your products.</p>
                    <button 
                      className="btn" 
                      style={{background: '#007bff', width: 'auto', padding: '12px 24px'}}
                      onClick={() => setActiveView('dashboard')}
                    >
                      📊 View Dashboard
                    </button>
                  </div>
                )}
              </div>
            );
          
          case 'users':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>👥 User Management</h3>
                  <button 
                    className="btn" 
                    style={{background: '#28a745', width: 'auto', padding: '8px 16px'}}
                    onClick={() => setShowAddUserModal(true)}
                  >
                    ➕ Add New User
                  </button>
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px'}}>
                  <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <h4 style={{marginBottom: '10px', color: '#495057'}}>Total Users</h4>
                    <p style={{fontSize: '24px', fontWeight: 'bold', color: '#007bff', margin: '0'}}>{stats?.totalUsers || '0'}</p>
                  </div>
                  <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <h4 style={{marginBottom: '10px', color: '#495057'}}>Regular Users</h4>
                    <p style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745', margin: '0'}}>{users.filter(u => !u.isAdmin).length}</p>
                  </div>
                  <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <h4 style={{marginBottom: '10px', color: '#495057'}}>Admin Users</h4>
                    <p style={{fontSize: '24px', fontWeight: 'bold', color: '#dc3545', margin: '0'}}>{users.filter(u => u.isAdmin).length}</p>
                  </div>
                </div>
                
                {users.length > 0 ? (
                  <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <thead>
                        <tr style={{backgroundColor: '#f5f5f5'}}>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>User ID</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Name</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Email</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Role</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user, index) => (
                          <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                            <td style={{padding: '12px'}}>#{user.id}</td>
                            <td style={{padding: '12px', fontWeight: '500'}}>{user.firstName} {user.lastName}</td>
                            <td style={{padding: '12px'}}>{user.email}</td>
                            <td style={{padding: '12px'}}>
                              <span style={{
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                backgroundColor: user.isAdmin ? '#f8d7da' : '#d4edda',
                                color: user.isAdmin ? '#721c24' : '#155724'
                              }}>
                                {user.isAdmin ? 'Admin' : 'User'}
                              </span>
                              {user.isAdmin && (user.adminMarkets || []).length === 0 && (
                                <span style={{marginLeft: '4px', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', background: '#f8d7da', color: '#721c24'}}>SUPER</span>
                              )}
                              {user.isAdmin && (user.adminMarkets || []).map(m => (
                                <span key={m} style={{marginLeft: '4px', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', background: m==='ro' ? '#fff3cd' : m==='fr' ? '#cfe2ff' : '#d1e7dd', color: '#333'}}>{m.toUpperCase()}</span>
                              ))}
                              {!user.isAdmin && (() => {
                                const userMarkets = [...new Set(orders.filter(o => o.userId === user.id).map(o => o.market || 'ro'))];
                                return userMarkets.map(m => (
                                  <span key={m} style={{marginLeft: '4px', padding: '2px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', background: m==='ro' ? '#fff3cd' : m==='fr' ? '#cfe2ff' : '#d1e7dd', color: '#333'}}>{m.toUpperCase()}</span>
                                ));
                              })()}
                            </td>
                            <td style={{padding: '12px'}}>
                              <div style={{display: 'flex', gap: '5px'}}>
                                <button 
                                  style={{
                                    padding: '4px 8px', 
                                    border: 'none', 
                                    borderRadius: '3px', 
                                    backgroundColor: '#007bff', 
                                    color: 'white', 
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => setEditingUser(user)}
                                >
                                  ✏️ Edit
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px', 
                                    border: 'none', 
                                    borderRadius: '3px', 
                                    backgroundColor: '#dc3545', 
                                    color: 'white', 
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={async () => {
                                    if (confirm(`Delete user "${user.firstName} ${user.lastName}"?\n\nThis action cannot be undone.`)) {
                                      const result = await deleteUser(user.id);
                                      if (result.success) {
                                        alert('User deleted successfully');
                                      } else {
                                        alert('Error: ' + result.message);
                                      }
                                    }
                                  }}
                                >
                                  🗑️ {t('common.delete')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <p style={{color: '#666', fontSize: '18px', marginBottom: '15px'}}>No users found</p>
                    <p style={{color: '#6c757d', marginBottom: '20px'}}>Create your first user to get started with user management.</p>
                    <button 
                      className="btn" 
                      style={{background: '#28a745', width: 'auto', padding: '12px 24px'}}
                      onClick={() => setShowAddUserModal(true)}
                    >
                      ➕ Add Your First User
                    </button>
                  </div>
                )}
              </div>
            );
          
          case 'products':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>📦 {t('products.title')}</h3>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button 
                      className="btn" 
                      style={{background: '#28a745', width: 'auto', padding: '8px 16px'}}
                      onClick={() => {
                        fetchCategories();
                        fetchSuppliers();
                        
                        // IMPORTANT: Set to null so the form knows this is a NEW product, not an edit
                        setEditingProduct(null);
                        
                        // Pre-generate a product code for the new product
                        const timestamp = Date.now().toString(36).toUpperCase();
                        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
                        const generatedCode = `PRD-${timestamp}${random}`;
                        
                        // Fetch company defaults and set initial data
                        fetchCompanyDefaults().then(defaults => {
                          console.log('Company defaults for new product:', defaults);
                          // Store initial data in ref (doesn't cause re-render)
                          initialProductDataRef.current = {
                            name: '',
                            description: '',
                            price: '',
                            compareAtPrice: '',
                            categoryId: '',
                            supplierId: '',
                            imageUrl: '',
                            stockQuantity: '',
                            featured: false,
                            vatValue: '',
                            vatPercentage: defaults.vatPercentage || (selectedMarketTab === 'fr' ? '20.00' : selectedMarketTab === 'ro' ? '19.00' : '0.00'),
                            currency: defaults.currency || 'RON',
                            productCode: generatedCode,
                            ean: '',
                            ncCode: '',
                            cpvCode: '',
                            status: 'active',
                            images: [],
                            weight: '',
                            length: '',
                            width: '',
                            height: '',
                            piecesPerPackage: '',
                            productQuantity: '',
                            specs: [],
                            volumeDiscounts: [],
                            priority: 0,
                            productType: 'standard',
                            isService: false,
                            isComposite: false
                          };
                          
                          // Trigger ModalsComponent to load the data
                          setProductLoadTrigger(prev => prev + 1);
                          
                          // Reset translations state for new product
                          setProductTranslations([]);
                          setShowTranslationsTab(false);
                          // newTranslation and editingTranslation are local to ModalsComponent, will reset automatically
                          
                          // Reset the last loaded product ID ref for new product
                          lastLoadedProductIdRef.current = null;
                          
                          // Open the modal after setting defaults
                          setShowAddProductModal(true);
                        });
                      }}
                    >
                      ➕ {t('products.addNew')}
                    </button>
                  </div>
                </div>
                
                <div style={{marginBottom: '20px'}}>
                  <h4 style={{color: '#333', marginBottom: '15px'}}>{t('products.actions')}</h4>
                   <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap'}}>
                     <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                    <div style={{position: 'relative'}}>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          background: showProductBulkActions ? '#0056b3' : '#007bff',
                          width: 'auto',
                          padding: '8px 16px',
                          boxShadow: showProductBulkActions ? '0 0 0 3px rgba(0, 123, 255, 0.2)' : 'none'
                        }}
                        onClick={() => {
                          setShowProductBulkActions(!showProductBulkActions);
                        }}
                        aria-haspopup="menu"
                        aria-expanded={showProductBulkActions}
                      >
                        🔄 {t('common.bulkOps')} {selectedProducts.length > 0 && `(${selectedProducts.length})`} ▾
                      </button>
                      {showProductBulkActions && (
                        <div
                          role="menu"
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 5px)',
                            left: 0,
                            zIndex: 20,
                            minWidth: '320px',
                            maxWidth: 'min(380px, calc(100vw - 32px))',
                            padding: '8px',
                            background: 'white',
                            border: '1px solid #dee2e6',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}
                        >
                          <ProductBulkOperationsComponent />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn"
                      aria-pressed={showProductAnalytics}
                      aria-label={`${t('common.analytics')} - ${showProductAnalytics ? t('common.active') : t('common.inactive')}`}
                      title={`${t('common.analytics')} - ${showProductAnalytics ? t('common.active') : t('common.inactive')}`}
                      style={{
                        background: showProductAnalytics ? '#198754' : '#6c757d',
                        border: showProductAnalytics ? '2px solid #146c43' : '2px solid #565e64',
                        boxShadow: showProductAnalytics ? '0 0 0 3px rgba(25, 135, 84, 0.2)' : 'none',
                        width: 'auto',
                        padding: '7px 16px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setShowProductAnalytics(!showProductAnalytics);
                        if (!showProductAnalytics) {
                          generateProductAnalytics();
                        }
                        console.log('Product analytics toggled:', !showProductAnalytics);
                      }}
                    >
                      {showProductAnalytics ? '✓' : '📊'} {t('common.analytics')} · {showProductAnalytics ? t('common.active') : t('common.inactive')}
                    </button>
                     </div>
                     <div style={{position: 'relative'}}>
                       <button
                         type="button"
                         className="btn"
                         style={{background: '#6f42c1', width: 'auto', padding: '8px 16px'}}
                         onClick={() => setShowExcelActions(!showExcelActions)}
                         aria-haspopup="menu"
                         aria-expanded={showExcelActions}
                       >
                         📊 Excel ▾
                       </button>
                       {showExcelActions && (
                         <div
                           role="menu"
                           style={{
                             position: 'absolute',
                             top: 'calc(100% + 5px)',
                             right: 0,
                             zIndex: 20,
                             minWidth: '220px',
                             padding: '6px',
                             background: 'white',
                             border: '1px solid #dee2e6',
                             borderRadius: '6px',
                             boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                           }}
                         >
                           <button
                             type="button"
                             role="menuitem"
                             onClick={() => {
                               setShowExcelActions(false);
                               setShowExcelImportModal(true);
                             }}
                             style={{
                               display: 'block',
                               width: '100%',
                               padding: '9px 10px',
                               border: 'none',
                               borderRadius: '4px',
                               background: 'transparent',
                               color: '#333',
                               textAlign: 'left',
                               cursor: 'pointer'
                             }}
                           >
                             📤 {t('products.importExcel')}
                           </button>
                           <button
                             type="button"
                             role="menuitem"
                             onClick={() => {
                               setShowExcelActions(false);
                               exportProductsToExcel();
                             }}
                             style={{
                               display: 'block',
                               width: '100%',
                               padding: '9px 10px',
                               border: 'none',
                               borderRadius: '4px',
                               background: 'transparent',
                               color: '#333',
                               textAlign: 'left',
                               cursor: 'pointer'
                             }}
                           >
                             📥 {t('products.exportExcel')}
                           </button>
                           <button
                             type="button"
                             role="menuitem"
                             onClick={() => {
                               setShowExcelActions(false);
                               downloadExcelTemplate();
                             }}
                             style={{
                               display: 'block',
                               width: '100%',
                               padding: '9px 10px',
                               border: 'none',
                               borderRadius: '4px',
                               background: 'transparent',
                               color: '#333',
                               textAlign: 'left',
                               cursor: 'pointer'
                             }}
                           >
                             📥 {t('products.downloadTemplate')}
                           </button>
                         </div>
                       )}
                     </div>
                  </div>
                </div>
                
                <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #dee2e6'}}>
                    <h4 style={{color: '#333', marginBottom: '15px'}}>🔍 {t('products.searchFilterTitle')}</h4>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px'}}>
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>{t('products.searchLabel')}:</label>
                        <div style={{position: 'relative'}}>
                          <input
                            type="text"
                            placeholder={t('products.searchPlaceholder')}
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            style={{width: '100%', padding: '8px 34px 8px 8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}}
                          />
                          {productSearchTerm && (
                            <button
                              type="button"
                              aria-label="Resetează căutarea"
                              onClick={() => setProductSearchTerm('')}
                              style={{
                                position: 'absolute',
                                top: '50%',
                                right: '8px',
                                transform: 'translateY(-50%)',
                                width: '22px',
                                height: '22px',
                                padding: 0,
                                border: 'none',
                                borderRadius: '50%',
                                background: '#e9ecef',
                                color: '#495057',
                                fontSize: '16px',
                                lineHeight: '20px',
                                cursor: 'pointer'
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>{t('common.category')}:</label>
                        <select 
                          value={productCategoryFilter}
                          onChange={(e) => setProductCategoryFilter(e.target.value)}
                          style={{width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px'}}
                        >
                          <option value="all">{t('products.allCategories')}</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{getCategoryName(cat)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>{t('common.status')}:</label>
                        <select 
                          value={productStatusFilter}
                          onChange={(e) => setProductStatusFilter(e.target.value)}
                          style={{width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px'}}
                        >
                          <option value="all">{t('common.allStatus')}</option>
                          <option value="active">{t('common.active')}</option>
                          <option value="inactive">{t('common.inactive')}</option>
                          <option value="draft">{t('common.draft')}</option>
                          <option value="discontinued">{t('common.discontinued')}</option>
                        </select>
                      </div>
                    </div>
                    <div style={{marginTop: '10px', fontSize: '14px', color: '#666'}}>
                      {t('products.showing', {count: filteredProducts.length, total: products.length})}
                    </div>
                </div>
                
                {showProductAnalytics && (
                  <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #dee2e6'}}>
                    <h4 style={{color: '#333', marginBottom: '20px'}}>📊 {t('products.analyticsDashboard')}</h4>
                    
                    {analyticsData && !analyticsData.error ? (
                      <div>
                        {/* Overview Stats */}
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px'}}>
                          <div style={{background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                            <h5 style={{color: '#007bff', fontSize: '28px', margin: '0 0 10px 0'}}>{analyticsData.totalProducts}</h5>
                            <p style={{color: '#666', margin: '0', fontSize: '14px'}}>{t('products.totalProducts')}</p>
                          </div>
                          <div style={{background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                            <h5 style={{color: '#28a745', fontSize: '28px', margin: '0 0 10px 0'}}>{analyticsData.stockAnalysis.inStock}</h5>
                            <p style={{color: '#666', margin: '0', fontSize: '14px'}}>{t('products.inStock')}</p>
                          </div>
                          <div style={{background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                            <h5 style={{color: '#ffc107', fontSize: '28px', margin: '0 0 10px 0'}}>{analyticsData.stockAnalysis.lowStock}</h5>
                            <p style={{color: '#666', margin: '0', fontSize: '14px'}}>{t('products.lowStock')}</p>
                          </div>
                          <div style={{background: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                            <h5 style={{color: '#dc3545', fontSize: '28px', margin: '0 0 10px 0'}}>{analyticsData.stockAnalysis.outOfStock}</h5>
                            <p style={{color: '#666', margin: '0', fontSize: '14px'}}>{t('products.outOfStock')}</p>
                          </div>
                        </div>

                        {/* Category Breakdown */}
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px'}}>
                          <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                            <h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>📂 {t('products.byCategory')}</h5>
                            {Object.entries(analyticsData.categoryBreakdown).map(([category, data]) => (
                              <div key={category} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '8px', background: '#f8f9fa', borderRadius: '4px'}}>
                                <span style={{fontSize: '14px', color: '#333'}}>{category}</span>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                  <span style={{fontSize: '14px', fontWeight: 'bold', color: '#007bff'}}>{data.count}</span>
                                  <span style={{fontSize: '12px', color: '#666', background: '#e9ecef', padding: '2px 8px', borderRadius: '12px'}}>{data.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                            <h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>📈 {t('products.statusDistribution')}</h5>
                            {Object.entries(analyticsData.statusBreakdown).map(([status, count]) => (
                              <div key={status} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '8px', background: '#f8f9fa', borderRadius: '4px'}}>
                                <span style={{fontSize: '14px', color: '#333', textTransform: 'capitalize'}}>{status}</span>
                                <span style={{fontSize: '14px', fontWeight: 'bold', color: status === 'active' ? '#28a745' : status === 'inactive' ? '#6c757d' : status === 'draft' ? '#ffc107' : '#dc3545'}}>{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Price Analysis */}
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px'}}>
                          <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                            <h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>💰 {t('products.priceAnalysis')}</h5>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                              <div style={{display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f8f9fa', borderRadius: '4px'}}>
                                <span style={{fontSize: '14px', color: '#333'}}>{t('products.avgPrice')}</span>
                                <span style={{fontSize: '14px', fontWeight: 'bold', color: '#007bff'}}>{analyticsData.priceAnalysis.avg} {analyticsData.currency}</span>
                              </div>
                              <div style={{display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f8f9fa', borderRadius: '4px'}}>
                                <span style={{fontSize: '14px', color: '#333'}}>{t('products.lowestPrice')}</span>
                                <span style={{fontSize: '14px', fontWeight: 'bold', color: '#28a745'}}>{analyticsData.priceAnalysis.min} {analyticsData.currency}</span>
                              </div>
                              <div style={{display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f8f9fa', borderRadius: '4px'}}>
                                <span style={{fontSize: '14px', color: '#333'}}>{t('products.highestPrice')}</span>
                                <span style={{fontSize: '14px', fontWeight: 'bold', color: '#dc3545'}}>{analyticsData.priceAnalysis.max} {analyticsData.currency}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div style={{background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
                            <h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>🏆 {t('products.topByPrice')}</h5>
                            {analyticsData.topPriceProducts.length > 0 ? (
                              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                {analyticsData.topPriceProducts.map((product, index) => (
                                  <div key={index} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: '#f8f9fa', borderRadius: '4px'}}>
                                    <div style={{display: 'flex', flexDirection: 'column'}}>
                                      <span style={{fontSize: '13px', fontWeight: '500', color: '#333'}}>{product.name}</span>
                                      <span style={{fontSize: '12px', color: '#666'}}>{product.category}</span>
                                    </div>
                                    <span style={{fontSize: '14px', fontWeight: 'bold', color: '#007bff'}}>{product.price} {analyticsData.currency}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{color: '#666', fontSize: '14px', textAlign: 'center', margin: '20px 0'}}>{t('products.noPricesFound')}</p>
                            )}
                          </div>
                        </div>

                        {/* Generated timestamp */}
                        <div style={{textAlign: 'center', marginTop: '20px', padding: '10px', background: '#e9ecef', borderRadius: '4px'}}>
                          <p style={{color: '#666', fontSize: '12px', margin: '0'}}>{t('products.analyticsGeneratedAt')}: {analyticsData.generatedAt}</p>
                        </div>
                      </div>
                    ) : analyticsData && analyticsData.error ? (
                      <div style={{textAlign: 'center', padding: '40px', color: '#dc3545'}}>
                        <h5>Error: {analyticsData.error}</h5>
                        <p>{t('products.analyticsError')}</p>
                      </div>
                    ) : (
                      <div style={{textAlign: 'center', padding: '40px'}}>
                        <div className="loading"></div>
                        <p style={{color: '#666', marginTop: '10px'}}>{t('products.generatingAnalytics')}</p>
                      </div>
                    )}
                    
                    <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                      <button 
                        className="btn" 
                        style={{background: '#28a745', width: 'auto', padding: '6px 12px', fontSize: '14px'}}
                        onClick={() => {
                          generateProductAnalytics();
                          console.log('Analytics refreshed');
                        }}
                      >
                        🔄 {t('products.refreshAnalytics')}
                      </button>
                      <button 
                        className="btn" 
                        style={{background: '#6c757d', width: 'auto', padding: '6px 12px', fontSize: '14px'}}
                        onClick={() => {
                          setShowProductAnalytics(false);
                          console.log('Analytics closed');
                        }}
                      >
                        ✖️ {t('common.close')}
                      </button>
                    </div>
                  </div>
                )}
                
                {filteredProducts.length > 0 ? (
                  <React.Fragment>
                  <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <thead>
                        <tr style={{backgroundColor: '#f5f5f5'}}>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '50px'}}>
                            <input 
                              type="checkbox" 
                              checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                              onChange={(e) => {
                                const currentProducts = filteredProducts;
                                if (e.target.checked) {
                                  setSelectedProducts(currentProducts.map(p => p.id));
                                } else {
                                  setSelectedProducts([]);
                                }
                              }}
                            />
                          </th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.image')}</th>
                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>{t('products.priority')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.productId')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.name')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.basePrice')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.category')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.stock')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.status')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>VAT %</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.currency')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.productCode')}</th>
                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>🇷🇴 .ro<br/><small style={{color:'#888',fontWeight:'normal'}}>RON (lei)</small></th>
                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>🇫🇷 .fr<br/><small style={{color:'#888',fontWeight:'normal'}}>EUR (€)</small></th>
                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>🌐 .com<br/><small style={{color:'#888',fontWeight:'normal'}}>EUR (€)</small></th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredProducts].sort((a, b) => {
                          // Sort by priority first (1=highest, 2, 3, etc. 0 or null = no priority, goes last)
                          const priorityA = a.priority && a.priority > 0 ? a.priority : 9999;
                          const priorityB = b.priority && b.priority > 0 ? b.priority : 9999;
                          if (priorityA !== priorityB) return priorityA - priorityB;
                          // Then by ID descending to show newest products first
                          return b.id - a.id;
                        }).slice((productPage - 1) * productsPerPage, productPage * productsPerPage).map((product, index) => (
                          <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                            <td style={{padding: '12px', textAlign: 'center'}}>
                              <input 
                                type="checkbox" 
                                checked={selectedProducts.includes(product.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProducts([...selectedProducts, product.id]);
                                  } else {
                                    setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                                  }
                                }}
                              />
                            </td>
                            <td style={{padding: '12px'}}>
                              <div style={{position: 'relative', display: 'inline-block'}}>
                                {product.images && product.images.length > 0 ? (
                                  <>
                                    <img 
                                      src={getImageUrlGlobal(product.images[0])} 
                                      alt={product.name}
                                      style={{
                                        width: '50px',
                                        height: '50px',
                                        objectFit: 'cover',
                                        borderRadius: '6px',
                                        border: '1px solid #ddd'
                                      }}
                                    />
                                    {product.images.length > 1 && (
                                      <span style={{
                                        position: 'absolute',
                                        top: '-5px',
                                        right: '-5px',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: '20px',
                                        height: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        border: '2px solid white'
                                      }}>
                                        {product.images.length}
                                      </span>
                                    )}
                                  </>
                                ) : product.imageUrl ? (
                                  <img 
                                    src={product.imageUrl} 
                                    alt={product.name}
                                    style={{
                                      width: '50px',
                                      height: '50px',
                                      objectFit: 'cover',
                                      borderRadius: '6px',
                                      border: '1px solid #ddd'
                                    }}
                                  />
                                ) : (
                                  <div style={{
                                    width: '50px',
                                    height: '50px',
                                    backgroundColor: '#f8f9fa',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#6c757d',
                                    fontSize: '12px'
                                  }}>
                                    📷
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{padding: '12px', textAlign: 'center'}}>
                              {product.priority && product.priority > 0 ? (
                                <span style={{
                                  backgroundColor: '#ffc107',
                                  color: '#000',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontWeight: 'bold',
                                  fontSize: '12px'
                                }}>
                                  {product.priority}
                                </span>
                              ) : (
                                <span style={{color: '#999', fontSize: '12px'}}>-</span>
                              )}
                            </td>
                            <td style={{padding: '12px'}}>#{product.id}</td>
                            <td style={{padding: '12px', fontWeight: '500'}}>{product.name}</td>
                            <td style={{padding: '12px', color: '#28a745', fontWeight: 'bold'}}>
                              {formatAdminPrice(product.price, getProductCurrency(product))}
                            </td>
                            <td style={{padding: '12px'}}>{getCategoryName(product.category)}</td>
                            <td style={{padding: '12px'}}>
                              <span style={{
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                backgroundColor: product.stockQuantity > 10 ? '#d4edda' : '#f8d7da',
                                color: product.stockQuantity > 10 ? '#155724' : '#721c24'
                              }}>
                                {product.stockQuantity ?? 0}
                              </span>
                            </td>
                            <td style={{padding: '12px'}}>
                              <span style={{
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                backgroundColor: product.status === 'active' ? '#d4edda' : product.status === 'inactive' ? '#f8d7da' : product.status === 'draft' ? '#fff3cd' : '#e2e3e5',
                                color: product.status === 'active' ? '#155724' : product.status === 'inactive' ? '#721c24' : product.status === 'draft' ? '#856404' : '#6c757d'
                              }}>
                                {product.status || 'active'}
                              </span>
                            </td>
                            <td style={{padding: '12px', color: '#6c757d', fontSize: '14px'}}>{product.vatPercentage || product.vatValue || 'N/A'}%</td>
                            <td style={{padding: '12px', color: '#007bff', fontSize: '14px', fontWeight: '500'}}>{getProductCurrency(product)}</td>
                            <td style={{padding: '12px', color: '#6c757d', fontSize: '14px', fontFamily: 'monospace'}}>{product.productCode || 'N/A'}</td>
                            {['ro', 'fr', 'com'].map(market => {
                              const pm = productMarketsMap[product.id]?.[market];
                              const isActive = pm ? pm.isActive : true;
                              const hasCustomPrice = pm && pm.price != null && pm.price !== '';
                              const effectivePrice = hasCustomPrice ? pm.price : product.price;
                              const currency = (pm?.currency || getMarketCurrency(market) || product.currency || '—').toString().toUpperCase();
                              return (
                                <td key={market} style={{padding: '8px', textAlign: 'center', minWidth: '80px'}}>
                                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
                                    <span
                                      title={hasCustomPrice ? `Preț custom pentru .${market}` : `Preț bază (fără override pe .${market})`}
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: hasCustomPrice ? '#007bff' : '#888',
                                        whiteSpace: 'nowrap',
                                        letterSpacing: '0.3px'
                                      }}
                                    >
                                      {formatAdminPrice(effectivePrice, currency)}
                                      {hasCustomPrice && <span style={{marginLeft: '2px', fontSize: '10px', color: '#fd7e14'}}>✎</span>}
                                    </span>
                                    <button
                                      title={isActive ? `Activ pe .${market} — click pentru dezactivare` : `Inactiv pe .${market} — click pentru activare`}
                                      onClick={() => toggleProductMarket(product.id, market, isActive)}
                                      style={{
                                        padding: '2px 8px',
                                        border: 'none',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        backgroundColor: isActive ? '#d4edda' : '#f8d7da',
                                        color: isActive ? '#155724' : '#721c24',
                                        minWidth: '40px'
                                      }}
                                    >
                                      {isActive ? '✓ ON' : '✗ OFF'}
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                            <td style={{padding: '12px'}}>
                              <div style={{display: 'flex', gap: '5px'}}>
                                <button 
                                  style={{
                                    padding: '4px 8px', 
                                    border: 'none', 
                                    borderRadius: '3px', 
                                    backgroundColor: '#007bff', 
                                    color: 'white', 
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => {
                                    fetchCategories();
                                    fetchSuppliers();
                                    setEditingProduct(product);
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px', 
                                    border: 'none', 
                                    borderRadius: '3px', 
                                    backgroundColor: '#dc3545', 
                                    color: 'white', 
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={async () => {
                                    const marketScoped = selectedMarketTab && selectedMarketTab !== 'all';
                                    const confirmation = marketScoped
                                      ? `Remove product "${product.name}" from the ${selectedMarketTab.toUpperCase()} marketplace?\n\nIt will remain available in other marketplaces and historical orders will be preserved.`
                                      : `Delete product "${product.name}" from all marketplaces?\n\nThis action cannot be undone.`;
                                    if (confirm(confirmation)) {
                                      const result = await deleteProduct(product.id, selectedMarketTab);
                                      if (result.success) {
                                        alert(result.message || 'Product removed successfully');
                                      } else {
                                        alert('Error: ' + result.message);
                                      }
                                    }
                                  }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {Math.ceil(filteredProducts.length / productsPerPage) > 1 && (
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderTop: '1px solid #eee', marginTop: '10px', flexWrap: 'wrap', gap: '10px'}}>
                      <span style={{color: '#666', fontSize: '14px'}}>
                        Showing {((productPage - 1) * productsPerPage) + 1}-{Math.min(productPage * productsPerPage, filteredProducts.length)} of {filteredProducts.length} products
                      </span>
                      <div style={{display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap'}}>
                        <button
                          onClick={() => setProductPage(1)}
                          disabled={productPage === 1}
                          style={{padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: productPage === 1 ? '#f5f5f5' : 'white', cursor: productPage === 1 ? 'not-allowed' : 'pointer', color: productPage === 1 ? '#ccc' : '#333'}}
                        >&laquo;</button>
                        <button
                          onClick={() => setProductPage(Math.max(1, productPage - 1))}
                          disabled={productPage === 1}
                          style={{padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: productPage === 1 ? '#f5f5f5' : 'white', cursor: productPage === 1 ? 'not-allowed' : 'pointer', color: productPage === 1 ? '#ccc' : '#333'}}
                        >&lsaquo; Prev</button>
                        {Array.from({length: Math.ceil(filteredProducts.length / productsPerPage)}, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setProductPage(p)}
                            style={{padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: p === productPage ? '#007bff' : 'white', color: p === productPage ? 'white' : '#333', cursor: 'pointer', fontWeight: p === productPage ? 'bold' : 'normal'}}
                          >{p}</button>
                        ))}
                        <button
                          onClick={() => setProductPage(Math.min(Math.ceil(filteredProducts.length / productsPerPage), productPage + 1))}
                          disabled={productPage === Math.ceil(filteredProducts.length / productsPerPage)}
                          style={{padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: productPage === Math.ceil(filteredProducts.length / productsPerPage) ? '#f5f5f5' : 'white', cursor: productPage === Math.ceil(filteredProducts.length / productsPerPage) ? 'not-allowed' : 'pointer', color: productPage === Math.ceil(filteredProducts.length / productsPerPage) ? '#ccc' : '#333'}}
                        >Next &rsaquo;</button>
                        <button
                          onClick={() => setProductPage(Math.ceil(filteredProducts.length / productsPerPage))}
                          disabled={productPage === Math.ceil(filteredProducts.length / productsPerPage)}
                          style={{padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: productPage === Math.ceil(filteredProducts.length / productsPerPage) ? '#f5f5f5' : 'white', cursor: productPage === Math.ceil(filteredProducts.length / productsPerPage) ? 'not-allowed' : 'pointer', color: productPage === Math.ceil(filteredProducts.length / productsPerPage) ? '#ccc' : '#333'}}
                        >&raquo;</button>
                      </div>
                    </div>
                  )}
                  </React.Fragment>
                ) : (
                  <div style={{padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <p style={{color: '#666', fontSize: '18px', marginBottom: '15px'}}>No products found</p>
                    <p style={{color: '#6c757d', marginBottom: '20px'}}>Start building your product catalog by adding your first product.</p>
                    <button 
                      className="btn" 
                      style={{background: '#28a745', width: 'auto', padding: '12px 24px'}}
                      onClick={() => alert('Add your first product:\n\n• Product name and description\n• High-quality images\n• Pricing information\n• Category assignment\n• Inventory management')}
                    >
                      ➕ Add Your First Product
                    </button>
                  </div>
                )}
              </div>
            );
          
          case 'categories':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>📁 {t('categories.title')}</h3>
                  <button 
                    className="btn" 
                    style={{background: '#28a745', width: 'auto', padding: '8px 16px'}}
                    onClick={() => setShowAddCategoryModal(true)}
                  >
                    ➕ {t('categories.addNew')}
                  </button>
                </div>
                
                <div style={{marginBottom: '20px'}}>
                  <h4 style={{color: '#333', marginBottom: '15px'}}>{t('categories.homepageSettings')}</h4>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px'}}>
                    <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#495057', marginBottom: '15px'}}>{t('categories.mainTopMax4')}</h5>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        {categories.filter(cat => cat.showOnMainTop).sort((a, b) => a.sortOrder - b.sortOrder).map(category => (
                          <div key={category.id} style={{
                            padding: '8px 12px',
                            background: '#007bff',
                            color: 'white',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span>{getCategoryName(category)}</span>
                            <span style={{fontSize: '12px', opacity: '0.8'}}>#{category.sortOrder}</span>
                          </div>
                        ))}
                        {categories.filter(cat => cat.showOnMainTop).length === 0 && (
                          <p style={{color: '#6c757d', fontStyle: 'italic'}}>{t('categories.noCatMainTop')}</p>
                        )}
                      </div>
                    </div>
                    
                    <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#495057', marginBottom: '15px'}}>{t('categories.shopCatMax3')}</h5>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        {categories.filter(cat => cat.showOnMainShop).sort((a, b) => a.sortOrder - b.sortOrder).map(category => (
                          <div key={category.id} style={{
                            padding: '8px 12px',
                            background: '#28a745',
                            color: 'white',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span>{getCategoryName(category)}</span>
                            <span style={{fontSize: '12px', opacity: '0.8'}}>#{category.sortOrder}</span>
                          </div>
                        ))}
                        {categories.filter(cat => cat.showOnMainShop).length === 0 && (
                          <p style={{color: '#6c757d', fontStyle: 'italic'}}>{t('categories.noCatShop')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    className="btn" 
                    style={{background: '#6c757d', width: 'auto', padding: '8px 16px'}}
                    onClick={() => {
                      const mainTopCategories = categories.filter(cat => cat.showOnMainTop).sort((a, b) => a.sortOrder - b.sortOrder);
                      const mainShopCategories = categories.filter(cat => cat.showOnMainShop).sort((a, b) => a.sortOrder - b.sortOrder);
                      
                      alert(`Homepage Category Configuration:\n\nMain Top (${mainTopCategories.length}/4): ${mainTopCategories.map(getCategoryName).join(', ') || 'None'}\n\nShop Section (${mainShopCategories.length}/3): ${mainShopCategories.map(getCategoryName).join(', ') || 'None'}\n\nTo modify these settings, use the "Configure Homepage" button below.`);
                    }}
                  >
                    📋 {t('categories.viewHomepageConfig')}
                  </button>
                </div>
                
                <div style={{marginBottom: '20px'}}>
                  <button 
                    className="btn" 
                    style={{background: '#007bff', width: 'auto', padding: '8px 16px'}}
                    onClick={() => {
                      // Initialize homepage config with current settings
                      console.log('All categories:', categories);
                      console.log('Categories with showOnMainTop:', categories.filter(cat => cat.showOnMainTop));
                      console.log('Categories with showOnMainShop:', categories.filter(cat => cat.showOnMainShop));
                      
                      const currentMainTop = categories.filter(cat => cat.showOnMainTop).sort((a, b) => a.sortOrder - b.sortOrder);
                      const currentMainShop = categories.filter(cat => cat.showOnMainShop).sort((a, b) => a.sortOrder - b.sortOrder);
                      
                      console.log('Current Main Top:', currentMainTop);
                      console.log('Current Main Shop:', currentMainShop);
                      
                      setHomepageConfig({
                        mainTop: currentMainTop.map(cat => cat.id),
                        mainShop: currentMainShop.map(cat => cat.id)
                      });
                      
                      setShowHomepageConfigModal(true);
                    }}
                  >
                    ⚙️ {t('categories.configureHomepage')}
                  </button>
                </div>
                
                {categories.length > 0 ? (
                  <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <thead>
                        <tr style={{backgroundColor: '#f5f5f5'}}>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>ID</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.image')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.name')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Slug</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.description')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('categories.homepage')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((category, index) => (
                          <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                            <td style={{padding: '12px'}}>#{category.id}</td>
                            <td style={{padding: '12px'}}>
                              {category.imageUrl ? (
                                <img 
                                  src={category.imageUrl} 
                                  alt={getCategoryName(category)}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd'
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  backgroundColor: '#f5f5f5',
                                  borderRadius: '4px',
                                  border: '1px solid #ddd',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#999'
                                }}>
                                  📷
                                </div>
                              )}
                            </td>
                            <td style={{padding: '12px', fontWeight: '500'}}>
                              {getCategoryName(category)}
                              <span style={{marginLeft: '6px', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', background: category.marketCode === 'fr' ? '#e8f4f8' : category.marketCode === 'com' ? '#e8f8e8' : '#f0e8f8', color: category.marketCode === 'fr' ? '#1a6080' : category.marketCode === 'com' ? '#1a6030' : '#6020a0'}}>
                                {(category.marketCode || 'ro').toUpperCase()}
                              </span>
                            </td>
                            <td style={{padding: '12px', fontFamily: 'monospace', fontSize: '14px', color: '#666'}}>{category.slug}</td>
                            <td style={{padding: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                              {category.description || t('common.noDescription')}
                            </td>
                            <td style={{padding: '12px'}}>
                              <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                {category.showOnMainTop && (
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    fontSize: '11px'
                                  }}>
                                    Main Top #{category.sortOrder}
                                  </span>
                                )}
                                {category.showOnMainShop && (
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    fontSize: '11px'
                                  }}>
                                    Shop #{category.sortOrder}
                                  </span>
                                )}
                                {!category.showOnMainTop && !category.showOnMainShop && (
                                  <span style={{color: '#6c757d', fontSize: '12px'}}>{t('categories.notFeatured')}</span>
                                )}
                              </div>
                            </td>
                            <td style={{padding: '12px'}}>
                              <div style={{display: 'flex', gap: '5px'}}>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '3px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => setEditingCategory(category)}
                                >
                                  ✏️ {t('common.edit')}
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '3px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={async () => {
                                    if (confirm(`Delete category "${getCategoryName(category)}"?\n\nThis action cannot be undone. Make sure no products are assigned to this category.`)) {
                                      const result = await deleteCategory(category.id);
                                      if (result.success) {
                                        alert('Category deleted successfully');
                                      } else {
                                        alert('Error: ' + result.message);
                                      }
                                    }
                                  }}
                                >
                                  🗑️ {t('common.delete')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <p style={{color: '#666', fontSize: '18px', marginBottom: '15px'}}>{t('categories.noneFound')}</p>
                     <p style={{color: '#6c757d', marginBottom: '20px'}}>
                       {selectedMarketTab && selectedMarketTab !== 'all'
                         ? `Nu există încă categorii pentru ${selectedMarketTab.toUpperCase()}. Creează o structură independentă pornind de la RO sau adaugă una nouă.`
                         : t('categories.createFirst')}
                     </p>
                     {selectedMarketTab && selectedMarketTab !== 'all' && (
                       <button
                         className="btn"
                         style={{background: '#6f42c1', width: 'auto', padding: '12px 24px', marginRight: '10px'}}
                         onClick={async () => {
                           const result = await initializeMarketCategories();
                           if (result.success) alert(`✅ ${result.message}`);
                           else if (result.message !== 'Acțiune anulată') alert('❌ ' + result.message);
                         }}
                       >
                         📋 Inițializează categoriile din RO
                       </button>
                     )}
                    <button 
                      className="btn" 
                      style={{background: '#28a745', width: 'auto', padding: '12px 24px'}}
                      onClick={() => setShowAddCategoryModal(true)}
                    >
                      ➕ {t('categories.addFirst')}
                    </button>
                  </div>
                )}
              </div>
            );
          
          case 'suppliers':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>🏢 {t('suppliers.title')}</h3>
                  <button 
                    className="btn" 
                    style={{background: '#28a745', width: 'auto', padding: '12px 20px'}}
                    onClick={() => {
                      setEditingSupplier(null);
                      supplierInitialDataRef.current = {
                        name: '',
                        email: '',
                        phone: '',
                        address: '',
                        city: '',
                        state: '',
                        zipCode: '',
                        country: '',
                        contactPerson: '',
                        apiEndpoint: '',
                        apiKey: '',
                        integrationType: 'email',
                        notes: '',
                        isActive: true,
                        marketCode: selectedMarketTab && selectedMarketTab !== 'all' ? selectedMarketTab : 'ro'
                      };
                      setSupplierLoadTrigger(prev => prev + 1);
                      setShowEditSupplierModal(true);
                    }}
                  >
                    ➕ {t('suppliers.addNew')}
                  </button>
                </div>
                
                <div style={{marginBottom: '20px'}}>
                  <h4 style={{color: '#333', marginBottom: '15px'}}>{t('suppliers.overview')}</h4>
                  <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                    <button 
                      className="btn" 
                      style={{background: '#007bff', width: 'auto', padding: '8px 16px'}}
                      onClick={() => alert('Supplier analytics:\n\n• Order volume by supplier\n• Performance metrics\n• Delivery times\n• Quality ratings\n• Cost analysis')}
                    >
                      📊 {t('common.analytics')}
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#17a2b8', width: 'auto', padding: '8px 16px'}}
                      onClick={() => {
                        if (selectedSuppliers.length === 0) {
                          alert('Please select suppliers first by checking the boxes in the table');
                        } else {
                          setSupplierBulkOperation('menu');
                          setShowSupplierBulkModal(true);
                        }
                      }}
                    >
                      🔄 {t('common.bulkOps')} {selectedSuppliers.length > 0 ? `(${selectedSuppliers.length})` : ''}
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#6c757d', width: 'auto', padding: '8px 16px'}}
                      onClick={() => alert('Export suppliers:\n\n• Contact directory\n• Performance reports\n• Contract details\n• Integration settings\n• Compliance documentation')}
                    >
                      📤 {t('common.export')}
                    </button>
                  </div>
                </div>
                
                {suppliers.length > 0 ? (
                  <div style={{marginTop: '20px', maxHeight: '500px', overflowY: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6'}}>
                      <thead>
                        <tr style={{backgroundColor: '#f8f9fa'}}>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333', width: '50px'}}>
                            <input 
                              type="checkbox" 
                              checked={selectedSuppliers.length === suppliers.length && suppliers.length > 0}
                              onChange={(e) => handleSelectAllSuppliers(e.target.checked)}
                              style={{cursor: 'pointer'}}
                            />
                          </th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('suppliers.supplierName')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('suppliers.contact')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('suppliers.location')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('suppliers.integration')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('common.status')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((supplier) => (
                          <tr key={supplier.id} style={{borderBottom: '1px solid #dee2e6'}}>
                            <td style={{padding: '12px', textAlign: 'center'}}>
                              <input 
                                type="checkbox" 
                                checked={selectedSuppliers.includes(supplier.id)}
                                onChange={(e) => handleSupplierSelection(supplier.id, e.target.checked)}
                                style={{cursor: 'pointer'}}
                              />
                            </td>
                            <td style={{padding: '12px', color: '#333'}}>
                              <div style={{fontWeight: 'bold'}}>
                                {supplier.name}
                                <span style={{marginLeft: '6px', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', background: supplier.marketCode === 'fr' ? '#e8f4f8' : supplier.marketCode === 'com' ? '#e8f8e8' : '#f0e8f8', color: supplier.marketCode === 'fr' ? '#1a6080' : supplier.marketCode === 'com' ? '#1a6030' : '#6020a0'}}>
                                  {(supplier.marketCode || 'ro').toUpperCase()}
                                </span>
                              </div>
                              <div style={{fontSize: '12px', color: '#666'}}>{supplier.contactPerson}</div>
                            </td>
                            <td style={{padding: '12px', color: '#333'}}>
                              <div style={{fontSize: '14px'}}>{supplier.email}</div>
                              <div style={{fontSize: '12px', color: '#666'}}>{supplier.phone}</div>
                            </td>
                            <td style={{padding: '12px', color: '#333'}}>
                              <div style={{fontSize: '14px'}}>{supplier.city}, {supplier.country}</div>
                              <div style={{fontSize: '12px', color: '#666'}}>{supplier.address}</div>
                            </td>
                            <td style={{padding: '12px', color: '#333'}}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                backgroundColor: supplier.integrationType === 'api' ? '#d4edda' : '#fff3cd',
                                color: supplier.integrationType === 'api' ? '#155724' : '#856404'
                              }}>
                                {supplier.integrationType === 'api' ? '🔗 API' : '📧 Email'}
                              </span>
                            </td>
                            <td style={{padding: '12px', color: '#333'}}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                backgroundColor: supplier.isActive ? '#d4edda' : '#f8d7da',
                                color: supplier.isActive ? '#155724' : '#721c24'
                              }}>
                                {supplier.isActive ? `✅ ${t('common.active')}` : `❌ ${t('common.inactive')}`}
                              </span>
                            </td>
                            <td style={{padding: '12px'}}>
                              <div style={{display: 'flex', gap: '8px'}}>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '3px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => syncSupplierPrices(supplier.id)}
                                >
                                  💰 {t('suppliers.syncPrices')}
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '3px',
                                    backgroundColor: '#ffc107',
                                    color: 'black',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => syncSupplierStock(supplier.id)}
                                >
                                  📦 Sync Stock
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '3px',
                                    backgroundColor: '#17a2b8',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => {
                                    setEditingSupplier(supplier);
                                    supplierInitialDataRef.current = {
                                      name: supplier.name || '',
                                      email: supplier.email || '',
                                      phone: supplier.phone || '',
                                      address: supplier.address || '',
                                      city: supplier.city || '',
                                      state: supplier.state || '',
                                      zipCode: supplier.zipCode || '',
                                      country: supplier.country || '',
                                      contactPerson: supplier.contactPerson || '',
                                      apiEndpoint: supplier.apiEndpoint || '',
                                      apiKey: supplier.apiKey || '',
                                      integrationType: supplier.integrationType || 'email',
                                      notes: supplier.notes || '',
                                      isActive: supplier.isActive !== undefined ? supplier.isActive : true,
                                      marketCode: supplier.marketCode || 'ro'
                                    };
                                    setSupplierLoadTrigger(prev => prev + 1);
                                    setShowEditSupplierModal(true);
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '3px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={async () => {
                                    setViewingSupplier(supplier);
                                    setShowViewSupplierModal(true);
                                    const details = await fetchSupplierDetails(supplier.id);
                                    setSupplierDetails(details);
                                  }}
                                >
                                  👁️ View
                                </button>
                                <button 
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '3px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => {
                                    if (confirm(`Delete supplier "${supplier.name}"?\n\nThis will remove the supplier and unassign all associated products.\n\nThis action cannot be undone.`)) {
                                      alert('Supplier deletion functionality:\n\n• Remove supplier record\n• Unassign products\n• Archive order history\n• Send notifications\n• Update system logs');
                                    }
                                  }}
                                >
                                  🗑️ {t('common.delete')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <p style={{color: '#666', fontSize: '18px', marginBottom: '15px'}}>No suppliers found</p>
                    <p style={{color: '#6c757d', marginBottom: '20px'}}>Start building your supplier network by adding your first supplier.</p>
                    <button 
                      className="btn" 
                      style={{background: '#28a745', width: 'auto', padding: '12px 24px'}}
                      onClick={() => {
                        setEditingSupplier(null);
                        supplierInitialDataRef.current = {
                          name: '',
                          email: '',
                          phone: '',
                          address: '',
                          city: '',
                          state: '',
                          zipCode: '',
                          country: '',
                          contactPerson: '',
                          apiEndpoint: '',
                          apiKey: '',
                          integrationType: 'email',
                          notes: '',
                          isActive: true
                        };
                        setSupplierLoadTrigger(prev => prev + 1);
                        setShowEditSupplierModal(true);
                      }}
                    >
                      ➕ Add Your First Supplier
                    </button>
                  </div>
                )}
              </div>
            );
          
          case 'google-feed': {
            const feedMarket = selectedMarketTab !== 'all' ? selectedMarketTab : 'ro';
            const feedConfig = googleFeedData?.feed;
            const selectedCategoryIds = feedConfig?.categoryIds || [];
            const selectedProductIds = feedConfig?.productIds || [];
            const normalizedFeedSearch = googleFeedProductSearch.trim().toLowerCase();
            const filteredFeedProducts = (googleFeedData?.products || []).filter(product =>
              !normalizedFeedSearch ||
              product.name.toLowerCase().includes(normalizedFeedSearch) ||
              String(product.id).includes(normalizedFeedSearch) ||
              String(product.productCode || '').toLowerCase().includes(normalizedFeedSearch) ||
              product.categoryName.toLowerCase().includes(normalizedFeedSearch)
            );
            const feedUrl = `https://xhaccp.${feedMarket === 'com' ? 'com' : feedMarket}/feeds/google-merchant/${feedMarket}.xml`;
            const toggleFeedSelection = (key, id, checked) => {
              setGoogleFeedData(current => {
                if (!current?.feed) return current;
                const values = new Set(current.feed[key] || []);
                if (checked) values.add(id);
                else values.delete(id);
                return { ...current, feed: { ...current.feed, [key]: [...values] } };
              });
            };

            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '22px', flexWrap: 'wrap'}}>
                  <div>
                    <h3 style={{color: '#333', margin: '0 0 8px'}}>🛍️ Google Merchant Center Feed</h3>
                    <p style={{color: '#6c757d', margin: 0, fontSize: '14px'}}>
                      Configurează produsele promovate pentru piața <strong>{feedMarket.toUpperCase()}</strong>. Categoriile și produsele se combină cu logică OR.
                    </p>
                  </div>
                  <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                    <button
                      onClick={() => fetchGoogleFeed(feedMarket)}
                      style={{background: 'white', border: '1px solid #adb5bd', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer'}}
                    >
                      🔄 Reîncarcă
                    </button>
                    <button
                      onClick={() => window.open(feedUrl, '_blank', 'noopener,noreferrer')}
                      style={{background: '#198754', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer'}}
                    >
                      🔗 Deschide feedul
                    </button>
                  </div>
                </div>

                {googleFeedLoading || !googleFeedData ? (
                  <div style={{padding: '40px', textAlign: 'center', color: '#6c757d'}}>
                    <div className="loading"></div>
                    <p>Se încarcă configurația feedului...</p>
                  </div>
                ) : (
                  <>
                    <div style={{background: '#eef7ff', border: '1px solid #b8d8f5', borderRadius: '8px', padding: '16px', marginBottom: '20px'}}>
                      <div style={{fontSize: '13px', color: '#155b8a', marginBottom: '8px', fontWeight: '600'}}>URL pentru Google Merchant Center</div>
                      <code style={{display: 'block', background: 'white', border: '1px solid #d7e8f5', borderRadius: '5px', padding: '10px', wordBreak: 'break-all', color: '#334e68'}}>{feedUrl}</code>
                      <div style={{fontSize: '12px', color: '#4f6b7a', marginTop: '8px'}}>
                        Feedul se regenerează automat la începutul fiecărei ore și se actualizează imediat după salvarea configurației.
                        {feedConfig?.lastGeneratedAt && ` Ultima generare: ${new Date(feedConfig.lastGeneratedAt).toLocaleString()}.`}
                      </div>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px', marginBottom: '22px'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', border: '1px solid #dee2e6', borderRadius: '8px', cursor: 'pointer'}}>
                        <input
                          type="checkbox"
                          checked={feedConfig?.enabled === true}
                          onChange={e => setGoogleFeedData(current => ({...current, feed: {...current.feed, enabled: e.target.checked}}))}
                          style={{width: '18px', height: '18px'}}
                        />
                        <span>
                          <strong>Feed activ</strong>
                          <small style={{display: 'block', color: '#6c757d', marginTop: '3px'}}>Permite accesul Google la XML.</small>
                        </span>
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', border: '1px solid #dee2e6', borderRadius: '8px', cursor: 'pointer'}}>
                        <input
                          type="checkbox"
                          checked={feedConfig?.includeOutOfStock !== false}
                          onChange={e => setGoogleFeedData(current => ({...current, feed: {...current.feed, includeOutOfStock: e.target.checked}}))}
                          style={{width: '18px', height: '18px'}}
                        />
                        <span>
                          <strong>Include și produsele fără stoc</strong>
                          <small style={{display: 'block', color: '#6c757d', marginTop: '3px'}}>Google primește disponibilitatea actuală.</small>
                        </span>
                      </label>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(360px, 1.2fr)', gap: '20px', alignItems: 'start'}}>
                      <section style={{border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden'}}>
                        <div style={{padding: '14px 16px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6'}}>
                          <h4 style={{margin: 0, color: '#495057'}}>📁 Categorii promovate</h4>
                          <p style={{fontSize: '12px', color: '#6c757d', margin: '5px 0 0'}}>Alege, de exemplu, categoria „Etichete”.</p>
                        </div>
                        <div style={{padding: '12px 16px', maxHeight: '360px', overflowY: 'auto'}}>
                          {(googleFeedData.categories || []).length === 0 ? (
                            <p style={{color: '#6c757d', fontSize: '13px'}}>Nu există categorii pentru această piață.</p>
                          ) : (
                            googleFeedData.categories.map(category => (
                              <label key={category.id} style={{display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 0', borderBottom: '1px solid #f1f3f5', cursor: 'pointer'}}>
                                <input
                                  type="checkbox"
                                  checked={selectedCategoryIds.includes(category.id)}
                                  onChange={e => toggleFeedSelection('categoryIds', category.id, e.target.checked)}
                                />
                        <span style={{flex: 1}}>{getCategoryName(category)}</span>
                                <code style={{fontSize: '11px', color: '#868e96'}}>{category.slug}</code>
                              </label>
                            ))
                          )}
                        </div>
                      </section>

                      <section style={{border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden'}}>
                        <div style={{padding: '14px 16px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center'}}>
                            <h4 style={{margin: 0, color: '#495057'}}>📦 Produse adăugate individual</h4>
                            <span style={{fontSize: '12px', color: '#6c757d'}}>{selectedProductIds.length} selectate</span>
                          </div>
                          <input
                            value={googleFeedProductSearch}
                            onChange={e => setGoogleFeedProductSearch(e.target.value)}
                            placeholder="Caută după nume, ID, cod sau categorie..."
                            style={{width: '100%', marginTop: '10px', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: '5px', boxSizing: 'border-box'}}
                          />
                        </div>
                        <div style={{padding: '12px 16px', maxHeight: '360px', overflowY: 'auto'}}>
                          {filteredFeedProducts.length === 0 ? (
                            <p style={{color: '#6c757d', fontSize: '13px'}}>Nu există produse care corespund căutării.</p>
                          ) : (
                            filteredFeedProducts.map(product => (
                              <label key={product.id} style={{display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '8px 0', borderBottom: '1px solid #f1f3f5', cursor: 'pointer'}}>
                                <input
                                  type="checkbox"
                                  checked={selectedProductIds.includes(product.id)}
                                  onChange={e => toggleFeedSelection('productIds', product.id, e.target.checked)}
                                />
                                <span style={{flex: 1, minWidth: 0}}>
                                  <span style={{display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{product.name}</span>
                        <small style={{color: '#868e96'}}>#{product.id} · {product.categoryName}{product.productCode ? ` · ${product.productCode}` : ''}</small>
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </section>
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #dee2e6', flexWrap: 'wrap'}}>
                      <div style={{fontSize: '13px', color: '#6c757d'}}>
                        Selecție curentă: <strong>{selectedCategoryIds.length}</strong> categorii + <strong>{selectedProductIds.length}</strong> produse.
                        {feedConfig?.lastItemCount != null && ` Ultimul XML a avut ${feedConfig.lastItemCount} produse.`}
                      </div>
                      <button
                        onClick={saveGoogleFeed}
                        disabled={googleFeedSaving}
                        style={{background: googleFeedSaving ? '#6c757d' : '#0d6efd', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: googleFeedSaving ? 'not-allowed' : 'pointer', fontWeight: '600'}}
                      >
                        {googleFeedSaving ? '⏳ Se salvează...' : '💾 Salvează configurația'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          }

          case 'homepage-hero':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', marginBottom: '22px', flexWrap: 'wrap'}}>
                  <div>
                    <h3 style={{color: '#333', margin: '0 0 6px'}}>🖼️ {t('homepageHero.title')}</h3>
                    <p style={{margin: 0, color: '#6c757d', fontSize: '13px'}}>{t('homepageHero.description')}</p>
                  </div>
                  <button onClick={fetchHeroSlides} disabled={heroLoading} style={{background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', padding: '9px 14px', cursor: 'pointer'}}>↻ {t('homepageHero.reload')}</button>
                </div>

                {selectedMarketTab === 'all' ? (
                  <div style={{padding: '18px', background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '6px'}}>
                    {t('homepageHero.selectMarket')}
                  </div>
                ) : (
                  <>
                    <section style={{background: '#f0f7ff', border: '1px solid #b8d7ff', borderRadius: '8px', padding: '18px', marginBottom: '24px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
                        <div>
                          <strong style={{color: '#145da0'}}>{t('homepageHero.displaySettings')} · .{selectedMarketTab}</strong>
                          <div style={{fontSize: '12px', color: '#6c757d', marginTop: '4px'}}>{t('homepageHero.autoplayHelp')}</div>
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.intervalSeconds')}</label>
                          <input type="number" min="3" max="30" value={heroSettings.autoplaySeconds} onChange={e => setHeroSettings({...heroSettings, autoplaySeconds: e.target.value})} style={{width: '72px', padding: '7px', border: '1px solid #ced4da', borderRadius: '4px'}} />
                          <button onClick={saveHeroSettings} style={{background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer'}}>💾 {t('common.save')}</button>
                        </div>
                      </div>
                    </section>

                    <section style={{border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px', marginBottom: '24px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                        <h4 style={{margin: 0, color: '#333'}}>{editingHeroSlide ? `✏️ ${t('homepageHero.editSlide')}` : `➕ ${t('homepageHero.addSlide')}`} <span style={{fontSize: '12px', color: '#6c757d', fontWeight: 'normal'}}>({heroSlides.length}/3)</span></h4>
                        {editingHeroSlide && <button onClick={() => { setEditingHeroSlide(null); setHeroForm(emptyHeroSlide()); }} style={{background: 'white', border: '1px solid #adb5bd', borderRadius: '4px', padding: '7px 12px', cursor: 'pointer'}}>{t('homepageHero.cancelEditing')}</button>}
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px'}}>
                        <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.slideType')}
                          <select value={heroForm.slideType} onChange={e => setHeroForm({...heroForm, slideType: e.target.value})} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px'}}>
                            <option value="text">{t('homepageHero.textSlide')}</option>
                            <option value="image">{t('homepageHero.imageSlide')}</option>
                          </select>
                        </label>
                        <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.titleLabel')}
                          <input value={heroForm.title} onChange={e => setHeroForm({...heroForm, title: e.target.value})} placeholder={t('homepageHero.titlePlaceholder')} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px', boxSizing: 'border-box'}} />
                        </label>
                        <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.subtitleLabel')}
                          <input value={heroForm.subtitle} onChange={e => setHeroForm({...heroForm, subtitle: e.target.value})} placeholder={t('homepageHero.subtitlePlaceholder')} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px 12px', border: '1px solid #ced4da', borderRadius: '4px', boxSizing: 'border-box'}} />
                        </label>
                        <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.ctaLabel')}
                          <input value={heroForm.ctaLabel} onChange={e => setHeroForm({...heroForm, ctaLabel: e.target.value})} placeholder={t('homepageHero.ctaPlaceholder')} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px', boxSizing: 'border-box'}} />
                        </label>
                        <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.ctaAction')}
                          <select value={heroForm.ctaType} onChange={e => setHeroForm({...heroForm, ctaType: e.target.value})} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px'}}>
                            <option value="link">{t('homepageHero.openLink')}</option>
                            <option value="quote">{t('homepageHero.requestQuote')}</option>
                          </select>
                        </label>
                        <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.ctaUrl')}
                          <input value={heroForm.ctaUrl} onChange={e => setHeroForm({...heroForm, ctaUrl: e.target.value})} disabled={heroForm.ctaType === 'quote'} placeholder={t('homepageHero.ctaUrlPlaceholder')} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px', boxSizing: 'border-box'}} />
                        </label>
                        <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.imageDestination')}
                          <select value={heroForm.destinationType} onChange={e => setHeroForm({...heroForm, destinationType: e.target.value, destinationId: '', destinationUrl: ''})} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px'}}>
                            <option value="none">{t('homepageHero.noDestination')}</option>
                            <option value="category">{t('common.category')}</option>
                            <option value="product">{t('homepageHero.product')}</option>
                            <option value="custom">{t('homepageHero.customUrl')}</option>
                          </select>
                        </label>
                        {heroForm.destinationType === 'category' && (
                          <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.promotedCategory')}
                            <select value={heroForm.destinationId} onChange={e => setHeroForm({...heroForm, destinationId: e.target.value})} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px'}}>
                              <option value="">{t('homepageHero.selectCategory')}</option>
                              {categories.map(category => <option key={category.id} value={category.id}>{getCategoryName(category)} ({category.slug})</option>)}
                            </select>
                          </label>
                        )}
                        {heroForm.destinationType === 'product' && (
                          <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.promotedProduct')}
                            <select value={heroForm.destinationId} onChange={e => setHeroForm({...heroForm, destinationId: e.target.value})} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px'}}>
                              <option value="">{t('homepageHero.selectProduct')}</option>
                              {products.filter(product => product.marketIsActive !== false).map(product => <option key={product.id} value={product.id}>{product.name} ({product.productCode || product.slug})</option>)}
                            </select>
                          </label>
                        )}
                        {heroForm.destinationType === 'custom' && (
                          <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.destinationUrl')}
                            <input value={heroForm.destinationUrl} onChange={e => setHeroForm({...heroForm, destinationUrl: e.target.value})} placeholder={t('homepageHero.destinationUrlPlaceholder')} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px', boxSizing: 'border-box'}} />
                          </label>
                        )}
                      </div>
                      <div style={{marginTop: '12px'}}>
                        <label style={{fontSize: '13px', color: '#495057'}}>{t('homepageHero.imageUrl')}
                          <input value={heroForm.imageUrl} onChange={e => setHeroForm({...heroForm, imageUrl: e.target.value})} placeholder={t('homepageHero.imageUrlPlaceholder')} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px', boxSizing: 'border-box'}} />
                        </label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap'}}>
                          <input type="file" accept="image/*" disabled={heroUploading} onChange={e => uploadHeroImage(e.target.files?.[0])} />
                          {heroUploading && <span style={{fontSize: '12px', color: '#6c757d'}}>{t('homepageHero.uploading')}</span>}
                        </div>
                        <label style={{display: 'block', marginTop: '10px', fontSize: '13px', color: '#495057'}}>{t('homepageHero.imageAlt')}
                          <input value={heroForm.imageAlt} onChange={e => setHeroForm({...heroForm, imageAlt: e.target.value})} placeholder={t('homepageHero.imageAltPlaceholder')} style={{display: 'block', width: '100%', marginTop: '5px', padding: '9px', border: '1px solid #ced4da', borderRadius: '4px', boxSizing: 'border-box'}} />
                        </label>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '15px', flexWrap: 'wrap'}}>
                        <label style={{fontSize: '13px', color: '#495057'}}><input type="checkbox" checked={heroForm.isActive} onChange={e => setHeroForm({...heroForm, isActive: e.target.checked})} /> {t('homepageHero.activeSlide')}</label>
                        <button onClick={saveHeroSlide} disabled={heroSaving || (!editingHeroSlide && heroSlides.length >= 3)} style={{background: heroSaving ? '#adb5bd' : '#198754', color: 'white', border: 'none', borderRadius: '4px', padding: '9px 16px', cursor: heroSaving ? 'not-allowed' : 'pointer'}}>
                          {heroSaving ? `⏳ ${t('homepageHero.saving')}` : editingHeroSlide ? `💾 ${t('homepageHero.saveChanges')}` : `➕ ${t('homepageHero.addSlide')}`}
                        </button>
                      </div>
                    </section>

                    {heroLoading ? <div style={{padding: '30px', textAlign: 'center', color: '#6c757d'}}>{t('homepageHero.loadingSlides')}</div> : (
                      <div style={{display: 'grid', gap: '12px'}}>
                        {heroSlides.length === 0 && <div style={{padding: '25px', textAlign: 'center', background: '#f8f9fa', borderRadius: '6px', color: '#6c757d'}}>{t('homepageHero.emptySlides')}</div>}
                        {heroSlides.map((slide, index) => (
                          <div key={slide.id} style={{display: 'flex', gap: '15px', alignItems: 'center', padding: '12px', border: '1px solid #dee2e6', borderRadius: '8px', opacity: slide.isActive ? 1 : 0.55, flexWrap: 'wrap'}}>
                            {slide.imageUrl ? <img src={slide.imageUrl} alt={slide.imageAlt || slide.title || t('homepageHero.previewAlt')} style={{width: '150px', height: '80px', objectFit: 'cover', borderRadius: '5px', background: '#e9ecef'}} /> : <div style={{width: '150px', height: '80px', borderRadius: '5px', background: 'linear-gradient(135deg,#102a43,#1f5f8b)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px', boxSizing: 'border-box', fontSize: '12px'}}>{slide.title || t('homepageHero.textSlide')}</div>}
                            <div style={{flex: 1, minWidth: '220px'}}>
                              <strong style={{color: '#333'}}>{index + 1}. {slide.title || t('homepageHero.imageSlide')}</strong>
                              <div style={{fontSize: '12px', color: '#6c757d', marginTop: '4px'}}>{slide.subtitle || t('common.noDescription')} · {slide.isActive ? t('common.active') : t('common.inactive')}</div>
                            </div>
                            <div style={{display: 'flex', gap: '5px', alignItems: 'center'}}>
                              <button disabled={index === 0} onClick={() => reorderHeroSlide(index, -1)} title={t('homepageHero.moveUp')} style={{padding: '6px 9px', border: '1px solid #ced4da', background: 'white', borderRadius: '4px', cursor: index === 0 ? 'not-allowed' : 'pointer'}}>↑</button>
                              <button disabled={index === heroSlides.length - 1} onClick={() => reorderHeroSlide(index, 1)} title={t('homepageHero.moveDown')} style={{padding: '6px 9px', border: '1px solid #ced4da', background: 'white', borderRadius: '4px', cursor: index === heroSlides.length - 1 ? 'not-allowed' : 'pointer'}}>↓</button>
                              <button onClick={() => editHeroSlide(slide)} style={{padding: '6px 10px', border: 'none', background: '#0d6efd', color: 'white', borderRadius: '4px', cursor: 'pointer'}}>{t('common.edit')}</button>
                              <button onClick={() => deleteHeroSlide(slide)} style={{padding: '6px 10px', border: 'none', background: '#dc3545', color: 'white', borderRadius: '4px', cursor: 'pointer'}}>{t('common.delete')}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );

          case 'marketing':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap'}}>
                  <div>
                    <h3 style={{color: '#333', margin: '0 0 6px'}}>📣 {t('marketing.title')}</h3>
                    <p style={{margin: 0, color: '#6c757d', fontSize: '13px'}}>{t('marketing.subtitle')}</p>
                  </div>
                  <button onClick={() => { fetchMarkets(); fetchMarketing(); }} style={{background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', padding: '9px 14px', cursor: 'pointer'}}>↻ {t('marketing.reload')}</button>
                </div>

                {(selectedMarketTab === 'fr' || selectedMarketTab === 'all') && (
                  <section style={{background: '#f4fbff', border: '1px solid #b9e6f5', borderRadius: '8px', padding: '20px', marginBottom: '24px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '6px'}}>
                      <div>
                        <h4 style={{margin: 0, color: '#075985'}}>🎫 {t('marketing.eventContactsTitle')}</h4>
                        <p style={{fontSize: '13px', color: '#475569', margin: '6px 0 0'}}>{t('marketing.eventContactsDescription')}</p>
                      </div>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                        <span style={{background: '#dff6ff', color: '#075985', borderRadius: '14px', padding: '5px 10px', fontSize: '12px', fontWeight: '600'}}>
                          {eventVoucherContacts.length} {t('marketing.eventContactsCount')}
                        </span>
                        <button
                          type="button"
                          onClick={downloadEventVoucherContactsCsv}
                          disabled={filteredEventVoucherContacts.length === 0}
                          style={{background: filteredEventVoucherContacts.length === 0 ? '#94a3b8' : '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 11px', cursor: filteredEventVoucherContacts.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px'}}
                        >
                          📥 {t('marketing.eventContactsExport')}
                        </button>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '8px', margin: '14px 0 12px', flexWrap: 'wrap'}}>
                      <input
                        value={eventVoucherContactSearch}
                        onChange={e => setEventVoucherContactSearch(e.target.value)}
                        placeholder={t('marketing.eventContactsSearch')}
                        style={{flex: '1 1 260px', padding: '8px 10px', border: '1px solid #bae6fd', borderRadius: '4px', minWidth: '220px'}}
                      />
                      <span style={{fontSize: '12px', color: '#64748b', alignSelf: 'center'}}>
                        {eventVoucherContactsLoading ? t('marketing.loading') : `${filteredEventVoucherContacts.length} ${t('marketing.eventContactsVisible')}`}
                      </span>
                    </div>
                    <div style={{overflowX: 'auto', maxHeight: '360px', overflowY: 'auto'}}>
                      <table style={{width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '12px'}}>
                        <thead style={{position: 'sticky', top: 0, background: '#e0f2fe', zIndex: 1}}>
                          <tr>
                            <th style={{padding: '8px', textAlign: 'left'}}>Contact</th>
                            <th style={{padding: '8px', textAlign: 'left'}}>Restaurant</th>
                            <th style={{padding: '8px', textAlign: 'left'}}>Email</th>
                            <th style={{padding: '8px', textAlign: 'left'}}>Telefon</th>
                            <th style={{padding: '8px', textAlign: 'left'}}>Voucher</th>
                            <th style={{padding: '8px', textAlign: 'left'}}>Activare</th>
                            <th style={{padding: '8px', textAlign: 'left'}}>Înscris la</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEventVoucherContacts.map(contact => (
                            <tr key={contact.id} style={{borderTop: '1px solid #e0f2fe'}}>
                              <td style={{padding: '8px', whiteSpace: 'nowrap'}}>{contact.firstName} {contact.lastName}</td>
                              <td style={{padding: '8px'}}>{contact.restaurant}</td>
                              <td style={{padding: '8px'}}>{contact.email}</td>
                              <td style={{padding: '8px', whiteSpace: 'nowrap'}}>{contact.phone}</td>
                              <td style={{padding: '8px'}}><code>{contact.voucherCode || '—'}</code></td>
                              <td style={{padding: '8px', whiteSpace: 'nowrap'}}>
                                <span style={{color: contact.activatedAt ? '#15803d' : '#b45309', fontWeight: '600'}}>
                                  {contact.activatedAt ? t('marketing.eventContactsActivated') : t('marketing.eventContactsPending')}
                                </span>
                              </td>
                              <td style={{padding: '8px', whiteSpace: 'nowrap'}}>{contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                          {!eventVoucherContactsLoading && filteredEventVoucherContacts.length === 0 && (
                            <tr><td colSpan="7" style={{padding: '16px', textAlign: 'center', color: '#64748b'}}>{t('marketing.eventContactsEmpty')}</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <section style={{background: '#f0f7ff', border: '1px solid #b8d7ff', borderRadius: '8px', padding: '20px', marginBottom: '24px'}}>
                  <h4 style={{margin: '0 0 6px', color: '#145da0'}}>⏱️ {t('marketing.thresholdsTitle')}</h4>
                  <p style={{fontSize: '13px', color: '#495057', margin: '0 0 16px'}}>
                    {t('marketing.thresholdsDescription')}
                  </p>
                  {['ro', 'fr', 'com'].filter(m => selectedMarketTab === 'all' || selectedMarketTab === m).map(market => (
                    <div key={market} style={{background: 'white', border: '1px solid #dee2e6', borderRadius: '6px', padding: '14px', marginBottom: '12px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <strong style={{color: '#333'}}>.{market}</strong>
                        <button
                          onClick={() => saveReminderThresholds(market)}
                          disabled={marketingSaving}
                          style={{background: marketingSaving ? '#adb5bd' : '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', padding: '7px 12px', cursor: marketingSaving ? 'not-allowed' : 'pointer', fontSize: '12px'}}
                        >💾 {t('marketing.saveThresholds')}</button>
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, minmax(90px, 1fr))', gap: '8px'}}>
                        {(reminderThresholds[market] || [null, null, null, null, null]).map((value, index) => (
                          <label key={index} style={{fontSize: '11px', color: '#6c757d'}}>
                            {t('marketing.reminder', { number: index + 1 })}
                            <input
                              type="number"
                              min="1"
                              max="8760"
                              value={value ?? ''}
                              placeholder={t('marketing.disabled')}
                              onChange={e => {
                                const next = e.target.value === '' ? null : Number(e.target.value);
                                setReminderThresholds(prev => ({...prev, [market]: prev[market].map((item, i) => i === index ? next : item)}));
                              }}
                              style={{display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '7px', border: '1px solid #ced4da', borderRadius: '4px'}}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>

                <section style={{background: '#fffaf0', border: '1px solid #ffe0a3', borderRadius: '8px', padding: '20px', marginBottom: '24px'}}>
                  <h4 style={{margin: '0 0 6px', color: '#856404'}}>👥 {t('marketing.segmentsTitle')}</h4>
                  <p style={{fontSize: '13px', color: '#6c757d', margin: '0 0 16px'}}>{t('marketing.segmentsDescription')}</p>
                  <div style={{display: 'grid', gridTemplateColumns: 'minmax(180px, 1.3fr) repeat(3, minmax(130px, 1fr)) auto', gap: '8px', alignItems: 'end', marginBottom: '16px'}}>
                    <label style={{fontSize: '12px', color: '#495057'}}>{t('marketing.segmentName')}<input value={marketingSegmentForm.name} onChange={e => setMarketingSegmentForm({...marketingSegmentForm, name: e.target.value})} placeholder={t('marketing.segmentNamePlaceholder')} style={{display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px'}} /></label>
                    <label style={{fontSize: '12px', color: '#495057'}}>{t('marketing.audienceSource')}<select value={marketingSegmentForm.eventVoucherCampaign} onChange={e => setMarketingSegmentForm({...marketingSegmentForm, eventVoucherCampaign: e.target.value})} style={{display: 'block', width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px'}}><option value="any">{t('marketing.allContacts')}</option>{(selectedMarketTab === 'fr' || selectedMarketTab === 'all') && <option value="chef-event-fr">{t('marketing.chefEventContacts')}</option>}</select></label>
                    <label style={{fontSize: '12px', color: '#495057'}}>{t('marketing.orders')}<select value={marketingSegmentForm.hasOrders} onChange={e => setMarketingSegmentForm({...marketingSegmentForm, hasOrders: e.target.value})} style={{display: 'block', width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px'}}><option value="any">{t('marketing.any')}</option><option value="yes">{t('marketing.withOrders')}</option><option value="no">{t('marketing.withoutOrders')}</option></select></label>
                    <label style={{fontSize: '12px', color: '#495057'}}>{t('marketing.abandonedCart')}<select value={marketingSegmentForm.hasAbandonedCart} onChange={e => setMarketingSegmentForm({...marketingSegmentForm, hasAbandonedCart: e.target.value})} style={{display: 'block', width: '100%', marginTop: '4px', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px'}}><option value="any">{t('marketing.any')}</option><option value="yes">{t('marketing.withCart')}</option><option value="no">{t('marketing.withoutCart')}</option></select></label>
                    <button onClick={createMarketingSegment} style={{background: '#198754', color: 'white', border: 'none', borderRadius: '4px', padding: '9px 12px', cursor: 'pointer'}}>+ {t('marketing.create')}</button>
                  </div>
                  {marketingLoading ? <p style={{color: '#6c757d'}}>{t('marketing.loading')}</p> : marketingSegments.length === 0 ? <p style={{color: '#6c757d', fontSize: '13px'}}>{t('marketing.noSegments')}</p> : (
                    <div style={{display: 'grid', gap: '8px'}}>
                      {marketingSegments.map(segment => (
                        <div key={segment.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', border: '1px solid #dee2e6', borderRadius: '5px', padding: '10px 12px', flexWrap: 'wrap'}}>
                           <div><strong>{segment.name}</strong><span style={{marginLeft: '8px', fontSize: '11px', color: '#6c757d'}}>.{segment.market} · {segment.criteria?.eventVoucherCampaign === 'chef-event-fr' ? t('marketing.chefEventContacts') : `${segment.criteria?.hasOrders || t('marketing.any')} ${t('marketing.orders').toLowerCase()} · ${segment.criteria?.hasAbandonedCart || t('marketing.any')} ${t('marketing.abandonedCart').toLowerCase()}`}</span></div>
                          <div style={{display: 'flex', gap: '6px'}}>
                            <button onClick={() => previewMarketingSegment(segment)} style={{background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 9px', cursor: 'pointer', fontSize: '12px'}}>{t('marketing.previewRecipients')}</button>
                            <button onClick={async () => { if (!window.confirm(t('marketing.deleteConfirm'))) return; await fetch(`/admin/api/marketing/segments/${segment.id}`, {method: 'DELETE', headers: {'Authorization': `Bearer ${token}`}}); fetchMarketing(); }} style={{background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 9px', cursor: 'pointer', fontSize: '12px'}}>{t('marketing.delete')}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {marketingPreview && (
                    <div style={{marginTop: '14px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '5px', padding: '12px', fontSize: '13px'}}>
                      <strong>{t('marketing.eligibleRecipients', { name: marketingPreview.segment.name, count: marketingPreview.count })}</strong>
                      <div style={{marginTop: '6px', color: '#495057', maxHeight: '80px', overflow: 'auto'}}>{marketingPreview.recipients?.slice(0, 20).map(user => user.email).join(', ') || t('marketing.noRecipients')}</div>
                    </div>
                  )}
                </section>

                <section style={{background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '8px', padding: '20px'}}>
                  <h4 style={{margin: '0 0 6px', color: '#333'}}>✉️ {t('marketing.campaignsTitle')}</h4>
                  <p style={{fontSize: '13px', color: '#6c757d', margin: '0 0 16px'}}>{t('marketing.campaignsDescription')}</p>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: '8px', marginBottom: '8px'}}>
                    <input value={marketingCampaignForm.name} onChange={e => setMarketingCampaignForm({...marketingCampaignForm, name: e.target.value})} placeholder={t('marketing.campaignNamePlaceholder')} style={{padding: '8px', border: '1px solid #ced4da', borderRadius: '4px'}} />
                    <select value={marketingCampaignForm.market} onChange={e => setMarketingCampaignForm({...marketingCampaignForm, market: e.target.value, segmentId: ''})} style={{padding: '8px', border: '1px solid #ced4da', borderRadius: '4px'}}>{['ro', 'fr', 'com'].filter(m => selectedMarketTab === 'all' || selectedMarketTab === m).map(m => <option key={m} value={m}>{t('marketing.marketplace', { market: m })}</option>)}</select>
                    <select value={marketingCampaignForm.segmentId} onChange={e => setMarketingCampaignForm({...marketingCampaignForm, segmentId: e.target.value})} style={{padding: '8px', border: '1px solid #ced4da', borderRadius: '4px'}}><option value="">{t('marketing.chooseSegment')}</option>{marketingSegments.filter(s => s.market === 'all' || s.market === marketingCampaignForm.market).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    <input value={marketingCampaignForm.subject} onChange={e => setMarketingCampaignForm({...marketingCampaignForm, subject: e.target.value})} placeholder={t('marketing.subjectPlaceholder')} style={{padding: '8px', border: '1px solid #ced4da', borderRadius: '4px'}} />
                  </div>
                  <textarea value={marketingCampaignForm.htmlContent} onChange={e => setMarketingCampaignForm({...marketingCampaignForm, htmlContent: e.target.value})} placeholder={t('marketing.htmlPlaceholder')} rows="5" style={{width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontFamily: 'monospace', marginBottom: '8px'}} />
                  <textarea value={marketingCampaignForm.textContent} onChange={e => setMarketingCampaignForm({...marketingCampaignForm, textContent: e.target.value})} placeholder={t('marketing.textPlaceholder')} rows="3" style={{width: '100%', boxSizing: 'border-box', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', marginBottom: '8px'}} />
                  <button onClick={createMarketingCampaign} style={{background: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', padding: '9px 14px', cursor: 'pointer'}}>{t('marketing.saveDraft')}</button>
                  <div style={{marginTop: '18px', display: 'grid', gap: '8px'}}>
                    {marketingCampaigns.map(campaign => (
                      <div key={campaign.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #dee2e6', background: 'white', borderRadius: '5px', padding: '10px 12px', gap: '12px', flexWrap: 'wrap'}}>
                        <div><strong>{campaign.name}</strong><div style={{fontSize: '12px', color: '#6c757d'}}>.{campaign.market} · {campaign.subject} · {campaign.status === 'draft' ? t('marketing.statusDraft') : campaign.status === 'sending' ? t('marketing.statusSending') : campaign.status === 'sent' ? t('marketing.statusSent') : campaign.status === 'failed' ? t('marketing.statusFailed') : campaign.status} · {campaign.sentCount || 0}/{campaign.recipientCount || 0}</div></div>
                        {campaign.status !== 'sent' && campaign.status !== 'sending' && <button onClick={() => sendMarketingCampaign(campaign)} style={{background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '7px 10px', cursor: 'pointer'}}>{t('marketing.sendCampaign')}</button>}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            );

          case 'company-settings':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>🏢 {t('companySettings.title')}</h3>
                  <button 
                    className="btn" 
                    style={{background: '#007bff', width: 'auto', padding: '8px 16px'}}
                    onClick={() => setShowCompanySettingsModal(true)}
                  >
                    ✏️ {t('companySettings.editInfo')}
                  </button>
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
                  {/* Basic Information */}
                  <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #007bff', paddingBottom: '5px'}}>{t('companySettings.basicInfo')}</h4>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.companyName')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.name || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('common.email')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.email || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('common.phone')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.phone || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.website')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.website || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.logisticsEmail')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.logisticsEmail || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>IBAN:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d', fontFamily: 'monospace'}}>{companySettings.iban || t('common.notSet')}</p>
                    </div>
                  </div>
                  
                  {/* Address Information */}
                  <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #28a745', paddingBottom: '5px'}}>{t('companySettings.address')}</h4>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.streetAddress')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.address || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.city')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.city || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.stateProvince')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.state || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.zipCode')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.zipCode || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.country')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.country || t('common.notSet')}</p>
                    </div>
                  </div>
                  
                  {/* Legal & Business Information */}
                  <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #ffc107', paddingBottom: '5px'}}>{t('companySettings.legalBusiness')}</h4>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.contactPerson')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.contactPerson || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.vatNumber')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.vatNumber || t('common.notSet')}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.registrationNumber')}:</strong>
                      <p style={{margin: '5px 0', color: '#6c757d'}}>{companySettings.registrationNumber || t('common.notSet')}</p>
                    </div>
                  </div>
                  
                  {/* Default Product Settings */}
                  <div style={{background: '#f0f8ff', padding: '20px', borderRadius: '6px', border: '1px solid #007bff'}}>
                    <h4 style={{color: '#007bff', marginBottom: '15px', borderBottom: '2px solid #007bff', paddingBottom: '5px'}}>💰 {t('companySettings.defaultProductSettings')}</h4>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.defaultCurrency')}:</strong>
                      <p style={{margin: '5px 0', color: '#007bff', fontWeight: '500'}}>{companySettings.defaultCurrency || 'EUR'}</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.defaultVatPct')}:</strong>
                      <p style={{margin: '5px 0', color: '#007bff', fontWeight: '500'}}>{companySettings.defaultVatPercentage || '21.00'}%</p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.reverseChargeVat')}:</strong>
                      <p style={{margin: '5px 0', color: '#007bff', fontWeight: '500'}}>{companySettings.reverseChargeVat || '0.00'}%</p>
                    </div>
                    <p style={{fontSize: '12px', color: '#666', marginTop: '10px', fontStyle: 'italic'}}>
                      {t('companySettings.usedAsDefaults')}
                    </p>
                  </div>
                  
                  {/* Shipping Settings Display */}
                  <div style={{background: '#e3f2fd', padding: '20px', borderRadius: '6px', border: '1px solid #bbdefb'}}>
                    <h4 style={{color: '#1976d2', marginBottom: '15px', borderBottom: '2px solid #2196f3', paddingBottom: '5px'}}>🚚 {t('companySettings.shippingSettings')}</h4>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.freeShippingThreshold')}:</strong>
                      <p style={{margin: '5px 0', color: '#1976d2', fontWeight: '500'}}>
                        {companySettings.freeShippingThreshold || '500.00'} {companySettings.defaultCurrency || 'EUR'}
                      </p>
                    </div>
                    <div style={{marginBottom: '10px'}}>
                      <strong style={{color: '#495057'}}>{t('companySettings.standardShippingCost')}:</strong>
                      <p style={{margin: '5px 0', color: '#1976d2', fontWeight: '500'}}>
                        {companySettings.standardShippingCost || '25.00'} {companySettings.defaultCurrency || 'EUR'}
                      </p>
                    </div>
                    <p style={{fontSize: '12px', color: '#666', marginTop: '10px', fontStyle: 'italic'}}>
                      Orders over {companySettings.freeShippingThreshold || '500.00'} {companySettings.defaultCurrency || 'EUR'} qualify for free shipping
                    </p>
                  </div>
                  
                  {/* Company Description */}
                  <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                    <h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #dc3545', paddingBottom: '5px'}}>{t('companySettings.description')}</h4>
                    <p style={{margin: '0', color: '#6c757d', lineHeight: '1.6'}}>
                      {companySettings.description || t('companySettings.noDescription')}
                    </p>
                  </div>
                  
                  {/* Invoice Numbering Settings */}
                  <div style={{background: '#fff8e1', padding: '20px', borderRadius: '6px', border: '1px solid #ffc107', gridColumn: 'span 2'}}>
                    <h4 style={{color: '#856404', marginBottom: '15px', borderBottom: '2px solid #ffc107', paddingBottom: '5px'}}>🧾 {t('invoiceSettings.title')}</h4>
                    <div style={{display: 'grid', gridTemplateColumns: selectedMarketTab === 'all' ? 'repeat(3, 1fr)' : '1fr', gap: '16px'}}>
                      {/* .ro: Smartbill managed — read-only counter display */}
                      {(selectedMarketTab === 'all' || selectedMarketTab === 'ro') && (() => {
                        const roCounter = invoiceCounters.find(c => c.market === 'ro') || {};
                        return (
                          <div style={{background: 'white', border: '1px solid #0d6efd30', borderRadius: '6px', padding: '14px'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px'}}>
                              <span style={{background: '#0d6efd', color: 'white', borderRadius: '4px', padding: '1px 7px', fontSize: '11px', fontWeight: '600'}}>RO</span>
                              <span style={{fontSize: '12px', color: '#6c757d'}}>Smartbill API</span>
                            </div>
                            <div style={{fontSize: '12px', color: '#495057', marginBottom: '6px'}}>
                              {t('invoices.counterSeries')}: <strong>{roCounter.series || 'KTO'}</strong>
                              &nbsp;|&nbsp; {t('invoices.counterCurrent')}: <strong>{roCounter.currentNumber ?? '—'}</strong>
                            </div>
                            <div style={{fontSize: '11px', color: '#6c757d', background: '#f8f9fa', padding: '6px 8px', borderRadius: '4px'}}>
                              🔗 {t('invoiceSettings.ro')}
                            </div>
                          </div>
                        );
                      })()}

                      {/* .fr and .com: Local PDF — editable series + format */}
                      {[
                        { market: 'fr', label: t('invoiceSettings.fr'), badge: '#198754', desc: 'PDF local + Chorus Pro (stub)' },
                        { market: 'com', label: t('invoiceSettings.com'), badge: '#6c757d', desc: 'PDF local + ext. API (stub)' }
                      ].filter(({market: mkt}) => selectedMarketTab === 'all' || selectedMarketTab === mkt)
                      .map(({market: mkt, label, badge, desc}) => {
                        const counter = invoiceCounters.find(c => c.market === mkt) || {};
                        return (
                          <div key={mkt} style={{background: 'white', border: `1px solid ${badge}30`, borderRadius: '6px', padding: '14px'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px'}}>
                              <span style={{background: badge, color: 'white', borderRadius: '4px', padding: '1px 7px', fontSize: '11px', fontWeight: '600'}}>{mkt.toUpperCase()}</span>
                              <span style={{fontSize: '12px', color: '#6c757d'}}>{desc}</span>
                            </div>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                              <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <label style={{fontSize: '11px', color: '#6c757d', minWidth: '50px'}}>{t('invoices.counterSeries')}:</label>
                                <input
                                  type="text"
                                  id={`inv-series-cs-${mkt}`}
                                  defaultValue={counter.series || (mkt === 'fr' ? 'FACT' : 'INV')}
                                  placeholder={mkt === 'fr' ? 'FACT' : 'INV'}
                                  style={{flex: 1, padding: '3px 6px', border: '1px solid #ced4da', borderRadius: '3px', fontSize: '12px'}}
                                />
                              </div>
                              <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <label style={{fontSize: '11px', color: '#6c757d', minWidth: '50px'}}>Format:</label>
                                <input
                                  type="text"
                                  id={`inv-fmt-cs-${mkt}`}
                                  defaultValue={'YYYY-NNNNNN'}
                                  placeholder="{SERIES}-{YEAR}-{NNNNNN}"
                                  style={{flex: 1, padding: '3px 6px', border: '1px solid #ced4da', borderRadius: '3px', fontSize: '12px'}}
                                />
                              </div>
                              <div style={{fontSize: '11px', color: '#6c757d', marginTop: '2px'}}>
                                {t('invoices.counterCurrent')}: <strong>{counter.currentNumber ?? '—'}</strong>
                              </div>
                              <button
                                style={{background: badge, color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px', marginTop: '4px'}}
                                onClick={async () => {
                                  const series = document.getElementById(`inv-series-cs-${mkt}`)?.value;
                                  const fmt = document.getElementById(`inv-fmt-cs-${mkt}`)?.value;
                                  const resp = await fetch(`/admin/api/invoice-settings/${mkt}`, {
                                    method: 'PUT',
                                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ invoiceSeries: series, invoiceNumberFormat: fmt })
                                  });
                                  if (resp.ok) {
                                    alert(`✅ ${t('invoices.counterSeries')} "${series}" ${t('common.saved') || 'saved'} (.${mkt})`);
                                    fetchInvoiceCounters();
                                  } else {
                                    const d = await resp.json();
                                    alert(`Error: ${d.message}`);
                                  }
                                }}
                              >
                                💾 {t('common.save') || 'Save'}
                              </button>
                            </div>
                            <div style={{fontSize: '11px', color: '#6c757d', marginTop: '8px'}}>{label}</div>
                          </div>
                        );
                      })}
                    </div>
                    <p style={{fontSize: '11px', color: '#856404', marginTop: '12px', margin: '12px 0 0'}}>
                      ℹ️ {t('invoiceSettings.efacturaStub')} &nbsp;|&nbsp; {t('invoiceSettings.externalApiStub')}. {' '}
                      <button onClick={() => { handleViewChange('invoices'); fetchInvoices(); fetchInvoiceCounters(); }} style={{background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: '0'}}>
                        → {t('invoices.title')}
                      </button>
                    </p>
                  </div>
                </div>
                
                {/* Market Settings Card — shown per active marketplace */}
                <div style={{marginTop: '30px', background: '#f0fff4', padding: '20px', borderRadius: '6px', border: '1px solid #28a74540'}}>
                  <h4 style={{color: '#155724', marginBottom: '16px', borderBottom: '2px solid #28a745', paddingBottom: '5px'}}>🌍 {t('nav.markets')}</h4>
                  {marketsLoading && <div style={{color: '#666', fontSize: '13px'}}><span className="loading"></span> {t('common.loading')}</div>}
                  {['ro', 'fr', 'com']
                    .filter(m => selectedMarketTab === 'all' || selectedMarketTab === m)
                    .map(m => <MarketSettingCard key={m} market={m} marketsData={marketsData} saveMarket={saveMarket} />)
                  }
                </div>

                <div style={{marginTop: '30px', padding: '20px', background: '#e8f4f8', borderRadius: '6px', border: '1px solid #bee5eb'}}>
                  <h4 style={{color: '#333', marginBottom: '10px'}}>📝 {t('companySettings.importantNotes')}</h4>
                  <ul style={{margin: '0', paddingLeft: '20px', color: '#495057'}}>
                    <li style={{marginBottom: '5px'}}>{t('companySettings.note1')}</li>
                    <li style={{marginBottom: '5px'}}>{t('companySettings.note2')}</li>
                    <li style={{marginBottom: '5px'}}>{t('companySettings.note3')}</li>
                    <li>{t('companySettings.note4')}</li>
                  </ul>
                </div>
              </div>
            );
          
          case 'invoices':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>🧾 {t('invoices.title')}</h3>
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <select
                      value={invoiceMarketFilter}
                      onChange={e => { setInvoiceMarketFilter(e.target.value); fetchInvoices(e.target.value); }}
                      style={{padding: '6px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px'}}
                    >
                      <option value="all">{t('invoices.filterAll')}</option>
                      <option value="ro">🇷🇴 România (.ro)</option>
                      <option value="fr">🇫🇷 France (.fr)</option>
                      <option value="com">🌍 International (.com)</option>
                    </select>
                    <button className="btn" style={{background: '#6c757d', width: 'auto', padding: '6px 12px'}} onClick={() => { fetchInvoices(); fetchInvoiceCounters(); }}>
                      🔄 {t('common.refresh')}
                    </button>
                    <button className="btn" style={{background: '#1a4f8a', width: 'auto', padding: '6px 14px', fontWeight: '600'}} onClick={() => setShowManualInvoiceModal(true)}>
                      ✏️ Emite Factură / Proformă
                    </button>
                  </div>
                </div>

                <p style={{color: '#666', marginBottom: '20px', fontSize: '13px'}}>{t('invoices.description')}</p>

                {/* Invoice Counters Card */}
                {invoiceCounters.length > 0 && (
                  <div style={{background: '#f0f8ff', border: '1px solid #007bff', borderRadius: '6px', padding: '16px', marginBottom: '24px'}}>
                    <h4 style={{color: '#007bff', margin: '0 0 12px', fontSize: '14px'}}>📊 {t('invoices.counters')}</h4>
                    <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
                      {invoiceCounters.map(counter => (
                        <div key={counter.market} style={{background: 'white', border: '1px solid #bee5eb', borderRadius: '6px', padding: '12px', minWidth: '180px'}}>
                          <div style={{fontWeight: '600', color: '#333', marginBottom: '6px'}}>
                            {counter.market === 'ro' ? '🇷🇴 .ro (Smartbill)' : counter.market === 'fr' ? '🇫🇷 .fr (PDF)' : '🌍 .com (PDF)'}
                          </div>
                          <div style={{fontSize: '12px', color: '#666', marginBottom: '8px'}}>
                            {t('invoices.counterSeries')}: <strong>{counter.series}</strong> &nbsp;|&nbsp; {t('invoices.counterCurrent')}: <strong>{counter.currentNumber}</strong>
                          </div>
                          <div style={{display: 'flex', gap: '6px'}}>
                            <input
                              type="text"
                              placeholder={t('invoices.counterSeries')}
                              defaultValue={counter.series}
                              id={`series-${counter.market}`}
                              style={{width: '60px', padding: '3px 6px', border: '1px solid #ced4da', borderRadius: '3px', fontSize: '11px'}}
                            />
                            <input
                              type="number"
                              placeholder="#"
                              defaultValue={counter.currentNumber}
                              id={`num-${counter.market}`}
                              style={{width: '60px', padding: '3px 6px', border: '1px solid #ced4da', borderRadius: '3px', fontSize: '11px'}}
                            />
                            <button
                              style={{background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px'}}
                              onClick={async () => {
                                const series = document.getElementById(`series-${counter.market}`)?.value;
                                const num = document.getElementById(`num-${counter.market}`)?.value;
                                const resp = await fetch(`/admin/api/invoice-counters/${counter.market}`, {
                                  method: 'PUT',
                                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ series, currentNumber: parseInt(num) })
                                });
                                if (resp.ok) { fetchInvoiceCounters(); alert(t('invoices.counterUpdated')); }
                              }}
                            >
                              {t('invoices.updateCounter')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* e-Factura stub notes */}
                    <div style={{marginTop: '12px', padding: '10px', background: '#fff3cd', borderRadius: '4px', fontSize: '12px', color: '#856404'}}>
                      🇫🇷 {t('invoiceSettings.efacturaStub')} &nbsp;|&nbsp; 🌍 {t('invoiceSettings.externalApiStub')}
                    </div>
                  </div>
                )}

                {/* Invoices Table */}
                {invoicesLoading ? (
                  <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>{t('common.loading')}</div>
                ) : adminInvoices.length === 0 ? (
                  <div style={{textAlign: 'center', padding: '40px', color: '#999', background: '#f8f9fa', borderRadius: '6px'}}>
                    📄 {t('invoices.noInvoices')}
                  </div>
                ) : (
                  <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                      <thead>
                        <tr style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>{t('invoices.id')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>{t('invoices.number')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>{t('invoices.order')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>{t('invoices.customer')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>{t('invoices.market')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>{t('invoices.source')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>{t('invoices.date')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'right', color: '#495057'}}>{t('invoices.total')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>{t('invoices.status')}</th>
                          <th style={{padding: '10px 12px', textAlign: 'center', color: '#495057'}}>{t('invoices.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminInvoices.map((inv, idx) => {
                          const isSmartbill = !!(inv.smartbillSeries && inv.smartbillNumber);
                          const hasPdf = !!(inv.pdfPath) || isSmartbill;
                          const sourceLabel = isSmartbill ? t('invoices.smartbill') : inv.efacturaStatus ? t('invoices.efactura') : t('invoices.local');
                          const sourceColor = isSmartbill ? '#0d6efd' : inv.efacturaStatus ? '#6610f2' : '#198754';
                          const statusColor = inv.status === 'issued' ? '#198754' : inv.status === 'cancelled' ? '#dc3545' : '#ffc107';
                          const marketFlag = inv.market === 'ro' ? '🇷🇴' : inv.market === 'fr' ? '🇫🇷' : '🌍';
                          const customerName = inv.userFirstName ? `${inv.userFirstName} ${inv.userLastName || ''}`.trim() : inv.userEmail || '-';
                          const issueDate = inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '-';
                          return (
                            <tr key={inv.id} style={{borderBottom: '1px solid #dee2e6', background: idx % 2 === 0 ? 'white' : '#f8f9fa'}}>
                              <td style={{padding: '10px 12px', color: '#6c757d', fontSize: '12px'}}>{inv.id}</td>
                              <td style={{padding: '10px 12px', fontFamily: 'monospace', fontWeight: '600', fontSize: '12px'}}>{inv.invoiceNumber}</td>
                              <td style={{padding: '10px 12px', color: '#6c757d'}}>#{inv.orderId || '-'}</td>
                              <td style={{padding: '10px 12px', fontSize: '12px'}}>{customerName}</td>
                              <td style={{padding: '10px 12px'}}>{marketFlag} {inv.market?.toUpperCase() || 'RO'}</td>
                              <td style={{padding: '10px 12px'}}>
                                <span style={{background: sourceColor, color: 'white', padding: '2px 7px', borderRadius: '10px', fontSize: '11px'}}>{sourceLabel}</span>
                              </td>
                              <td style={{padding: '10px 12px', color: '#6c757d', fontSize: '12px'}}>{issueDate}</td>
                              <td style={{padding: '10px 12px', textAlign: 'right', fontWeight: '600'}}>{parseFloat(inv.totalAmount || 0).toFixed(2)} {inv.currency}</td>
                              <td style={{padding: '10px 12px'}}>
                                <span style={{background: statusColor, color: 'white', padding: '2px 7px', borderRadius: '10px', fontSize: '11px'}}>
                                  {inv.status === 'issued' ? t('invoices.issued') : inv.status === 'cancelled' ? t('invoices.cancelled') : t('invoices.pending')}
                                </span>
                                {inv.efacturaStatus && <span style={{marginLeft: '4px', fontSize: '10px', color: '#6c757d'}}>e-fact: {inv.efacturaStatus}</span>}
                              </td>
                              <td style={{padding: '10px 12px', textAlign: 'center'}}>
                                <div style={{display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap'}}>
                                  {/* PDF download — local PDF or Smartbill PDF */}
                                  {hasPdf && (
                                    <button
                                      onClick={() => downloadAdminInvoicePdf(inv.id, inv.invoiceNumber)}
                                      title={t('invoices.download')}
                                      style={{background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px'}}
                                    >
                                      📥 PDF
                                    </button>
                                  )}
                                  {/* Open in Smartbill link for .ro invoices */}
                                  {isSmartbill && (
                                    <a
                                      href={inv.smartbillUrl || `https://app.smartbill.ro/`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Open in Smartbill"
                                      style={{background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center'}}
                                    >
                                      🔗 Smartbill
                                    </a>
                                  )}
                                  {/* e-Factura submit stub for .ro non-Smartbill invoices */}
                                  {inv.market === 'ro' && !isSmartbill && (
                                    <button
                                      onClick={async () => {
                                        const resp = await fetch(`/admin/api/invoices/${inv.id}/submit-efactura`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
                                        const data = await resp.json();
                                        alert(`e-Factura: ${data.message}`);
                                      }}
                                      title="Submit to e-Factura (stub)"
                                      style={{background: '#6610f2', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px'}}
                                    >
                                      📤 e-Fact
                                    </button>
                                  )}
                                  {/* External API submit stub for .com invoices */}
                                  {inv.market === 'com' && (
                                    <button
                                      onClick={async () => {
                                        const resp = await fetch(`/admin/api/invoices/${inv.id}/submit-external`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
                                        const data = await resp.json();
                                        alert(`External API: ${data.message}`);
                                      }}
                                      title="Submit to external API (stub)"
                                      style={{background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px'}}
                                    >
                                      📤 Ext.
                                    </button>
                                  )}
                                  {/* View details */}
                                  <button
                                    onClick={() => openInvoiceDetail(inv.id)}
                                    title={t('invoices.viewDetails') || 'View Details'}
                                    style={{background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px'}}
                                  >
                                    🔍 {t('common.view') || 'View'}
                                  </button>
                                  {/* Send invoice by email */}
                                  {hasPdf && (
                                    <button
                                      onClick={() => setSendInvoiceEmailModal({ id: inv.id, invoiceNumber: inv.invoiceNumber, userEmail: inv.userEmail || '' })}
                                      title="Trimite pe email"
                                      style={{background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px'}}
                                    >
                                      ✉️ Email
                                    </button>
                                  )}
                                  {!hasPdf && !isSmartbill && <span style={{color: '#adb5bd', fontSize: '11px'}}>—</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p style={{color: '#666', fontSize: '12px', marginTop: '10px'}}>{adminInvoices.length} {t('invoices.title').toLowerCase()} total</p>
                  </div>
                )}

                {/* Manual Invoice / Proforma Modal */}
                {showManualInvoiceModal && (
                  <ManualInvoiceModal
                    onClose={() => setShowManualInvoiceModal(false)}
                    onCreated={() => {}}
                  />
                )}

                {/* Send Invoice Email Modal */}
                {sendInvoiceEmailModal && (
                  <SendInvoiceEmailModal
                    invoice={sendInvoiceEmailModal}
                    onClose={() => setSendInvoiceEmailModal(null)}
                  />
                )}

                {/* Invoice Detail Modal */}
                {invoiceDetailModal && (
                  <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                    onClick={e => { if (e.target === e.currentTarget) setInvoiceDetailModal(null); }}
                  >
                    <div style={{background: 'white', borderRadius: '10px', width: '700px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)'}}>
                      {/* Header */}
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #dee2e6', background: '#f8f9fa'}}>
                        <div>
                          <h4 style={{margin: 0, color: '#333'}}>🧾 {t('invoices.details') || 'Invoice Details'}</h4>
                          {!invoiceDetailModal.loading && (
                            <div style={{fontSize: '12px', color: '#6c757d', marginTop: '2px'}}>
                              {invoiceDetailModal.invoiceNumber} &nbsp;·&nbsp; {invoiceDetailModal.market?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setInvoiceDetailModal(null)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6c757d', lineHeight: '1'}}>×</button>
                      </div>

                      {invoiceDetailModal.loading ? (
                        <div style={{padding: '40px', textAlign: 'center', color: '#6c757d'}}>⏳ Loading...</div>
                      ) : (
                        <div style={{padding: '24px'}}>
                          {/* Status row */}
                          <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px'}}>
                            <span style={{background: invoiceDetailModal.status === 'issued' ? '#198754' : invoiceDetailModal.status === 'cancelled' ? '#dc3545' : '#ffc107', color: 'white', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600'}}>
                              {invoiceDetailModal.status === 'issued' ? t('invoices.issued') : invoiceDetailModal.status === 'cancelled' ? t('invoices.cancelled') : t('invoices.pending')}
                            </span>
                            <span style={{background: '#e9ecef', color: '#495057', padding: '3px 10px', borderRadius: '10px', fontSize: '12px'}}>
                              📅 {invoiceDetailModal.issueDate ? new Date(invoiceDetailModal.issueDate).toLocaleDateString() : '-'}
                            </span>
                            {invoiceDetailModal.dueDate && (
                              <span style={{background: '#fff3cd', color: '#856404', padding: '3px 10px', borderRadius: '10px', fontSize: '12px'}}>
                                ⏳ Due: {new Date(invoiceDetailModal.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            <span style={{background: '#cfe2ff', color: '#0d6efd', padding: '3px 10px', borderRadius: '10px', fontSize: '12px'}}>
                              🛒 Order #{invoiceDetailModal.orderId || '-'}
                            </span>
                          </div>

                          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
                            {/* Buyer */}
                            <div style={{background: '#f8f9fa', borderRadius: '6px', padding: '14px'}}>
                              <div style={{fontWeight: '600', color: '#333', marginBottom: '8px', fontSize: '13px'}}>👤 {t('invoices.buyer') || 'Buyer'}</div>
                              <div style={{fontSize: '13px', color: '#495057', lineHeight: '1.6'}}>
                                <div>{invoiceDetailModal.buyerName || `${invoiceDetailModal.userFirstName || ''} ${invoiceDetailModal.userLastName || ''}`.trim() || '—'}</div>
                                <div style={{color: '#6c757d'}}>{invoiceDetailModal.buyerEmail || invoiceDetailModal.userEmail || ''}</div>
                                {invoiceDetailModal.buyerVatCode && <div style={{color: '#6c757d', fontSize: '11px'}}>VAT: {invoiceDetailModal.buyerVatCode}</div>}
                                {invoiceDetailModal.buyerAddress && <div style={{color: '#6c757d', fontSize: '11px'}}>{invoiceDetailModal.buyerAddress}</div>}
                              </div>
                            </div>

                            {/* Payment */}
                            <div style={{background: '#f8f9fa', borderRadius: '6px', padding: '14px'}}>
                              <div style={{fontWeight: '600', color: '#333', marginBottom: '8px', fontSize: '13px'}}>💳 {t('invoices.payment') || 'Payment'}</div>
                              <div style={{fontSize: '13px', color: '#495057', lineHeight: '1.6'}}>
                                <div>{invoiceDetailModal.paymentMethod || '—'}</div>
                                {invoiceDetailModal.paymentStatus && <div style={{color: '#6c757d'}}>{invoiceDetailModal.paymentStatus}</div>}
                                {invoiceDetailModal.externalRef && <div style={{fontSize: '11px', color: '#6c757d'}}>Ext ref: {invoiceDetailModal.externalRef}</div>}
                                {invoiceDetailModal.efacturaRef && <div style={{fontSize: '11px', color: '#6c757d'}}>e-Fact: {invoiceDetailModal.efacturaRef}</div>}
                              </div>
                            </div>
                          </div>

                          {/* Line items */}
                          {invoiceDetailModal.items && invoiceDetailModal.items.length > 0 && (
                            <div style={{marginBottom: '20px'}}>
                              <div style={{fontWeight: '600', color: '#333', marginBottom: '8px', fontSize: '13px'}}>📦 {t('invoices.lineItems') || 'Line Items'}</div>
                              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                                <thead>
                                  <tr style={{background: '#f8f9fa'}}>
                                    <th style={{padding: '7px 10px', textAlign: 'left', borderBottom: '2px solid #dee2e6', color: '#333'}}>{t('orders.product') || 'Product'}</th>
                                    <th style={{padding: '7px 10px', textAlign: 'center', borderBottom: '2px solid #dee2e6', color: '#333'}}>{t('orders.qty') || 'Qty'}</th>
                                    <th style={{padding: '7px 10px', textAlign: 'right', borderBottom: '2px solid #dee2e6', color: '#333'}}>{t('invoices.unitPrice') || 'Unit Price'}</th>
                                    <th style={{padding: '7px 10px', textAlign: 'right', borderBottom: '2px solid #dee2e6', color: '#333'}}>{t('invoices.vatRate') || 'VAT%'}</th>
                                    <th style={{padding: '7px 10px', textAlign: 'right', borderBottom: '2px solid #dee2e6', color: '#333'}}>{t('orders.total') || 'Total'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {invoiceDetailModal.items.map((item, idx) => (
                                    <tr key={idx} style={{borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? 'white' : '#fafafa'}}>
                                      <td style={{padding: '7px 10px'}}>{item.name || item.productName || '-'}</td>
                                      <td style={{padding: '7px 10px', textAlign: 'center'}}>{item.quantity || item.qty || 1}</td>
                                      <td style={{padding: '7px 10px', textAlign: 'right'}}>{parseFloat(item.price || item.unitPrice || 0).toFixed(2)}</td>
                                      <td style={{padding: '7px 10px', textAlign: 'right'}}>{item.vatRate || item.taxRate || '19'}%</td>
                                      <td style={{padding: '7px 10px', textAlign: 'right', fontWeight: '600'}}>{parseFloat(item.total || ((item.price || 0) * (item.quantity || 1))).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Totals */}
                          <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '20px'}}>
                            <div style={{background: '#f8f9fa', borderRadius: '6px', padding: '14px', minWidth: '220px'}}>
                              {invoiceDetailModal.subtotal != null && (
                                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: '#6c757d'}}>
                                  <span>{t('orders.subtotal') || 'Subtotal'}:</span>
                                  <span>{parseFloat(invoiceDetailModal.subtotal).toFixed(2)} {invoiceDetailModal.currency}</span>
                                </div>
                              )}
                              {invoiceDetailModal.taxAmount != null && (
                                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: '#6c757d'}}>
                                  <span>TVA / VAT:</span>
                                  <span>{parseFloat(invoiceDetailModal.taxAmount).toFixed(2)} {invoiceDetailModal.currency}</span>
                                </div>
                              )}
                              <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #dee2e6', paddingTop: '8px', fontWeight: '700', fontSize: '15px', color: '#333'}}>
                                <span>Total:</span>
                                <span>{parseFloat(invoiceDetailModal.totalAmount || 0).toFixed(2)} {invoiceDetailModal.currency}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
                            {(invoiceDetailModal.pdfPath || invoiceDetailModal.source === 'smartbill') && (
                              <button
                                onClick={() => downloadAdminInvoicePdf(invoiceDetailModal.id, invoiceDetailModal.invoiceNumber)}
                                style={{background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px'}}
                              >
                                📥 Download PDF
                              </button>
                            )}
                            <button
                              onClick={() => setInvoiceDetailModal(null)}
                              style={{background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px'}}
                            >
                              {t('common.close') || 'Close'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );

          case 'vouchers':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>🎟️ {t('vouchers.title')}</h3>
                  <button 
                    className="btn" 
                    style={{background: '#28a745', width: 'auto', padding: '8px 16px'}}
                    onClick={() => {
                      setVoucherForm({
                        code: '',
                        name: '',
                        discountType: 'fixed',
                        discountValue: '',
                        minOrderAmount: '',
                        maxUses: '',
                        isActive: true,
                        validFrom: '',
                        validUntil: '',
                        marketCode: selectedMarketTab && selectedMarketTab !== 'all' ? selectedMarketTab : 'ro'
                      });
                      setEditingVoucher(null);
                      setShowAddVoucherModal(true);
                    }}
                  >
                    + {t('vouchers.addNew')}
                  </button>
                </div>
                
                <p style={{color: '#666', marginBottom: '20px'}}>
                  {t('vouchers.description')}
                </p>

                {(selectedMarketTab === 'fr' || selectedMarketTab === 'all') && (
                  <div style={{marginBottom: '28px', padding: '20px', borderRadius: '10px', border: '1px solid #cfe2ff', background: '#f4f8ff'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap'}}>
                      <div>
                        <h4 style={{margin: '0 0 6px', color: '#12345b'}}>🎫 Campagne événement chefs — France</h4>
                        <p style={{margin: 0, color: '#52657d', fontSize: '13px'}}>
                          QR code vers le formulaire public. Chaque inscription reçoit un code de 20 %, sans montant minimum, valable 12 mois.
                        </p>
                      </div>
                      {eventVoucherData?.campaign && (
                        <button
                          type="button"
                          disabled={eventVoucherSaving}
                          onClick={() => updateEventVoucherCampaign(!eventVoucherData.campaign.isActive)}
                          style={{
                            border: 'none',
                            borderRadius: '6px',
                            padding: '9px 14px',
                            cursor: eventVoucherSaving ? 'wait' : 'pointer',
                            color: '#fff',
                            background: eventVoucherData.campaign.isActive ? '#dc3545' : '#198754'
                          }}
                        >
                          {eventVoucherData.campaign.isActive ? 'Désactiver la campagne' : 'Activer la campagne'}
                        </button>
                      )}
                    </div>

                    {eventVoucherLoading && <p style={{color: '#52657d'}}>Chargement de la campagne…</p>}
                    {!eventVoucherLoading && eventVoucherData?.campaign && (
                      <>
                        <div style={{display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', marginTop: '18px'}}>
                          <img
                            src={eventVoucherData.qrCodeDataUrl}
                            alt="QR code de la campagne événement FR"
                            style={{width: '180px', height: '180px', background: '#fff', padding: '8px', borderRadius: '8px'}}
                          />
                          <div style={{fontSize: '13px', color: '#52657d'}}>
                            <div style={{marginBottom: '8px'}}><strong>Page publique :</strong> {eventVoucherData.publicUrl}</div>
                            <div style={{marginBottom: '8px'}}><strong>Statut :</strong> {eventVoucherData.campaign.isActive ? 'Active' : 'Inactive'}</div>
                            <div style={{marginBottom: '14px'}}><strong>Inscriptions :</strong> {eventVoucherData.registrations?.length || 0}</div>
                            <a
                              href={eventVoucherData.qrCodeDataUrl}
                              download="xhaccp-fr-chef-event-qr.png"
                              style={{display: 'inline-block', padding: '9px 13px', borderRadius: '6px', background: '#0d6efd', color: '#fff', textDecoration: 'none'}}
                            >
                              Télécharger le QR code
                            </a>
                          </div>
                        </div>
                        <div style={{overflowX: 'auto', marginTop: '20px'}}>
                          <table style={{width: '100%', borderCollapse: 'collapse', background: '#fff'}}>
                            <thead>
                              <tr style={{background: '#eaf2ff'}}>
                                <th style={{padding: '9px', textAlign: 'left'}}>Participant</th>
                                <th style={{padding: '9px', textAlign: 'left'}}>Restaurant</th>
                                <th style={{padding: '9px', textAlign: 'left'}}>Email</th>
                                <th style={{padding: '9px', textAlign: 'left'}}>Code</th>
                                <th style={{padding: '9px', textAlign: 'left'}}>Email</th>
                                <th style={{padding: '9px', textAlign: 'left'}}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(eventVoucherData.registrations || []).map((registration) => (
                                <tr key={registration.id} style={{borderTop: '1px solid #e1e8f0'}}>
                                  <td style={{padding: '9px'}}>{registration.firstName} {registration.lastName}</td>
                                  <td style={{padding: '9px'}}>{registration.restaurant}</td>
                                  <td style={{padding: '9px'}}>{registration.email}</td>
                                  <td style={{padding: '9px'}}><code>{registration.voucherCode || '—'}</code></td>
                                  <td style={{padding: '9px'}}>{registration.emailStatus}</td>
                                  <td style={{padding: '9px'}}>
                                    <button
                                      type="button"
                                      onClick={() => resendEventVoucherEmail(registration.id)}
                                      style={{border: '1px solid #0d6efd', color: '#0d6efd', background: '#fff', borderRadius: '5px', padding: '5px 8px', cursor: 'pointer'}}
                                    >
                                      Renvoyer
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {(!eventVoucherData.registrations || eventVoucherData.registrations.length === 0) && (
                                <tr><td colSpan="6" style={{padding: '14px', textAlign: 'center', color: '#6c757d'}}>Aucune inscription pour le moment.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {vouchers.length > 0 ? (
                  <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <thead>
                        <tr style={{backgroundColor: '#f5f5f5'}}>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.code')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.name')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.discount')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.minOrder')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.market')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.usage')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.validPeriod')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.status')}</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vouchers.map((voucher) => (
                          <tr key={voucher.id} style={{borderBottom: '1px solid #eee'}}>
                            <td style={{padding: '12px'}}>
                              <code style={{background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'}}>{voucher.code}</code>
                            </td>
                            <td style={{padding: '12px'}}>{voucher.name}</td>
                            <td style={{padding: '12px'}}>
                              {voucher.discountType === 'percentage' 
                                ? `${voucher.discountValue}%` 
                                : `${voucher.discountValue} RON`}
                            </td>
                            <td style={{padding: '12px'}}>
                              {voucher.minOrderAmount ? `${voucher.minOrderAmount} RON` : '-'}
                            </td>
                            <td style={{padding: '12px'}}>
                              <span style={{padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', background: voucher.marketCode === 'fr' ? '#e8f4f8' : voucher.marketCode === 'com' ? '#e8f8e8' : '#f0e8f8', color: voucher.marketCode === 'fr' ? '#1a6080' : voucher.marketCode === 'com' ? '#1a6030' : '#6020a0'}}>
                                {(voucher.marketCode || 'ro').toUpperCase()}
                              </span>
                            </td>
                            <td style={{padding: '12px'}}>
                              {voucher.usedCount || 0}{voucher.maxUses ? ` / ${voucher.maxUses}` : ''}
                            </td>
                            <td style={{padding: '12px', fontSize: '12px'}}>
                              {voucher.validFrom || voucher.validUntil ? (
                                <>
                                  {voucher.validFrom ? new Date(voucher.validFrom).toLocaleDateString() : 'N/A'}
                                  {' - '}
                                  {voucher.validUntil ? new Date(voucher.validUntil).toLocaleDateString() : 'N/A'}
                                </>
                              ) : t('vouchers.noExpiry')}
                            </td>
                            <td style={{padding: '12px'}}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                background: voucher.isActive ? '#d4edda' : '#f8d7da',
                                color: voucher.isActive ? '#155724' : '#721c24'
                              }}>
                                {voucher.isActive ? t('common.active') : t('common.inactive')}
                              </span>
                            </td>
                            <td style={{padding: '12px'}}>
                              <div style={{display: 'flex', gap: '5px'}}>
                                <button 
                                  className="btn" 
                                  style={{background: '#007bff', width: 'auto', padding: '4px 10px', fontSize: '12px'}}
                                  onClick={() => {
                                    setEditingVoucher(voucher);
                                    setVoucherForm({
                                      code: voucher.code || '',
                                      name: voucher.name || '',
                                      discountType: voucher.discountType || 'fixed',
                                      discountValue: voucher.discountValue || '',
                                      minOrderAmount: voucher.minOrderAmount || '',
                                      maxUses: voucher.maxUses || '',
                                      isActive: voucher.isActive !== false,
                                      validFrom: voucher.validFrom ? new Date(voucher.validFrom).toISOString().slice(0, 16) : '',
                                      validUntil: voucher.validUntil ? new Date(voucher.validUntil).toISOString().slice(0, 16) : '',
                                      marketCode: voucher.marketCode || 'ro'
                                    });
                                    setShowAddVoucherModal(true);
                                  }}
                                >
                                  {t('common.edit')}
                                </button>
                                <button 
                                  className="btn" 
                                  style={{background: '#dc3545', width: 'auto', padding: '4px 10px', fontSize: '12px'}}
                                  onClick={async () => {
                                    if (confirm(`Are you sure you want to delete voucher "${voucher.code}"?`)) {
                                      try {
                                        const response = await fetch(`/admin/api/vouchers/${voucher.id}`, {
                                          method: 'DELETE',
                                          headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        if (response.ok) {
                                          setVouchers(vouchers.filter(v => v.id !== voucher.id));
                                        } else {
                                          alert('Failed to delete voucher');
                                        }
                                      } catch (err) {
                                        console.error('Error deleting voucher:', err);
                                        alert('Failed to delete voucher');
                                      }
                                    }
                                  }}
                                >
                                  {t('common.delete')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                    <p>{t('vouchers.noneFound')}</p>
                  </div>
                )}
                
                {/* Add/Edit Voucher Modal */}
                {showAddVoucherModal && (
                  <div className="modal-backdrop" onClick={() => setShowAddVoucherModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '500px'}}>
                      <h3 style={{marginBottom: '20px'}}>{editingVoucher ? t('vouchers.editVoucher') : t('vouchers.addNew')}</h3>
                      
                      <div style={{marginBottom: '15px'}}>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('common.market')} *</label>
                        <select
                          value={voucherForm.marketCode}
                          onChange={(e) => setVoucherForm({...voucherForm, marketCode: e.target.value})}
                          style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                        >
                          <option value="ro">🇷🇴 România (ro)</option>
                          <option value="fr">🇫🇷 France (fr)</option>
                          <option value="com">🌍 International (com)</option>
                        </select>
                      </div>

                      <div style={{marginBottom: '15px'}}>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.voucherCode')} *</label>
                        <input
                          type="text"
                          value={voucherForm.code}
                          onChange={(e) => setVoucherForm({...voucherForm, code: e.target.value.toUpperCase()})}
                          placeholder="e.g., DISCOUNT10"
                          style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                        />
                      </div>
                      
                      <div style={{marginBottom: '15px'}}>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.nameDescription')} *</label>
                        <input
                          type="text"
                          value={voucherForm.name}
                          onChange={(e) => setVoucherForm({...voucherForm, name: e.target.value})}
                          placeholder="e.g., 10% Summer Sale"
                          style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                        />
                      </div>
                      
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.discountType')}</label>
                          <select
                            value={voucherForm.discountType}
                            onChange={(e) => setVoucherForm({...voucherForm, discountType: e.target.value})}
                            style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                          >
                            <option value="fixed">{t('vouchers.fixedAmount')}</option>
                            <option value="percentage">{t('vouchers.percentage')}</option>
                          </select>
                        </div>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.discountValue')} *</label>
                          <input
                            type="number"
                            value={voucherForm.discountValue}
                            onChange={(e) => setVoucherForm({...voucherForm, discountValue: e.target.value})}
                            placeholder={voucherForm.discountType === 'percentage' ? 'e.g., 10' : 'e.g., 50'}
                            style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                          />
                        </div>
                      </div>
                      
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.minOrderAmount')}</label>
                          <input
                            type="number"
                            value={voucherForm.minOrderAmount}
                            onChange={(e) => setVoucherForm({...voucherForm, minOrderAmount: e.target.value})}
                            placeholder="Optional"
                            style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                          />
                        </div>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Max Uses</label>
                          <input
                            type="number"
                            value={voucherForm.maxUses}
                            onChange={(e) => setVoucherForm({...voucherForm, maxUses: e.target.value})}
                            placeholder="Unlimited"
                            style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                          />
                        </div>
                      </div>
                      
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Valid From</label>
                          <input
                            type="datetime-local"
                            value={voucherForm.validFrom}
                            onChange={(e) => setVoucherForm({...voucherForm, validFrom: e.target.value})}
                            style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                          />
                        </div>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Valid Until</label>
                          <input
                            type="datetime-local"
                            value={voucherForm.validUntil}
                            onChange={(e) => setVoucherForm({...voucherForm, validUntil: e.target.value})}
                            style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
                          />
                        </div>
                      </div>
                      
                      <div style={{marginBottom: '20px'}}>
                        <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'}}>
                          <input
                            type="checkbox"
                            checked={voucherForm.isActive}
                            onChange={(e) => setVoucherForm({...voucherForm, isActive: e.target.checked})}
                          />
                          <span style={{fontWeight: 'bold'}}>Voucher is active</span>
                        </label>
                      </div>
                      
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => setShowAddVoucherModal(false)}
                          style={{width: 'auto', padding: '10px 20px'}}
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn" 
                          style={{background: '#28a745', width: 'auto', padding: '10px 20px'}}
                          onClick={async () => {
                            if (!voucherForm.code || !voucherForm.name || !voucherForm.discountValue) {
                              alert('Please fill in all required fields (Code, Name, Discount Value)');
                              return;
                            }
                            
                            try {
                              const voucherData = {
                                code: voucherForm.code,
                                name: voucherForm.name,
                                discountType: voucherForm.discountType,
                                discountValue: voucherForm.discountValue,
                                minOrderAmount: voucherForm.minOrderAmount || null,
                                maxUses: voucherForm.maxUses ? parseInt(voucherForm.maxUses) : null,
                                isActive: voucherForm.isActive,
                                validFrom: voucherForm.validFrom ? new Date(voucherForm.validFrom).toISOString() : null,
                                validUntil: voucherForm.validUntil ? new Date(voucherForm.validUntil).toISOString() : null,
                                marketCode: voucherForm.marketCode || 'ro'
                              };
                              
                              const url = editingVoucher 
                                ? `/admin/api/vouchers/${editingVoucher.id}` 
                                : '/admin/api/vouchers';
                              const method = editingVoucher ? 'PUT' : 'POST';
                              
                              const response = await fetch(url, {
                                method,
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(voucherData)
                              });
                              
                              if (response.ok) {
                                const savedVoucher = await response.json();
                                if (editingVoucher) {
                                  setVouchers(vouchers.map(v => v.id === savedVoucher.id ? savedVoucher : v));
                                } else {
                                  setVouchers([savedVoucher, ...vouchers]);
                                }
                                setShowAddVoucherModal(false);
                                setEditingVoucher(null);
                              } else {
                                const error = await response.json();
                                alert(error.message || 'Failed to save voucher');
                              }
                            } catch (err) {
                              console.error('Error saving voucher:', err);
                              alert('Failed to save voucher');
                            }
                          }}
                        >
                          {editingVoucher ? 'Update Voucher' : 'Create Voucher'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          
          case 'blog':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <h3 style={{color: '#333', marginTop: 0}}>📝 {t('blog.title')}</h3>

                {/* Generate Form */}
                <div style={{background: '#f8f9fa', borderRadius: '8px', padding: '20px', marginBottom: '24px', border: '1px solid #e9ecef'}}>
                  <h4 style={{marginTop: 0, color: '#495057'}}>{t('blog.generateNew')}</h4>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>{t('blog.titleLabel')}</label>
                      <input
                        type="text"
                        placeholder={t('blog.titlePlaceholder')}
                        value={blogGenerateForm.title}
                        onChange={e => setBlogGenerateForm({...blogGenerateForm, title: e.target.value})}
                        style={{width: '100%', padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'}}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>{t('blog.category')}</label>
                      <select
                        value={blogGenerateForm.category}
                        onChange={e => setBlogGenerateForm({...blogGenerateForm, category: e.target.value})}
                        style={{width: '100%', padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'}}
                      >
                        <option value="HACCP">HACCP</option>
                        <option value="Legislație">Legislație</option>
                        <option value="Etichetare">Etichetare</option>
                        <option value="Trasabilitate">Trasabilitate</option>
                        <option value="Echipamente">Echipamente</option>
                        <option value="Digitalizare">Digitalizare</option>
                        <option value="Operațiuni">Operațiuni</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div>
                      <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>{t('blog.language')}</label>
                      <select
                        value={blogGenerateForm.language}
                        onChange={e => setBlogGenerateForm({...blogGenerateForm, language: e.target.value})}
                        style={{width: '100%', padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'}}
                      >
                        <option value="ro">🇷🇴 Română (RO)</option>
                        <option value="fr">🇫🇷 Franceză (FR)</option>
                        <option value="en">🇬🇧 Engleză (COM)</option>
                      </select>
                    </div>
                    <button
                      onClick={generateBlogPost}
                      disabled={blogGenerating}
                      style={{background: blogGenerating ? '#6c757d' : '#0066cc', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 18px', fontSize: '14px', cursor: blogGenerating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontWeight: '600'}}
                    >
                      {blogGenerating ? `⏳ ${t('blog.generating')}` : `✨ ${t('blog.generate')}`}
                    </button>
                  </div>
                  <p style={{margin: '10px 0 0', fontSize: '12px', color: '#868e96'}}>
                    ℹ️ Generarea durează ~25-40 secunde. "Etichete HACCP" este inclus în toate articolele.
                  </p>
                </div>

                {/* Schedule Config */}
                {adminIsSuperAdmin && (
                  <div style={{background: '#f0f7ff', borderRadius: '8px', padding: '20px', marginBottom: '24px', border: '1px solid #b8d4f5'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px'}}>
                    <h4 style={{margin: 0, color: '#1565c0'}}>⏰ Generare automată</h4>
                    {!scheduleLoaded && (
                      <button onClick={fetchScheduleConfig} style={{background:'none', border:'1px solid #1565c0', borderRadius:'6px', padding:'4px 12px', cursor:'pointer', fontSize:'12px', color:'#1565c0'}}>
                        Încarcă configurație
                      </button>
                    )}
                  </div>
                  {scheduleLoaded && (
                    <div style={{display:'grid', gridTemplateColumns:'auto 1fr 1fr auto', gap:'12px', alignItems:'end'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'8px', paddingBottom:'8px'}}>
                        <input type="checkbox" id="schedEnabled" checked={scheduleConfig.enabled}
                          onChange={e => setScheduleConfig(c => ({...c, enabled: e.target.checked}))}
                          style={{width:'16px', height:'16px', cursor:'pointer'}} />
                        <label htmlFor="schedEnabled" style={{fontSize:'14px', fontWeight:'600', color:'#333', cursor:'pointer'}}>Activat</label>
                      </div>
                      <div>
                        <label style={{display:'block', marginBottom:'4px', fontSize:'13px', fontWeight:'600', color:'#495057'}}>La fiecare (zile)</label>
                        <input type="number" min="1" max="30" value={scheduleConfig.intervalDays}
                          onChange={e => setScheduleConfig(c => ({...c, intervalDays: parseInt(e.target.value)||1}))}
                          style={{width:'100%', padding:'8px 12px', border:'1px solid #ced4da', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box'}} />
                      </div>
                      <div>
                        <label style={{display:'block', marginBottom:'4px', fontSize:'13px', fontWeight:'600', color:'#495057'}}>Ora (0-23, Bucharest)</label>
                        <input type="number" min="0" max="23" value={scheduleConfig.hour}
                          onChange={e => setScheduleConfig(c => ({...c, hour: parseInt(e.target.value)||8}))}
                          style={{width:'100%', padding:'8px 12px', border:'1px solid #ced4da', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box'}} />
                      </div>
                      <button onClick={saveScheduleConfig}
                        style={{background:'#1565c0', color:'white', border:'none', borderRadius:'6px', padding:'8px 16px', cursor:'pointer', fontSize:'14px', fontWeight:'600'}}>
                        💾 Salvează
                      </button>
                    </div>
                  )}
                  {scheduleLoaded && (
                    <p style={{margin:'10px 0 0', fontSize:'12px', color:'#666'}}>
                      Curent: {scheduleConfig.enabled ? `la fiecare ${scheduleConfig.intervalDays} zi(le), ora ${scheduleConfig.hour}:00 Bucharest` : 'dezactivat'}
                    </p>
                  )}
                  </div>
                )}

                {/* Generate Weekly by Market */}
                <div style={{background: '#fff8e1', borderRadius: '8px', padding: '16px', marginBottom: '24px', border: '1px solid #ffe082'}}>
                  <h4 style={{marginTop: 0, marginBottom: '10px', color: '#e65100', fontSize: '14px'}}>🌍 Generare săptămânală pe piață</h4>
                  <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center'}}>
                    <span style={{fontSize: '13px', color: '#555'}}>Generează un articol din subiectele predefinite pentru:</span>
                    <button
                      onClick={() => generateWeeklyForMarket('ro')}
                      disabled={blogGenerating}
                      style={{background: blogGenerating ? '#9e9e9e' : '#1b5e20', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', cursor: blogGenerating ? 'not-allowed' : 'pointer', fontWeight: '600'}}
                    >
                      🇷🇴 RO
                    </button>
                    <button
                      onClick={() => generateWeeklyForMarket('fr')}
                      disabled={blogGenerating}
                      style={{background: blogGenerating ? '#9e9e9e' : '#1a237e', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', cursor: blogGenerating ? 'not-allowed' : 'pointer', fontWeight: '600'}}
                    >
                      🇫🇷 FR
                    </button>
                    <button
                      onClick={() => generateWeeklyForMarket('com')}
                      disabled={blogGenerating}
                      style={{background: blogGenerating ? '#9e9e9e' : '#006064', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', cursor: blogGenerating ? 'not-allowed' : 'pointer', fontWeight: '600'}}
                    >
                      🇬🇧 COM
                    </button>
                    {blogGenerating && <span style={{fontSize: '13px', color: '#e65100'}}>⏳ Generez (~30s)...</span>}
                  </div>
                </div>

                {/* Posts List */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                  <h4 style={{margin: 0, color: '#495057'}}>Articole ({blogPosts.length})</h4>
                  <button onClick={fetchBlogPosts} style={{background: 'none', border: '1px solid #ced4da', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px'}}>🔄 Reîncarcă</button>
                </div>

                {blogPosts.length === 0 ? (
                  <div style={{textAlign: 'center', padding: '40px', color: '#868e96', background: '#f8f9fa', borderRadius: '8px', border: '1px dashed #ced4da'}}>
                    <div style={{fontSize: '48px', marginBottom: '12px'}}>📭</div>
                    <p style={{margin: 0}}>Niciun articol generat încă. Folosește formularul de mai sus pentru a genera primul articol.</p>
                  </div>
                ) : (
                  <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                      <thead>
                        <tr style={{background: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>Titlu</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>Categorie</th>
                          <th style={{padding: '10px 12px', textAlign: 'center', color: '#495057'}}>Piață</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>Limbă</th>
                          <th style={{padding: '10px 12px', textAlign: 'center', color: '#495057'}}>Citit</th>
                          <th style={{padding: '10px 12px', textAlign: 'center', color: '#495057'}}>Status</th>
                          <th style={{padding: '10px 12px', textAlign: 'left', color: '#495057'}}>Data</th>
                          <th style={{padding: '10px 12px', textAlign: 'center', color: '#495057'}}>Acțiuni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blogPosts.map((post, idx) => (
                          <tr key={post.id} style={{borderBottom: '1px solid #dee2e6', background: idx % 2 === 0 ? 'white' : '#fafafa'}}>
                            <td style={{padding: '10px 12px', maxWidth: '280px'}}>
                              <div style={{fontWeight: '600', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{post.title}</div>
                              <div style={{fontSize: '12px', color: '#868e96', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px'}}>{post.excerpt}</div>
                            </td>
                            <td style={{padding: '10px 12px', color: '#495057'}}>{post.category}</td>
                            <td style={{padding: '10px 12px', textAlign: 'center'}}>{(post.marketCode || 'ro') === 'fr' ? '🇫🇷 FR' : (post.marketCode || 'ro') === 'com' ? '🌐 COM' : '🇷🇴 RO'}</td>
                            <td style={{padding: '10px 12px', textAlign: 'center'}}>{post.language === 'ro' ? '🇷🇴' : post.language === 'fr' ? '🇫🇷' : '🇬🇧'}</td>
                            <td style={{padding: '10px 12px', textAlign: 'center', color: '#495057'}}>{post.readTimeMinutes ? post.readTimeMinutes + ' min' : '-'}</td>
                            <td style={{padding: '10px 12px', textAlign: 'center'}}>
                              <span style={{
                                background: post.published ? '#d4edda' : '#fff3cd',
                                color: post.published ? '#155724' : '#856404',
                                padding: '2px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                {post.published ? 'Publicat' : 'Draft'}
                              </span>
                            </td>
                            <td style={{padding: '10px 12px', color: '#868e96', fontSize: '12px', whiteSpace: 'nowrap'}}>
                              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ro-RO') : '-'}
                            </td>
                            <td style={{padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap'}}>
                              <button
                                onClick={() => setPreviewBlogPost(post)}
                                style={{background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', marginRight: '4px'}}
                                title="Previzualizare articol"
                              >
                                👁
                              </button>
                              <button
                                onClick={() => openEditBlogPost(post)}
                                style={{background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', marginRight: '4px'}}
                                title="Editează articol"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => toggleBlogPostPublished(post)}
                                style={{background: post.published ? '#ffc107' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', marginRight: '4px'}}
                              >
                                {post.published ? 'Ascunde' : 'Publică'}
                              </button>
                              <button
                                onClick={() => deleteBlogPost(post.id)}
                                style={{background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px'}}
                              >
                                Șterge
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );

          default:
            return (
              <>
                <div className="dashboard-grid">
                  <div className="stat-card">
                    <div className="stat-number">{stats?.totalUsers || '0'}</div>
                    <div className="stat-label">Total Users</div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-number">{stats?.totalOrders || '0'}</div>
                    <div className="stat-label">Total Orders</div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-number">{stats?.totalProducts || '0'}</div>
                    <div className="stat-label">{t('stats.totalProducts')}</div>
                  </div>
                  
                  <div className="stat-card">
                    <div className="stat-number">{stats?.recentOrders?.length || '0'}</div>
                    <div className="stat-label">{t('stats.recentOrders')}</div>
                  </div>
                </div>
                
                <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>{t('dashboard.systemOverview')}</h3>
                  <p style={{color: '#666', lineHeight: '1.6'}}>
                    {t('dashboard.welcomeText')}
                  </p>
                  
                  <div style={{marginTop: '30px', padding: '20px', background: '#f8f9ff', borderRadius: '6px'}}>
                    <h4 style={{color: '#333', marginBottom: '10px'}}>{t('dashboard.quickStats')}</h4>
                    <ul style={{listStyle: 'none', padding: 0}}>
                      <li style={{marginBottom: '5px'}}>📊 {stats?.totalUsers || '0'} {t('dashboard.registeredUsers')}</li>
                      <li style={{marginBottom: '5px'}}>🛒 {stats?.totalOrders || '0'} {t('dashboard.ordersProcessed')}</li>
                      <li style={{marginBottom: '5px'}}>📦 {stats?.totalProducts || '0'} {t('dashboard.productsInCatalog')}</li>
                      <li style={{marginBottom: '5px'}}>🔄 {stats?.recentOrders?.length || '0'} {t('dashboard.recentOrdersLabel')}</li>
                    </ul>
                  </div>
                  
                  <div style={{marginTop: '30px', padding: '20px', background: '#fff8e1', borderRadius: '6px'}}>
                    <h4 style={{color: '#333', marginBottom: '10px'}}>{t('dashboard.adminActions')}</h4>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px'}}>
                      <button 
                        className="btn" 
                        style={{background: activeView === 'orders' ? '#2E7D32' : '#4CAF50', width: 'auto', padding: '10px 16px'}}
                        onClick={() => handleViewChange('orders')}
                      >
                        📋 {t('dashboard.manageOrders')}
                      </button>
                      <button 
                        className="btn" 
                        style={{background: activeView === 'users' ? '#1565C0' : '#2196F3', width: 'auto', padding: '10px 16px'}}
                        onClick={() => handleViewChange('users')}
                      >
                        👥 {t('dashboard.manageUsers')}
                      </button>
                      <button 
                        className="btn" 
                        style={{background: activeView === 'products' ? '#F57C00' : '#FF9800', width: 'auto', padding: '10px 16px'}}
                        onClick={() => handleViewChange('products')}
                      >
                        📦 {t('dashboard.manageProducts')}
                      </button>
                      <button 
                        className="btn" 
                        style={{background: '#9C27B0', width: 'auto', padding: '10px 16px'}}
                        onClick={() => setShowTwoFactor(!showTwoFactor)}
                      >
                        🔐 {t('dashboard.twoFactorAuth')}
                      </button>
                    </div>
                  </div>
                  
                  {showTwoFactor && (
                    <div style={{marginTop: '30px', padding: '20px', background: '#e8f5e8', borderRadius: '6px', border: '2px solid #4CAF50'}}>
                      <h4 style={{color: '#333', marginBottom: '10px'}}>🔐 {t('dashboard.twoFactorAuthentication')}</h4>
                      <p style={{color: '#666', marginBottom: '15px'}}>
                        Status: {admin?.twoFactorEnabled ? 
                          <span style={{color: '#4CAF50', fontWeight: 'bold'}}>✅ {t('common.enabled')}</span> : 
                          <span style={{color: '#f44336', fontWeight: 'bold'}}>❌ {t('common.disabled')}</span>
                        }
                      </p>
                      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                        <button 
                          className="btn" 
                          style={{background: admin?.twoFactorEnabled ? '#f44336' : '#4CAF50', width: 'auto', padding: '8px 16px'}}
                          onClick={() => alert('2FA management functionality will be implemented')}
                        >
                          {admin?.twoFactorEnabled ? `🔓 ${t('dashboard.disable2fa')}` : `🔒 ${t('dashboard.enable2fa')}`}
                        </button>
                        {admin?.twoFactorEnabled && (
                          <button 
                            className="btn" 
                            style={{background: '#FF9800', width: 'auto', padding: '8px 16px'}}
                            onClick={() => alert('Backup codes regeneration will be implemented')}
                          >
                            🔄 Regenerate Backup Codes
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div style={{marginTop: '30px', padding: '20px', background: '#f0f8ff', borderRadius: '6px'}}>
                    <h4 style={{color: '#333', marginBottom: '10px'}}>Recent Activity</h4>
                    {stats?.recentOrders?.length > 0 ? (
                      <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                        {stats.recentOrders.map((order, index) => (
                          <div key={index} style={{
                            padding: '10px',
                            marginBottom: '10px',
                            background: 'white',
                            borderRadius: '4px',
                            borderLeft: '4px solid #2196F3'
                          }}>
                            <div style={{fontWeight: 'bold'}}>Order #{order.id}</div>
                            <div style={{fontSize: '14px', color: '#666'}}>
                              Amount: ${order.totalAmount} | Status: {order.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{color: '#666', fontStyle: 'italic'}}>No recent orders</p>
                    )}
                  </div>
                </div>
              </>
            );
        }
      };

      // Bulk Operations Components
      const BulkStatusComponent = () => {
        const [newStatus, setNewStatus] = useState('');
        const [isProcessing, setIsProcessing] = useState(false);
        
        const handleStatusUpdate = async () => {
          if (!newStatus) {
            alert('Please select a status');
            return;
          }
          
          setIsProcessing(true);
          const result = await performBulkOperation('status', selectedOrders, { status: newStatus });
          
          if (result.success) {
            alert(`Status updated successfully for ${selectedOrders.length} orders`);
            setSelectedOrders([]);
            setShowBulkModal(false);
            setBulkOperation('');
          } else {
            alert('Error: ' + result.message);
          }
          setIsProcessing(false);
        };
        
        return (
          <div>
            <div className="form-group">
              <label className="form-label">Select New Status</label>
              <select
                className="form-input"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="">Choose Status...</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="in_delivery">In Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button
              className="btn"
              style={{background: '#28a745'}}
              onClick={handleStatusUpdate}
              disabled={isProcessing}
            >
              {isProcessing ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        );
      };
      
      const BulkToolsComponent = () => {
        const [selectedTool, setSelectedTool] = useState('');
        const [isProcessing, setIsProcessing] = useState(false);
        const [notificationMessage, setNotificationMessage] = useState('');
        
        const handleToolOperation = async (operation) => {
          setIsProcessing(true);
          let result;
          
          switch (operation) {
            case 'shipping':
              result = await performBulkOperation('shipping', selectedOrders);
              break;
            case 'notifications':
              result = await performBulkOperation('notifications', selectedOrders, { message: notificationMessage });
              break;
            case 'refunds':
              result = await performBulkOperation('refunds', selectedOrders);
              break;
            default:
              result = { success: false, message: 'Invalid operation' };
          }
          
          if (result.success) {
            alert(`${operation} operation completed successfully for ${selectedOrders.length} orders`);
            setSelectedOrders([]);
            setShowBulkModal(false);
            setBulkOperation('');
          } else {
            alert('Error: ' + result.message);
          }
          setIsProcessing(false);
        };
        
        return (
          <div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <button
                className="btn"
                style={{background: '#17a2b8'}}
                onClick={() => handleToolOperation('shipping')}
                disabled={isProcessing}
              >
                📦 Generate Shipping Labels
              </button>
              
              <div>
                <div className="form-group">
                  <label className="form-label">Custom Notification Message</label>
                  <textarea
                    className="form-input"
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    placeholder="Enter custom notification message..."
                    rows="3"
                  />
                </div>
                <button
                  className="btn"
                  style={{background: '#ffc107'}}
                  onClick={() => handleToolOperation('notifications')}
                  disabled={isProcessing}
                >
                  📧 Send Notifications
                </button>
              </div>
              
              <button
                className="btn"
                style={{background: '#dc3545'}}
                onClick={() => {
                  if (confirm('Are you sure you want to process refunds for the selected orders? This action cannot be undone.')) {
                    handleToolOperation('refunds');
                  }
                }}
                disabled={isProcessing}
              >
                💸 Process Refunds
              </button>
            </div>
            
            {isProcessing && (
              <div style={{textAlign: 'center', marginTop: '20px'}}>
                <div className="loading"></div>
                <p>Processing operation...</p>
              </div>
            )}
          </div>
        );
      };
      
      // Product Bulk Operations Component
      const ProductBulkOperationsComponent = () => {
        const [selectedOperation, setSelectedOperation] = useState('');
        const [isProcessing, setIsProcessing] = useState(false);
        const [priceMultiplier, setPriceMultiplier] = useState('');
        const [fixedPrice, setFixedPrice] = useState('');
        const [newCategoryId, setNewCategoryId] = useState('');
        const [newStatus, setNewStatus] = useState('');
        const [stockOperation, setStockOperation] = useState('set');
        const [stockValue, setStockValue] = useState('');

        const operationLabels = {
          'update-prices': t('products.bulkUpdatePrices'),
          'update-categories': t('products.bulkUpdateCategories'),
          'update-status': t('products.bulkUpdateStatus'),
          'update-stock': t('products.bulkUpdateStock'),
          export: t('products.bulkExport'),
          delete: t('products.bulkDelete')
        };

        const handleOperation = async () => {
          if (!selectedOperation) {
            alert(t('products.bulkSelectAction'));
            return;
          }

          let payload = {};
          switch (selectedOperation) {
            case 'update-prices':
              if (!priceMultiplier && !fixedPrice) {
                alert(t('products.bulkPriceRequired'));
                return;
              }
              payload = {
                multiplier: priceMultiplier ? parseFloat(priceMultiplier) : null,
                fixedPrice: fixedPrice ? parseFloat(fixedPrice) : null
              };
              break;
            case 'update-categories':
              if (!newCategoryId) {
                alert(t('products.bulkCategoryRequired'));
                return;
              }
              payload = { categoryId: parseInt(newCategoryId) };
              break;
            case 'update-status':
              if (!newStatus) {
                alert(t('products.bulkStatusRequired'));
                return;
              }
              payload = { status: newStatus };
              break;
            case 'update-stock':
              if (!stockValue) {
                alert(t('products.bulkStockRequired'));
                return;
              }
              payload = {
                operation: stockOperation,
                value: parseInt(stockValue)
              };
              break;
            case 'export':
            case 'delete':
              break;
            default:
              alert(t('products.bulkInvalidAction'));
              return;
          }

          const marketScoped = selectedMarketTab && selectedMarketTab !== 'all';
          const confirmation = selectedOperation === 'delete'
            ? marketScoped
              ? t('products.bulkConfirmDeleteMarket', { count: selectedProducts.length, market: selectedMarketTab.toUpperCase() })
              : t('products.bulkConfirmDeleteAll', { count: selectedProducts.length })
            : t('products.bulkConfirmAction', { action: operationLabels[selectedOperation], count: selectedProducts.length });

          if (!window.confirm(confirmation)) {
            return;
          }

          setIsProcessing(true);
          const result = await performProductBulkOperation(selectedOperation, selectedProducts, payload);

          if (result.success) {
            alert(t('products.bulkSuccess', { action: operationLabels[selectedOperation], count: selectedProducts.length }));
            setSelectedProducts([]);
            setShowProductBulkActions(false);
            setSelectedOperation('');
            // Force refresh of products after bulk operations
            setTimeout(() => {
              fetchProducts();
            }, 1000);
          } else {
            alert('Error: ' + result.message);
          }
          setIsProcessing(false);
        };

        const menuButtonStyle = {
          display: 'block',
          width: '100%',
          padding: '9px 10px',
          border: 'none',
          borderRadius: '4px',
          background: 'transparent',
          color: '#333',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '14px'
        };

        const chooseOperation = (operation) => {
          if (selectedProducts.length === 0) {
            alert(t('products.bulkNoSelection'));
            return;
          }
          setSelectedOperation(operation);
        };

        return (
          <div>
            {!selectedOperation ? (
              <>
                <div style={{padding: '4px 10px 8px', color: '#666', fontSize: '13px', borderBottom: '1px solid #eee', marginBottom: '4px'}}>
                  {selectedProducts.length > 0
                    ? t('products.bulkSelectActionFor', { count: selectedProducts.length })
                    : t('products.bulkNoSelectionHint')}
                </div>
                {[
                  ['update-prices', '💰', operationLabels['update-prices']],
                  ['update-categories', '📁', operationLabels['update-categories']],
                  ['update-status', '🔄', operationLabels['update-status']],
                  ['update-stock', '📦', operationLabels['update-stock']],
                  ['export', '📤', operationLabels.export],
                  ['delete', '🗑️', operationLabels.delete]
                ].map(([operation, icon, label]) => (
                  <button
                    key={operation}
                    type="button"
                    role="menuitem"
                    style={{
                      ...menuButtonStyle,
                      color: operation === 'delete' ? '#b02a37' : '#333'
                    }}
                    onClick={() => chooseOperation(operation)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f3f5'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </>
            ) : (
              <>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '4px 2px 10px', borderBottom: '1px solid #eee', marginBottom: '10px'}}>
                  <strong style={{color: '#333', fontSize: '14px'}}>{operationLabels[selectedOperation]}</strong>
                  <button
                    type="button"
                    onClick={() => setSelectedOperation('')}
                    style={{border: 'none', background: 'transparent', color: '#6c757d', cursor: 'pointer', fontSize: '13px', padding: '2px 4px'}}
                  >
                    ← {t('products.bulkBack')}
                  </button>
                </div>

                {selectedOperation === 'update-prices' && (
                  <div>
                    <div className="form-group">
                      <label className="form-label">{t('products.bulkPriceMultiplierLabel')}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={priceMultiplier}
                        onChange={(e) => setPriceMultiplier(e.target.value)}
                        placeholder={t('products.bulkPriceMultiplierPlaceholder')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('products.bulkFixedPriceLabel')}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={fixedPrice}
                        onChange={(e) => setFixedPrice(e.target.value)}
                        placeholder={t('products.bulkFixedPricePlaceholder')}
                      />
                    </div>
                  </div>
                )}

                {selectedOperation === 'update-categories' && (
                  <div className="form-group">
                    <label className="form-label">{t('products.bulkNewCategory')}</label>
                    <select
                      className="form-input"
                      value={newCategoryId}
                      onChange={(e) => setNewCategoryId(e.target.value)}
                    >
                      <option value="">{t('products.bulkSelectCategory')}</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>{getCategoryName(category)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedOperation === 'update-status' && (
                  <div className="form-group">
                    <label className="form-label">{t('products.bulkNewStatus')}</label>
                    <select
                      className="form-input"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                    >
                      <option value="">{t('products.bulkSelectStatus')}</option>
                      <option value="active">{t('common.active')}</option>
                      <option value="inactive">{t('common.inactive')}</option>
                      <option value="draft">{t('common.draft')}</option>
                      <option value="discontinued">{t('common.discontinued')}</option>
                    </select>
                  </div>
                )}

                {selectedOperation === 'update-stock' && (
                  <div>
                    <div className="form-group">
                      <label className="form-label">{t('products.bulkStockOperation')}</label>
                      <select
                        className="form-input"
                        value={stockOperation}
                        onChange={(e) => setStockOperation(e.target.value)}
                      >
                        <option value="set">{t('products.bulkStockSet')}</option>
                        <option value="add">{t('products.bulkStockAdd')}</option>
                        <option value="subtract">{t('products.bulkStockSubtract')}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('products.bulkStockValue')}</label>
                      <input
                        type="number"
                        className="form-input"
                        value={stockValue}
                        onChange={(e) => setStockValue(e.target.value)}
                        placeholder={t('products.bulkStockValuePlaceholder')}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="btn"
                  style={{background: selectedOperation === 'delete' ? '#dc3545' : '#28a745', width: '100%', marginTop: '6px'}}
                  onClick={handleOperation}
                  disabled={isProcessing}
                >
                  {isProcessing ? t('products.bulkProcessing') : t('products.bulkConfirmExecute')}
                </button>

                {isProcessing && (
                  <div style={{textAlign: 'center', marginTop: '12px'}}>
                    <div className="loading"></div>
                    <p>{t('products.bulkProcessing')}</p>
                  </div>
                )}
              </>
            )}
          </div>
        );
      };
      
      // Market Setting Card — standalone component so React hooks work correctly (not inside .map)
      const MarketSettingCard = ({ market, marketsData, saveMarket }) => {
        const defaults = {
          ro: { label: 'România (.ro)', currency: 'RON', vatPercentage: '19.00', freeShippingThreshold: '500', standardShippingCost: '20', isActive: true },
          fr: { label: 'France (.fr)', currency: 'EUR', vatPercentage: '20.00', freeShippingThreshold: '150', standardShippingCost: '10', isActive: false },
          com: { label: 'International (.com)', currency: 'EUR', vatPercentage: '0.00', freeShippingThreshold: '200', standardShippingCost: '15', isActive: false },
        }[market];
        const serverVals = marketsData[market];
        const [local, setLocal] = useState(serverVals || defaults);
        const flag = market === 'ro' ? '🇷🇴' : market === 'fr' ? '🇫🇷' : '🌐';

        useEffect(() => {
          if (serverVals) setLocal(serverVals);
        }, [JSON.stringify(serverVals)]);

        const set = (field, val) => setLocal(prev => ({...prev, [field]: val}));

        return (
          <div style={{background: '#f8f9fa', borderRadius: '8px', padding: '24px', marginBottom: '20px', border: '1px solid #dee2e6'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
              <h4 style={{margin: 0, color: '#333'}}>{flag} {local.label || defaults.label}</h4>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <label style={{fontSize: '14px', color: '#555', fontWeight: '600'}}>Activ:</label>
                <input type="checkbox" checked={local.isActive || false} onChange={e => set('isActive', e.target.checked)} style={{width: '18px', height: '18px', cursor: 'pointer'}} />
              </div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px'}}>
              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#495057'}}>Monedă</label>
                <input type="text" value={local.currency || ''} onChange={e => set('currency', e.target.value)} placeholder="RON / EUR" style={{width: '100%', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'}} />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#495057'}}>TVA %</label>
                <input type="number" step="0.01" min="0" max="100" value={local.vatPercentage || ''} onChange={e => set('vatPercentage', e.target.value)} placeholder="19.00" style={{width: '100%', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'}} />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#495057'}}>Prag transport gratuit</label>
                <input type="number" step="0.01" min="0" value={local.freeShippingThreshold || ''} onChange={e => set('freeShippingThreshold', e.target.value)} placeholder="500.00" style={{width: '100%', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'}} />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#495057'}}>Cost transport standard</label>
                <input type="number" step="0.01" min="0" value={local.standardShippingCost || ''} onChange={e => set('standardShippingCost', e.target.value)} placeholder="20.00" style={{width: '100%', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'}} />
              </div>
            </div>
            <div style={{marginTop: '16px', display: 'flex', justifyContent: 'flex-end'}}>
              <button
                onClick={() => saveMarket(market, {
                  currency: local.currency, vatPercentage: local.vatPercentage,
                  freeShippingThreshold: local.freeShippingThreshold,
                  standardShippingCost: local.standardShippingCost,
                  isActive: local.isActive, label: local.label || defaults.label
                })}
                style={{background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: '600'}}
              >
                💾 Salvează {flag}
              </button>
            </div>
          </div>
        );
      };

      // Shared styles for invoice modals
      const _inputSt = {width:'100%',padding:'7px 10px',border:'1px solid #ced4da',borderRadius:'6px',fontSize:'13px',boxSizing:'border-box'};
      const _labelSt = {display:'block',marginBottom:'4px',fontSize:'12px',fontWeight:'600',color:'#495057'};

      // ManualInvoiceModal — create invoice or pro-forma from scratch
      const ManualInvoiceModal = ({ onClose, onCreated }) => {
        const defaultItem = () => ({ desc: '', qty: 1, unitPrice: 0, vatRate: market === 'ro' ? 19 : 20, lineTotal: 0 });
        const initMarket = !adminIsSuperAdmin && admin?.adminMarkets?.length > 0
          ? admin.adminMarkets[0]
          : (selectedMarketTab !== 'all' ? selectedMarketTab : 'fr');
        const [type, setType] = useState('invoice');
        const [market, setMarket] = useState(initMarket);
        const [currency, setCurrency] = useState(initMarket === 'ro' ? 'RON' : 'EUR');
        const [buyer, setBuyer] = useState({ name:'', company:'', address:'', city:'', zip:'', country: initMarket === 'ro' ? 'România' : initMarket === 'fr' ? 'France' : '', email:'', vat:'' });
        const [items, setItems] = useState([{ desc:'', qty:1, unitPrice:0, vatRate: initMarket === 'ro' ? 19 : 20 }]);
        const [dueDate, setDueDate] = useState('');
        const [paymentMethod, setPaymentMethod] = useState('wire_transfer');
        const [notes, setNotes] = useState('');
        const [creating, setCreating] = useState(false);

        const setBuyerField = (k, v) => setBuyer(b => ({...b, [k]: v}));
        const setItemField = (i, k, v) => setItems(prev => {
          const upd = prev.map((it, idx) => idx === i ? {...it, [k]: v} : it);
          return upd;
        });

        const getLineTotal = (it) => parseFloat(it.qty || 0) * parseFloat(it.unitPrice || 0);
        const subtotal = items.reduce((s, it) => s + getLineTotal(it), 0);
        const vatAmount = items.reduce((s, it) => s + getLineTotal(it) * (parseFloat(it.vatRate || 0) / 100), 0);
        const totalAmount = subtotal + vatAmount;

        const marketOptions = adminIsSuperAdmin ? ['ro','fr','com'] : (admin?.adminMarkets || []);

        const submit = async () => {
          if (!buyer.name.trim()) { alert('Completați numele clientului'); return; }
          if (!buyer.email.trim()) { alert('Completați email-ul clientului'); return; }
          if (items.some(it => !it.desc.trim() || parseFloat(it.qty) <= 0)) { alert('Completați toate liniile (descriere + cantitate)'); return; }
          setCreating(true);
          try {
            const resp = await fetch('/admin/api/invoices/manual', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type, market, currency,
                buyer: { name: buyer.name, companyName: buyer.company, address: buyer.address, city: buyer.city, zipCode: buyer.zip, country: buyer.country, email: buyer.email, vatNumber: buyer.vat },
                items: items.map(it => ({ productName: it.desc, quantity: parseFloat(it.qty), unitPrice: parseFloat(it.unitPrice), vatRate: parseFloat(it.vatRate || 0) })),
                dueDate: dueDate || null, paymentMethod, notes
              })
            });
            const data = await resp.json();
            if (resp.ok) {
              fetchInvoices();
              onCreated && onCreated(data);
              onClose();
              alert(`✅ ${type === 'proforma' ? 'Proformă' : 'Factură'} ${data.invoiceNumber} creată cu succes!\nPoți descărca PDF-ul sau trimite pe email din listă.`);
            } else {
              alert('❌ Eroare: ' + (data.message || 'Necunoscută'));
            }
          } catch(e) { alert('❌ Eroare rețea: ' + e.message); }
          setCreating(false);
        };

        return (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:9500,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'30px',overflowY:'auto'}}
            onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
            <div style={{background:'white',borderRadius:'8px',width:'820px',maxWidth:'96vw',boxShadow:'0 8px 40px rgba(0,0,0,0.28)',marginBottom:'40px'}}>
              {/* Header */}
              <div style={{background:'#1a4f8a',color:'white',padding:'18px 24px',borderRadius:'8px 8px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{margin:0,fontSize:'17px'}}>🧾 Emitere Factură / Proformă</h3>
                <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',borderRadius:'4px',padding:'4px 12px',cursor:'pointer',fontSize:'16px'}}>✕</button>
              </div>
              <div style={{padding:'24px'}}>
                {/* Type toggle */}
                <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
                  {[['invoice','📄 Factură (Invoice)'],['proforma','📝 Proformă (Devis)']].map(([v,l]) => (
                    <button key={v} onClick={() => setType(v)}
                      style={{padding:'8px 22px',borderRadius:'6px',border:type===v?'2px solid #1a4f8a':'1px solid #ced4da',background:type===v?'#1a4f8a':'white',color:type===v?'white':'#333',cursor:'pointer',fontWeight:type===v?'600':'400',fontSize:'14px'}}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Market + Currency */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
                  <div>
                    <label style={_labelSt}>Marketplace *</label>
                    <select value={market} onChange={e => { setMarket(e.target.value); setCurrency(e.target.value==='ro'?'RON':'EUR'); }} style={_inputSt}>
                      {marketOptions.map(m => (
                        <option key={m} value={m}>{m==='ro'?'🇷🇴 România (.ro)':m==='fr'?'🇫🇷 France (.fr)':'🌍 International (.com)'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={_labelSt}>Monedă</label>
                    <input type="text" value={currency} onChange={e => setCurrency(e.target.value)} style={_inputSt} placeholder="EUR / RON" />
                  </div>
                </div>

                {/* Buyer */}
                <div style={{background:'#f8f9fa',borderRadius:'6px',padding:'16px',marginBottom:'20px',border:'1px solid #dee2e6'}}>
                  <h4 style={{margin:'0 0 12px',color:'#333',fontSize:'14px'}}>👤 Client / Destinataire</h4>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                    <div><label style={_labelSt}>Nume *</label><input style={_inputSt} value={buyer.name} onChange={e=>setBuyerField('name',e.target.value)} placeholder="Jean Dupont" /></div>
                    <div><label style={_labelSt}>Societate / Société</label><input style={_inputSt} value={buyer.company} onChange={e=>setBuyerField('company',e.target.value)} placeholder="SARL Example" /></div>
                    <div><label style={_labelSt}>Email *</label><input type="email" style={_inputSt} value={buyer.email} onChange={e=>setBuyerField('email',e.target.value)} placeholder="client@example.com" /></div>
                    <div><label style={_labelSt}>TVA / SIRET / CUI</label><input style={_inputSt} value={buyer.vat} onChange={e=>setBuyerField('vat',e.target.value)} placeholder="FR 12 345678901" /></div>
                    <div><label style={_labelSt}>Adresă</label><input style={_inputSt} value={buyer.address} onChange={e=>setBuyerField('address',e.target.value)} placeholder="12 Rue de la Paix" /></div>
                    <div style={{display:'grid',gridTemplateColumns:'90px 1fr',gap:'8px'}}>
                      <div><label style={_labelSt}>Cod poștal</label><input style={_inputSt} value={buyer.zip} onChange={e=>setBuyerField('zip',e.target.value)} placeholder="75001" /></div>
                      <div><label style={_labelSt}>Oraș / Ville</label><input style={_inputSt} value={buyer.city} onChange={e=>setBuyerField('city',e.target.value)} placeholder="Paris" /></div>
                    </div>
                    <div><label style={_labelSt}>Țară / Pays</label><input style={_inputSt} value={buyer.country} onChange={e=>setBuyerField('country',e.target.value)} placeholder="France" /></div>
                  </div>
                </div>

                {/* Line items */}
                <div style={{marginBottom:'20px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                    <h4 style={{margin:0,color:'#333',fontSize:'14px'}}>📋 Articole / Lignes</h4>
                    <button onClick={() => setItems(prev => [...prev, {desc:'',qty:1,unitPrice:0,vatRate:market==='ro'?19:20}])}
                      style={{background:'#28a745',color:'white',border:'none',borderRadius:'4px',padding:'5px 14px',cursor:'pointer',fontSize:'13px'}}>+ Adaugă linie</button>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
                    <thead>
                      <tr style={{background:'#1a4f8a',color:'white'}}>
                        <th style={{padding:'8px 10px',textAlign:'left'}}>Descriere *</th>
                        <th style={{padding:'8px',textAlign:'right',width:'55px'}}>Qty</th>
                        <th style={{padding:'8px',textAlign:'right',width:'110px'}}>P.U. HT</th>
                        <th style={{padding:'8px',textAlign:'right',width:'70px'}}>TVA%</th>
                        <th style={{padding:'8px',textAlign:'right',width:'110px'}}>Total HT</th>
                        <th style={{padding:'8px',width:'28px'}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} style={{borderBottom:'1px solid #dee2e6',background:i%2===0?'white':'#f8f9fa'}}>
                          <td style={{padding:'4px 6px'}}><input style={{..._inputSt,margin:0}} value={item.desc} onChange={e=>setItemField(i,'desc',e.target.value)} placeholder="Produit / Serviciu" /></td>
                          <td style={{padding:'4px 6px'}}><input type="number" min="0.01" step="0.01" style={{..._inputSt,margin:0,textAlign:'right'}} value={item.qty} onChange={e=>setItemField(i,'qty',e.target.value)} /></td>
                          <td style={{padding:'4px 6px'}}><input type="number" min="0" step="0.01" style={{..._inputSt,margin:0,textAlign:'right'}} value={item.unitPrice} onChange={e=>setItemField(i,'unitPrice',e.target.value)} /></td>
                          <td style={{padding:'4px 6px'}}><input type="number" min="0" max="100" step="0.01" style={{..._inputSt,margin:0,textAlign:'right'}} value={item.vatRate} onChange={e=>setItemField(i,'vatRate',e.target.value)} /></td>
                          <td style={{padding:'4px 8px',textAlign:'right',fontWeight:'600'}}>{getLineTotal(item).toFixed(2)}</td>
                          <td style={{padding:'4px 6px',textAlign:'center'}}>
                            {items.length > 1 && <button onClick={() => setItems(prev => prev.filter((_,j)=>j!==i))} style={{background:'#dc3545',color:'white',border:'none',borderRadius:'3px',padding:'2px 6px',cursor:'pointer',fontSize:'11px'}}>✕</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Totals */}
                  <div style={{display:'flex',justifyContent:'flex-end',marginTop:'12px'}}>
                    <div style={{minWidth:'290px',background:'#f0f8ff',border:'1px solid #bee5eb',borderRadius:'6px',padding:'14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px',fontSize:'13px',color:'#555'}}>
                        <span>Sous-total HT:</span><strong>{subtotal.toFixed(2)} {currency}</strong>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px',fontSize:'13px',color:'#555'}}>
                        <span>TVA:</span><strong>{vatAmount.toFixed(2)} {currency}</strong>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',borderTop:'2px solid #1a4f8a',paddingTop:'8px',fontSize:'15px'}}>
                        <strong>TOTAL TTC:</strong><strong style={{color:'#1a4f8a'}}>{totalAmount.toFixed(2)} {currency}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer fields */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:'16px',marginBottom:'20px'}}>
                  <div>
                    <label style={_labelSt}>Scadență / Échéance</label>
                    <input type="date" style={_inputSt} value={dueDate} onChange={e=>setDueDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={_labelSt}>Mod plată</label>
                    <select style={_inputSt} value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
                      <option value="wire_transfer">Virement / Transfer bancar</option>
                      <option value="card">Carte / Card</option>
                      <option value="cash">Espèces / Numerar</option>
                      <option value="cash_on_delivery">Ramburs / COD</option>
                    </select>
                  </div>
                  <div>
                    <label style={_labelSt}>Note / Mentions</label>
                    <input style={_inputSt} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Mențiuni legale, bancă..." />
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:'flex',justifyContent:'flex-end',gap:'12px',borderTop:'1px solid #dee2e6',paddingTop:'16px'}}>
                  <button onClick={onClose} style={{background:'#6c757d',color:'white',border:'none',borderRadius:'6px',padding:'10px 24px',cursor:'pointer',fontSize:'14px'}}>Anulează</button>
                  <button onClick={submit} disabled={creating}
                    style={{background:creating?'#6c757d':'#1a4f8a',color:'white',border:'none',borderRadius:'6px',padding:'10px 26px',cursor:creating?'not-allowed':'pointer',fontSize:'14px',fontWeight:'600'}}>
                    {creating ? '⏳ Se creează...' : `✅ Emite ${type==='proforma'?'Proformă':'Factură'}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      };

      // SendInvoiceEmailModal — send existing invoice PDF to an email address
      const SendInvoiceEmailModal = ({ invoice, onClose }) => {
        const [email, setEmail] = useState(invoice.userEmail || '');
        const [message, setMessage] = useState(
          `Bonjour,\n\nVeuillez trouver en pièce jointe votre document N° ${invoice.invoiceNumber}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,`
        );
        const [sending, setSending] = useState(false);

        const send = async () => {
          if (!email.trim()) { alert('Introduceți adresa de email'); return; }
          setSending(true);
          try {
            const resp = await fetch(`/admin/api/invoices/${invoice.id}/send-email`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, message })
            });
            const data = await resp.json();
            if (resp.ok) {
              alert(`✅ Email trimis cu succes la ${email}`);
              onClose();
            } else {
              alert('❌ Eroare: ' + (data.message || 'Necunoscută'));
            }
          } catch(e) { alert('❌ Eroare rețea: ' + e.message); }
          setSending(false);
        };

        return (
          <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:9500,display:'flex',alignItems:'center',justifyContent:'center'}}
            onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
            <div style={{background:'white',borderRadius:'8px',width:'520px',maxWidth:'95vw',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
              <div style={{background:'#0066cc',color:'white',padding:'16px 22px',borderRadius:'8px 8px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{margin:0,fontSize:'15px'}}>✉️ Trimite pe email — {invoice.invoiceNumber}</h3>
                <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',borderRadius:'4px',padding:'4px 10px',cursor:'pointer',fontSize:'15px'}}>✕</button>
              </div>
              <div style={{padding:'20px'}}>
                <div style={{marginBottom:'14px'}}>
                  <label style={_labelSt}>Adresă email destinatar *</label>
                  <input type="email" style={_inputSt} value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@example.com" />
                </div>
                <div style={{marginBottom:'14px'}}>
                  <label style={_labelSt}>Mesaj / Message</label>
                  <textarea style={{..._inputSt,height:'130px',resize:'vertical'}} value={message} onChange={e=>setMessage(e.target.value)} />
                </div>
                <div style={{background:'#e8f4f8',borderRadius:'4px',padding:'10px',fontSize:'12px',color:'#0066cc',marginBottom:'16px'}}>
                  📎 Documentul <strong>{invoice.invoiceNumber}</strong> va fi atașat automat ca PDF.
                </div>
                <div style={{display:'flex',justifyContent:'flex-end',gap:'10px'}}>
                  <button onClick={onClose} style={{background:'#6c757d',color:'white',border:'none',borderRadius:'6px',padding:'9px 20px',cursor:'pointer',fontSize:'13px'}}>Anulează</button>
                  <button onClick={send} disabled={sending}
                    style={{background:sending?'#6c757d':'#0066cc',color:'white',border:'none',borderRadius:'6px',padding:'9px 22px',cursor:sending?'not-allowed':'pointer',fontSize:'13px',fontWeight:'600'}}>
                    {sending ? '⏳ Se trimite...' : '📧 Trimite email'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      };

      // Market Prices Section — shown in product edit modal for per-market price overrides
      const MarketPricesSection = ({ editingProduct, editingProductMarkets, token, fetchProductMarkets }) => {
        const emptyRow = () => ({ isActive: true, price: '', compareAtPrice: '' });
        const [local, setLocal] = useState({ ro: emptyRow(), fr: emptyRow(), com: emptyRow() });

        useEffect(() => {
          setLocal({
            ro: editingProductMarkets?.ro ? { isActive: editingProductMarkets.ro.isActive, price: editingProductMarkets.ro.price || '', compareAtPrice: editingProductMarkets.ro.compareAtPrice || '' } : emptyRow(),
            fr: editingProductMarkets?.fr ? { isActive: editingProductMarkets.fr.isActive, price: editingProductMarkets.fr.price || '', compareAtPrice: editingProductMarkets.fr.compareAtPrice || '' } : emptyRow(),
            com: editingProductMarkets?.com ? { isActive: editingProductMarkets.com.isActive, price: editingProductMarkets.com.price || '', compareAtPrice: editingProductMarkets.com.compareAtPrice || '' } : emptyRow(),
          });
        }, [editingProductMarkets]);

        const setField = (market, field, val) => setLocal(prev => ({...prev, [market]: {...prev[market], [field]: val}}));

        const save = async () => {
          try {
            const markets = ['ro', 'fr', 'com'].map(m => ({
              market: m,
              isActive: local[m].isActive,
              price: local[m].price || null,
              compareAtPrice: local[m].compareAtPrice || null,
            }));
            const res = await fetch(`/admin/api/products/${editingProduct.id}/markets/bulk`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ markets })
            });
            if (res.ok) {
              alert('✅ Prețuri per piață salvate!');
              fetchProductMarkets();
            } else {
              alert('❌ Eroare la salvare');
            }
          } catch (err) {
            alert('❌ Eroare: ' + err.message);
          }
        };

        const rows = [
          { market: 'ro', flag: '🇷🇴', label: 'România (.ro)', currency: 'RON' },
          { market: 'fr', flag: '🇫🇷', label: 'France (.fr)', currency: 'EUR' },
          { market: 'com', flag: '🌐', label: 'International (.com)', currency: 'EUR' },
        ];

        return (
          <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#fff8e1', borderRadius: '6px', border: '1px solid #ffe082'}}>
            <h5 style={{color: '#333', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              🌍 Prețuri per Piață
            </h5>
            <div style={{overflowX: 'auto'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                <thead>
                  <tr style={{backgroundColor: '#fff3cd'}}>
                    <th style={{padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ffe082'}}>Piață</th>
                    <th style={{padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #ffe082'}}>Activ</th>
                    <th style={{padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ffe082'}}>Preț override</th>
                    <th style={{padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #ffe082'}}>Preț vechi (barát)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ market, flag, label, currency }) => (
                    <tr key={market} style={{borderBottom: '1px solid #ffe082'}}>
                      <td style={{padding: '8px 10px', fontWeight: '600'}}>{flag} {label}</td>
                      <td style={{padding: '8px 10px', textAlign: 'center'}}>
                        <input
                          type="checkbox"
                          checked={local[market].isActive || false}
                          onChange={e => setField(market, 'isActive', e.target.checked)}
                          style={{width: '16px', height: '16px', cursor: 'pointer'}}
                        />
                      </td>
                      <td style={{padding: '8px 10px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={local[market].price}
                            onChange={e => setField(market, 'price', e.target.value)}
                            placeholder="(preț implicit)"
                            style={{width: '120px', padding: '5px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                          />
                          <span style={{color: '#666', fontSize: '12px'}}>{currency}</span>
                        </div>
                      </td>
                      <td style={{padding: '8px 10px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={local[market].compareAtPrice}
                            onChange={e => setField(market, 'compareAtPrice', e.target.value)}
                            placeholder="(opțional)"
                            style={{width: '120px', padding: '5px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                          />
                          <span style={{color: '#666', fontSize: '12px'}}>{currency}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{marginTop: '10px', display: 'flex', justifyContent: 'flex-end'}}>
              <button
                onClick={save}
                style={{background: '#ff8f00', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: '600'}}
              >
                💾 Salvează prețuri piețe
              </button>
            </div>
            <div style={{marginTop: '6px', fontSize: '11px', color: '#795548'}}>
              Lasă prețul gol pentru a folosi prețul implicit al produsului. Bifează „Activ" pentru ca produsul să fie vizibil pe piața respectivă.
            </div>
          </div>
        );
      };

      // ─── Add Order Modal — creare comandă manuală din admin ─────────────────
      const AddOrderModal = () => {
        const initialMarket = (marketFilter && marketFilter !== 'all') ? marketFilter : 'ro';
        const [aoMarket, setAoMarket] = useState(initialMarket);
        const [aoProducts, setAoProducts] = useState([]);
        const [aoShipping, setAoShipping] = useState({ freeShippingThreshold: 500, standardShippingCost: 25 });
        const [aoCustomShipping, setAoCustomShipping] = useState(undefined); // undefined = folosește regula site-ului
        const [aoLoading, setAoLoading] = useState(false);
        const [aoSubmitting, setAoSubmitting] = useState(false);
        const [aoItems, setAoItems] = useState([{ productId: '', quantity: 1 }]);
        const defaultCountry = initialMarket === 'fr' ? 'France' : (initialMarket === 'com' ? '' : 'Romania');
        const [aoCustomer, setAoCustomer] = useState({
          firstName: '', lastName: '', email: '', phone: '',
          streetAddress: '', city: '', state: '', zipCode: '', country: defaultCountry
        });
        const [aoIsCompany, setAoIsCompany] = useState(false);
        const [aoCompany, setAoCompany] = useState({ companyName: '', vatNumber: '', registrationNumber: '' });
        const [aoPaymentMethod, setAoPaymentMethod] = useState('cash_on_delivery');
        const [aoNotes, setAoNotes] = useState('');

        useEffect(() => {
          let cancelled = false;
          (async () => {
            setAoLoading(true);
            try {
              const resp = await fetch(`/admin/api/orders/product-options?market=${aoMarket}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const data = await resp.json();
              if (!cancelled && resp.ok) {
                if (Array.isArray(data)) { setAoProducts(data); }
                else if (data && Array.isArray(data.products)) {
                  setAoProducts(data.products);
                  if (data.shipping) setAoShipping(data.shipping);
                }
              }
            } catch (e) { console.error('AddOrder products fetch failed:', e); }
            if (!cancelled) setAoLoading(false);
          })();
          return () => { cancelled = true; };
        }, [aoMarket]);

        const getProduct = (pid) => aoProducts.find(p => String(p.id) === String(pid));

        const computeUnitPrice = (product, qty) => {
          if (!product) return 0;
          let price = parseFloat(product.price) || 0;
          const tiers = Array.isArray(product.volumeDiscounts) ? product.volumeDiscounts : [];
          let pct = 0;
          for (const t of tiers) {
            if (t && t.minQty > 0 && t.discountPercent > 0 && qty >= t.minQty) pct = t.discountPercent;
          }
          return pct > 0 ? parseFloat((price * (1 - pct / 100)).toFixed(2)) : price;
        };

        const currency = (aoProducts[0] && aoProducts[0].currency) || (aoMarket === 'ro' ? 'RON' : 'EUR');
        const subtotal = aoItems.reduce((sum, it) => {
          const p = getProduct(it.productId);
          const q = parseInt(it.quantity) || 0;
          if (!p || q <= 0) return sum;
          const unit = (it.customPrice !== undefined && it.customPrice !== '') ? (parseFloat(it.customPrice) || 0) : computeUnitPrice(p, q);
          return sum + unit * q;
        }, 0);

        const updateItem = (idx, field, value) => {
          setAoItems(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
        };

        const submit = async () => {
          const validItems = aoItems.filter(it => it.productId && (parseInt(it.quantity) || 0) > 0);
          if (validItems.length === 0) { alert('Adaugă cel puțin un produs.'); return; }
          for (const it of validItems) {
            if (it.customPrice !== undefined && it.customPrice !== '' && (isNaN(parseFloat(it.customPrice)) || parseFloat(parseFloat(it.customPrice).toFixed(2)) <= 0)) {
              alert('Preț unitar invalid — trebuie să fie un număr pozitiv.'); return;
            }
          }
          if (aoCustomShipping !== undefined && aoCustomShipping !== '' && (isNaN(parseFloat(aoCustomShipping)) || parseFloat(aoCustomShipping) < 0)) {
            alert('Cost transport invalid — trebuie să fie 0 sau un număr pozitiv.'); return;
          }
          if (!aoCustomer.firstName || !aoCustomer.lastName) { alert('Numele și prenumele sunt obligatorii.'); return; }
          if (!aoCustomer.email) { alert('Emailul clientului este obligatoriu.'); return; }
          if (!aoCustomer.phone) { alert('Telefonul este obligatoriu (necesar pentru AWB).'); return; }
          if (!aoCustomer.streetAddress) { alert('Adresa este obligatorie (necesară pentru AWB și factură).'); return; }
          if (!aoCustomer.city) { alert('Orașul este obligatoriu (necesar pentru AWB și factură).'); return; }
          if (!aoCustomer.state) { alert('Județul este obligatoriu (necesar pentru AWB și factură).'); return; }
          if (aoMarket === 'ro' && aoCustomer.zipCode && !/^\d{6}$/.test(aoCustomer.zipCode.replace(/\s/g, ''))) {
            if (!confirm('Codul poștal nu are 6 cifre — Sameday îl va ignora. Continui?')) return;
          }
          if (aoIsCompany && !aoCompany.companyName) { alert('Numele firmei este obligatoriu pentru comandă B2B.'); return; }
          setAoSubmitting(true);
          try {
            const resp = await fetch('/admin/api/orders/create-manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify((() => {
                // Aliases: AWB reads streetAddress/state, Smartbill invoice reads address/county
                const addr = {
                  ...aoCustomer,
                  address: aoCustomer.streetAddress,
                  county: aoCustomer.state
                };
                const billing = aoIsCompany
                  ? { ...addr, clientType: 'company', companyName: aoCompany.companyName, vatNumber: aoCompany.vatNumber, registrationNumber: aoCompany.registrationNumber }
                  : { ...addr, clientType: 'individual' };
                return {
                  market: aoMarket,
                  items: validItems.map(it => {
                    const item = { productId: parseInt(it.productId), quantity: parseInt(it.quantity) };
                    if (it.customPrice !== undefined && it.customPrice !== '') {
                      const p = getProduct(it.productId);
                      const siteUnit = p ? computeUnitPrice(p, parseInt(it.quantity) || 0) : null;
                      const cp = parseFloat(it.customPrice);
                      if (!isNaN(cp) && cp > 0 && cp !== siteUnit) item.customPrice = cp;
                    }
                    return item;
                  }),
                  shippingAddress: aoIsCompany ? { ...addr, companyName: aoCompany.companyName } : addr,
                  billingAddress: billing,
                  paymentMethod: aoPaymentMethod,
                  email: aoCustomer.email,
                  phone: aoCustomer.phone,
                  notes: aoNotes,
                  ...(aoCustomShipping !== undefined && aoCustomShipping !== '' ? { customShippingCost: parseFloat(aoCustomShipping) } : {})
                };
              })())
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
              alert('✅ ' + data.message);
              setShowAddOrderModal(false);
              fetchOrders();
            } else {
              alert('❌ ' + (data.message || 'Eroare la crearea comenzii'));
            }
          } catch (e) {
            alert('❌ Eroare de rețea: ' + e.message);
          }
          setAoSubmitting(false);
        };

        const inputStyle = { width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' };
        const labelStyle = { fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '3px', display: 'block' };

        return (
          <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{background: 'white', borderRadius: '8px', width: '90%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', padding: '24px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3 style={{margin: 0, color: '#333'}}>➕ Comandă nouă (manuală)</h3>
                <button onClick={() => setShowAddOrderModal(false)} style={{border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer', color: '#888'}}>×</button>
              </div>

              <div style={{display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', padding: '10px', background: '#f8f9fa', borderRadius: '6px'}}>
                <span style={{fontSize: '13px', fontWeight: 'bold'}}>Piață:</span>
                <select value={aoMarket} onChange={e => { const m = e.target.value; setAoMarket(m); setAoItems([{ productId: '', quantity: 1 }]); setAoCustomShipping(undefined); setAoCustomer(c => ({...c, country: m === 'fr' ? 'France' : (m === 'com' ? c.country : 'Romania')})); }} style={{padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px'}}>
                  <option value="ro">🇷🇴 RO (RON)</option>
                  <option value="com">🌍 COM (EUR)</option>
                  <option value="fr">🇫🇷 FR (EUR)</option>
                </select>
                {marketFilter !== 'all' && <span style={{fontSize: '11px', color: '#888'}}>(preluat din tab-ul de comenzi)</span>}
              </div>

              <h4 style={{margin: '0 0 8px 0', fontSize: '14px', color: '#333'}}>🛒 Produse {aoLoading ? '(se încarcă...)' : ''}</h4>
              {aoItems.map((it, idx) => {
                const p = getProduct(it.productId);
                const q = parseInt(it.quantity) || 0;
                const unit = p ? computeUnitPrice(p, q) : 0;
                const base = p ? parseFloat(p.price) : 0;
                return (
                  <div key={idx} style={{display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px'}}>
                    <div style={{flex: 3, position: 'relative'}}>
                      <input
                        style={{...inputStyle, width: '100%'}}
                        placeholder="Caută produs..."
                        value={it.search !== undefined ? it.search : (p ? `${p.name} — ${parseFloat(p.price).toFixed(2)} ${currency}` : '')}
                        onChange={e => setAoItems(items => items.map((x, i) => i === idx ? { ...x, search: e.target.value, productId: '', customPrice: undefined, open: true } : x))}
                        onFocus={() => setAoItems(items => items.map((x, i) => i === idx ? { ...x, open: true, search: x.productId ? '' : (x.search || '') } : x))}
                        onBlur={() => setTimeout(() => setAoItems(items => items.map((x, i) => i === idx ? { ...x, open: false, search: undefined } : x)), 200)}
                      />
                      {it.open && (
                        <div style={{position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '4px', maxHeight: '220px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'}}>
                          {aoProducts
                            .filter(pr => !it.search || pr.name.toLowerCase().includes(it.search.toLowerCase()))
                            .map(pr => (
                              <div
                                key={pr.id}
                                onMouseDown={() => setAoItems(items => items.map((x, i) => i === idx ? { ...x, productId: String(pr.id), customPrice: undefined, search: undefined, open: false } : x))}
                                style={{padding: '8px 10px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f0f0f0'}}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0f8f0'}
                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                              >
                                {pr.name} — <b>{parseFloat(pr.price).toFixed(2)} {currency}</b>
                              </div>
                            ))}
                          {aoProducts.filter(pr => !it.search || pr.name.toLowerCase().includes(it.search.toLowerCase())).length === 0 && (
                            <div style={{padding: '8px 10px', color: '#888', fontSize: '13px'}}>Niciun produs găsit</div>
                          )}
                        </div>
                      )}
                    </div>
                    <input type="number" min="1" max="9999" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{...inputStyle, flex: 1, maxWidth: '70px'}} title="Cantitate" />
                    <div style={{flex: 1, maxWidth: '110px', position: 'relative'}}>
                      <input
                        type="number" step="0.01" min="0.01"
                        value={it.customPrice !== undefined ? it.customPrice : (p ? unit : '')}
                        onChange={e => updateItem(idx, 'customPrice', e.target.value)}
                        disabled={!p}
                        title="Preț unitar (modificabil)"
                        style={{...inputStyle, width: '100%', background: it.customPrice !== undefined && parseFloat(it.customPrice) !== unit ? '#fff8e6' : 'white', borderColor: it.customPrice !== undefined && parseFloat(it.customPrice) !== unit ? '#f0ad4e' : '#ddd'}}
                      />
                    </div>
                    {it.customPrice !== undefined && p && parseFloat(it.customPrice) !== unit && (
                      <button onClick={() => setAoItems(items => items.map((x, i) => i === idx ? { ...x, customPrice: undefined } : x))} title={`Revino la prețul site-ului (${unit.toFixed(2)})`} style={{border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px'}}>↺</button>
                    )}
                    <span style={{flex: 2, fontSize: '13px', whiteSpace: 'nowrap'}}>
                      {p && q > 0 ? (() => {
                        const effUnit = it.customPrice !== undefined && it.customPrice !== '' ? (parseFloat(it.customPrice) || 0) : unit;
                        const overridden = it.customPrice !== undefined && parseFloat(it.customPrice) !== unit;
                        return (
                          <>
                            {overridden
                              ? <><s style={{color: '#999'}}>{(unit * q).toFixed(2)}</s> <b style={{color: '#f0ad4e'}}>{(effUnit * q).toFixed(2)} {currency}</b> <span style={{fontSize: '11px', color: '#f0ad4e'}}>(preț modificat)</span></>
                              : (unit < base
                                ? <><s style={{color: '#999'}}>{(base * q).toFixed(2)}</s> <b style={{color: '#28a745'}}>{(effUnit * q).toFixed(2)} {currency}</b> <span style={{fontSize: '11px', color: '#28a745'}}>(discount volum)</span></>
                                : <b>{(effUnit * q).toFixed(2)} {currency}</b>)}
                          </>
                        );
                      })() : '—'}
                    </span>
                    <button onClick={() => setAoItems(items => items.filter((_, i) => i !== idx))} disabled={aoItems.length === 1} style={{border: 'none', background: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '16px'}}>🗑</button>
                  </div>
                );
              })}
              <button onClick={() => setAoItems(items => [...items, { productId: '', quantity: 1 }])} style={{marginBottom: '16px', padding: '6px 12px', border: '1px dashed #28a745', background: 'none', color: '#28a745', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'}}>+ Adaugă produs</button>

              {(() => {
                const siteShipping = subtotal > aoShipping.freeShippingThreshold ? 0 : aoShipping.standardShippingCost;
                const shippingOverridden = aoCustomShipping !== undefined && aoCustomShipping !== '' && parseFloat(aoCustomShipping) !== siteShipping;
                const shippingCost = (aoCustomShipping !== undefined && aoCustomShipping !== '') ? (parseFloat(aoCustomShipping) || 0) : siteShipping;
                const total = subtotal + (subtotal > 0 ? shippingCost : 0);
                return (
                  <div style={{padding: '12px 14px', background: '#f0f8f0', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', border: '1px solid #d4edda'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                      <span>Subtotal produse:</span><b>{subtotal.toFixed(2)} {currency}</b>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px'}}>
                      <span>Transport <span style={{color: '#888', fontSize: '11px'}}>(site: {subtotal > 0 ? (siteShipping === 0 ? 'gratuit' : siteShipping.toFixed(2) + ' ' + currency) : '—'}, gratuit peste {aoShipping.freeShippingThreshold.toFixed(0)} {currency})</span></span>
                      <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <input
                          type="number" step="0.01" min="0"
                          value={aoCustomShipping !== undefined ? aoCustomShipping : siteShipping}
                          onChange={e => setAoCustomShipping(e.target.value)}
                          style={{width: '90px', padding: '5px 8px', border: '1px solid ' + (shippingOverridden ? '#f0ad4e' : '#ddd'), borderRadius: '4px', fontSize: '13px', background: shippingOverridden ? '#fff8e6' : 'white', textAlign: 'right'}}
                        />
                        <span style={{fontSize: '12px'}}>{currency}</span>
                        {shippingCost > 0 && (
                          <button onClick={() => setAoCustomShipping('0')} title="Anulează transportul (0)" style={{border: '1px solid #dc3545', background: 'none', color: '#dc3545', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: '3px 6px'}}>Anulează</button>
                        )}
                        {shippingOverridden && (
                          <button onClick={() => setAoCustomShipping(undefined)} title={`Revino la regula site-ului (${siteShipping.toFixed(2)})`} style={{border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px'}}>↺</button>
                        )}
                      </span>
                    </div>
                    {shippingOverridden && <div style={{color: '#f0ad4e', fontSize: '11px', marginBottom: '4px', textAlign: 'right'}}>transport modificat manual</div>}
                    <div style={{display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #d4edda', fontSize: '15px'}}>
                      <b>Total comandă:</b><b style={{color: '#28a745'}}>{total.toFixed(2)} {currency}</b>
                    </div>
                    <div style={{color: '#888', fontSize: '11px', marginTop: '4px'}}>Calculat după aceleași reguli ca pe site; serverul revalidează la creare.</div>
                  </div>
                );
              })()}

              <h4 style={{margin: '0 0 8px 0', fontSize: '14px', color: '#333'}}>👤 Date client</h4>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px'}}>
                <div><label style={labelStyle}>Prenume *</label><input style={inputStyle} value={aoCustomer.firstName} onChange={e => setAoCustomer(c => ({...c, firstName: e.target.value}))} /></div>
                <div><label style={labelStyle}>Nume *</label><input style={inputStyle} value={aoCustomer.lastName} onChange={e => setAoCustomer(c => ({...c, lastName: e.target.value}))} /></div>
                <div><label style={labelStyle}>Email *</label><input type="email" style={inputStyle} value={aoCustomer.email} onChange={e => setAoCustomer(c => ({...c, email: e.target.value}))} /></div>
                <div><label style={labelStyle}>Telefon * <span style={{fontWeight: 'normal', color: '#888'}}>(pentru AWB)</span></label><input style={inputStyle} value={aoCustomer.phone} onChange={e => setAoCustomer(c => ({...c, phone: e.target.value}))} /></div>
                <div style={{gridColumn: '1 / -1'}}><label style={labelStyle}>Adresă (stradă, nr.) *</label><input style={inputStyle} value={aoCustomer.streetAddress} onChange={e => setAoCustomer(c => ({...c, streetAddress: e.target.value}))} /></div>
                <div><label style={labelStyle}>Oraș *</label><input style={inputStyle} value={aoCustomer.city} onChange={e => setAoCustomer(c => ({...c, city: e.target.value}))} /></div>
                <div><label style={labelStyle}>Județ *</label><input style={inputStyle} value={aoCustomer.state} onChange={e => setAoCustomer(c => ({...c, state: e.target.value}))} /></div>
                <div><label style={labelStyle}>Cod poștal <span style={{fontWeight: 'normal', color: '#888'}}>(6 cifre pt. Sameday)</span></label><input style={inputStyle} value={aoCustomer.zipCode} onChange={e => setAoCustomer(c => ({...c, zipCode: e.target.value}))} /></div>
                <div><label style={labelStyle}>Țară</label><input style={inputStyle} value={aoCustomer.country} onChange={e => setAoCustomer(c => ({...c, country: e.target.value}))} /></div>
              </div>

              <div style={{marginBottom: '16px', padding: '12px', background: aoIsCompany ? '#fff8e6' : '#f8f9fa', borderRadius: '6px', border: '1px solid ' + (aoIsCompany ? '#ffe0a3' : '#eee')}}>
                <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', marginBottom: aoIsCompany ? '10px' : 0}}>
                  <input type="checkbox" checked={aoIsCompany} onChange={e => setAoIsCompany(e.target.checked)} />
                  🏢 Persoană juridică (factură pe firmă)
                </label>
                {aoIsCompany && (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px'}}>
                    <div><label style={labelStyle}>Nume firmă *</label><input style={inputStyle} value={aoCompany.companyName} onChange={e => setAoCompany(c => ({...c, companyName: e.target.value}))} /></div>
                    <div><label style={labelStyle}>CUI / Cod TVA <span style={{fontWeight: 'normal', color: '#888'}}>(ex. RO12345678)</span></label><input style={inputStyle} value={aoCompany.vatNumber} onChange={e => setAoCompany(c => ({...c, vatNumber: e.target.value}))} /></div>
                    <div><label style={labelStyle}>Nr. Reg. Com. <span style={{fontWeight: 'normal', color: '#888'}}>(ex. J12/345/2020)</span></label><input style={inputStyle} value={aoCompany.registrationNumber} onChange={e => setAoCompany(c => ({...c, registrationNumber: e.target.value}))} /></div>
                  </div>
                )}
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px'}}>
                <div>
                  <label style={labelStyle}>Metodă de plată</label>
                  <select value={aoPaymentMethod} onChange={e => setAoPaymentMethod(e.target.value)} style={inputStyle}>
                    <option value="cash_on_delivery">💵 Ramburs (COD)</option>
                    <option value="bank_transfer">🏦 Transfer bancar</option>
                    <option value="card">💳 Card (plătit extern)</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Note (opțional)</label><input style={inputStyle} value={aoNotes} onChange={e => setAoNotes(e.target.value)} /></div>
              </div>

              <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                <button onClick={() => setShowAddOrderModal(false)} style={{padding: '10px 18px', border: '1px solid #ddd', background: 'white', borderRadius: '4px', cursor: 'pointer'}}>Anulează</button>
                <button onClick={submit} disabled={aoSubmitting} style={{padding: '10px 18px', border: 'none', background: aoSubmitting ? '#94d3a2' : '#28a745', color: 'white', borderRadius: '4px', cursor: aoSubmitting ? 'wait' : 'pointer', fontWeight: 'bold'}}>
                  {aoSubmitting ? 'Se creează...' : '✅ Creează comanda'}
                </button>
              </div>
            </div>
          </div>
        );
      };

      // Modal Forms Component - uses key prop to reset state when opening new product modal
      const ModalsComponent = () => {
        // Local state for form data - updates here don't cause parent re-render
        const [productFormData, setProductFormData] = useState({
          name: '',
          description: '',
          price: '',
          compareAtPrice: '',
          categoryId: '',
          supplierId: '',
          imageUrl: '',
          stockQuantity: '',
          featured: false,
          vatValue: '',
          vatPercentage: '21.00',
          currency: 'RON',
          productCode: '',
          ean: '',
          ncCode: '',
          cpvCode: '',
          status: 'active',
          images: [],
          weight: '',
          length: '',
          width: '',
          height: '',
          piecesPerPackage: '',
          productQuantity: '',
          specs: [],
          volumeDiscounts: [],
          priority: 0,
          productType: 'standard',
          isService: false,
          isComposite: false
        });
        const [uploadedImages, setUploadedImages] = useState([]);
        const [componentProducts, setComponentProducts] = useState([]);
        const [componentSearch, setComponentSearch] = useState('');
        const [componentsLoading, setComponentsLoading] = useState(false);
        
        // Translation form states - local to ModalsComponent to prevent focus loss
        const [newTranslation, setNewTranslation] = useState({ language: '', name: '', description: '', sourceUrl: '' });
        const [editingTranslation, setEditingTranslation] = useState(null);
        const [categoryTranslations, setCategoryTranslations] = useState([]);
        const [categoryTranslationDrafts, setCategoryTranslationDrafts] = useState({});

        React.useEffect(() => {
          if (!editingCategory?.id) {
            setCategoryTranslations([]);
            setCategoryTranslationDrafts({});
            return;
          }

          fetch(`/admin/api/categories/${editingCategory.id}/translations`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
            .then(response => response.ok ? response.json() : [])
            .then(translations => {
              setCategoryTranslations(translations);
              setCategoryTranslationDrafts(Object.fromEntries(
                translations.map(translation => [
                  translation.language,
                  { name: translation.name || '', description: translation.description || '' }
                ])
              ));
            })
            .catch(error => console.error('Error fetching category translations:', error));
        }, [editingCategory?.id]);

        const saveCategoryTranslation = async (language) => {
          const draft = categoryTranslationDrafts[language] || {};
          try {
            const response = await fetch(`/admin/api/categories/${editingCategory.id}/translations/${language}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(draft)
            });
            const data = await response.json();
            if (!response.ok) {
              alert(data.message || 'Failed to save category translation');
              return;
            }

            setCategoryTranslations(previous => [
              ...previous.filter(translation => translation.language !== language),
              data.translation,
            ]);
            broadcastCategoryTranslationUpdate(data.invalidation);
            alert('Category translation saved successfully');
          } catch (error) {
            console.error('Error saving category translation:', error);
            alert('Network error. Please try again.');
          }
        };
        
        // Load product data from ref when productLoadTrigger changes
        React.useEffect(() => {
          if (productLoadTrigger > 0 && initialProductDataRef.current) {
            console.log('ModalsComponent: Loading product data from ref');
            setProductFormData(initialProductDataRef.current);
            setUploadedImages(initialProductDataRef.current.images || []);
          }
        }, [productLoadTrigger]);

        // When market-specific data loads, override price/currency/stock with market values
        // This ensures editing on .ro tab shows .ro price, not the global fallback price
        React.useEffect(() => {
          if (!editingProduct || selectedMarketTab === 'all') return;
          const mktData = editingProductMarkets[selectedMarketTab];
          if (!mktData) return;
          setProductFormData(prev => ({
            ...prev,
            price: (mktData.price !== null && mktData.price !== undefined && mktData.price !== '') ? String(mktData.price) : prev.price,
            compareAtPrice: (mktData.compareAtPrice !== null && mktData.compareAtPrice !== undefined && mktData.compareAtPrice !== '') ? String(mktData.compareAtPrice) : prev.compareAtPrice,
            currency: mktData.currency || prev.currency,
            stockQuantity: (mktData.stockQuantity !== null && mktData.stockQuantity !== undefined) ? String(mktData.stockQuantity) : prev.stockQuantity,
          }));
        }, [editingProductMarkets, selectedMarketTab]);

        // Component choices only exist for saved products and are independent
        // per marketplace. The product list deliberately includes inactive rows.
        React.useEffect(() => {
          if (!editingProduct || !productFormData.isComposite || selectedMarketTab === 'all') {
            setComponentProducts([]);
            return;
          }
          let cancelled = false;
          const loadComponents = async () => {
            setComponentsLoading(true);
            try {
              const response = await fetch(`/admin/api/products/${editingProduct.id}/components?market=${selectedMarketTab}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.message || 'Failed to load components');
              if (!cancelled) {
                setComponentProducts(data.map(item => ({
                  ...item.product,
                  id: item.componentProductId,
                  price: item.marketPrice ?? item.product.price,
                  currency: item.marketCurrency ?? item.product.currency,
                  marketIsActive: item.marketIsActive,
                })));
              }
            } catch (error) {
              if (!cancelled) alert(error.message || 'Failed to load components');
            } finally {
              if (!cancelled) setComponentsLoading(false);
            }
          };
          loadComponents();
          return () => { cancelled = true; };
        }, [editingProduct?.id, productFormData.isComposite, selectedMarketTab]);
        
        const [userFormData, setUserFormData] = useState({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          isAdmin: false,
          adminMarkets: []
        });

        const [uploading, setUploading] = useState(false);
        const [uploadProgress, setUploadProgress] = useState(0);

        // Import from URL state
        const [importUrl, setImportUrl] = useState('');
        const [importLanguage, setImportLanguage] = useState('ro');
        const [importLoading, setImportLoading] = useState(false);
        const [importedData, setImportedData] = useState(null);
        const [usageRightsConfirmed, setUsageRightsConfirmed] = useState(false);

        // Product translations state - now at AdminDashboard level to survive modal remount

        // Import from URL handler
        const handleImportFromUrl = async () => {
          if (!importUrl.trim()) {
            alert('Please enter a URL to import from');
            return;
          }
          
          setImportLoading(true);
          try {
            const response = await fetch('/admin/api/products/import-from-url', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ url: importUrl })
            });
            
            const result = await response.json();
            
            if (result.success) {
              setImportedData(result.data);
              // Pre-fill form fields with imported data
              setProductFormData(prev => ({
                ...prev,
                name: result.data.title || prev.name,
                description: result.data.description || prev.description,
                imageUrl: result.data.imageUrl || prev.imageUrl,
                price: result.data.price || prev.price
              }));
            } else {
              alert(`Import failed: ${result.message}`);
            }
          } catch (error) {
            console.error('Import error:', error);
            alert('Failed to import data from URL');
          } finally {
            setImportLoading(false);
          }
        };

        // Helper function to extract URL from image (handles both objects and strings)
        const getImageUrl = (image) => {
          if (!image) return '';
          if (typeof image === 'string') {
            // Check if it's a JSON string
            if (image.startsWith('{') && image.includes('"url"')) {
              try {
                const parsed = JSON.parse(image);
                return parsed.thumbnailUrl || parsed.url || '';
              } catch {
                return image;
              }
            }
            return image;
          }
          if (typeof image === 'object') {
            return image.thumbnailUrl || image.url || '';
          }
          return '';
        };

        // Local supplier form data state - lives in ModalsComponent to avoid re-renders
        const [supplierFormData, setSupplierFormData] = useState({
          name: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
          contactPerson: '',
          apiEndpoint: '',
          apiKey: '',
          integrationType: 'email',
          notes: '',
          isActive: true,
          marketCode: 'ro'
        });

        // Load supplier form data when trigger changes
        useEffect(() => {
          if (supplierLoadTrigger > 0 && supplierInitialDataRef.current) {
            console.log('ModalsComponent: Loading supplier data from ref');
            setSupplierFormData(supplierInitialDataRef.current);
          }
        }, [supplierLoadTrigger]);

        // Handle supplier form submission (create or update)
        const handleSupplierSubmit = async (e) => {
          e.preventDefault();
          
          if (editingSupplier) {
            // Update existing supplier
            const result = await updateSupplier(editingSupplier.id, supplierFormData);
            
            if (result.success) {
              alert('✅ Supplier updated successfully!');
              setShowEditSupplierModal(false);
              setEditingSupplier(null);
              fetchSuppliers(); // Refresh the suppliers list
            } else {
              alert(`❌ Error updating supplier: ${result.message}`);
            }
          } else {
            // Create new supplier
            try {
              const token = localStorage.getItem('adminToken');
              const response = await fetch('/admin/api/suppliers', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(supplierFormData)
              });
              
              if (response.ok) {
                alert('✅ Supplier created successfully!');
                setShowEditSupplierModal(false);
                // Reset form
                setSupplierFormData({
                  name: '',
                  email: '',
                  phone: '',
                  address: '',
                  city: '',
                  state: '',
                  zipCode: '',
                  country: '',
                  contactPerson: '',
                  apiEndpoint: '',
                  apiKey: '',
                  integrationType: 'email',
                  notes: '',
                  isActive: true
                });
                fetchSuppliers(); // Refresh the suppliers list
              } else {
                const error = await response.json();
                alert(`❌ Error creating supplier: ${error.message || 'Unknown error'}`);
              }
            } catch (error) {
              console.error('Error creating supplier:', error);
              alert('❌ Failed to create supplier');
            }
          }
        };

        // Image upload function
        const uploadImages = async (files) => {
          // Validate file types and sizes
          const validFiles = Array.from(files).filter(file => {
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            if (!validTypes.includes(file.type)) {
              alert(`Invalid file type: ${file.name}. Please use JPG, PNG, GIF, or WebP.`);
              return false;
            }
            
            if (file.size > maxSize) {
              alert(`File too large: ${file.name}. Maximum size is 5MB.`);
              return false;
            }
            
            return true;
          });
          
          if (validFiles.length === 0) return;
          
          if (uploadedImages.length + validFiles.length > 10) {
            alert('Maximum 10 images per product. Please remove some images first.');
            return;
          }
          
          setUploading(true);
          setUploadProgress(0);
          
          const formData = new FormData();
          validFiles.forEach(file => {
            formData.append('images', file);
          });

          try {
            const response = await fetch('/admin/api/upload-images', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
              },
              body: formData
            });

            const result = await response.json();
            
            if (result.success) {
              const newImages = [...uploadedImages, ...result.files];
              setUploadedImages(newImages);
              setProductFormData(prev => ({
                ...prev,
                images: newImages
              }));
              
              alert(`${result.files.length} image(s) uploaded successfully`);
            } else {
              alert('Error: ' + result.message);
            }
          } catch (error) {
            console.error('Upload error:', error);
            alert('Error uploading images. Please try again.');
          } finally {
            setUploading(false);
            setUploadProgress(0);
          }
        };

        // Delete image function - handles both string URLs and objects, deletes from R2 storage
        const deleteImage = async (image, index) => {
          try {
            // Get the full image URL for R2 deletion
            let imageUrl = null;
            
            if (typeof image === 'string') {
              imageUrl = image;
            } else if (image && image.url) {
              imageUrl = image.url;
            } else if (image && image.filename) {
              imageUrl = image.filename;
            }
            
            // Delete from R2 storage using the new endpoint
            if (imageUrl) {
              console.log('Deleting image from R2:', imageUrl);
              const response = await fetch('/admin/api/delete-image-by-url', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imageUrl })
              });

              const result = await response.json();
              console.log('Delete result:', result);
              
              if (!result.success) {
                console.warn('Server delete failed:', result.message);
              }
            }
            
            // Always remove from local list
            const newImages = uploadedImages.filter((_, i) => i !== index);
            setUploadedImages(newImages);
            setProductFormData(prev => ({
              ...prev,
              images: newImages
            }));
            
            alert('Image deleted successfully');
          } catch (error) {
            console.error('Delete error:', error);
            // Still remove from list even if server delete fails
            const newImages = uploadedImages.filter((_, i) => i !== index);
            setUploadedImages(newImages);
            setProductFormData(prev => ({
              ...prev,
              images: newImages
            }));
            alert('Image removed from list');
          }
        };

        // Set image as main function
        const setAsMainImage = async (selectedIndex) => {
          if (selectedIndex === 0) return; // Already main
          
          const newImages = [...uploadedImages];
          const mainImage = newImages.splice(selectedIndex, 1)[0];
          newImages.unshift(mainImage);
          
          setUploadedImages(newImages);
          setProductFormData(prev => ({
            ...prev,
            images: newImages
          }));
          
          // Images will be saved when the form is submitted
        };
        
        const handleUserSubmit = async (e) => {
          e.preventDefault();
          
          const result = editingUser 
            ? await updateUser(editingUser.id, userFormData)
            : await createUser(userFormData);
          
          if (result.success) {
            alert(result.message);
            setShowAddUserModal(false);
            setEditingUser(null);
            setUserFormData({
              email: '',
              password: '',
              firstName: '',
              lastName: '',
              isAdmin: false
            });
          } else {
            alert('Error: ' + result.message);
          }
        };
        
        const handleProductSubmit = async (e) => {
          e.preventDefault();
          
          // Check usage rights confirmation if data was imported from URL
          if (importedData && !usageRightsConfirmed) {
            alert('Te rog confirmă că ai dreptul de utilizare a datelor și imaginilor importate.');
            return;
          }
          
          // Include uploaded images in the product data
          const productData = {
            ...productFormData,
            images: uploadedImages
          };
          
          console.log('Product form data being submitted:', productData);
          console.log('selectedMarketTab:', selectedMarketTab);

          // Helper to reset form after save
          const resetForm = () => {
            setShowAddProductModal(false);
            setEditingProduct(null);
            setProductFormData({
              name: '', description: '', price: '', compareAtPrice: '',
              categoryId: '', supplierId: '', imageUrl: '', stockQuantity: '',
              featured: false, vatValue: '', vatPercentage: '21.00', currency: 'EUR',
              productCode: '', ean: '', ncCode: '', cpvCode: '', status: 'active', images: [],
              weight: '', length: '', width: '', height: '', piecesPerPackage: '',
              productQuantity: '', specs: [], volumeDiscounts: [], priority: 0, productType: 'standard', isService: false, isComposite: false
            });
            setUploadedImages([]);
            setImportUrl('');
            setImportedData(null);
            setUsageRightsConfirmed(false);
            fetchProducts(selectedMarketTab);
            setTimeout(() => fetchProducts(selectedMarketTab), 1500);
          };

          // Helper: save market-specific fields (price/currency/stock) to product_markets
          const saveMarketData = async (productId, market) => {
            try {
              const response = await fetch(`/admin/api/products/${productId}/markets/${market}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  isActive: true,
                  price: productData.price || null,
                  compareAtPrice: productData.compareAtPrice || null,
                  currency: productData.currency || null,
                  categoryId: productData.categoryId ? parseInt(String(productData.categoryId)) : null,
                  stockQuantity: productData.stockQuantity !== '' && productData.stockQuantity !== null ? parseInt(String(productData.stockQuantity)) : null,
                  inStock: productData.stockQuantity ? parseInt(String(productData.stockQuantity)) > 0 : null,
                })
              });
              const result = await response.json();
              if (!response.ok) {
                throw new Error(result.message || 'Datele marketplace-ului nu au putut fi salvate');
              }
            } catch (err) {
              console.error('Failed to save market-specific data:', err);
              throw err;
            }
          };

          const saveComponents = async (productId, market) => {
            const response = await fetch(`/admin/api/products/${productId}/components?market=${market}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ componentProductIds: componentProducts.map(product => product.id) })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to save components');
          };

          if (editingProduct && selectedMarketTab !== 'all') {
            // ── EDITING on specific market tab ──────────────────────────────
            // 1. Save global fields (name, desc, images, specs, weight, etc.)
            //    but NOT price/compareAtPrice/currency/stockQuantity — those are market-specific
            const { price, compareAtPrice, currency, stockQuantity, inStock, categoryId, ...globalFields } = productData;
            const globalResult = await updateProduct(editingProduct.id, globalFields);
            
            if (!globalResult.success) {
              alert('Eroare la salvare: ' + globalResult.message);
              return;
            }
            
            // 2. Save price/currency/stock only to this market's product_markets row
            try {
              await saveMarketData(editingProduct.id, selectedMarketTab);
            } catch (error) {
              alert('Produsul global a fost salvat, dar categoria/prețul pentru ' + selectedMarketTab.toUpperCase() + ' nu au fost salvate: ' + error.message);
              return;
            }
            if (productData.isComposite) {
              try {
                await saveComponents(editingProduct.id, selectedMarketTab);
              } catch (error) {
                alert('Produsul a fost salvat, dar componentele nu: ' + error.message);
                return;
              }
            }
            
            alert('✅ Produs salvat! Prețul/stocul au fost actualizate doar pentru piața ' + selectedMarketTab.toUpperCase() + '.');
            resetForm();

          } else if (!editingProduct && selectedMarketTab !== 'all') {
            // ── CREATING new product on specific market tab ─────────────────
            // The server creates the shared product and its marketplace row atomically.
            const result = await createProduct({...productData, market: selectedMarketTab});
            if (result.success) {
              if (!result.product?.id || result.productMarket?.market !== selectedMarketTab) {
                alert('Produsul nu a fost confirmat pentru piața ' + selectedMarketTab.toUpperCase() + '. Formularul rămâne deschis.');
                return;
              }
              alert(result.message);
              resetForm();
            } else {
              alert('Error: ' + result.message);
            }

          } else {
            // ── 'all' tab OR creating globally ─────────────────────────────
            // Current behavior: save everything to global products table
            const result = editingProduct
              ? await updateProduct(editingProduct.id, productData)
              : await createProduct(productData);
            
            if (result.success) {
              alert(result.message);
              resetForm();
            } else {
              alert('Error: ' + result.message);
            }
          }
        };
        
        // Set form data when editing
        React.useEffect(() => {
          if (editingUser) {
            setUserFormData({
              email: editingUser.email || '',
              password: '',
              firstName: editingUser.firstName || '',
              lastName: editingUser.lastName || '',
              isAdmin: editingUser.isAdmin || false,
              adminMarkets: editingUser.adminMarkets || []
            });
            setShowAddUserModal(true);
          }
        }, [editingUser]);
        
        // Note: Product form initialization useEffect is now at AdminDashboard level
        
        // Add new translation
        const handleAddTranslation = async (productId) => {
          if (!newTranslation.language || !newTranslation.name) {
            alert('Language and name are required');
            return;
          }
          
          try {
            const response = await fetch(`/admin/api/products/${productId}/translations`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify(newTranslation)
            });
            
            if (response.ok) {
              const translation = await response.json();
              setProductTranslations([...productTranslations, translation]);
              setNewTranslation({ language: '', name: '', description: '', sourceUrl: '' });
              alert('✅ Translation added successfully!');
            } else {
              const error = await response.json();
              alert('Error: ' + error.message);
            }
          } catch (error) {
            console.error('Error adding translation:', error);
            alert('Failed to add translation');
          }
        };
        
        // Delete translation
        const handleDeleteTranslation = async (translationId) => {
          if (!confirm('Are you sure you want to delete this translation?')) return;
          
          try {
            const response = await fetch(`/admin/api/products/translations/${translationId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
              setProductTranslations(productTranslations.filter(t => t.id !== translationId));
              alert('✅ Translation deleted!');
            }
          } catch (error) {
            console.error('Error deleting translation:', error);
          }
        };
        
        // Update translation
        const handleUpdateTranslation = async () => {
          if (!editingTranslation || !editingTranslation.name) {
            alert('Name is required');
            return;
          }
          
          try {
            const response = await fetch(`/admin/api/products/translations/${editingTranslation.id}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({
                language: editingTranslation.language,
                name: editingTranslation.name,
                description: editingTranslation.description,
                sourceUrl: editingTranslation.sourceUrl
              })
            });
            
            if (response.ok) {
              const updated = await response.json();
              setProductTranslations(productTranslations.map(t => t.id === updated.id ? updated : t));
              setEditingTranslation(null);
              alert('✅ Translation updated!');
            } else {
              const error = await response.json();
              alert('Error: ' + error.message);
            }
          } catch (error) {
            console.error('Error updating translation:', error);
            alert('Failed to update translation');
          }
        };
        
        // Form initialization for new products is now handled by the "Add New Product" button click handler
        // This avoids infinite loops caused by useEffect re-triggering on state changes
        
        return (
          <>
            {/* Add/Edit User Modal */}
            {showAddUserModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '500px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    {editingUser ? 'Edit User' : 'Add New User'}
                  </h3>
                  <form onSubmit={handleUserSubmit}>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password {editingUser && '(leave empty to keep current)'}</label>
                      <input
                        type="password"
                        className="form-input"
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                        required={!editingUser}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">First Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={userFormData.firstName}
                        onChange={(e) => setUserFormData({...userFormData, firstName: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={userFormData.lastName}
                        onChange={(e) => setUserFormData({...userFormData, lastName: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <input
                          type="checkbox"
                          checked={userFormData.isAdmin}
                          onChange={(e) => setUserFormData({...userFormData, isAdmin: e.target.checked})}
                        />
                        Admin User
                      </label>
                    </div>
                    {adminIsSuperAdmin && userFormData.isAdmin && (
                      <div className="form-group">
                        <label className="form-label" style={{marginBottom:'8px',display:'block'}}>
                          Market Access <span style={{fontSize:'12px',color:'#888',fontWeight:'400'}}>(empty = superadmin, can see all)</span>
                        </label>
                        <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                          {['ro','fr','com'].map(mkt => {
                            const flags = {ro:'🇷🇴',fr:'🇫🇷',com:'🌐'};
                            const labels = {ro:'Romania',fr:'France',com:'International'};
                            const checked = (userFormData.adminMarkets||[]).includes(mkt);
                            return (
                              <label key={mkt} style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',padding:'6px 12px',border:`2px solid ${checked?'#667eea':'#e0e0e0'}`,borderRadius:'8px',background:checked?'#f0f0ff':'white',transition:'all 0.2s'}}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const prev = userFormData.adminMarkets || [];
                                    setUserFormData({...userFormData, adminMarkets: e.target.checked ? [...prev, mkt] : prev.filter(m => m !== mkt)});
                                  }}
                                  style={{accentColor:'#667eea'}}
                                />
                                {flags[mkt]} {labels[mkt]}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div style={{display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end'}}>
                      <button
                        type="button"
                        className="btn"
                        style={{background: '#6c757d'}}
                        onClick={() => {
                          setShowAddUserModal(false);
                          setEditingUser(null);
                          setUserFormData({
                            email: '',
                            password: '',
                            firstName: '',
                            lastName: '',
                            isAdmin: false,
                            adminMarkets: []
                          });
                        }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn" style={{background: '#28a745'}}>
                        {editingUser ? 'Update User' : 'Create User'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* Add/Edit Product Modal */}
            {showAddProductModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '95%',
                  maxWidth: '1000px',
                  maxHeight: '92vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    {editingProduct ? t('products.modal.editTitle') : t('products.modal.addTitle')}
                  </h3>
                  
                  {/* Import from URL Section */}
                  {!editingProduct && (
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      border: '1px solid #e9ecef'
                    }}>
                      <h4 style={{marginBottom: '4px', color: '#495057', fontSize: '14px'}}>
                        🔗 {t('products.modal.importTitle')}
                      </h4>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '10px'}}>
                        {t('products.modal.importDesc')}
                      </div>
                      <div style={{display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap'}}>
                        <input
                          type="url"
                          className="form-input"
                          placeholder={t('products.modal.importUrlPh')}
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          style={{flex: '1 1 300px', minWidth: '250px', padding: '10px', fontSize: '14px'}}
                        />
                        <select
                          className="form-input"
                          value={importLanguage}
                          onChange={(e) => setImportLanguage(e.target.value)}
                          style={{width: '100px'}}
                        >
                          <option value="en">🇬🇧 EN</option>
                          <option value="ro">🇷🇴 RO</option>
                          <option value="de">🇩🇪 DE</option>
                          <option value="fr">🇫🇷 FR</option>
                          <option value="it">🇮🇹 IT</option>
                          <option value="es">🇪🇸 ES</option>
                          <option value="zh">🇨🇳 ZH</option>
                        </select>
                        <button
                          type="button"
                          className="btn"
                          onClick={handleImportFromUrl}
                          disabled={importLoading || !importUrl.trim()}
                          style={{
                            backgroundColor: importLoading ? '#6c757d' : '#17a2b8',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {importLoading ? '⏳' : '📥'} {t('products.modal.importFetch')}
                        </button>
                      </div>
                      
                      {importedData && (
                        <div style={{
                          backgroundColor: '#d4edda',
                          padding: '10px',
                          borderRadius: '6px',
                          marginTop: '10px',
                          fontSize: '13px'
                        }}>
                          <div style={{fontWeight: 'bold', marginBottom: '5px', color: '#155724'}}>
                            ✅ {t('products.modal.importSuccess')}
                          </div>
                          {importedData.imageUrl && (
                            <div style={{marginBottom: '8px'}}>
                              <img 
                                src={importedData.imageUrl} 
                                alt="Preview" 
                                style={{
                                  maxWidth: '100px',
                                  maxHeight: '100px',
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  border: '1px solid #ccc'
                                }}
                              />
                            </div>
                          )}
                          <div><strong>{t('products.modal.importTitleLabel')}:</strong> {importedData.title?.substring(0, 50)}...</div>
                          <div><strong>{t('products.modal.importDescLabel')}:</strong> {importedData.description?.substring(0, 80)}...</div>
                          
                          <div style={{marginTop: '10px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px'}}>
                            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                              <input
                                type="checkbox"
                                checked={usageRightsConfirmed}
                                onChange={(e) => setUsageRightsConfirmed(e.target.checked)}
                              />
                              <span style={{fontSize: '12px', color: '#856404'}}>
                                ⚠️ {t('products.modal.importRights')}
                              </span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <form onSubmit={handleProductSubmit}>
                    {/* Base language notice */}
                    <div style={{
                      backgroundColor: '#e3f2fd',
                      border: '1px solid #2196f3',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span style={{fontSize: '20px'}}>🇬🇧</span>
                      <div style={{fontSize: '13px', color: '#1565c0'}}>
                        <strong>{t('products.modal.baseLangTitle')}</strong> — {t('products.modal.baseLangDesc')}
                      </div>
                    </div>
                    
                    {/* Basic Information Section */}
                    <div style={{marginTop: '10px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#333', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        📝 {t('products.modal.basicTitle')}
                      </h5>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '12px'}}>
                        {t('products.modal.basicDesc')}
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('products.modal.nameLabel')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={productFormData.name}
                          onChange={(e) => setProductFormData({...productFormData, name: e.target.value})}
                          required
                          placeholder={t('products.modal.namePh')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('products.modal.descLabel')}</label>
                        <textarea
                          className="form-input"
                          value={productFormData.description}
                          onChange={(e) => setProductFormData({...productFormData, description: e.target.value})}
                          rows="8"
                          placeholder={t('products.modal.descPh')}
                        />
                      </div>
                    </div>

                    {/* Pricing & Tax Section */}
                    <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#333', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        💰 {t('products.modal.pricingTitle')}
                      </h5>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '12px'}}>
                        {t('products.modal.pricingDesc')}
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px'}}>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.priceLabel')}</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={productFormData.price}
                            onChange={(e) => setProductFormData({...productFormData, price: e.target.value})}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.comparePriceLabel')}</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={productFormData.compareAtPrice}
                            onChange={(e) => setProductFormData({...productFormData, compareAtPrice: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Organization Section */}
                    <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#333', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        🗂️ {t('products.modal.organizeTitle')}
                      </h5>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '12px'}}>
                        {t('products.modal.organizeDesc')}
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.categoryLabel')}</label>
                          <select
                            className="form-input"
                            value={productFormData.categoryId}
                            onChange={(e) => setProductFormData({...productFormData, categoryId: e.target.value})}
                          >
                            <option value="">{t('products.modal.selectCategory')}</option>
                            {categories.map(category => (
                            <option key={category.id} value={category.id}>{getCategoryName(category)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.supplierLabel')}</label>
                          <select
                            className="form-input"
                            value={productFormData.supplierId || ''}
                            onChange={(e) => setProductFormData({...productFormData, supplierId: e.target.value})}
                          >
                            <option value="">{t('products.modal.selectSupplier')}</option>
                            {suppliers.map(supplier => (
                              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Images Section */}
                    <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#333', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        🖼️ {t('products.modal.imagesTitle')}
                      </h5>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '12px'}}>
                        {t('products.modal.imagesDesc')}
                      </div>
                    <div className="form-group">
                      <label className="form-label">{t('products.modal.legacyUrlLabel')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={productFormData.imageUrl}
                        onChange={(e) => setProductFormData({...productFormData, imageUrl: e.target.value})}
                        placeholder={t('products.modal.legacyUrlPh')}
                      />
                    </div>
                    
                    <div className="form-group">
                      <div 
                        className="image-upload-zone"
                        style={{
                          border: '2px dashed #ddd',
                          borderRadius: '8px',
                          padding: '20px',
                          textAlign: 'center',
                          backgroundColor: '#f9f9f9',
                          marginBottom: '15px'
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#007bff';
                          e.currentTarget.style.backgroundColor = '#e3f2fd';
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#ddd';
                          e.currentTarget.style.backgroundColor = '#f9f9f9';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '#ddd';
                          e.currentTarget.style.backgroundColor = '#f9f9f9';
                          
                          const files = e.dataTransfer.files;
                          if (files && files.length > 0) {
                            uploadImages(files);
                          }
                        }}
                      >
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              uploadImages(e.target.files);
                            }
                          }}
                          style={{display: 'none'}}
                          id="image-upload"
                        />
                        <label
                          htmlFor="image-upload"
                          style={{
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            color: uploading ? '#666' : '#007bff',
                            textDecoration: uploading ? 'none' : 'underline'
                          }}
                        >
                          {uploading ? t('products.modal.uploading') : t('products.modal.uploadClick')}
                        </label>
                        
                        {uploading && (
                          <div style={{
                            width: '100%',
                            height: '4px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '2px',
                            margin: '10px 0',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              backgroundColor: '#007bff',
                              width: '100%',
                              animation: 'pulse 1.5s ease-in-out infinite'
                            }}></div>
                          </div>
                        )}
                        
                        <p style={{color: '#666', fontSize: '14px', marginTop: '10px'}}>
                          {t('products.modal.uploadLimits')}
                          {uploadedImages.length > 0 && (
                            <span style={{display: 'block', marginTop: '5px', color: '#28a745'}}>
                              {t('products.modal.uploadedCount', { count: uploadedImages.length })}
                            </span>
                          )}
                        </p>
                      </div>
                      
                      {uploadedImages.length > 0 && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                          gap: '10px',
                          marginTop: '15px'
                        }}>
                          {uploadedImages.map((image, index) => (
                            <div key={index} className="image-thumbnail" style={{
                              position: 'relative',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              backgroundColor: '#fff'
                            }}>
                              <img
                                src={getImageUrl(image)}
                                alt={`Product image ${index + 1}`}
                                style={{
                                  width: '100%',
                                  height: '100px',
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                              />
                              <div style={{
                                position: 'absolute',
                                top: '5px',
                                right: '5px',
                                display: 'flex',
                                gap: '5px'
                              }}>
                                {index === 0 && (
                                  <span style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: 'bold'
                                  }}>
                                    {t('products.modal.mainBadge')}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => deleteImage(image, index)}
                                  style={{
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                              
                              {index !== 0 && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '25px',
                                  left: '5px',
                                  right: '5px'
                                }}>
                                  <button
                                    type="button"
                                    onClick={() => setAsMainImage(index)}
                                    style={{
                                      backgroundColor: '#007bff',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      padding: '3px 6px',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                      width: '100%'
                                    }}
                                  >
                                    {t('products.modal.setAsMain')}
                                  </button>
                                </div>
                              )}
                              <div style={{
                                padding: '5px',
                                fontSize: '11px',
                                color: '#666',
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {typeof image === 'string' ? image.split('/').pop() : (image.originalName || image.filename || 'Image')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </div>

                    {/* Stock & Identification Section */}
                    <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#333', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        📦 {t('products.modal.inventoryTitle')}
                      </h5>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '12px'}}>
                        {t('products.modal.inventoryDesc')}
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.stockLabel')}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            value={productFormData.stockQuantity}
                            onChange={(e) => setProductFormData({...productFormData, stockQuantity: e.target.value})}
                            placeholder={productFormData.isComposite
                              ? `Automat din componente: ${componentProducts.reduce((sum, product) => sum + (Number(product.stockQuantity) || 0), 0)}`
                              : ''}
                          />
                          {productFormData.isComposite && (
                            <div style={{fontSize: '11px', color: '#64748b', marginTop: '4px'}}>
                              Lasă gol pentru a folosi automat suma stocurilor componentelor.
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.productCodeLabel')}</label>
                          <input
                            type="text"
                            className="form-input"
                            value={productFormData.productCode}
                            onChange={(e) => setProductFormData({...productFormData, productCode: e.target.value})}
                            placeholder="ABC-123-DEF"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.eanLabel')}</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength="14"
                            className="form-input"
                            value={productFormData.ean}
                            onChange={(e) => setProductFormData({...productFormData, ean: e.target.value})}
                            placeholder="5941234567890"
                          />
                          <small style={{color: '#6c757d'}}>Opțional: 8, 12, 13 sau 14 cifre</small>
                        </div>
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px'}}>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.vatLabel')}</label>
                          <select
                            className="form-input"
                            value={productFormData.vatPercentage || '21.00'}
                            onChange={(e) => setProductFormData({...productFormData, vatPercentage: e.target.value})}
                          >
                            <option value="0.00">{t('products.modal.vatReverse')}</option>
                            <option value="5.00">5% ({t('products.modal.vatReduced')})</option>
                            <option value="9.00">9% ({t('products.modal.vatReduced')})</option>
                            <option value="19.00">19% (TVA standard România)</option>
                            <option value="20.00">20% (TVA standard France)</option>
                            <option value="21.00">21% ({t('products.modal.vatStandard')})</option>
                            <option value="24.00">24% ({t('products.modal.vatLuxury')})</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.currencyLabel')}</label>
                          <select
                            className="form-input"
                            value={productFormData.currency}
                            onChange={(e) => setProductFormData({...productFormData, currency: e.target.value})}
                          >
                            <option value="EUR">EUR (Euro)</option>
                            <option value="RON">RON (Romanian Leu)</option>
                            <option value="USD">USD (US Dollar)</option>
                            <option value="GBP">GBP (British Pound)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.vatValueLabel')}</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={productFormData.vatValue}
                            onChange={(e) => setProductFormData({...productFormData, vatValue: e.target.value})}
                            placeholder="19.00"
                          />
                        </div>
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.ncCodeLabel')}</label>
                          <input
                            type="text"
                            className="form-input"
                            value={productFormData.ncCode}
                            onChange={(e) => setProductFormData({...productFormData, ncCode: e.target.value})}
                            placeholder="1234.56.78"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.cpvCodeLabel')}</label>
                          <input
                            type="text"
                            className="form-input"
                            value={productFormData.cpvCode}
                            onChange={(e) => setProductFormData({...productFormData, cpvCode: e.target.value})}
                            placeholder="39000000-0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Visibility Section */}
                    <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#333', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        👁️ {t('products.modal.statusTitle')}
                      </h5>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '12px'}}>
                        {t('products.modal.statusDesc')}
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', alignItems: 'end'}}>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.statusLabel')}</label>
                          <select
                            className="form-input"
                            value={productFormData.status}
                            onChange={(e) => setProductFormData({...productFormData, status: e.target.value})}
                          >
                            <option value="active">{t('common.active')}</option>
                            <option value="inactive">{t('common.inactive')}</option>
                            <option value="draft">{t('common.draft')}</option>
                            <option value="discontinued">{t('common.discontinued')}</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('products.modal.priorityLabel')}</label>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            value={productFormData.priority || 0}
                            onChange={(e) => setProductFormData({...productFormData, priority: parseInt(e.target.value) || 0})}
                            placeholder="0"
                          />
                        </div>
                        <div className="form-group">
                          <label style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px'}}>
                            <input
                              type="checkbox"
                              checked={productFormData.featured}
                              onChange={(e) => setProductFormData({...productFormData, featured: e.target.checked})}
                            />
                            ⭐ {t('products.modal.featuredLabel')}
                          </label>
                        </div>
                      </div>
                      <small style={{color: '#666', fontSize: '12px', display: 'block'}}>
                        {t('products.modal.priorityHint')}
                      </small>
                    </div>
                    
                    {/* Logistics Details Section */}
                    <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#333', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        🚚 {t('products.modal.logisticsTitle')}
                      </h5>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '12px'}}>
                        {t('products.modal.logisticsDesc')}
                      </div>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                        <div className="form-group" style={{display: 'flex', flexDirection: 'column'}}>
                          <label className="form-label" style={{height: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
                            {t('products.modal.weightLabel')}
                            <span style={{fontSize: '11px', color: '#666', fontWeight: 'normal'}}>{t('products.modal.weightHint')}</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="form-input"
                            value={productFormData.weight || ''}
                            onChange={(e) => setProductFormData({...productFormData, weight: e.target.value})}
                            placeholder={t('products.modal.weightPh')}
                          />
                        </div>
                        <div className="form-group" style={{display: 'flex', flexDirection: 'column'}}>
                          <label className="form-label" style={{height: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
                            {t('products.modal.lengthLabel')}
                            <span style={{fontSize: '11px', color: 'transparent', fontWeight: 'normal'}}>placeholder</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input"
                            value={productFormData.length || ''}
                            onChange={(e) => setProductFormData({...productFormData, length: e.target.value})}
                            placeholder={t('products.modal.lengthPh')}
                          />
                        </div>
                        <div className="form-group" style={{display: 'flex', flexDirection: 'column'}}>
                          <label className="form-label" style={{height: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
                            {t('products.modal.widthLabel')}
                            <span style={{fontSize: '11px', color: 'transparent', fontWeight: 'normal'}}>placeholder</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input"
                            value={productFormData.width || ''}
                            onChange={(e) => setProductFormData({...productFormData, width: e.target.value})}
                            placeholder={t('products.modal.widthPh')}
                          />
                        </div>
                        <div className="form-group" style={{display: 'flex', flexDirection: 'column'}}>
                          <label className="form-label" style={{height: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
                            {t('products.modal.heightLabel')}
                            <span style={{fontSize: '11px', color: 'transparent', fontWeight: 'normal'}}>placeholder</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input"
                            value={productFormData.height || ''}
                            onChange={(e) => setProductFormData({...productFormData, height: e.target.value})}
                            placeholder={t('products.modal.heightPh')}
                          />
                        </div>
                        <div className="form-group" style={{display: 'flex', flexDirection: 'column'}}>
                          <label className="form-label" style={{height: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
                            {t('products.modal.piecesLabel')}
                            <span style={{fontSize: '11px', color: '#666', fontWeight: 'normal'}}>{t('products.modal.piecesHint')}</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="form-input"
                            value={productFormData.piecesPerPackage || ''}
                            onChange={(e) => setProductFormData({...productFormData, piecesPerPackage: e.target.value})}
                            placeholder={t('products.modal.piecesPh')}
                          />
                        </div>
                        <div className="form-group" style={{display: 'flex', flexDirection: 'column'}}>
                          <label className="form-label" style={{height: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'}}>
                            {t('products.modal.quantityLabel')}
                            <span style={{fontSize: '11px', color: '#666', fontWeight: 'normal'}}>{t('products.modal.quantityHint')}</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={productFormData.productQuantity || ''}
                            onChange={(e) => setProductFormData({...productFormData, productQuantity: e.target.value})}
                            placeholder={t('products.modal.quantityPh')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Product Specs Section */}
                    <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                      <h5 style={{color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        📋 {t('products.modal.specsTitle')}
                        <span style={{fontSize: '12px', fontWeight: 'normal', color: '#666'}}>— {t('products.modal.specsDesc')}</span>
                      </h5>
                      <div>
                        {(productFormData.specs || []).map((spec, idx) => (
                          <div key={idx} style={{display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center'}}>
                            <input
                              type="text"
                              className="form-input"
                              style={{flex: 1}}
                              value={spec.label || ''}
                              onChange={(e) => {
                                const newSpecs = [...(productFormData.specs || [])];
                                newSpecs[idx] = {...newSpecs[idx], label: e.target.value};
                                setProductFormData({...productFormData, specs: newSpecs});
                              }}
                              placeholder={t('products.modal.specNamePh')}
                            />
                            <input
                              type="text"
                              className="form-input"
                              style={{flex: 1}}
                              value={spec.value || ''}
                              onChange={(e) => {
                                const newSpecs = [...(productFormData.specs || [])];
                                newSpecs[idx] = {...newSpecs[idx], value: e.target.value};
                                setProductFormData({...productFormData, specs: newSpecs});
                              }}
                              placeholder={t('products.modal.specValuePh')}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newSpecs = (productFormData.specs || []).filter((_, i) => i !== idx);
                                setProductFormData({...productFormData, specs: newSpecs});
                              }}
                              style={{padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', flexShrink: 0, fontSize: '16px', lineHeight: '1'}}
                              title={t('products.modal.deleteSpec')}
                            >×</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newSpecs = [...(productFormData.specs || []), {label: '', value: ''}];
                            setProductFormData({...productFormData, specs: newSpecs});
                          }}
                          style={{marginTop: '4px', padding: '6px 14px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'}}
                        >+ {t('products.modal.addSpec')}</button>
                      </div>
                      {(productFormData.specs || []).length === 0 && (
                        <div style={{marginTop: '8px', fontSize: '12px', color: '#999'}}>
                          {t('products.modal.specsEmpty')}
                        </div>
                      )}
                    </div>

                    {/* Product type */}
                    <div style={{marginTop: '16px', padding: '12px 14px', backgroundColor: '#f0f4ff', borderRadius: '6px', border: '1px solid #c7d2fe'}}>
                      <label htmlFor="productType" style={{display: 'block', marginBottom: '6px', fontSize: '13px', color: '#3730a3', fontWeight: '600'}}>
                        {t('products.productTypeLabel')}
                      </label>
                      <select
                        id="productType"
                        className="form-input"
                        value={productFormData.productType || (productFormData.isService ? 'service' : 'standard')}
                        onChange={(e) => setProductFormData({
                          ...productFormData,
                          productType: e.target.value,
                          isService: e.target.value === 'service',
                        })}
                      >
                        <option value="standard">{t('products.productTypeStandard')}</option>
                        <option value="service">{t('products.productTypeService')}</option>
                        <option value="subscription">{t('products.productTypeSubscription')}</option>
                      </select>
                      <div style={{fontSize: '12px', color: '#6b7280', marginTop: '6px'}}>
                        {productFormData.productType === 'subscription'
                          ? t('products.productTypeSubscriptionHint')
                          : productFormData.productType === 'service'
                            ? t('products.productTypeServiceHint')
                            : t('products.productTypeStandardHint')}
                      </div>
                    </div>

                    <div style={{marginTop: '10px', padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <input
                        type="checkbox"
                        id="isComposite"
                        checked={!!productFormData.isComposite}
                        onChange={(e) => setProductFormData({...productFormData, isComposite: e.target.checked})}
                        style={{width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0}}
                      />
                      <label htmlFor="isComposite" style={{margin: 0, cursor: 'pointer', fontSize: '13px', color: '#166534', fontWeight: '600'}}>
                        🧩 Configurable composite product
                      </label>
                    </div>

                    {productFormData.isComposite && editingProduct && selectedMarketTab !== 'all' && (
                      <div style={{marginTop: '12px', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px'}}>
                        <div style={{fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px'}}>
                          Components for {selectedMarketTab.toUpperCase()} ({componentProducts.length}/8)
                        </div>
                        <input
                          className="form-input"
                          value={componentSearch}
                          onChange={e => setComponentSearch(e.target.value)}
                          placeholder="Search products to add…"
                          disabled={componentProducts.length >= 8}
                          style={{marginBottom: '6px'}}
                        />
                        {componentSearch.trim() && componentProducts.length < 8 && (
                          <div style={{maxHeight: '130px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px', background: 'white', marginBottom: '8px'}}>
                            {products.filter(product =>
                              product.id !== editingProduct.id &&
                              !product.isComposite &&
                              !componentProducts.some(component => component.id === product.id) &&
                              `${product.name} ${product.productCode || ''}`.toLowerCase().includes(componentSearch.toLowerCase())
                            ).slice(0, 8).map(product => (
                              <button key={product.id} type="button" onClick={() => {
                                setComponentProducts([...componentProducts, product]);
                                setComponentSearch('');
                              }} style={{display: 'flex', width: '100%', justifyContent: 'space-between', gap: '8px', padding: '7px 9px', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'white', cursor: 'pointer', textAlign: 'left', fontSize: '12px'}}>
                                <span>{product.name} <span style={{color: '#64748b'}}>{product.productCode || ''}</span></span>
                                <span style={{color: product.status === 'active' && product.marketIsActive !== false ? '#15803d' : '#b45309'}}>{product.status || 'active'}{product.marketIsActive === false ? ' / market inactive' : ''} · {product.price} {product.currency || ''}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {componentsLoading ? <div style={{fontSize: '12px', color: '#64748b'}}>Loading components…</div> : componentProducts.map((product, index) => (
                          <div key={product.id} style={{display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 0', borderTop: '1px solid #e2e8f0', fontSize: '12px'}}>
                            <span style={{color: '#64748b', width: '16px'}}>{index + 1}</span>
                            <span style={{flex: 1}}>{product.name} <span style={{color: product.status === 'active' && product.marketIsActive !== false ? '#15803d' : '#b45309'}}>({product.status || 'active'}{product.marketIsActive === false ? ', market inactive' : ''} · {product.price} {product.currency || ''})</span></span>
                            <button type="button" disabled={index === 0} onClick={() => setComponentProducts(componentProducts.map((item, i) => i === index ? componentProducts[i - 1] : i === index - 1 ? componentProducts[i] : item))} style={{border: 'none', background: 'none', cursor: 'pointer', color: '#475569'}}>↑</button>
                            <button type="button" disabled={index === componentProducts.length - 1} onClick={() => setComponentProducts(componentProducts.map((item, i) => i === index ? componentProducts[i + 1] : i === index + 1 ? componentProducts[i] : item))} style={{border: 'none', background: 'none', cursor: 'pointer', color: '#475569'}}>↓</button>
                            <button type="button" onClick={() => setComponentProducts(componentProducts.filter(item => item.id !== product.id))} style={{border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626'}}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Volume Discounts Section */}
                    {productFormData.productType !== 'service' && productFormData.productType !== 'subscription' && (
                    <div style={{marginTop: '20px', padding: '15px', backgroundColor: '#fff8e1', borderRadius: '6px', border: '1px solid #ffd54f'}}>
                      <h5 style={{color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        🏷️ {t('products.volumeDiscountTitle')}
                        <span style={{fontSize: '12px', fontWeight: 'normal', color: '#666'}}>— {t('products.volumeDiscountSubtitle')}</span>
                      </h5>
                      <div>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '6px'}}>
                          <span style={{fontSize: '11px', color: '#666', fontWeight: '600', paddingLeft: '2px'}}>{t('products.volumeDiscountMinQty')}</span>
                          <span style={{fontSize: '11px', color: '#666', fontWeight: '600', paddingLeft: '2px'}}>{t('products.volumeDiscountPercent')}</span>
                          <span></span>
                        </div>
                        {(productFormData.volumeDiscounts || []).map((tier, idx) => (
                          <div key={idx} style={{display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center'}}>
                            <input
                              type="number"
                              className="form-input"
                              min="2"
                              step="1"
                              value={tier.minQty || ''}
                              onChange={(e) => {
                                const newTiers = [...(productFormData.volumeDiscounts || [])];
                                newTiers[idx] = {...newTiers[idx], minQty: parseInt(e.target.value) || 0};
                                setProductFormData({...productFormData, volumeDiscounts: newTiers});
                              }}
                              placeholder={t('products.modal.tierQtyPh')}
                            />
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              max="99"
                              step="1"
                              value={tier.discountPercent || ''}
                              onChange={(e) => {
                                const newTiers = [...(productFormData.volumeDiscounts || [])];
                                newTiers[idx] = {...newTiers[idx], discountPercent: parseFloat(e.target.value) || 0};
                                setProductFormData({...productFormData, volumeDiscounts: newTiers});
                              }}
                              placeholder={t('products.modal.tierPercentPh')}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newTiers = (productFormData.volumeDiscounts || []).filter((_, i) => i !== idx);
                                setProductFormData({...productFormData, volumeDiscounts: newTiers});
                              }}
                              style={{padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', lineHeight: '1'}}
                              title={t('products.modal.deleteTier')}
                            >×</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newTiers = [...(productFormData.volumeDiscounts || []), {minQty: '', discountPercent: ''}];
                            setProductFormData({...productFormData, volumeDiscounts: newTiers});
                          }}
                          style={{marginTop: '4px', padding: '6px 14px', backgroundColor: '#e6a817', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'}}
                        >+ {t('products.volumeDiscountAddTier')}</button>
                      </div>
                      {(productFormData.volumeDiscounts || []).length === 0 && (
                        <div style={{marginTop: '8px', fontSize: '12px', color: '#999'}}>
                          {t('products.volumeDiscountEmpty')}
                        </div>
                      )}
                    </div>
                    )}

                    {/* Market Prices Section - Show only for editing existing products */}
                    {editingProduct && (
                      <MarketPricesSection
                        editingProduct={editingProduct}
                        editingProductMarkets={editingProductMarkets}
                        token={token}
                        fetchProductMarkets={fetchProductMarkets}
                      />
                    )}

                    {/* Translations Section - Show for both new and edit */}
                    <div style={{
                      backgroundColor: '#f0f7ff',
                      padding: '15px',
                      borderRadius: '8px',
                      marginTop: '20px',
                      border: '1px solid #b3d4fc'
                    }}>
                      <h4 style={{marginBottom: '4px', color: '#1976d2', fontSize: '14px'}}>
                        🌍 {t('products.modal.translationsTitle')} ({productTranslations.length})
                      </h4>
                      <div style={{fontSize: '12px', color: '#6c757d', marginBottom: '12px'}}>
                        {t('products.modal.translationsDesc')}
                      </div>
                      
                      {/* Show message for new products */}
                      {!editingProduct && (
                        <div style={{
                          backgroundColor: '#fff3cd',
                          border: '1px solid #ffc107',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: '15px',
                          fontSize: '13px',
                          color: '#856404'
                        }}>
                          ⚠️ {t('products.modal.saveFirst')}
                        </div>
                      )}
                      
                      {editingProduct && (
                        <>
                        
                        {/* Existing translations */}
                        {productTranslations.length > 0 && (
                          <div style={{marginBottom: '15px'}}>
                            {productTranslations.map(translation => (
                              <div key={translation.id} style={{
                                backgroundColor: '#fff',
                                padding: '10px 12px',
                                borderRadius: '4px',
                                marginBottom: '8px',
                                border: editingTranslation?.id === translation.id ? '2px solid #1976d2' : '1px solid #e0e0e0'
                              }}>
                                {editingTranslation?.id === translation.id ? (
                                  <div>
                                    <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                                      <span style={{
                                        backgroundColor: '#1976d2',
                                        color: '#fff',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        textTransform: 'uppercase'
                                      }}>
                                        {editingTranslation.language}
                                      </span>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={editingTranslation.name}
                                        onChange={(e) => setEditingTranslation({...editingTranslation, name: e.target.value})}
                                        style={{flex: 1, fontSize: '13px'}}
                                        placeholder={t('products.modal.translationEditNamePh')}
                                      />
                                    </div>
                                    <textarea
                                      className="form-input"
                                      value={editingTranslation.description || ''}
                                      onChange={(e) => setEditingTranslation({...editingTranslation, description: e.target.value})}
                                      rows="6"
                                      style={{marginBottom: '8px', fontSize: '13px'}}
                                      placeholder={t('products.modal.translationEditDescPh')}
                                    />
                                    <div style={{display: 'flex', gap: '8px'}}>
                                      <button type="button" className="btn" onClick={handleUpdateTranslation} style={{backgroundColor: '#28a745', fontSize: '12px'}}>
                                        ✓ {t('products.modal.translationSave')}
                                      </button>
                                      <button type="button" className="btn" onClick={() => setEditingTranslation(null)} style={{backgroundColor: '#6c757d', fontSize: '12px'}}>
                                        ✕ {t('products.modal.translationCancel')}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                    <div>
                                      <span style={{
                                        backgroundColor: '#1976d2',
                                        color: '#fff',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        marginRight: '10px',
                                        textTransform: 'uppercase'
                                      }}>
                                        {translation.language}
                                      </span>
                                      <strong>{translation.name}</strong>
                                      {translation.sourceUrl && (
                                        <a href={translation.sourceUrl} target="_blank" style={{marginLeft: '8px', fontSize: '11px'}}>🔗</a>
                                      )}
                                    </div>
                                    <div style={{display: 'flex', gap: '5px'}}>
                                      <button
                                        type="button"
                                        onClick={() => setEditingTranslation({...translation})}
                                        style={{background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', fontSize: '14px'}}
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTranslation(translation.id)}
                                        style={{background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '14px'}}
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Add new translation */}
                        <div style={{
                          backgroundColor: '#fff',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px dashed #1976d2'
                        }}>
                          <div style={{fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#1976d2'}}>
                            ➕ {t('products.modal.addTranslation')}
                          </div>
                          <div style={{display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px', marginBottom: '10px'}}>
                            <select
                              className="form-input"
                              value={newTranslation.language}
                              onChange={(e) => setNewTranslation({...newTranslation, language: e.target.value})}
                              style={{fontSize: '13px'}}
                            >
                              <option value="">{t('products.modal.translationLangPh')}</option>
                              <option value="ro">🇷🇴 Română</option>
                              <option value="de">🇩🇪 Deutsch</option>
                              <option value="fr">🇫🇷 Français</option>
                              <option value="it">🇮🇹 Italiano</option>
                              <option value="es">🇪🇸 Español</option>
                              <option value="zh">🇨🇳 中文</option>
                            </select>
                            <input
                              type="text"
                              className="form-input"
                              placeholder={t('products.modal.translationNamePh')}
                              value={newTranslation.name}
                              onChange={(e) => setNewTranslation({...newTranslation, name: e.target.value})}
                              style={{fontSize: '13px'}}
                            />
                          </div>
                          <textarea
                            className="form-input"
                            placeholder={t('products.modal.translationDescPh')}
                            value={newTranslation.description}
                            onChange={(e) => setNewTranslation({...newTranslation, description: e.target.value})}
                            rows="6"
                            style={{marginBottom: '10px', fontSize: '13px'}}
                          />
                          <div style={{display: 'flex', gap: '10px'}}>
                            <input
                              type="url"
                              className="form-input"
                              placeholder={t('products.modal.translationUrlPh')}
                              value={newTranslation.sourceUrl}
                              onChange={(e) => setNewTranslation({...newTranslation, sourceUrl: e.target.value})}
                              style={{flex: 1, fontSize: '13px'}}
                            />
                            <button
                              type="button"
                              className="btn"
                              onClick={() => handleAddTranslation(editingProduct.id)}
                              disabled={!newTranslation.language || !newTranslation.name}
                              style={{
                                backgroundColor: newTranslation.language && newTranslation.name ? '#28a745' : '#ccc',
                                whiteSpace: 'nowrap',
                                fontSize: '13px'
                              }}
                            >
                              ➕ {t('products.modal.translationAdd')}
                            </button>
                          </div>
                        </div>
                        </>
                      )}
                    </div>
                    
                    <div style={{display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end'}}>
                      <button
                        type="button"
                        className="btn"
                        style={{background: '#6c757d'}}
                        onClick={() => {
                          setShowAddProductModal(false);
                          setEditingProduct(null);
                          setProductFormData({
                            name: '',
                            description: '',
                            price: '',
                            compareAtPrice: '',
                            categoryId: '',
                            supplierId: '',
                            imageUrl: '',
                            stockQuantity: '',
                            featured: false,
                            vatValue: '',
                            vatPercentage: '21.00',
                            currency: 'RON',
                            productCode: '',
                            ean: '',
                            ncCode: '',
                            cpvCode: '',
                            status: 'active',
                            images: [],
                            weight: '',
                            length: '',
                            width: '',
                            height: '',
                            piecesPerPackage: '',
                            productQuantity: '',
                            specs: [],
                            volumeDiscounts: [],
                            priority: 0,
                            isService: false,
                            isComposite: false
                          });
                          setUploadedImages([]);
                          // Reset import from URL state
                          setImportUrl('');
                          setImportedData(null);
                          setUsageRightsConfirmed(false);
                          // Reset translations state
                          setProductTranslations([]);
                          setNewTranslation({ language: '', name: '', description: '', sourceUrl: '' });
                          setEditingTranslation(null);
                        }}
                      >
                        {t('products.modal.cancelBtn')}
                      </button>
                      <button type="submit" className="btn" style={{background: '#28a745'}}>
                        {editingProduct ? t('products.modal.updateBtn') : t('products.modal.createBtn')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* Bulk Operations Modal */}
            {showBulkModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '600px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    {bulkOperation === 'status' ? '🔄 Bulk Status Update' : '🛠️ Bulk Order Tools'}
                  </h3>
                  <p style={{marginBottom: '20px', color: '#666'}}>
                    Selected {selectedOrders.length} orders for bulk operation.
                  </p>
                  
                  {bulkOperation === 'status' && (
                    <BulkStatusComponent />
                  )}
                  
                  {bulkOperation === 'tools' && (
                    <BulkToolsComponent />
                  )}
                  
                  <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                    <button
                      type="button"
                      className="btn"
                      style={{background: '#6c757d'}}
                      onClick={() => {
                        setShowBulkModal(false);
                        setBulkOperation('');
                        setBulkResults(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Status Change Mini-Modal */}
            {statusChangeOrderId && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: 1100
              }}>
                <div style={{
                  backgroundColor: 'white', padding: '25px', borderRadius: '8px',
                  width: '350px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}>
                  <h4 style={{marginBottom: '15px', color: '#333'}}>
                    🔄 Update Status — Order #{statusChangeOrderId}
                  </h4>
                  <select
                    value={statusChangeValue}
                    onChange={(e) => setStatusChangeValue(e.target.value)}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '6px',
                      border: '1px solid #ced4da', fontSize: '14px', marginBottom: '15px'
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="in_delivery">In Delivery (În curs de livrare)</option>
                    <option value="delivered">Delivered (Livrat)</option>
                    <option value="cancelled">Cancelled (Anulat)</option>
                  </select>
                  <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                    <button
                      className="btn"
                      style={{background: '#6c757d', padding: '8px 16px'}}
                      onClick={() => { setStatusChangeOrderId(null); setStatusChangeValue(''); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn"
                      style={{background: '#28a745', padding: '8px 16px'}}
                      onClick={async () => {
                        const result = await updateOrderStatus(statusChangeOrderId, statusChangeValue);
                        if (result.success) {
                          alert(`Order #${statusChangeOrderId} status updated to "${statusChangeValue}"`);
                          if (selectedOrder && selectedOrder.id === statusChangeOrderId) {
                            setSelectedOrder({...selectedOrder, status: statusChangeValue});
                          }
                        } else {
                          alert('Error: ' + (result.message || 'Unknown error'));
                        }
                        setStatusChangeOrderId(null);
                        setStatusChangeValue('');
                      }}
                    >
                      ✅ Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Order Details Modal */}
            {showOrderDetails && selectedOrder && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '800px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    📋 {t('orders.orderDetails')} #{selectedOrder.id}
                  </h3>
                  
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px'}}>
                    <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '6px'}}>
                      <h4 style={{color: '#333', marginBottom: '10px'}}>{t('orders.orderInfo')}</h4>
                      <p><strong>{t('orders.orderId')}:</strong> #{selectedOrder.id}</p>
                      <p><strong>Status:</strong> <span style={{
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: selectedOrder.status === 'pending' ? '#fff3cd' : selectedOrder.status === 'accepted' ? '#d1ecf1' : selectedOrder.status === 'processing' ? '#cce5ff' : selectedOrder.status === 'shipped' ? '#d4edda' : selectedOrder.status === 'in_delivery' ? '#d4f4f4' : selectedOrder.status === 'delivered' ? '#d4edda' : selectedOrder.status === 'cancelled' ? '#f8d7da' : '#e2e3e5',
                        color: selectedOrder.status === 'pending' ? '#856404' : selectedOrder.status === 'accepted' ? '#0c5460' : selectedOrder.status === 'processing' ? '#0056b3' : selectedOrder.status === 'shipped' ? '#155724' : selectedOrder.status === 'in_delivery' ? '#0e7c7b' : selectedOrder.status === 'delivered' ? '#155724' : selectedOrder.status === 'cancelled' ? '#721c24' : '#383d41'
                      }}>{selectedOrder.status === 'in_delivery' ? 'In Delivery' : selectedOrder.status}</span></p>
                      <p><strong>{t('orders.paymentMethod')}:</strong> {(() => {
                        const pm = selectedOrder.paymentMethod;
                        if (pm === 'cash_on_delivery' || pm === 'cod' || pm === 'cash') return 'Ramburs (plata la livrare)';
                        if (pm === 'card' || pm === 'viva') return 'Card online';
                        return pm;
                      })()}</p>
                      <p><strong>{t('orders.paymentStatus')}:</strong> <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: (() => {
                          const pm = selectedOrder.paymentMethod;
                          if (pm === 'cash_on_delivery' || pm === 'cod' || pm === 'cash') return '#fff3cd';
                          return selectedOrder.paymentStatus === 'paid' ? '#d4edda' : '#f8d7da';
                        })(),
                        color: (() => {
                          const pm = selectedOrder.paymentMethod;
                          if (pm === 'cash_on_delivery' || pm === 'cod' || pm === 'cash') return '#856404';
                          return selectedOrder.paymentStatus === 'paid' ? '#155724' : '#721c24';
                        })()
                      }}>{(() => {
                        const pm = selectedOrder.paymentMethod;
                        if (pm === 'cash_on_delivery' || pm === 'cod' || pm === 'cash') return 'Ramburs / Numerar';
                        return selectedOrder.paymentStatus === 'paid' ? 'Plătit ✓' : (selectedOrder.paymentStatus || 'Neplătit');
                      })()}</span></p>
                      {(() => {
                        const sc = parseFloat(selectedOrder.shippingCost || '0');
                        const total = parseFloat(selectedOrder.totalAmount || '0');
                        const discount = parseFloat(selectedOrder.discountAmount || '0');
                        const subtotal = (total - sc + discount).toFixed(2);
                        return (
                          <div style={{marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #dee2e6'}}>
                            <p style={{margin: '4px 0'}}><strong>Subtotal:</strong> {subtotal} lei</p>
                            {discount > 0 && selectedOrder.voucherCode && (
                              <p style={{margin: '4px 0', color: '#28a745'}}><strong>Discount voucher {selectedOrder.voucherCode}:</strong> -{discount.toFixed(2)} lei</p>
                            )}
                            <p style={{margin: '4px 0'}}><strong>Transport:</strong> {sc > 0 ? sc.toFixed(2) + ' lei' : <span style={{color: '#28a745'}}>Gratuit</span>}</p>
                            <p style={{margin: '6px 0 0', fontSize: '15px', fontWeight: 'bold', borderTop: '1px solid #dee2e6', paddingTop: '6px'}}><strong>Total:</strong> {total.toFixed(2)} lei</p>
                          </div>
                        );
                      })()}
                      <p><strong>Created:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                      {selectedOrder.awbNumber && !selectedOrder.awbNumber.includes('-API') && !selectedOrder.awbNumber.includes('-MANUAL-') && (
                        <p><strong>AWB:</strong> <span style={{fontFamily: 'monospace', background: '#e9ecef', padding: '2px 6px', borderRadius: '3px'}}>{selectedOrder.awbNumber}</span></p>
                      )}
                      {selectedOrder.invoiceNumber && (
                        <p><strong>Factură:</strong> {selectedOrder.invoiceNumber}</p>
                      )}
                    </div>
                    
                    <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '6px'}}>
                      <h4 style={{color: '#333', marginBottom: '10px'}}>{t('orders.customerInfo')}</h4>
                      <p><strong>Name:</strong> {selectedOrder.shippingAddress.firstName} {selectedOrder.shippingAddress.lastName}</p>
                      <p><strong>Email:</strong> {selectedOrder.shippingAddress.email || '—'}</p>
                      <p><strong>Phone:</strong> {selectedOrder.shippingAddress.phone || '—'}</p>
                      <p><strong>User ID:</strong> #{selectedOrder.userId || 'Guest'}</p>
                    </div>
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px'}}>
                    <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '6px'}}>
                      <h4 style={{color: '#333', marginBottom: '10px'}}>{t('orders.shippingAddress')}</h4>
                      <p><strong>{selectedOrder.shippingAddress.firstName} {selectedOrder.shippingAddress.lastName}</strong></p>
                      <p>{selectedOrder.shippingAddress.address}</p>
                      <p>{selectedOrder.shippingAddress.city}{selectedOrder.shippingAddress.county ? `, ${selectedOrder.shippingAddress.county}` : ''}{selectedOrder.shippingAddress.state ? `, ${selectedOrder.shippingAddress.state}` : ''}</p>
                      <p>{selectedOrder.shippingAddress.zipCode} {selectedOrder.shippingAddress.country}</p>
                      {selectedOrder.shippingAddress.phone && <p>📞 {selectedOrder.shippingAddress.phone}</p>}
                    </div>
                    
                    <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '6px'}}>
                      <h4 style={{color: '#333', marginBottom: '10px'}}>Billing Address / Facturare</h4>
                      <p><strong>{selectedOrder.billingAddress.firstName} {selectedOrder.billingAddress.lastName}</strong></p>
                      {selectedOrder.billingAddress.companyName && (
                        <p style={{color: '#0056b3'}}>🏢 {selectedOrder.billingAddress.companyName}</p>
                      )}
                      {selectedOrder.billingAddress.vatNumber && (
                        <p><strong>CUI:</strong> {selectedOrder.billingAddress.vatNumber}</p>
                      )}
                      {selectedOrder.billingAddress.regCom && (
                        <p><strong>Reg. Com.:</strong> {selectedOrder.billingAddress.regCom}</p>
                      )}
                      <p>{selectedOrder.billingAddress.address}</p>
                      <p>{selectedOrder.billingAddress.city}{selectedOrder.billingAddress.county ? `, ${selectedOrder.billingAddress.county}` : ''}{selectedOrder.billingAddress.state ? `, ${selectedOrder.billingAddress.state}` : ''}</p>
                      <p>{selectedOrder.billingAddress.zipCode} {selectedOrder.billingAddress.country}</p>
                      {selectedOrder.billingAddress.phone && <p>📞 {selectedOrder.billingAddress.phone}</p>}
                    </div>
                  </div>
                  
                  <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '6px', marginBottom: '20px'}}>
                    <h4 style={{color: '#333', marginBottom: '15px'}}>Order Items</h4>
                    <div style={{overflowX: 'auto'}}>
                      <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                          <tr style={{backgroundColor: '#e9ecef'}}>
                            <th style={{padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6'}}>Product</th>
                            <th style={{padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6'}}>Quantity</th>
                            <th style={{padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6'}}>Price</th>
                            <th style={{padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6'}}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items && selectedOrder.items.map((item, index) => (
                            <tr key={index} style={{borderBottom: '1px solid #dee2e6'}}>
                              <td style={{padding: '10px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                  {item.product && item.product.imageUrl && (
                                    <img 
                                      src={item.product.imageUrl} 
                                      alt={item.product.name}
                                      style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}}
                                    />
                                  )}
                                  <span>
                                    {item.product ? item.product.name : `Product ID: ${item.productId}`}
                                    {item.compositeConfiguration?.components?.length ? (
                                      <span style={{display: 'block', fontSize: '12px', color: '#64748b', marginTop: '4px'}}>
                                        {item.compositeConfiguration.components.map(component => (
                                          <span key={component.componentProductId} style={{display: 'block'}}>
                                            {component.name || `#${component.componentProductId}`} × {component.quantity}
                                            {component.unitPrice ? ` · ${component.unitPrice}` : ''}
                                          </span>
                                        ))}
                                      </span>
                                    ) : null}
                                  </span>
                                </div>
                              </td>
                              <td style={{padding: '10px'}}>{item.quantity}</td>
                              <td style={{padding: '10px'}}>{parseFloat(item.price).toFixed(2)} lei</td>
                              <td style={{padding: '10px', fontWeight: 'bold'}}>{parseFloat(item.totalPrice).toFixed(2)} lei</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {selectedOrder.notes && (
                    <div style={{padding: '15px', background: '#fff3cd', borderRadius: '6px', marginBottom: '20px'}}>
                      <h4 style={{color: '#333', marginBottom: '10px'}}>Order Notes</h4>
                      <p>{selectedOrder.notes}</p>
                    </div>
                  )}
                  
                  <div style={{padding: '15px', background: '#f8f9fa', borderRadius: '6px', marginBottom: '20px'}}>
                    <h4 style={{color: '#333', marginBottom: '15px'}}>Order Tools</h4>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px'}}>
                      <button
                        className="btn"
                        style={{background: '#17a2b8', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'}}
                        onClick={async () => {
                          const result = await performBulkOperation('shipping', [selectedOrder.id]);
                          if (result.success) {
                            alert(`Shipping label generated for Order #${selectedOrder.id}`);
                          } else {
                            alert('Error: ' + result.message);
                          }
                        }}
                      >
                        <span>📦</span>
                        <span>Generate Shipping Label</span>
                      </button>
                      
                      <button
                        className="btn"
                        style={{background: '#ffc107', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'}}
                        onClick={() => {
                          const message = prompt('Enter notification message for customer:');
                          if (message) {
                            performBulkOperation('notifications', [selectedOrder.id], { message }).then(result => {
                              if (result.success) {
                                alert(`Notification sent to customer for Order #${selectedOrder.id}`);
                              } else {
                                alert('Error: ' + result.message);
                              }
                            });
                          }
                        }}
                      >
                        <span>📧</span>
                        <span>Send Notification</span>
                      </button>
                      
                      <button
                        className="btn"
                        style={{background: '#dc3545', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'}}
                        onClick={() => {
                          if (confirm(`Are you sure you want to process a refund for Order #${selectedOrder.id}? This action cannot be undone.`)) {
                            performBulkOperation('refunds', [selectedOrder.id]).then(result => {
                              if (result.success) {
                                alert(`Refund processed for Order #${selectedOrder.id}`);
                              } else {
                                alert('Error: ' + result.message);
                              }
                            });
                          }
                        }}
                      >
                        <span>💸</span>
                        <span>Process Refund</span>
                      </button>
                      
                      <button
                        className="btn"
                        style={{background: '#28a745', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'}}
                        onClick={() => {
                          const csvContent = `Order ID,Customer,Status,Amount (lei),Date\n${selectedOrder.id},${selectedOrder.shippingAddress.firstName} ${selectedOrder.shippingAddress.lastName},${selectedOrder.status},${selectedOrder.totalAmount},${new Date(selectedOrder.createdAt).toLocaleDateString()}`;
                          
                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `order_${selectedOrder.id}_${new Date().toISOString().split('T')[0]}.csv`;
                          a.click();
                          window.URL.revokeObjectURL(url);
                          
                          alert(`Order #${selectedOrder.id} exported to CSV`);
                        }}
                      >
                        <span>📊</span>
                        <span>Export to CSV</span>
                      </button>
                      
                      <button
                        className="btn"
                        style={{background: '#6f42c1', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'}}
                        onClick={() => {
                          setStatusChangeOrderId(selectedOrder.id);
                          setStatusChangeValue(selectedOrder.status);
                        }}
                      >
                        <span>✏️</span>
                        <span>Update Status</span>
                      </button>
                      
                      <button
                        className="btn"
                        style={{background: '#fd7e14', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px'}}
                        onClick={() => {
                          const pm = selectedOrder.paymentMethod;
                          const isCOD = pm === 'cash_on_delivery' || pm === 'cod' || pm === 'cash';
                          const invoice = `
INVOICE - Order #${selectedOrder.id}
========================================
Customer: ${selectedOrder.shippingAddress.firstName} ${selectedOrder.shippingAddress.lastName}
Email: ${selectedOrder.shippingAddress.email || '—'}
Phone: ${selectedOrder.shippingAddress.phone || '—'}
Date: ${new Date(selectedOrder.createdAt).toLocaleDateString()}
Status: ${selectedOrder.status}
Payment Method: ${isCOD ? 'Ramburs (plata la livrare)' : (pm === 'card' || pm === 'viva' ? 'Card online' : pm)}
Payment Status: ${isCOD ? 'Ramburs / Numerar' : (selectedOrder.paymentStatus === 'paid' ? 'Platit' : (selectedOrder.paymentStatus || 'Neplatit'))}
${selectedOrder.awbNumber && !selectedOrder.awbNumber.includes('-API') && !selectedOrder.awbNumber.includes('-MANUAL-') ? 'AWB: ' + selectedOrder.awbNumber : ''}${selectedOrder.invoiceNumber ? '\nFactura: ' + selectedOrder.invoiceNumber : ''}

SHIPPING ADDRESS:
${selectedOrder.shippingAddress.firstName} ${selectedOrder.shippingAddress.lastName}
${selectedOrder.shippingAddress.address}
${selectedOrder.shippingAddress.city}${selectedOrder.shippingAddress.county ? ', ' + selectedOrder.shippingAddress.county : ''} ${selectedOrder.shippingAddress.zipCode}
${selectedOrder.shippingAddress.country}

BILLING:
${selectedOrder.billingAddress.firstName} ${selectedOrder.billingAddress.lastName}
${selectedOrder.billingAddress.companyName ? 'Company: ' + selectedOrder.billingAddress.companyName : ''}${selectedOrder.billingAddress.vatNumber ? '\nCUI: ' + selectedOrder.billingAddress.vatNumber : ''}
${selectedOrder.billingAddress.address}
${selectedOrder.billingAddress.city}${selectedOrder.billingAddress.county ? ', ' + selectedOrder.billingAddress.county : ''} ${selectedOrder.billingAddress.zipCode}
${selectedOrder.billingAddress.country}

ITEMS:
${selectedOrder.items ? selectedOrder.items.map(item => `${item.quantity}x ${item.product ? item.product.name : 'Product ID: ' + item.productId} - ${parseFloat(item.price).toFixed(2)} lei x${item.quantity} = ${parseFloat(item.totalPrice).toFixed(2)} lei`).join('\n') : 'No items'}
${selectedOrder.discountAmount && parseFloat(selectedOrder.discountAmount) > 0 && selectedOrder.voucherCode ? '\nDiscount voucher ' + selectedOrder.voucherCode + ': -' + parseFloat(selectedOrder.discountAmount).toFixed(2) + ' lei' : ''}${selectedOrder.shippingCost && parseFloat(selectedOrder.shippingCost) > 0 ? '\nTransport: ' + parseFloat(selectedOrder.shippingCost).toFixed(2) + ' lei' : ''}
TOTAL: ${parseFloat(selectedOrder.totalAmount).toFixed(2)} lei
========================================
                          `;
                          
                          const blob = new Blob([invoice], { type: 'text/plain' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `invoice_${selectedOrder.id}.txt`;
                          a.click();
                          window.URL.revokeObjectURL(url);
                          
                          alert(`Invoice for Order #${selectedOrder.id} downloaded`);
                        }}
                      >
                        <span>📄</span>
                        <span>{t('orders.downloadInvoice')}</span>
                      </button>
                    </div>
                  </div>
                  
                  <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                    <button
                      type="button"
                      className="btn"
                      style={{background: '#6c757d'}}
                      onClick={() => {
                        setShowOrderDetails(false);
                        setSelectedOrder(null);
                      }}
                    >
                      {t('common.close')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Order Tools Modal */}
            {showOrderTools && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '600px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    🛠️ Order Tools
                  </h3>
                  <p style={{marginBottom: '20px', color: '#666'}}>
                    Selected {selectedOrders.length} orders for advanced operations.
                  </p>
                  
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '20px'}}>
                    <button
                      className="btn"
                      style={{background: '#17a2b8', padding: '15px', display: 'flex', alignItems: 'center', gap: '10px'}}
                      onClick={async () => {
                        const result = await performBulkOperation('shipping', selectedOrders);
                        if (result.success) {
                          alert(`Shipping labels generated for ${selectedOrders.length} orders`);
                          setShowOrderTools(false);
                          setSelectedOrders([]);
                        } else {
                          alert('Error: ' + result.message);
                        }
                      }}
                    >
                      <span style={{fontSize: '20px'}}>📦</span>
                      <div style={{textAlign: 'left'}}>
                        <div style={{fontWeight: 'bold'}}>Generate Shipping Labels</div>
                        <div style={{fontSize: '12px', opacity: '0.8'}}>Create shipping labels for selected orders</div>
                      </div>
                    </button>
                    
                    <button
                      className="btn"
                      style={{background: '#ffc107', padding: '15px', display: 'flex', alignItems: 'center', gap: '10px'}}
                      onClick={() => {
                        const message = prompt('Enter notification message for customers:');
                        if (message) {
                          performBulkOperation('notifications', selectedOrders, { message }).then(result => {
                            if (result.success) {
                              alert(`Notifications sent to ${selectedOrders.length} customers`);
                              setShowOrderTools(false);
                              setSelectedOrders([]);
                            } else {
                              alert('Error: ' + result.message);
                            }
                          });
                        }
                      }}
                    >
                      <span style={{fontSize: '20px'}}>📧</span>
                      <div style={{textAlign: 'left'}}>
                        <div style={{fontWeight: 'bold'}}>Send Notifications</div>
                        <div style={{fontSize: '12px', opacity: '0.8'}}>Send email notifications to customers</div>
                      </div>
                    </button>
                    
                    <button
                      className="btn"
                      style={{background: '#dc3545', padding: '15px', display: 'flex', alignItems: 'center', gap: '10px'}}
                      onClick={() => {
                        if (confirm('Are you sure you want to process refunds for the selected orders? This action cannot be undone.')) {
                          performBulkOperation('refunds', selectedOrders).then(result => {
                            if (result.success) {
                              alert(`Refunds processed for ${selectedOrders.length} orders`);
                              setShowOrderTools(false);
                              setSelectedOrders([]);
                            } else {
                              alert('Error: ' + result.message);
                            }
                          });
                        }
                      }}
                    >
                      <span style={{fontSize: '20px'}}>💸</span>
                      <div style={{textAlign: 'left'}}>
                        <div style={{fontWeight: 'bold'}}>Process Refunds</div>
                        <div style={{fontSize: '12px', opacity: '0.8'}}>Issue refunds for selected orders</div>
                      </div>
                    </button>
                    
                    <button
                      className="btn"
                      style={{background: '#28a745', padding: '15px', display: 'flex', alignItems: 'center', gap: '10px'}}
                      onClick={() => {
                        const escCsv = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
                        const csvContent = `Order ID,Customer Name,Customer Email,Shipping Address,Payment Method,Status,Amount,Voucher Code,Discount Amount,Date\n${selectedOrders.map(id => {
                          const order = filteredOrders.find(o => o.id === id);
                          const sa = order.shippingAddress || {};
                          const customerName = [sa.firstName, sa.lastName].filter(Boolean).join(' ') || sa.name || '';
                          const customerEmail = sa.email || '';
                          const shippingAddress = [sa.address, sa.city, sa.county, sa.postalCode, sa.country].filter(Boolean).join(', ');
                          const paymentMethod = order.paymentMethod || '';
                          const voucherCode = order.voucherCode || '';
                          const discountAmount = order.discountAmount ? parseFloat(order.discountAmount).toFixed(2) : '0.00';
                          return `${order.id},${escCsv(customerName)},${escCsv(customerEmail)},${escCsv(shippingAddress)},${escCsv(paymentMethod)},${escCsv(order.status)},${order.totalAmount},${escCsv(voucherCode)},${discountAmount},${new Date(order.createdAt).toLocaleDateString()}`;
                        }).join('\n')}`;
                        
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        window.URL.revokeObjectURL(url);
                        
                        alert(`Exported ${selectedOrders.length} orders to CSV`);
                        setShowOrderTools(false);
                        setSelectedOrders([]);
                      }}
                    >
                      <span style={{fontSize: '20px'}}>📊</span>
                      <div style={{textAlign: 'left'}}>
                        <div style={{fontWeight: 'bold'}}>Export to CSV</div>
                        <div style={{fontSize: '12px', opacity: '0.8'}}>Download order data as CSV file</div>
                      </div>
                    </button>
                  </div>
                  
                  <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                    <button
                      type="button"
                      className="btn"
                      style={{background: '#6c757d'}}
                      onClick={() => {
                        setShowOrderTools(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Add/Edit Supplier Modal */}
            {showEditSupplierModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '800px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    {editingSupplier ? '✏️ Edit Supplier' : '➕ Add New Supplier'}
                  </h3>
                  
                  <form onSubmit={handleSupplierSubmit}>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          Company Name *
                        </label>
                        <input
                          type="text"
                          value={supplierFormData.name}
                          onChange={(e) => setSupplierFormData({...supplierFormData, name: e.target.value})}
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          Email *
                        </label>
                        <input
                          type="email"
                          value={supplierFormData.email}
                          onChange={(e) => setSupplierFormData({...supplierFormData, email: e.target.value})}
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={supplierFormData.phone}
                          onChange={(e) => setSupplierFormData({...supplierFormData, phone: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          Contact Person
                        </label>
                        <input
                          type="text"
                          value={supplierFormData.contactPerson}
                          onChange={(e) => setSupplierFormData({...supplierFormData, contactPerson: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                    
                    <div style={{marginTop: '20px'}}>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                        Address
                      </label>
                      <input
                        type="text"
                        value={supplierFormData.address}
                        onChange={(e) => setSupplierFormData({...supplierFormData, address: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                    
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px'}}>
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          City
                        </label>
                        <input
                          type="text"
                          value={supplierFormData.city}
                          onChange={(e) => setSupplierFormData({...supplierFormData, city: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          State/Region
                        </label>
                        <input
                          type="text"
                          value={supplierFormData.state}
                          onChange={(e) => setSupplierFormData({...supplierFormData, state: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          ZIP Code
                        </label>
                        <input
                          type="text"
                          value={supplierFormData.zipCode}
                          onChange={(e) => setSupplierFormData({...supplierFormData, zipCode: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          Country
                        </label>
                        <input
                          type="text"
                          value={supplierFormData.country}
                          onChange={(e) => setSupplierFormData({...supplierFormData, country: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                    
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px'}}>
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          Integration Type
                        </label>
                        <select
                          value={supplierFormData.integrationType}
                          onChange={(e) => setSupplierFormData({...supplierFormData, integrationType: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        >
                          <option value="email">Email</option>
                          <option value="api">API</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          Status
                        </label>
                        <select
                          value={supplierFormData.isActive}
                          onChange={(e) => setSupplierFormData({...supplierFormData, isActive: e.target.value === 'true'})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </div>

                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                          Piață
                        </label>
                        <select
                          value={supplierFormData.marketCode || 'ro'}
                          onChange={(e) => setSupplierFormData({...supplierFormData, marketCode: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        >
                          <option value="ro">🇷🇴 România (ro)</option>
                          <option value="fr">🇫🇷 France (fr)</option>
                          <option value="com">🌍 International (com)</option>
                        </select>
                      </div>
                    </div>
                    
                    {supplierFormData.integrationType === 'api' && (
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px'}}>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                            API Endpoint
                          </label>
                          <input
                            type="url"
                            value={supplierFormData.apiEndpoint}
                            onChange={(e) => setSupplierFormData({...supplierFormData, apiEndpoint: e.target.value})}
                            placeholder="https://api.supplier.com/v1/"
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                        
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                            API Key
                          </label>
                          <input
                            type="password"
                            value={supplierFormData.apiKey}
                            onChange={(e) => setSupplierFormData({...supplierFormData, apiKey: e.target.value})}
                            placeholder="Enter API key"
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div style={{marginTop: '20px'}}>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>
                        Notes
                      </label>
                      <textarea
                        value={supplierFormData.notes}
                        onChange={(e) => setSupplierFormData({...supplierFormData, notes: e.target.value})}
                        rows="3"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    
                    <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px'}}>
                      <button
                        type="button"
                        className="btn"
                        style={{background: '#6c757d'}}
                        onClick={() => {
                          setShowEditSupplierModal(false);
                          setEditingSupplier(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn"
                        style={{background: editingSupplier ? '#007bff' : '#28a745'}}
                      >
                        {editingSupplier ? '✅ Update Supplier' : '➕ Create Supplier'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* View Supplier Modal */}
            {showViewSupplierModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '1000px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    👁️ Supplier Details - {viewingSupplier?.name}
                  </h3>
                  
                  {supplierDetails ? (
                    <div>
                      {/* Supplier Overview */}
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px'}}>
                        <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                          <h4 style={{marginBottom: '10px', color: '#495057'}}>Total Products</h4>
                          <p style={{fontSize: '24px', fontWeight: 'bold', color: '#007bff', margin: '0'}}>{supplierDetails.totalProducts}</p>
                        </div>
                        <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                          <h4 style={{marginBottom: '10px', color: '#495057'}}>Total Orders</h4>
                          <p style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745', margin: '0'}}>{supplierDetails.totalOrders}</p>
                        </div>
                        <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                          <h4 style={{marginBottom: '10px', color: '#495057'}}>Total Revenue</h4>
                          <p style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745', margin: '0'}}>€{supplierDetails.totalRevenue.toFixed(2)}</p>
                        </div>
                        <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6'}}>
                          <h4 style={{marginBottom: '10px', color: '#495057'}}>Status</h4>
                          <p style={{fontSize: '18px', fontWeight: 'bold', color: supplierDetails.supplier.isActive ? '#28a745' : '#dc3545', margin: '0'}}>
                            {supplierDetails.supplier.isActive ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Contact Information */}
                      <div style={{marginBottom: '30px'}}>
                        <h4 style={{marginBottom: '15px', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '5px'}}>📞 Contact Information</h4>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px'}}>
                          <div>
                            <strong>Email:</strong> {supplierDetails.supplier.email || 'Not provided'}
                          </div>
                          <div>
                            <strong>Phone:</strong> {supplierDetails.supplier.phone || 'Not provided'}
                          </div>
                          <div>
                            <strong>Contact Person:</strong> {supplierDetails.supplier.contactPerson || 'Not provided'}
                          </div>
                          <div>
                            <strong>Integration Type:</strong> {supplierDetails.supplier.integrationType || 'Email'}
                          </div>
                        </div>
                        
                        {supplierDetails.supplier.address && (
                          <div style={{marginTop: '15px'}}>
                            <strong>Address:</strong><br />
                            {supplierDetails.supplier.address}<br />
                            {supplierDetails.supplier.city && `${supplierDetails.supplier.city}, `}
                            {supplierDetails.supplier.state && `${supplierDetails.supplier.state} `}
                            {supplierDetails.supplier.zipCode}<br />
                            {supplierDetails.supplier.country}
                          </div>
                        )}
                        
                        {supplierDetails.supplier.notes && (
                          <div style={{marginTop: '15px'}}>
                            <strong>Notes:</strong><br />
                            <div style={{padding: '10px', background: '#f8f9fa', borderRadius: '4px', marginTop: '5px'}}>
                              {supplierDetails.supplier.notes}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* API Integration Info */}
                      {supplierDetails.supplier.integrationType === 'api' && (
                        <div style={{marginBottom: '30px'}}>
                          <h4 style={{marginBottom: '15px', color: '#333', borderBottom: '2px solid #17a2b8', paddingBottom: '5px'}}>🔗 API Integration</h4>
                          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px'}}>
                            <div>
                              <strong>API Endpoint:</strong> {supplierDetails.supplier.apiEndpoint || 'Not configured'}
                            </div>
                            <div>
                              <strong>API Key:</strong> {supplierDetails.supplier.apiKey ? '••••••••••••' : 'Not configured'}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Associated Products */}
                      <div style={{marginBottom: '30px'}}>
                        <h4 style={{marginBottom: '15px', color: '#333', borderBottom: '2px solid #ffc107', paddingBottom: '5px'}}>📦 Associated Products ({supplierDetails.totalProducts})</h4>
                        {supplierDetails.products.length > 0 ? (
                          <div style={{overflowX: 'auto'}}>
                            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                              <thead>
                                <tr style={{backgroundColor: '#f5f5f5'}}>
                                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Product</th>
                                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Price</th>
                                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Stock</th>
                                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {supplierDetails.products.slice(0, 5).map((product, index) => (
                                  <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                                    <td style={{padding: '8px'}}>{product.name}</td>
                                    <td style={{padding: '8px'}}>€{product.price}</td>
                                    <td style={{padding: '8px'}}>{product.stockQuantity}</td>
                                    <td style={{padding: '8px'}}>
                                      <span style={{
                                        padding: '2px 6px',
                                        borderRadius: '3px',
                                        backgroundColor: product.status === 'active' ? '#d4edda' : '#f8d7da',
                                        color: product.status === 'active' ? '#155724' : '#721c24',
                                        fontSize: '12px'
                                      }}>
                                        {product.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {supplierDetails.products.length > 5 && (
                              <p style={{textAlign: 'center', marginTop: '10px', color: '#666'}}>
                                ... and {supplierDetails.products.length - 5} more products
                              </p>
                            )}
                          </div>
                        ) : (
                          <p style={{color: '#666', fontStyle: 'italic'}}>No products associated with this supplier</p>
                        )}
                      </div>
                      
                      {/* Recent Orders */}
                      <div style={{marginBottom: '30px'}}>
                        <h4 style={{marginBottom: '15px', color: '#333', borderBottom: '2px solid #28a745', paddingBottom: '5px'}}>📋 Recent Orders ({supplierDetails.totalOrders})</h4>
                        {supplierDetails.orders.length > 0 ? (
                          <div style={{overflowX: 'auto'}}>
                            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                              <thead>
                                <tr style={{backgroundColor: '#f5f5f5'}}>
                                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Order ID</th>
                                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Date</th>
                                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Amount</th>
                                  <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {supplierDetails.orders.slice(0, 5).map((order, index) => (
                                  <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                                    <td style={{padding: '8px'}}>#{order.id}</td>
                                    <td style={{padding: '8px'}}>{new Date(order.createdAt).toLocaleDateString()}</td>
                                    <td style={{padding: '8px'}}>€{order.totalAmount}</td>
                                    <td style={{padding: '8px'}}>
                                      <span style={{
                                        padding: '2px 6px',
                                        borderRadius: '3px',
                                        backgroundColor: order.status === 'delivered' ? '#d4edda' : order.status === 'pending' ? '#fff3cd' : '#f8d7da',
                                        color: order.status === 'delivered' ? '#155724' : order.status === 'pending' ? '#856404' : '#721c24',
                                        fontSize: '12px'
                                      }}>
                                        {order.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {supplierDetails.orders.length > 5 && (
                              <p style={{textAlign: 'center', marginTop: '10px', color: '#666'}}>
                                ... and {supplierDetails.orders.length - 5} more orders
                              </p>
                            )}
                          </div>
                        ) : (
                          <p style={{color: '#666', fontStyle: 'italic'}}>No orders from this supplier yet</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: '40px'}}>
                      <div className="loading"></div>
                      <p style={{marginTop: '20px', color: '#666'}}>Loading supplier details...</p>
                    </div>
                  )}
                  
                  <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px'}}>
                    <button
                      type="button"
                      className="btn"
                      style={{background: '#6c757d'}}
                      onClick={() => {
                        setShowViewSupplierModal(false);
                        setViewingSupplier(null);
                        setSupplierDetails(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Supplier Bulk Operations Modal */}
            {showSupplierBulkModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '600px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    🔄 Bulk Operations - {selectedSuppliers.length} supplier(s) selected
                  </h3>
                  
                  {supplierBulkOperation === 'menu' && (
                    <div>
                      <h4 style={{marginBottom: '20px'}}>Choose Operation</h4>
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '20px'}}>
                        <button
                          className="btn"
                          style={{
                            background: '#28a745',
                            padding: '20px',
                            textAlign: 'left',
                            height: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}
                          onClick={() => setSupplierBulkOperation('activate')}
                        >
                          <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px'}}>✅ Activate Suppliers</div>
                          <div style={{fontSize: '12px', opacity: '0.9'}}>Enable order processing and API sync</div>
                        </button>
                        
                        <button
                          className="btn"
                          style={{
                            background: '#ffc107',
                            padding: '20px',
                            textAlign: 'left',
                            height: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}
                          onClick={() => setSupplierBulkOperation('deactivate')}
                        >
                          <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px'}}>❌ Deactivate Suppliers</div>
                          <div style={{fontSize: '12px', opacity: '0.9'}}>Disable order processing and pause sync</div>
                        </button>
                        
                        <button
                          className="btn"
                          style={{
                            background: '#17a2b8',
                            padding: '20px',
                            textAlign: 'left',
                            height: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}
                          onClick={() => setSupplierBulkOperation('sync-prices')}
                        >
                          <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px'}}>💰 Sync Prices</div>
                          <div style={{fontSize: '12px', opacity: '0.9'}}>Fetch latest prices from supplier APIs</div>
                        </button>
                        
                        <button
                          className="btn"
                          style={{
                            background: '#fd7e14',
                            padding: '20px',
                            textAlign: 'left',
                            height: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}
                          onClick={() => setSupplierBulkOperation('sync-stock')}
                        >
                          <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px'}}>📊 Sync Stock</div>
                          <div style={{fontSize: '12px', opacity: '0.9'}}>Update inventory levels from suppliers</div>
                        </button>
                        
                        <button
                          className="btn"
                          style={{
                            background: '#6c757d',
                            padding: '20px',
                            textAlign: 'left',
                            height: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}
                          onClick={() => setSupplierBulkOperation('status')}
                        >
                          <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px'}}>🔄 Update Status</div>
                          <div style={{fontSize: '12px', opacity: '0.9'}}>Change supplier status with options</div>
                        </button>
                        
                        <button
                          className="btn"
                          style={{
                            background: '#dc3545',
                            padding: '20px',
                            textAlign: 'left',
                            height: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}
                          onClick={() => setSupplierBulkOperation('delete')}
                        >
                          <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '8px'}}>🗑️ Delete Suppliers</div>
                          <div style={{fontSize: '12px', opacity: '0.9'}}>Permanently remove suppliers (requires confirmation)</div>
                        </button>
                      </div>
                      
                      <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                        <button
                          className="btn"
                          style={{background: '#6c757d'}}
                          onClick={() => setShowSupplierBulkModal(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {supplierBulkOperation === 'status' && (
                    <div>
                      <h4>Update Status</h4>
                      <div style={{marginBottom: '15px'}}>
                        <label style={{display: 'block', marginBottom: '5px', color: '#555'}}>New Status:</label>
                        <select 
                          id="bulkStatus"
                          style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                          defaultValue="active"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'space-between'}}>
                        <button
                          className="btn"
                          style={{background: '#6c757d'}}
                          onClick={() => setSupplierBulkOperation('menu')}
                        >
                          ← Back to Menu
                        </button>
                        <div style={{display: 'flex', gap: '10px'}}>
                          <button
                            className="btn"
                            style={{background: '#6c757d'}}
                            onClick={() => setShowSupplierBulkModal(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn"
                            style={{background: '#28a745'}}
                            onClick={async () => {
                              const status = document.getElementById('bulkStatus').value;
                              await performSupplierBulkOperation('status', { status });
                            }}
                          >
                            Update Status
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {supplierBulkOperation === 'activate' && (
                    <div>
                      <h4>Activate Suppliers</h4>
                      <p style={{marginBottom: '20px', color: '#666'}}>
                        Are you sure you want to activate {selectedSuppliers.length} supplier(s)? This will:
                      </p>
                      <ul style={{marginBottom: '20px', paddingLeft: '20px'}}>
                        <li>Enable order processing from these suppliers</li>
                        <li>Allow API synchronization (if configured)</li>
                        <li>Include suppliers in bulk operations</li>
                        <li>Enable automatic notifications</li>
                      </ul>
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'space-between'}}>
                        <button
                          className="btn"
                          style={{background: '#6c757d'}}
                          onClick={() => setSupplierBulkOperation('menu')}
                        >
                          ← Back to Menu
                        </button>
                        <div style={{display: 'flex', gap: '10px'}}>
                          <button
                            className="btn"
                            style={{background: '#6c757d'}}
                            onClick={() => setShowSupplierBulkModal(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn"
                            style={{background: '#28a745'}}
                            onClick={async () => {
                              await performSupplierBulkOperation('activate', {});
                            }}
                          >
                            Activate Suppliers
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {supplierBulkOperation === 'deactivate' && (
                    <div>
                      <h4>Deactivate Suppliers</h4>
                      <p style={{marginBottom: '20px', color: '#666'}}>
                        Are you sure you want to deactivate {selectedSuppliers.length} supplier(s)? This will:
                      </p>
                      <ul style={{marginBottom: '20px', paddingLeft: '20px'}}>
                        <li>Disable order processing from these suppliers</li>
                        <li>Pause API synchronization</li>
                        <li>Exclude suppliers from bulk operations</li>
                        <li>Stop automatic notifications</li>
                      </ul>
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'space-between'}}>
                        <button
                          className="btn"
                          style={{background: '#6c757d'}}
                          onClick={() => setSupplierBulkOperation('menu')}
                        >
                          ← Back to Menu
                        </button>
                        <div style={{display: 'flex', gap: '10px'}}>
                          <button
                            className="btn"
                            style={{background: '#6c757d'}}
                            onClick={() => setShowSupplierBulkModal(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn"
                            style={{background: '#ffc107'}}
                            onClick={async () => {
                              await performSupplierBulkOperation('deactivate', {});
                            }}
                          >
                            Deactivate Suppliers
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {supplierBulkOperation === 'sync-prices' && (
                    <div>
                      <h4>Sync Prices</h4>
                      <p style={{marginBottom: '20px', color: '#666'}}>
                        Sync product prices from {selectedSuppliers.length} supplier(s). This will:
                      </p>
                      <ul style={{marginBottom: '20px', paddingLeft: '20px'}}>
                        <li>Fetch latest prices from supplier APIs</li>
                        <li>Update all associated products</li>
                        <li>Maintain price history</li>
                        <li>Send notifications on significant changes</li>
                      </ul>
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'space-between'}}>
                        <button
                          className="btn"
                          style={{background: '#6c757d'}}
                          onClick={() => setSupplierBulkOperation('menu')}
                        >
                          ← Back to Menu
                        </button>
                        <div style={{display: 'flex', gap: '10px'}}>
                          <button
                            className="btn"
                            style={{background: '#6c757d'}}
                            onClick={() => setShowSupplierBulkModal(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn"
                            style={{background: '#17a2b8'}}
                            onClick={async () => {
                              await performSupplierBulkOperation('sync-prices', {});
                            }}
                          >
                            Sync Prices
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {supplierBulkOperation === 'sync-stock' && (
                    <div>
                      <h4>Sync Stock</h4>
                      <p style={{marginBottom: '20px', color: '#666'}}>
                        Sync stock levels from {selectedSuppliers.length} supplier(s). This will:
                      </p>
                      <ul style={{marginBottom: '20px', paddingLeft: '20px'}}>
                        <li>Fetch current inventory levels</li>
                        <li>Update product availability</li>
                        <li>Trigger low stock alerts</li>
                        <li>Update order processing status</li>
                      </ul>
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'space-between'}}>
                        <button
                          className="btn"
                          style={{background: '#6c757d'}}
                          onClick={() => setSupplierBulkOperation('menu')}
                        >
                          ← Back to Menu
                        </button>
                        <div style={{display: 'flex', gap: '10px'}}>
                          <button
                            className="btn"
                            style={{background: '#6c757d'}}
                            onClick={() => setShowSupplierBulkModal(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn"
                            style={{background: '#ffc107'}}
                            onClick={async () => {
                              await performSupplierBulkOperation('sync-stock', {});
                            }}
                          >
                            Sync Stock
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {supplierBulkOperation === 'delete' && (
                    <div>
                      <h4 style={{color: '#dc3545'}}>⚠️ Delete Suppliers</h4>
                      <p style={{marginBottom: '20px', color: '#666'}}>
                        <strong>WARNING:</strong> This action cannot be undone. Deleting {selectedSuppliers.length} supplier(s) will:
                      </p>
                      <ul style={{marginBottom: '20px', paddingLeft: '20px', color: '#dc3545'}}>
                        <li>Permanently remove supplier records</li>
                        <li>Unlink all associated products</li>
                        <li>Remove API integrations</li>
                        <li>Delete order history connections</li>
                      </ul>
                      <div style={{marginBottom: '20px'}}>
                        <label style={{display: 'block', marginBottom: '5px', color: '#555'}}>
                          Type "DELETE" to confirm:
                        </label>
                        <input 
                          type="text"
                          id="deleteConfirmation"
                          style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                          placeholder="Type DELETE to confirm"
                        />
                      </div>
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'space-between'}}>
                        <button
                          className="btn"
                          style={{background: '#6c757d'}}
                          onClick={() => setSupplierBulkOperation('menu')}
                        >
                          ← Back to Menu
                        </button>
                        <div style={{display: 'flex', gap: '10px'}}>
                          <button
                            className="btn"
                            style={{background: '#6c757d'}}
                            onClick={() => setShowSupplierBulkModal(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn"
                            style={{background: '#dc3545'}}
                            onClick={async () => {
                              const confirmation = document.getElementById('deleteConfirmation').value;
                              if (confirmation === 'DELETE') {
                                await performSupplierBulkOperation('delete', {});
                              } else {
                                alert('Please type "DELETE" to confirm this action');
                              }
                            }}
                          >
                            Delete Suppliers
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Add/Edit Category Modal */}
            {(showAddCategoryModal || editingCategory) && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '500px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    
                    const formData = new FormData(e.target);
                    const categoryData = {
                      name: formData.get('name'),
                      description: formData.get('description'),
                      slug: formData.get('slug') || formData.get('name').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                      marketCode: formData.get('marketCode') || 'ro'
                    };
                    
                    let result;
                    if (editingCategory) {
                      result = await updateCategory(editingCategory.id, categoryData);
                    } else {
                      result = await createCategory(categoryData);
                    }
                    
                    if (result.success) {
                      alert(result.message);
                      setShowAddCategoryModal(false);
                      setEditingCategory(null);
                    } else {
                      alert('Error: ' + result.message);
                    }
                  }}>
                    <div className="form-group">
                      <label className="form-label">Category Name</label>
                      <input
                        type="text"
                        name="name"
                        className="form-input"
                        defaultValue={editingCategory?.name || ''}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea
                        name="description"
                        className="form-input"
                        defaultValue={editingCategory?.description || ''}
                        rows={3}
                        placeholder="Brief description of the category"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Slug (URL-friendly name)</label>
                      <input
                        type="text"
                        name="slug"
                        className="form-input"
                        defaultValue={editingCategory?.slug || ''}
                        placeholder="auto-generated-from-name"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Piață</label>
                      <select name="marketCode" className="form-input" defaultValue={editingCategory?.marketCode || (selectedMarketTab && selectedMarketTab !== 'all' ? selectedMarketTab : 'ro')}>
                        <option value="ro">🇷🇴 România (ro)</option>
                        <option value="fr">🇫🇷 France (fr)</option>
                        <option value="com">🌍 International (com)</option>
                      </select>
                    </div>

                    {editingCategory && (
                      <div style={{marginBottom: '20px', padding: '15px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px'}}>
                        <h4 style={{margin: '0 0 5px', color: '#333'}}>Localized names</h4>
                        <p style={{margin: '0 0 12px', color: '#666', fontSize: '12px'}}>
                          Save a name for each admin language. Open category selectors refresh without changing their selected IDs.
                        </p>
                        {['ro', 'fr', 'en'].map(language => {
                          const draft = categoryTranslationDrafts[language] || { name: '', description: '' };
                          return (
                            <div key={language} style={{marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e5e5e5'}}>
                              <label className="form-label">{language.toUpperCase()} name</label>
                              <div style={{display: 'flex', gap: '8px'}}>
                                <input
                                  className="form-input"
                                  value={draft.name}
                                  onChange={event => setCategoryTranslationDrafts(previous => ({
                                    ...previous,
                                    [language]: { ...draft, name: event.target.value }
                                  }))}
                                  placeholder={`Category name in ${language.toUpperCase()}`}
                                />
                                <button
                                  type="button"
                                  className="btn"
                                  style={{background: '#007bff', width: 'auto', whiteSpace: 'nowrap'}}
                                  onClick={() => saveCategoryTranslation(language)}
                                  disabled={!draft.name.trim()}
                                >
                                  Save
                                </button>
                              </div>
                              <textarea
                                className="form-input"
                                rows={2}
                                value={draft.description}
                                onChange={event => setCategoryTranslationDrafts(previous => ({
                                  ...previous,
                                  [language]: { ...draft, description: event.target.value }
                                }))}
                                placeholder={`Description in ${language.toUpperCase()} (optional)`}
                                style={{marginTop: '6px'}}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    <div className="form-group">
                      <label className="form-label">Category Image</label>
                      {editingCategory?.imageUrl && (
                        <div style={{
                          marginBottom: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          padding: '10px',
                          backgroundColor: '#f9f9f9'
                        }}>
                          <p style={{margin: '0 0 8px 0', fontWeight: 'bold'}}>Current Image:</p>
                          <img 
                            src={editingCategory.imageUrl} 
                            alt="Current category image" 
                            style={{
                              maxWidth: '100%',
                              height: '120px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #ddd'
                            }}
                          />
                        </div>
                      )}
                      
                      <div 
                        className="image-upload-zone"
                        style={{
                          border: '2px dashed #ddd',
                          borderRadius: '8px',
                          padding: '20px',
                          textAlign: 'center',
                          backgroundColor: '#f9f9f9',
                          cursor: 'pointer'
                        }}
                        onClick={() => document.getElementById('category-image-upload').click()}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          id="category-image-upload"
                          style={{display: 'none'}}
                          onChange={async (e) => {
                            console.log('File input changed, files:', e.target.files);
                            if (e.target.files && e.target.files[0] && editingCategory) {
                              const file = e.target.files[0];
                              console.log('Starting category image upload for category:', editingCategory.id);
                              console.log('File selected:', file.name, file.size, file.type);
                              
                              try {
                                console.log('Checking if uploadCategoryImage function exists:', typeof window.uploadCategoryImage);
                                if (typeof window.uploadCategoryImage !== 'function') {
                                  console.error('uploadCategoryImage function not found on window object');
                                  alert('Upload function not available. Please refresh the page.');
                                  return;
                                }
                                const uploadResult = await window.uploadCategoryImage(editingCategory.id, file);
                                console.log('Upload result:', uploadResult);
                                
                                if (uploadResult.success) {
                                  alert('Image uploaded successfully!');
                                  // Update the current editing category with the new image URL
                                  const updatedCategory = {
                                    ...editingCategory,
                                    imageUrl: uploadResult.imageUrl
                                  };
                                  setEditingCategory(updatedCategory);
                                  
                                  // Refresh categories list to update the main table
                                  fetchCategories();
                                } else {
                                  alert('Error uploading image: ' + uploadResult.message);
                                }
                              } catch (error) {
                                console.error('Upload error:', error);
                                alert('Upload failed: Network error');
                              }
                            } else {
                              console.log('Upload conditions not met:', {
                                hasFiles: !!e.target.files,
                                fileCount: e.target.files?.length,
                                hasEditingCategory: !!editingCategory
                              });
                            }
                          }}
                        />
                        <p style={{margin: '0', color: '#666'}}>
                          📷 Click to upload new image
                        </p>
                        <p style={{margin: '5px 0 0 0', fontSize: '12px', color: '#999'}}>
                          JPG, PNG, GIF up to 5MB
                        </p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end'}}>
                      <button
                        type="button"
                        className="btn"
                        style={{background: '#6c757d'}}
                        onClick={() => {
                          setShowAddCategoryModal(false);
                          setEditingCategory(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn" style={{background: '#28a745'}}>
                        {editingCategory ? 'Update Category' : 'Create Category'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* Homepage Configuration Modal */}
            {showHomepageConfigModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '800px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>
                    🏠 Configure Homepage Categories
                  </h3>
                  
                  <div style={{
                    padding: '15px',
                    background: '#e3f2fd',
                    border: '1px solid #2196f3',
                    borderRadius: '6px',
                    marginBottom: '20px'
                  }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                      <span style={{color: '#1976d2', fontSize: '16px'}}>ℹ️</span>
                      <strong style={{color: '#1976d2'}}>Important:</strong>
                    </div>
                    <p style={{color: '#1976d2', fontSize: '14px', margin: '0'}}>
                      You can select categories for both sections while configuring. When you save, categories that appear in both sections will be kept in Main Top and automatically removed from Shop Categories.
                    </p>
                  </div>
                  
                  <div style={{marginBottom: '30px'}}>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px'}}>
                      {/* Main Top Categories Section */}
                      <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
                        <h4 style={{color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <span style={{
                            display: 'inline-block',
                            width: '20px',
                            height: '20px',
                            backgroundColor: '#007bff',
                            borderRadius: '50%',
                            color: 'white',
                            textAlign: 'center',
                            lineHeight: '20px',
                            fontSize: '12px'
                          }}>1</span>
                          Main Top Categories (Max 4)
                        </h4>
                        <p style={{color: '#666', fontSize: '14px', marginBottom: '15px'}}>
                          These categories appear in the hero section of your homepage. Select up to 4 most important categories.
                        </p>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px'}}>
                          {homepageConfig.mainTop.map((categoryId, index) => {
                            const category = categories.find(c => c.id === categoryId);
                            return category ? (
                              <div key={categoryId} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: '#007bff',
                                color: 'white',
                                borderRadius: '4px'
                              }}>
                                <span>{getCategoryName(category)}</span>
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                  <span style={{fontSize: '12px', opacity: '0.8'}}>#{index + 1}</span>
                                  <button
                                    style={{
                                      background: 'rgba(255,255,255,0.2)',
                                      border: 'none',
                                      color: 'white',
                                      cursor: 'pointer',
                                      borderRadius: '3px',
                                      padding: '2px 6px',
                                      fontSize: '12px'
                                    }}
                                    onClick={() => {
                                      const newMainTop = homepageConfig.mainTop.filter(id => id !== categoryId);
                                      setHomepageConfig({...homepageConfig, mainTop: newMainTop});
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : null;
                          })}
                        </div>
                        
                        {homepageConfig.mainTop.length < 4 && (
                          <select
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              backgroundColor: 'white'
                            }}
                            onChange={(e) => {
                              const categoryId = parseInt(e.target.value);
                              if (categoryId && !homepageConfig.mainTop.includes(categoryId)) {
                                setHomepageConfig({
                                  ...homepageConfig,
                                  mainTop: [...homepageConfig.mainTop, categoryId]
                                });
                              }
                              e.target.value = '';
                            }}
                            value=""
                          >
                            <option value="">+ Add Category to Main Top</option>
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>
                                {getCategoryName(category)}
                                {homepageConfig.mainTop.includes(category.id) && ' (Already selected)'}
                                {homepageConfig.mainShop.includes(category.id) && ' (In Shop section)'}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      
                      {/* Main Shop Categories Section */}
                      <div style={{padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
                        <h4 style={{color: '#333', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <span style={{
                            display: 'inline-block',
                            width: '20px',
                            height: '20px',
                            backgroundColor: '#28a745',
                            borderRadius: '50%',
                            color: 'white',
                            textAlign: 'center',
                            lineHeight: '20px',
                            fontSize: '12px'
                          }}>2</span>
                          Shop Categories (Max 3)
                        </h4>
                        <p style={{color: '#666', fontSize: '14px', marginBottom: '15px'}}>
                          These categories appear in the "Shop by Category" section. Select up to 3 popular categories.
                        </p>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px'}}>
                          {homepageConfig.mainShop.map((categoryId, index) => {
                            const category = categories.find(c => c.id === categoryId);
                            return category ? (
                              <div key={categoryId} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: '#28a745',
                                color: 'white',
                                borderRadius: '4px'
                              }}>
                                <span>{getCategoryName(category)}</span>
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                  <span style={{fontSize: '12px', opacity: '0.8'}}>#{index + 1}</span>
                                  <button
                                    style={{
                                      background: 'rgba(255,255,255,0.2)',
                                      border: 'none',
                                      color: 'white',
                                      cursor: 'pointer',
                                      borderRadius: '3px',
                                      padding: '2px 6px',
                                      fontSize: '12px'
                                    }}
                                    onClick={() => {
                                      const newMainShop = homepageConfig.mainShop.filter(id => id !== categoryId);
                                      setHomepageConfig({...homepageConfig, mainShop: newMainShop});
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : null;
                          })}
                        </div>
                        
                        {homepageConfig.mainShop.length < 3 && (
                          <select
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              backgroundColor: 'white'
                            }}
                            onChange={(e) => {
                              const categoryId = parseInt(e.target.value);
                              if (categoryId && !homepageConfig.mainShop.includes(categoryId)) {
                                setHomepageConfig({
                                  ...homepageConfig,
                                  mainShop: [...homepageConfig.mainShop, categoryId]
                                });
                              }
                              e.target.value = '';
                            }}
                            value=""
                          >
                            <option value="">+ Add Category to Shop Section</option>
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>
                                {getCategoryName(category)}
                                {homepageConfig.mainShop.includes(category.id) && ' (Already selected)'}
                                {homepageConfig.mainTop.includes(category.id) && ' (In Main Top)'}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '15px',
                    background: '#e9ecef',
                    borderRadius: '6px',
                    marginBottom: '20px'
                  }}>
                    <h5 style={{color: '#495057', marginBottom: '10px'}}>Current Configuration Summary</h5>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
                      <div>
                        <strong style={{color: '#007bff'}}>Main Top ({homepageConfig.mainTop.length}/4):</strong>
                        <div style={{fontSize: '14px', color: '#666'}}>
                          {homepageConfig.mainTop.length > 0 ? 
                            homepageConfig.mainTop.map(id => getCategoryName(categories.find(c => c.id === id))).join(', ') :
                            'None selected'
                          }
                        </div>
                      </div>
                      <div>
                        <strong style={{color: '#28a745'}}>Shop Section ({homepageConfig.mainShop.length}/3):</strong>
                        <div style={{fontSize: '14px', color: '#666'}}>
                          {homepageConfig.mainShop.length > 0 ? 
                            homepageConfig.mainShop.map(id => getCategoryName(categories.find(c => c.id === id))).join(', ') :
                            'None selected'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                    <button
                      type="button"
                      className="btn"
                      style={{background: '#6c757d'}}
                      onClick={() => {
                        setShowHomepageConfigModal(false);
                        setHomepageConfig({ mainTop: [], mainShop: [] });
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{background: '#28a745'}}
                      onClick={async () => {
                        try {
                          const response = await fetch('/admin/api/categories/bulk/homepage', {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              mainTopCategories: homepageConfig.mainTop,
                              mainShopCategories: homepageConfig.mainShop,
                              marketCode: selectedMarketTab && selectedMarketTab !== 'all' ? selectedMarketTab : undefined
                            })
                          });
                          
                          const data = await response.json();
                          
                          if (response.ok) {
                            alert('Homepage categories updated successfully!');
                            setShowHomepageConfigModal(false);
                            setHomepageConfig({ mainTop: [], mainShop: [] }); // Reset the configuration
                            fetchCategories(); // Refresh the categories list
                          } else {
                            alert('Error: ' + data.message);
                          }
                        } catch (err) {
                          alert('Network error: ' + err.message);
                        }
                      }}
                    >
                      💾 Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Company Settings Modal */}
            {showCompanySettingsModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '30px',
                  maxWidth: '600px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>🏢 Edit Company Settings</h3>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const settingsData = {
                      name: formData.get('name'),
                      email: formData.get('email'),
                      logisticsEmail: formData.get('logisticsEmail'),
                      phone: formData.get('phone'),
                      address: formData.get('address'),
                      city: formData.get('city'),
                      state: formData.get('state'),
                      zipCode: formData.get('zipCode'),
                      country: formData.get('country'),
                      contactPerson: formData.get('contactPerson'),
                      website: formData.get('website'),
                      vatNumber: formData.get('vatNumber'),
                      registrationNumber: formData.get('registrationNumber'),
                      bankName: formData.get('bankName'),
                      iban: formData.get('iban'),
                      defaultCurrency: formData.get('defaultCurrency'),
                      defaultVatPercentage: formData.get('defaultVatPercentage'),
                      reverseChargeVat: formData.get('reverseChargeVat'),
                      freeShippingThreshold: formData.get('freeShippingThreshold'),
                      standardShippingCost: formData.get('standardShippingCost'),
                       description: formData.get('description')
                    };
                    
                    const result = await updateCompanySettings(settingsData);
                    
                    if (result.success) {
                      alert('✅ Company settings updated successfully!');
                      setCompanySettings(settingsData);
                      setShowCompanySettingsModal(false);
                    } else {
                      alert(`❌ Error updating company settings: ${result.message}`);
                    }
                  }}>
                    
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px'}}>
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Company Name *</label>
                        <input
                          type="text"
                          name="name"
                          defaultValue={companySettings.name}
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Email *</label>
                        <input
                          type="email"
                          name="email"
                          defaultValue={companySettings.email}
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Logistics Email</label>
                        <input
                          type="email"
                          name="logisticsEmail"
                          defaultValue={companySettings.logisticsEmail}
                          placeholder="Email for order notifications"
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Phone</label>
                        <input
                          type="text"
                          name="phone"
                          defaultValue={companySettings.phone}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Website</label>
                        <input
                          type="url"
                          name="website"
                          defaultValue={companySettings.website}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Street Address</label>
                        <input
                          type="text"
                          name="address"
                          defaultValue={companySettings.address}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>City</label>
                        <input
                          type="text"
                          name="city"
                          defaultValue={companySettings.city}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>State/Province</label>
                        <input
                          type="text"
                          name="state"
                          defaultValue={companySettings.state}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>ZIP/Postal Code</label>
                        <input
                          type="text"
                          name="zipCode"
                          defaultValue={companySettings.zipCode}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Country</label>
                        <input
                          type="text"
                          name="country"
                          defaultValue={companySettings.country}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Contact Person</label>
                        <input
                          type="text"
                          name="contactPerson"
                          defaultValue={companySettings.contactPerson}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>VAT Number</label>
                        <input
                          type="text"
                          name="vatNumber"
                          defaultValue={companySettings.vatNumber}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Registration Number</label>
                        <input
                          type="text"
                          name="registrationNumber"
                          defaultValue={companySettings.registrationNumber}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Bank Name</label>
                        <input
                          type="text"
                          name="bankName"
                          defaultValue={companySettings.bankName}
                          placeholder="Banca Comercială Română"
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>IBAN</label>
                        <input
                          type="text"
                          name="iban"
                          defaultValue={companySettings.iban}
                          placeholder="RO49 AAAA 1B31 0075 9384 0000"
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Default VAT & Currency Settings */}
                    <div style={{marginBottom: '20px', padding: '15px', background: '#f0f8ff', border: '1px solid #007bff', borderRadius: '6px'}}>
                      <h4 style={{color: '#007bff', marginBottom: '15px', fontSize: '16px'}}>💰 Default Product Settings</h4>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px'}}>
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Default Currency</label>
                          <select
                            name="defaultCurrency"
                            defaultValue={companySettings.defaultCurrency || 'EUR'}
                            onChange={handleCurrencyChange}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          >
                            <option value="EUR">EUR (Euro)</option>
                            <option value="RON">RON (Romanian Leu)</option>
                            <option value="USD">USD (US Dollar)</option>
                            <option value="GBP">GBP (British Pound)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Default VAT %</label>
                           <select
                             name="defaultVatPercentage"
                             defaultValue={companySettings.defaultVatPercentage || '19.00'}
                             style={{
                               width: '100%',
                               padding: '8px',
                               border: '1px solid #ddd',
                               borderRadius: '4px'
                             }}
                           >
                             <option value="0.00">{t('products.modal.vatReverse')}</option>
                             <option value="5.00">5% ({t('products.modal.vatReduced')})</option>
                             <option value="9.00">9% ({t('products.modal.vatReduced')})</option>
                             <option value="19.00">19% (TVA standard România)</option>
                             <option value="20.00">20% (TVA standard France)</option>
                             <option value="21.00">21% ({t('products.modal.vatStandard')})</option>
                             <option value="24.00">24% ({t('products.modal.vatLuxury')})</option>
                           </select>
                        </div>
                        
                        <div>
                          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Reverse Charge VAT %</label>
                          <input
                            type="number"
                            step="0.01"
                            name="reverseChargeVat"
                            defaultValue={companySettings.reverseChargeVat || '0.00'}
                            placeholder="0.00"
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Shipping Settings Section */}
                      <div style={{background: '#e3f2fd', padding: '20px', borderRadius: '6px', border: '1px solid #bbdefb', marginBottom: '20px'}}>
                        <h4 style={{color: '#1976d2', marginBottom: '15px', borderBottom: '2px solid #2196f3', paddingBottom: '5px'}}>
                          🚚 Shipping Settings
                        </h4>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                          <div>
                            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>
                              Free Shipping Threshold ({companySettings.defaultCurrency || 'EUR'})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              name="freeShippingThreshold"
                              defaultValue={companySettings.freeShippingThreshold || '500.00'}
                              placeholder="500.00"
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px'
                              }}
                            />
                            <small style={{color: '#666', fontSize: '12px'}}>Orders above this amount get free shipping</small>
                          </div>
                          
                          <div>
                            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>
                              Standard Shipping Cost ({companySettings.defaultCurrency || 'EUR'})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              name="standardShippingCost"
                              defaultValue={companySettings.standardShippingCost || '25.00'}
                              placeholder="25.00"
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px'
                              }}
                            />
                            <small style={{color: '#666', fontSize: '12px'}}>Cost for orders below free shipping threshold</small>
                          </div>
                        </div>
                      </div>
                      <p style={{fontSize: '12px', color: '#666', marginTop: '10px', fontStyle: 'italic'}}>
                        These values will be used as defaults when creating new products. You can still modify them per product.
                      </p>
                    </div>
                    
                    <div style={{marginBottom: '20px'}}>
                      <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333'}}>Company Description</label>
                      <textarea
                        name="description"
                        defaultValue={companySettings.description}
                        rows="4"
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                      <button
                        type="button"
                        className="btn"
                        style={{background: '#6c757d'}}
                        onClick={() => setShowCompanySettingsModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn"
                        style={{background: '#007bff'}}
                      >
                        💾 Save Settings
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* Excel Import Modal */}
            {showExcelImportModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '30px',
                  borderRadius: '8px',
                  width: '90%',
                  maxWidth: '600px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <h3 style={{marginBottom: '20px', color: '#333'}}>📤 Import Products from Excel</h3>
                  
                  <div style={{marginBottom: '20px', padding: '15px', background: '#e7f3ff', borderRadius: '6px', border: '1px solid #b8daff'}}>
                    <h4 style={{color: '#0c5460', marginBottom: '10px'}}>📋 Import Instructions</h4>
                    <ul style={{color: '#0c5460', margin: '0', paddingLeft: '20px'}}>
                      <li>Download the Excel template first using the "Download Excel Template" button</li>
                      <li>Fill in your product data following the template format</li>
                      <li>Required fields: Product Name, Price, Stock Quantity, Category ID</li>
                      <li>Optional fields: Description, Status, VAT %, Product Code, NC Code, CPV Code</li>
                      <li>Category ID must match existing categories in the system</li>
                      <li>Price should be in decimal format (e.g., 29.99)</li>
                    </ul>
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#333'}}>
                      Select Excel File (.xlsx)
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setExcelFile(e.target.files[0])}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px dashed #ddd',
                        borderRadius: '6px',
                        background: '#f8f9fa'
                      }}
                    />
                    {excelFile && (
                      <p style={{marginTop: '8px', color: '#28a745', fontSize: '14px'}}>
                        📁 Selected: {excelFile.name}
                      </p>
                    )}
                  </div>

                  {importResults && importResults.loading && (
                    <div style={{textAlign: 'center', marginBottom: '20px'}}>
                      <div className="loading"></div>
                      <p style={{color: '#666', marginTop: '10px'}}>Se procesează fișierul Excel...</p>
                    </div>
                  )}

                  {/* ── Duplicate confirmation step ── */}
                  {importDuplicates && (
                    <div style={{marginBottom: '20px', border: '1px solid #f0ad4e', borderRadius: '6px', overflow: 'hidden'}}>
                      <div style={{background: '#fff3cd', padding: '12px 15px', borderBottom: '1px solid #f0ad4e'}}>
                        <h4 style={{color: '#856404', margin: 0}}>⚠️ {importDuplicates.duplicates.length} produs(e) cu cod existent</h4>
                        <p style={{color: '#856404', margin: '4px 0 0 0', fontSize: '13px'}}>Alege ce să se întâmple cu fiecare produs. Celelalte rânduri fără cod duplicat vor fi importate normal.</p>
                      </div>
                      <div style={{padding: '10px 15px'}}>
                        <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
                          <button onClick={() => setImportDuplicates(d => ({...d, strategies: Object.fromEntries(d.duplicates.map(x => [x.code, 'update']))}))} style={{padding: '5px 10px', border: '1px solid #17a2b8', background: '#17a2b8', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'}}>✏️ Actualizează toate</button>
                          <button onClick={() => setImportDuplicates(d => ({...d, strategies: Object.fromEntries(d.duplicates.map(x => [x.code, 'skip']))}))} style={{padding: '5px 10px', border: '1px solid #6c757d', background: '#6c757d', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'}}>⏭ Sari peste toate</button>
                        </div>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                          <thead>
                            <tr style={{background: '#f8f9fa'}}>
                              <th style={{padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Cod produs</th>
                              <th style={{padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Existent în sistem</th>
                              <th style={{padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Nou (Excel, rând {'{'}rândului{'}'})</th>
                              <th style={{padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #ddd'}}>Acțiune</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importDuplicates.duplicates.map(d => (
                              <tr key={d.code} style={{borderBottom: '1px solid #f0f0f0'}}>
                                <td style={{padding: '6px 8px', fontFamily: 'monospace', fontWeight: 'bold'}}>{d.code}</td>
                                <td style={{padding: '6px 8px', color: '#666'}}>{d.existingName}</td>
                                <td style={{padding: '6px 8px'}}>{d.newName} <span style={{color: '#888', fontSize: '11px'}}>(r.{d.rowNumber})</span></td>
                                <td style={{padding: '6px 8px', textAlign: 'center'}}>
                                  <select
                                    value={importDuplicates.strategies[d.code] || 'skip'}
                                    onChange={e => setImportDuplicates(prev => ({...prev, strategies: {...prev.strategies, [d.code]: e.target.value}}))}
                                    style={{padding: '3px 6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', background: importDuplicates.strategies[d.code] === 'update' ? '#d1ecf1' : '#f8f9fa'}}
                                  >
                                    <option value="skip">⏭ Sari peste</option>
                                    <option value="update">✏️ Actualizează</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importDuplicates.parseErrors.length > 0 && (
                          <div style={{marginTop: '8px', color: '#721c24', fontSize: '12px'}}>
                            <b>Erori de validare ({importDuplicates.parseErrors.length}):</b> {importDuplicates.parseErrors.slice(0, 3).join('; ')}{importDuplicates.parseErrors.length > 3 ? '…' : ''}
                          </div>
                        )}
                      </div>
                      <div style={{padding: '10px 15px', borderTop: '1px solid #f0ad4e', display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
                        <button onClick={() => setImportDuplicates(null)} style={{padding: '7px 14px', border: '1px solid #6c757d', background: 'white', borderRadius: '4px', cursor: 'pointer'}}>Anulează</button>
                        <button
                          onClick={() => importProductsFromExcel(excelFile, importDuplicates.strategies)}
                          style={{padding: '7px 14px', border: 'none', background: '#fd7e14', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}
                        >
                          📤 Continuă importul
                        </button>
                      </div>
                    </div>
                  )}

                  {importResults && !importResults.loading && (
                    <div style={{
                      marginBottom: '20px',
                      padding: '15px',
                      borderRadius: '6px',
                      background: importResults.success ? '#d4edda' : '#f8d7da',
                      border: importResults.success ? '1px solid #c3e6cb' : '1px solid #f5c6cb'
                    }}>
                      <h4 style={{color: importResults.success ? '#155724' : '#721c24', marginBottom: '10px'}}>
                        {importResults.success ? '✅ Rezultate import' : '❌ Import eșuat'}
                      </h4>
                      {importResults.success ? (
                        <div style={{color: '#155724'}}>
                          <p><strong>Total rânduri:</strong> {importResults.total}</p>
                          <p><strong>Importate (noi):</strong> {importResults.imported}</p>
                          {importResults.updated > 0 && <p><strong>Actualizate:</strong> {importResults.updated}</p>}
                          {importResults.skipped > 0 && <p><strong>Omise:</strong> {importResults.skipped}</p>}
                          {importResults.errors?.length > 0 && (
                            <details style={{marginTop: '8px'}}>
                              <summary style={{cursor: 'pointer'}}><strong>Erori ({importResults.errors.length}):</strong></summary>
                              <ul style={{marginTop: '6px', paddingLeft: '16px', fontSize: '12px'}}>
                                {importResults.errors.map((e, i) => <li key={i}>{e}</li>)}
                              </ul>
                            </details>
                          )}
                        </div>
                      ) : (
                        <p style={{color: '#721c24'}}>{importResults.message}</p>
                      )}
                    </div>
                  )}

                  <div style={{display: 'flex', gap: '10px', justifyContent: 'space-between'}}>
                    <div style={{display: 'flex', gap: '10px'}}>
                      <button
                        type="button"
                        className="btn"
                        style={{background: '#28a745'}}
                        onClick={downloadExcelTemplate}
                      >
                        📥 Download Template
                      </button>
                    </div>
                    <div style={{display: 'flex', gap: '10px'}}>
                      <button
                        type="button"
                        className="btn"
                        style={{background: '#6c757d'}}
                        onClick={() => {
                          setShowExcelImportModal(false);
                          setExcelFile(null);
                          setImportResults(null);
                          setImportDuplicates(null);
                        }}
                      >
                        Închide
                      </button>
                      {!importDuplicates && (
                        <button
                          type="button"
                          className="btn"
                          style={{background: '#fd7e14'}}
                          onClick={() => importProductsFromExcel(excelFile)}
                          disabled={!excelFile || (importResults && importResults.loading)}
                        >
                          📤 Importă produse
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      };

      return (
        <div className="container">
          <div className="admin-header">
            <div className="logo" onClick={() => setActiveView('dashboard')} style={{cursor: 'pointer'}}>
              <img src="/attached_assets/logo_xHACCP-S1_1772812623761.png" alt="xHACCP Logo" />
              <span>xHACCP Admin</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
              <span style={{fontSize: '14px', color: '#666'}}>
                {t('header.welcome')}, {admin?.firstName || 'Admin'}
                {adminIsSuperAdmin
                  ? <span style={{marginLeft:'6px',background:'#667eea',color:'white',fontSize:'11px',padding:'2px 7px',borderRadius:'10px',fontWeight:'600'}}>Superadmin</span>
                  : <span style={{marginLeft:'6px',background:'#ff9800',color:'white',fontSize:'11px',padding:'2px 7px',borderRadius:'10px',fontWeight:'600'}}>{(admin?.adminMarkets||[]).map(m=>m.toUpperCase()).join(', ')}</span>
                }
              </span>
              <LanguageSwitcher />
              <button onClick={handleLogout} className="btn btn-secondary" style={{padding: '8px 16px', fontSize: '14px', width: 'auto'}}>
                {t('header.logout')}
              </button>
            </div>
          </div>

          {/* Marketplace selector bar */}
          <div style={{background:'rgba(255,255,255,0.95)',backdropFilter:'blur(10px)',borderRadius:'12px',padding:'8px 12px',marginBottom:'12px',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',border:'1px solid rgba(255,255,255,0.2)',display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
            <span style={{fontSize:'13px',fontWeight:'600',color:'#555',marginRight:'4px'}}>🌍 Marketplace:</span>
            {adminIsSuperAdmin && (
              <button
                onClick={() => setSelectedMarketTab('all')}
                style={{padding:'5px 14px',borderRadius:'20px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:'600',
                  background: selectedMarketTab==='all' ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#f0f0f0',
                  color: selectedMarketTab==='all' ? 'white' : '#555',
                  boxShadow: selectedMarketTab==='all' ? '0 2px 8px rgba(102,126,234,0.4)' : 'none',
                  transition:'all 0.2s'}}
              >🌐 All</button>
            )}
            {(adminIsSuperAdmin ? ['ro','fr','com'] : (admin?.adminMarkets||[])).map(mkt => {
              const flags = {ro:'🇷🇴',fr:'🇫🇷',com:'🌐'};
              const labels = {ro:'Romania (.ro)',fr:'France (.fr)',com:'International (.com)'};
              const active = selectedMarketTab === mkt;
              return (
                <button key={mkt}
                  onClick={() => setSelectedMarketTab(mkt)}
                  style={{padding:'5px 14px',borderRadius:'20px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:'600',
                    background: active ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#f0f0f0',
                    color: active ? 'white' : '#555',
                    boxShadow: active ? '0 2px 8px rgba(102,126,234,0.4)' : 'none',
                    transition:'all 0.2s'}}
                >
                  {flags[mkt]||'🌐'} {labels[mkt]||mkt.toUpperCase()}
                </button>
              );
            })}
          </div>
          
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleViewChange('dashboard')}
            >
              <span style={{fontSize: '18px'}}>📊</span>
              <span style={{fontSize: '12px'}}>{t('nav.dashboard')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'orders' ? 'active' : ''}`}
              onClick={() => handleViewChange('orders')}
            >
              <span style={{fontSize: '18px'}}>📋</span>
              <span style={{fontSize: '12px'}}>{t('nav.orders')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'products' ? 'active' : ''}`}
              onClick={() => handleViewChange('products')}
            >
              <span style={{fontSize: '18px'}}>📦</span>
              <span style={{fontSize: '12px'}}>{t('nav.products')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'categories' ? 'active' : ''}`}
              onClick={() => handleViewChange('categories')}
            >
              <span style={{fontSize: '18px'}}>📁</span>
              <span style={{fontSize: '12px'}}>{t('nav.categories')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'suppliers' ? 'active' : ''}`}
              onClick={() => handleViewChange('suppliers')}
            >
              <span style={{fontSize: '18px'}}>🏢</span>
              <span style={{fontSize: '12px'}}>{t('nav.suppliers')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'vouchers' ? 'active' : ''}`}
              onClick={() => handleViewChange('vouchers')}
            >
              <span style={{fontSize: '18px'}}>🎟️</span>
              <span style={{fontSize: '12px'}}>{t('nav.vouchers')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'blog' ? 'active' : ''}`}
              onClick={() => handleViewChange('blog')}
            >
              <span style={{fontSize: '18px'}}>📝</span>
              <span style={{fontSize: '12px'}}>{t('nav.blog')}</span>
            </button>
            <button
              className={`nav-tab ${activeView === 'homepage-hero' ? 'active' : ''}`}
              onClick={() => handleViewChange('homepage-hero')}
            >
              <span style={{fontSize: '18px'}}>🖼️</span>
              <span style={{fontSize: '12px'}}>{t('homepageHero.navLabel')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'google-feed' ? 'active' : ''}`}
              onClick={() => handleViewChange('google-feed')}
            >
              <span style={{fontSize: '18px'}}>🛍️</span>
              <span style={{fontSize: '12px'}}>Google Feed</span>
            </button>
            <button
              className={`nav-tab ${activeView === 'invoices' ? 'active' : ''}`}
              onClick={() => { handleViewChange('invoices'); fetchInvoices(); fetchInvoiceCounters(); }}
            >
              <span style={{fontSize: '18px'}}>🧾</span>
              <span style={{fontSize: '12px'}}>{t('nav.invoices')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => handleViewChange('users')}
            >
              <span style={{fontSize: '18px'}}>👥</span>
              <span style={{fontSize: '12px'}}>{t('nav.users')}</span>
            </button>
            <button 
              className={`nav-tab ${activeView === 'company-settings' ? 'active' : ''}`}
              onClick={() => handleViewChange('company-settings')}
            >
              <span style={{fontSize: '18px'}}>⚙️</span>
              <span style={{fontSize: '12px'}}>{t('nav.companySettings')}</span>
            </button>
            <button
              className={`nav-tab ${activeView === 'marketing' ? 'active' : ''}`}
              onClick={() => handleViewChange('marketing')}
            >
              <span style={{fontSize: '18px'}}>📣</span>
              <span style={{fontSize: '12px'}}>{t('nav.marketing')}</span>
            </button>
            <button
              className={`nav-tab ${activeView === 'wms' ? 'active' : ''}`}
              onClick={() => handleViewChange('wms')}
            >
              <span style={{fontSize: '18px'}}>🚚</span>
              <span style={{fontSize: '12px'}}>WMS</span>
            </button>
          </div>
          
          <div className="content-area">
            {renderContent()}
          </div>
          <ModalsComponent key={modalKey} />
          {showAddOrderModal && <AddOrderModal />}

          {/* Blog Preview Modal */}
          {previewBlogPost && (
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:9000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'40px 20px',overflowY:'auto'}}
              onClick={(e) => { if(e.target===e.currentTarget) setPreviewBlogPost(null); }}>
              <div style={{background:'white',borderRadius:'12px',width:'100%',maxWidth:'760px',padding:'32px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',position:'relative'}}>
                <button onClick={() => setPreviewBlogPost(null)}
                  style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',fontSize:'24px',cursor:'pointer',color:'#666'}}>✕</button>
                {previewBlogPost.imageUrl && (
                  <img src={previewBlogPost.imageUrl} alt={previewBlogPost.title}
                    style={{width:'100%',height:'240px',objectFit:'cover',borderRadius:'8px',marginBottom:'20px'}} />
                )}
                <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
                  <span style={{background:'#e3f2fd',color:'#1565c0',padding:'3px 12px',borderRadius:'20px',fontSize:'12px',fontWeight:'600'}}>{previewBlogPost.category}</span>
                  <span style={{background:'#f5f5f5',color:'#666',padding:'3px 12px',borderRadius:'20px',fontSize:'12px'}}>{previewBlogPost.language === 'ro' ? '🇷🇴 Română' : '🇬🇧 English'}</span>
                  {previewBlogPost.readTimeMinutes && <span style={{background:'#f5f5f5',color:'#666',padding:'3px 12px',borderRadius:'20px',fontSize:'12px'}}>⏱ {previewBlogPost.readTimeMinutes} min</span>}
                </div>
                <h2 style={{margin:'0 0 8px',fontSize:'24px',color:'#1a1a1a',lineHeight:'1.3'}}>{previewBlogPost.title}</h2>
                <p style={{color:'#666',fontSize:'14px',margin:'0 0 20px',fontStyle:'italic'}}>{previewBlogPost.excerpt}</p>
                <hr style={{border:'none',borderTop:'1px solid #eee',margin:'0 0 20px'}}/>
                <div style={{fontSize:'15px',lineHeight:'1.7',color:'#333',whiteSpace:'pre-wrap',maxHeight:'60vh',overflowY:'auto'}}>
                  {previewBlogPost.content}
                </div>
                <div style={{marginTop:'20px',textAlign:'right'}}>
                  <a href={'/blog/' + previewBlogPost.slug} target="_blank" rel="noopener"
                    style={{display:'inline-block',background:'#0d6efd',color:'white',padding:'8px 20px',borderRadius:'6px',textDecoration:'none',fontSize:'14px'}}>
                    Deschide pe site →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Blog Edit Modal */}
          {editingBlogPost && (
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:9000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'40px 20px',overflowY:'auto'}}
              onClick={(e) => { if(e.target===e.currentTarget) setEditingBlogPost(null); }}>
              <div style={{background:'white',borderRadius:'12px',width:'100%',maxWidth:'800px',padding:'32px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',position:'relative'}}>
                <button onClick={() => setEditingBlogPost(null)}
                  style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',fontSize:'24px',cursor:'pointer',color:'#666'}}>✕</button>
                <h3 style={{margin:'0 0 24px',fontSize:'20px',color:'#1a1a1a'}}>✏️ Editează articol</h3>

                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontWeight:'600',marginBottom:'6px',fontSize:'14px',color:'#495057'}}>Titlu</label>
                  <input value={blogEditForm.title} onChange={e => setBlogEditForm(f=>({...f,title:e.target.value}))}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #ced4da',borderRadius:'6px',fontSize:'14px',boxSizing:'border-box'}} />
                </div>

                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontWeight:'600',marginBottom:'6px',fontSize:'14px',color:'#495057'}}>Categorie</label>
                  <input value={blogEditForm.category} onChange={e => setBlogEditForm(f=>({...f,category:e.target.value}))}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #ced4da',borderRadius:'6px',fontSize:'14px',boxSizing:'border-box'}} />
                </div>

                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontWeight:'600',marginBottom:'6px',fontSize:'14px',color:'#495057'}}>Rezumat (excerpt)</label>
                  <textarea value={blogEditForm.excerpt} onChange={e => setBlogEditForm(f=>({...f,excerpt:e.target.value}))} rows={3}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #ced4da',borderRadius:'6px',fontSize:'14px',resize:'vertical',boxSizing:'border-box'}} />
                </div>

                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontWeight:'600',marginBottom:'6px',fontSize:'14px',color:'#495057'}}>URL Imagine</label>
                  <input value={blogEditForm.imageUrl} onChange={e => setBlogEditForm(f=>({...f,imageUrl:e.target.value}))}
                    placeholder="https://images.unsplash.com/..."
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #ced4da',borderRadius:'6px',fontSize:'14px',boxSizing:'border-box'}} />
                  {blogEditForm.imageUrl && (
                    <img src={blogEditForm.imageUrl} alt="preview"
                      style={{marginTop:'8px',width:'100%',height:'160px',objectFit:'cover',borderRadius:'6px'}} />
                  )}
                </div>

                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontWeight:'600',marginBottom:'6px',fontSize:'14px',color:'#495057'}}>Conținut (Markdown)</label>
                  <textarea value={blogEditForm.content} onChange={e => setBlogEditForm(f=>({...f,content:e.target.value}))} rows={18}
                    style={{width:'100%',padding:'10px 12px',border:'1px solid #ced4da',borderRadius:'6px',fontSize:'13px',fontFamily:'monospace',resize:'vertical',boxSizing:'border-box'}} />
                </div>

                <div style={{display:'flex',gap:'12px',justifyContent:'flex-end',marginTop:'8px'}}>
                  <button onClick={() => setEditingBlogPost(null)}
                    style={{padding:'10px 24px',border:'1px solid #ced4da',borderRadius:'6px',background:'white',cursor:'pointer',fontSize:'14px'}}>
                    Anulează
                  </button>
                  <button onClick={saveBlogPost}
                    style={{padding:'10px 24px',border:'none',borderRadius:'6px',background:'#198754',color:'white',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>
                    💾 Salvează
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Main Admin App Component - Optimized for speed
    function AdminApp() {
      // Initialize state synchronously to avoid delays
      const [token, setToken] = useState(localStorage.getItem('adminToken'));
      const [admin, setAdmin] = useState(() => {
        try {
          const savedAdmin = localStorage.getItem('adminUser');
          return savedAdmin ? JSON.parse(savedAdmin) : null;
        } catch {
          return null;
        }
      });
      const [isAuthenticated, setIsAuthenticated] = useState(
        !!(localStorage.getItem('adminToken') && localStorage.getItem('adminUser'))
      );
      const [loading, setLoading] = useState(false); // Start with false for immediate render
      
      useEffect(() => {
        // Minimal async validation - only if needed
        if (token && admin && !isAuthenticated) {
          setIsAuthenticated(true);
        } else if (!token || !admin) {
          // Clean up invalid state
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          setIsAuthenticated(false);
        }
      }, [token, admin, isAuthenticated]);
      
      const handleLoginSuccess = (token, admin) => {
        setToken(token);
        setAdmin(admin);
        setIsAuthenticated(true);
      };
      
      const handleLogout = () => {
        // Clear localStorage
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        
        // Clear state
        setToken(null);
        setAdmin(null);
        setIsAuthenticated(false);
      };
      
      // Render immediately without loading screen
      if (!isAuthenticated) {
        return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
      }
      
      return <AdminDashboard token={token} admin={admin} onLogout={handleLogout} />;
    }
    
    // Hide initial loading overlay after a short delay and render app
    setTimeout(() => {
      const loadingElement = document.getElementById('initial-loading');
      if (loadingElement) {
        loadingElement.classList.add('hidden');
      }
    }, 1000);
    
    // Render the app immediately
    const root = ReactDOM.createRoot(document.getElementById('admin-root'));
    root.render(<I18nextProvider i18n={i18n}><AdminApp /></I18nextProvider>);
