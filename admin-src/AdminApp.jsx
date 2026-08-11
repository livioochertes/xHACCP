import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { useTranslation, I18nextProvider } from "react-i18next";
import i18n from "./i18n.js";
import LanguageSwitcher from "./LanguageSwitcher.jsx";

    
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
        const marketParam = market && market !== 'all' ? `?market=${market}` : '';
        const response = await fetch(`/admin/api/categories${marketParam}`, {
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
      const [users, setUsers] = useState([]);
      const [products, setProducts] = useState([]);
      const [categories, setCategories] = useState([]);
      const [suppliers, setSuppliers] = useState([]);
      const [showAddUserModal, setShowAddUserModal] = useState(false);
      const [showAddProductModal, setShowAddProductModal] = useState(false);
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
      const [showProductBulkModal, setShowProductBulkModal] = useState(false);
      const [productBulkOperation, setProductBulkOperation] = useState('');
      const [showProductSearchFilter, setShowProductSearchFilter] = useState(false);
      const [productSearchTerm, setProductSearchTerm] = useState('');
      const [productCategoryFilter, setProductCategoryFilter] = useState('all');
      const [productStatusFilter, setProductStatusFilter] = useState('all');
      const [filteredProducts, setFilteredProducts] = useState([]);
      const [productPage, setProductPage] = useState(1);
      const productsPerPage = 20;
      const [showProductAnalytics, setShowProductAnalytics] = useState(false);
      const [analyticsData, setAnalyticsData] = useState(null);
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
      
      // Blog state
      const [blogPosts, setBlogPosts] = useState([]);
      const [blogGenerating, setBlogGenerating] = useState(false);
      const [blogGenerateForm, setBlogGenerateForm] = useState({ title: '', category: 'HACCP', language: (() => { const _m = sessionStorage.getItem('adminMarketTab'); return _m === 'fr' ? 'fr' : _m === 'com' ? 'en' : 'ro'; })() });
      const [editingBlogPost, setEditingBlogPost] = useState(null);
      const [previewBlogPost, setPreviewBlogPost] = useState(null);
      const [blogEditForm, setBlogEditForm] = useState({ title: '', excerpt: '', content: '', imageUrl: '', category: '', published: true });
      const [scheduleConfig, setScheduleConfig] = useState({ enabled: true, intervalDays: 7, hour: 8 });
      const [scheduleLoaded, setScheduleLoaded] = useState(false);

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
        description: '',
        marketContacts: { ro: {}, fr: {}, com: {} }
      });
      const [activeMarketTab, setActiveMarketTab] = useState('ro');
      const [showCompanySettingsModal, setShowCompanySettingsModal] = useState(false);
      const [showExcelImportModal, setShowExcelImportModal] = useState(false);
      const [excelFile, setExcelFile] = useState(null);
      const [importResults, setImportResults] = useState(null);
      
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
            vatPercentage: editingProduct.vatPercentage || '19.00',
            currency: editingProduct.currency || 'EUR',
            productCode: editingProduct.productCode || '',
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
            isService: editingProduct.isService || false
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
        fetchStats(selectedMarketTab);
        if (activeView === 'users') fetchUsers();
        else if (activeView === 'products') fetchProducts();
        else if (activeView === 'categories') fetchCategories();
        else if (activeView === 'suppliers') fetchSuppliers();
        else if (activeView === 'vouchers') fetchVouchers();
        else if (activeView === 'invoices') { setInvoiceMarketFilter('all'); fetchInvoices(selectedMarketTab); fetchInvoiceCounters(); }
        else if (activeView === 'company-settings') { fetchCompanySettings(); fetchMarkets(); fetchInvoiceCounters(); }
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
        
        if (productSearchTerm) {
          filtered = filtered.filter(product => 
            product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
            product.id.toString().includes(productSearchTerm) ||
            product.category?.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
            product.description?.toLowerCase().includes(productSearchTerm.toLowerCase())
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

      const fetchProducts = async () => {
        try {
          const marketParam = selectedMarketTab && selectedMarketTab !== 'all' ? `?market=${selectedMarketTab}` : '';
          const response = await fetch(`/admin/api/products${marketParam}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setProducts(data);
          } else {
            console.error('Failed to fetch products:', data.message);
          }
        } catch (err) {
          console.error('Network error fetching products:', err);
        }
      };

      const fetchCategories = async () => {
        try {
          const marketParam = selectedMarketTab && selectedMarketTab !== 'all' ? `?market=${selectedMarketTab}` : '';
          const response = await fetch(`/admin/api/categories${marketParam}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setCategories(data);
          } else {
            console.error('Failed to fetch categories:', data.message);
          }
        } catch (err) {
          console.error('Network error fetching categories:', err);
        }
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
          const _bMkt = sessionStorage.getItem('adminMarketTab');
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

      const fetchMarkets = async () => {
        setMarketsLoading(true);
        try {
          const res = await fetch('/admin/api/markets/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const map = { ro: null, fr: null, com: null };
            data.forEach(m => { map[m.market] = m; });
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
        console.log('Generating product analytics with data:', products.length, 'products');
        console.log('Categories available:', categories.length, 'categories');
        
        if (products.length === 0) {
          setAnalyticsData({
            error: 'No products found to analyze'
          });
          return;
        }
        
        // Make sure categories are loaded
        if (categories.length === 0) {
          fetchCategories();
        }

        // Determine the display currency for the current market view:
        // use the most common currency among the loaded products.
        const currencyCounts = products.reduce((acc, p) => {
          const cur = p.currency || 'RON';
          acc[cur] = (acc[cur] || 0) + 1;
          return acc;
        }, {});
        const displayCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'RON';

        // Calculate analytics based on actual product data
        const analytics = {
          totalProducts: products.length,
          currency: displayCurrency,
          
          // Category analysis
          categoryBreakdown: categories.reduce((acc, cat) => {
            const categoryProducts = products.filter(p => p.categoryId === cat.id);
            if (categoryProducts.length > 0) {
              acc[cat.name] = {
                count: categoryProducts.length,
                percentage: ((categoryProducts.length / products.length) * 100).toFixed(1)
              };
            }
            return acc;
          }, {}),
          
          // Status analysis
          statusBreakdown: {
            active: products.filter(p => (p.status || 'active') === 'active').length,
            inactive: products.filter(p => p.status === 'inactive').length,
            draft: products.filter(p => p.status === 'draft').length,
            discontinued: products.filter(p => p.status === 'discontinued').length
          },
          
          // Price analysis
          priceAnalysis: (() => {
            const prices = products.map(p => parseFloat(p.price) || 0).filter(p => p > 0);
            if (prices.length === 0) return { avg: 0, min: 0, max: 0 };
            
            return {
              avg: (prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(2),
              min: Math.min(...prices).toFixed(2),
              max: Math.max(...prices).toFixed(2)
            };
          })(),
          
          // Stock analysis
          stockAnalysis: {
            totalStock: products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0),
            inStock: products.filter(p => (p.stockQuantity || 0) > 0).length,
            outOfStock: products.filter(p => (p.stockQuantity || 0) === 0).length,
            lowStock: products.filter(p => (p.stockQuantity || 0) > 0 && (p.stockQuantity || 0) < 10).length
          },
          
          // Top products by price
          topPriceProducts: products
            .filter(p => p.price && parseFloat(p.price) > 0)
            .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
            .slice(0, 5)
            .map(p => ({
              name: p.name,
              price: parseFloat(p.price).toFixed(2),
              category: categories.find(c => c.id === p.categoryId)?.name || 'Unknown'
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
            return { success: true, message: data.message };
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

      const deleteProduct = async (productId) => {
        try {
          const response = await fetch(`/admin/api/products/${productId}`, {
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
      const importProductsFromExcel = async (file) => {
        if (!file) {
          alert('Please select an Excel file to import.');
          return;
        }

        try {
          setImportResults({ loading: true });
          
          const formData = new FormData();
          formData.append('excelFile', file);

          const response = await fetch('/admin/api/products/import-excel', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          const result = await response.json();

          if (response.ok) {
            setImportResults({
              success: true,
              imported: result.imported || 0,
              errors: result.errors || [],
              duplicates: result.duplicates || [],
              total: result.total || 0
            });
            
            // Refresh products list with delay to ensure data is updated
            console.log('Excel import completed, refreshing product list...');
            await fetchProducts();
            
            // Also refresh after a short delay to ensure cache is cleared
            setTimeout(async () => {
              console.log('Performing delayed product list refresh...');
              await fetchProducts();
            }, 1000);
            
            alert(`✅ Import completed!\\n\\nImported: ${result.imported}\\nErrors: ${result.errors?.length || 0}\\nDuplicates: ${result.duplicates?.length || 0}\\n\\nProduct list has been refreshed. The new products should now be visible.`);
          } else {
            setImportResults({
              success: false,
              message: result.message || 'Import failed'
            });
            alert('❌ Import failed: ' + (result.message || 'Unknown error'));
          }
        } catch (error) {
          console.error('Error importing Excel:', error);
          setImportResults({
            success: false,
            message: 'Network error during import'
          });
          alert('❌ Network error during import');
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

      // Category management API functions (fetchCategories moved to global scope)

      const createCategory = async (categoryData) => {
        try {
          const response = await fetch('/admin/api/categories', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(categoryData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchCategories(); // Refresh category list
            return { success: true, message: 'Category created successfully' };
          } else {
            return { success: false, message: data.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
        }
      };

      const updateCategory = async (categoryId, categoryData) => {
        try {
          const token = localStorage.getItem('adminToken');
          const response = await fetch(`/admin/api/categories/${categoryId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(categoryData)
          });
          
          const data = await response.json();
          
          if (response.ok) {
            fetchCategories(); // Refresh category list
            return { success: true, message: 'Category updated successfully' };
          } else {
            return { success: false, message: data.message };
          }
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
              mainShopCategories
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
          
          const result = await response.json();
          
          if (response.ok) {
            fetchProducts(); // Refresh product list
            return { success: true, message: result.message, results: result.results };
          } else {
            return { success: false, message: result.message };
          }
        } catch (err) {
          return { success: false, message: 'Network error' };
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
            setCompanySettings({
              ...data,
              marketContacts: data.marketContacts || { ro: {}, fr: {}, com: {} }
            });
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
          const response = await fetch('/admin/api/company-settings', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok && data) {
            return {
              currency: data.defaultCurrency || 'EUR',
              vatPercentage: data.defaultVatPercentage || '21.00'
            };
          }
        } catch (err) {
          console.error('Error fetching company defaults:', err);
        }
        
        // Return defaults if fetch fails
        return {
          currency: 'EUR',
          vatPercentage: '21.00'
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
          if (suppliers.length === 0) {
            fetchSuppliers();
          }
          fetchProductMarkets();
        } else if (view === 'categories') {
          fetchCategories();
        } else if (view === 'suppliers') {
          fetchSuppliers();
        } else if (view === 'company-settings') {
          fetchCompanySettings();
          fetchMarkets();
        } else if (view === 'vouchers') {
          fetchVouchers();
        } else if (view === 'blog') {
          fetchBlogPosts();
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
          case 'orders':
            return (
              <div style={{background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={{color: '#333', margin: '0'}}>📋 Order Management</h3>
                  <div style={{display: 'flex', gap: '10px'}}>
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
                                                order.status === 'cancelled' ? '#f8d7da' : '#e2e3e5',
                                color: order.status === 'pending' ? '#856404' : 
                                       order.status === 'accepted' ? '#0c5460' : 
                                       order.status === 'processing' ? '#0056b3' : 
                                       order.status === 'shipped' ? '#155724' : 
                                       order.status === 'in_delivery' ? '#0e7c7b' : 
                                       order.status === 'delivered' ? '#155724' : 
                                       order.status === 'cancelled' ? '#721c24' : '#383d41'
                              }}>
                                {order.status === 'in_delivery' ? 'In Delivery' : order.status === 'cash_on_delivery' ? 'COD' : order.status}
                              </span>
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
                      style={{background: '#fd7e14', width: 'auto', padding: '8px 16px'}}
                      onClick={() => setShowExcelImportModal(true)}
                    >
                      📤 {t('products.importExcel')}
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#17a2b8', width: 'auto', padding: '8px 16px'}}
                      onClick={exportProductsToExcel}
                    >
                      📥 {t('products.exportExcel')}
                    </button>
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
                            vatPercentage: defaults.vatPercentage || '21.00',
                            currency: defaults.currency || 'RON',
                            productCode: generatedCode,
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
                            isService: false
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
                  <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                    <button 
                      className="btn" 
                      style={{background: '#007bff', width: 'auto', padding: '8px 16px'}}
                      onClick={() => {
                        if (selectedProducts.length === 0) {
                          alert('Please select products first by checking the boxes in the product list.');
                          return;
                        }
                        setShowProductBulkModal(true);
                      }}
                      disabled={selectedProducts.length === 0}
                    >
                      🔄 {t('common.bulkOps')} {selectedProducts.length > 0 && `(${selectedProducts.length})`}
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#17a2b8', width: 'auto', padding: '8px 16px'}}
                      onClick={() => {
                        setShowProductSearchFilter(!showProductSearchFilter);
                        if (!showProductSearchFilter) {
                          fetchCategories(); // Fetch categories when opening search filter
                        }
                        console.log('Product search filter toggled:', !showProductSearchFilter);
                      }}
                    >
                      🔍 Search & Filter
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#6c757d', width: 'auto', padding: '8px 16px'}}
                      onClick={() => {
                        setShowProductAnalytics(!showProductAnalytics);
                        if (!showProductAnalytics) {
                          generateProductAnalytics();
                        }
                        console.log('Product analytics toggled:', !showProductAnalytics);
                      }}
                    >
                      📊 {t('common.analytics')}
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#28a745', width: 'auto', padding: '8px 16px'}}
                      onClick={downloadExcelTemplate}
                    >
                      📥 {t('products.downloadTemplate')}
                    </button>
                    <button 
                      className="btn" 
                      style={{background: '#dc3545', width: 'auto', padding: '8px 16px'}}
                      onClick={async () => {
                        if (!confirm('Aceasta va genera coduri de produs pentru toate produsele care nu au cod. Continuați?')) return;
                        
                        try {
                          const response = await fetch('/admin/api/products/bulk/generate-codes', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                              'Content-Type': 'application/json'
                            }
                          });
                          
                          const result = await response.json();
                          
                          if (response.ok) {
                            alert(`✅ ${result.message}\n\nActualizate: ${result.updated}\nEșuate: ${result.failed || 0}`);
                            fetchProducts();
                          } else {
                            alert('❌ Eroare: ' + result.message);
                          }
                        } catch (error) {
                          console.error('Error generating codes:', error);
                          alert('❌ Eroare la generarea codurilor');
                        }
                      }}
                    >
                      🔢 {t('products.generateCodes')}
                    </button>
                  </div>
                </div>
                
                {showProductSearchFilter && (
                  <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #dee2e6'}}>
                    <h4 style={{color: '#333', marginBottom: '15px'}}>🔍 {t('products.searchFilterTitle')}</h4>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px'}}>
                      <div>
                        <label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>{t('products.searchLabel')}:</label>
                        <input 
                          type="text" 
                          placeholder={t('products.searchPlaceholder')}
                          value={productSearchTerm}
                          onChange={(e) => {
                            setProductSearchTerm(e.target.value);
                            console.log('Product search term changed:', e.target.value);
                          }}
                          style={{width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px'}}
                        />
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
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
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
                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                      <button 
                        className="btn" 
                        style={{background: '#28a745', width: 'auto', padding: '6px 12px', fontSize: '14px'}}
                        onClick={() => {
                          console.log('Search applied with filters:', {
                            searchTerm: productSearchTerm,
                            categoryFilter: productCategoryFilter,
                            statusFilter: productStatusFilter
                          });
                          alert(`Search applied! Found ${filteredProducts.length} products out of ${products.length} total.`);
                        }}
                      >
                        ✅ {t('common.applySearch')}
                      </button>
                      <button 
                        className="btn" 
                        style={{background: '#6c757d', width: 'auto', padding: '6px 12px', fontSize: '14px'}}
                        onClick={() => {
                          setProductSearchTerm('');
                          setProductCategoryFilter('all');
                          setProductStatusFilter('all');
                          console.log('Product filters cleared');
                        }}
                      >
                        🗑️ {t('common.clearFilters')}
                      </button>
                    </div>
                    <div style={{marginTop: '10px', fontSize: '14px', color: '#666'}}>
                      {t('products.showing', {count: filteredProducts.length, total: products.length})}
                    </div>
                  </div>
                )}
                
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
                
                {(showProductSearchFilter ? filteredProducts : products).length > 0 ? (
                  <React.Fragment>
                  <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <thead>
                        <tr style={{backgroundColor: '#f5f5f5'}}>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', width: '50px'}}>
                            <input 
                              type="checkbox" 
                              checked={selectedProducts.length === (showProductSearchFilter ? filteredProducts : products).length && (showProductSearchFilter ? filteredProducts : products).length > 0}
                              onChange={(e) => {
                                const currentProducts = showProductSearchFilter ? filteredProducts : products;
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
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>NC Code</th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>CPV Code</th>
                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>🇷🇴 .ro<br/><small style={{color:'#888',fontWeight:'normal'}}>RON (lei)</small></th>
                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>🇫🇷 .fr<br/><small style={{color:'#888',fontWeight:'normal'}}>EUR (€)</small></th>
                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>🌐 .com<br/><small style={{color:'#888',fontWeight:'normal'}}>EUR (€)</small></th>
                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showProductSearchFilter ? filteredProducts : products).sort((a, b) => {
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
                            <td style={{padding: '12px', color: '#28a745', fontWeight: 'bold'}}>${product.price}</td>
                            <td style={{padding: '12px'}}>{product.category?.name || 'N/A'}</td>
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
                            <td style={{padding: '12px', color: '#007bff', fontSize: '14px', fontWeight: '500'}}>{product.currency || 'EUR'}</td>
                            <td style={{padding: '12px', color: '#6c757d', fontSize: '14px', fontFamily: 'monospace'}}>{product.productCode || 'N/A'}</td>
                            <td style={{padding: '12px', color: '#6c757d', fontSize: '14px', fontFamily: 'monospace'}}>{product.ncCode || 'N/A'}</td>
                            <td style={{padding: '12px', color: '#6c757d', fontSize: '14px', fontFamily: 'monospace'}}>{product.cpvCode || 'N/A'}</td>
                            {['ro', 'fr', 'com'].map(market => {
                              const pm = productMarketsMap[product.id]?.[market];
                              const isActive = pm ? pm.isActive : true;
                              const hasCustomPrice = pm && pm.price != null && pm.price !== '';
                              const effectivePrice = hasCustomPrice ? pm.price : product.price;
                              const symbol = market === 'ro' ? 'lei' : '€';
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
                                      {parseFloat(effectivePrice || 0).toFixed(2)} {symbol}
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
                                    if (confirm(`Delete product "${product.name}"?\n\nThis action cannot be undone.`)) {
                                      const result = await deleteProduct(product.id);
                                      if (result.success) {
                                        alert('Product deleted successfully');
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
                  {Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) > 1 && (
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderTop: '1px solid #eee', marginTop: '10px', flexWrap: 'wrap', gap: '10px'}}>
                      <span style={{color: '#666', fontSize: '14px'}}>
                        Showing {((productPage - 1) * productsPerPage) + 1}-{Math.min(productPage * productsPerPage, (showProductSearchFilter ? filteredProducts : products).length)} of {(showProductSearchFilter ? filteredProducts : products).length} products
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
                        {Array.from({length: Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage)}, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setProductPage(p)}
                            style={{padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: p === productPage ? '#007bff' : 'white', color: p === productPage ? 'white' : '#333', cursor: 'pointer', fontWeight: p === productPage ? 'bold' : 'normal'}}
                          >{p}</button>
                        ))}
                        <button
                          onClick={() => setProductPage(Math.min(Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage), productPage + 1))}
                          disabled={productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage)}
                          style={{padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? '#f5f5f5' : 'white', cursor: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? 'not-allowed' : 'pointer', color: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? '#ccc' : '#333'}}
                        >Next &rsaquo;</button>
                        <button
                          onClick={() => setProductPage(Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage))}
                          disabled={productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage)}
                          style={{padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', background: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? '#f5f5f5' : 'white', cursor: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? 'not-allowed' : 'pointer', color: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? '#ccc' : '#333'}}
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
                            <span>{category.name}</span>
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
                            <span>{category.name}</span>
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
                      
                      alert(`Homepage Category Configuration:\n\nMain Top (${mainTopCategories.length}/4): ${mainTopCategories.map(c => c.name).join(', ') || 'None'}\n\nShop Section (${mainShopCategories.length}/3): ${mainShopCategories.map(c => c.name).join(', ') || 'None'}\n\nTo modify these settings, use the "Configure Homepage" button below.`);
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
                                  alt={category.name}
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
                              {category.name}
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
                                    if (confirm(`Delete category "${category.name}"?\n\nThis action cannot be undone. Make sure no products are assigned to this category.`)) {
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
                    <p style={{color: '#6c757d', marginBottom: '20px'}}>{t('categories.createFirst')}</p>
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
        
        const handleOperation = async () => {
          if (!selectedOperation) {
            alert('Please select an operation');
            return;
          }
          
          setIsProcessing(true);
          let result;
          
          switch (selectedOperation) {
            case 'update-prices':
              if (!priceMultiplier && !fixedPrice) {
                alert('Please enter a price multiplier or fixed price');
                setIsProcessing(false);
                return;
              }
              result = await performProductBulkOperation('update-prices', selectedProducts, {
                multiplier: priceMultiplier ? parseFloat(priceMultiplier) : null,
                fixedPrice: fixedPrice ? parseFloat(fixedPrice) : null
              });
              break;
            case 'update-categories':
              if (!newCategoryId) {
                alert('Please select a category');
                setIsProcessing(false);
                return;
              }
              result = await performProductBulkOperation('update-categories', selectedProducts, {
                categoryId: parseInt(newCategoryId)
              });
              break;
            case 'update-status':
              if (!newStatus) {
                alert('Please select a status');
                setIsProcessing(false);
                return;
              }
              result = await performProductBulkOperation('update-status', selectedProducts, {
                status: newStatus
              });
              break;
            case 'update-stock':
              if (!stockValue) {
                alert('Please enter a stock value');
                setIsProcessing(false);
                return;
              }
              result = await performProductBulkOperation('update-stock', selectedProducts, {
                operation: stockOperation,
                value: parseInt(stockValue)
              });
              break;
            case 'export':
              result = await performProductBulkOperation('export', selectedProducts);
              break;
            case 'delete':
              if (!confirm(`Are you sure you want to delete ${selectedProducts.length} products? This action cannot be undone.`)) {
                setIsProcessing(false);
                return;
              }
              result = await performProductBulkOperation('delete', selectedProducts);
              break;
            default:
              result = { success: false, message: 'Invalid operation' };
          }
          
          if (result.success) {
            alert(`${selectedOperation} operation completed successfully for ${selectedProducts.length} products`);
            setSelectedProducts([]);
            setShowProductBulkModal(false);
            setProductBulkOperation('');
            // Force refresh of products after bulk operations
            setTimeout(() => {
              fetchProducts();
            }, 1000);
          } else {
            alert('Error: ' + result.message);
          }
          setIsProcessing(false);
        };
        
        return (
          <div>
            <div className="form-group">
              <label className="form-label">Select Operation</label>
              <select
                className="form-input"
                value={selectedOperation}
                onChange={(e) => setSelectedOperation(e.target.value)}
              >
                <option value="">Choose Operation...</option>
                <option value="update-prices">💰 Update Prices</option>
                <option value="update-categories">📁 Update Categories</option>
                <option value="update-status">🔄 Update Status</option>
                <option value="update-stock">📦 Update Stock</option>
                <option value="export">📤 Export Products</option>
                <option value="delete">🗑️ Delete Products</option>
              </select>
            </div>
            
            {selectedOperation === 'update-prices' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Price Multiplier (e.g., 1.1 for 10% increase)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={priceMultiplier}
                    onChange={(e) => setPriceMultiplier(e.target.value)}
                    placeholder="Enter multiplier (e.g., 1.1)"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">OR Set Fixed Price</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={fixedPrice}
                    onChange={(e) => setFixedPrice(e.target.value)}
                    placeholder="Enter fixed price"
                  />
                </div>
              </div>
            )}
            
            {selectedOperation === 'update-categories' && (
              <div className="form-group">
                <label className="form-label">New Category</label>
                <select
                  className="form-input"
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                >
                  <option value="">Select Category...</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            {selectedOperation === 'update-status' && (
              <div className="form-group">
                <label className="form-label">New Status</label>
                <select
                  className="form-input"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="">Select Status...</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="draft">Draft</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            )}
            
            {selectedOperation === 'update-stock' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Stock Operation</label>
                  <select
                    className="form-input"
                    value={stockOperation}
                    onChange={(e) => setStockOperation(e.target.value)}
                  >
                    <option value="set">Set Stock To</option>
                    <option value="add">Add To Stock</option>
                    <option value="subtract">Subtract From Stock</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Value</label>
                  <input
                    type="number"
                    className="form-input"
                    value={stockValue}
                    onChange={(e) => setStockValue(e.target.value)}
                    placeholder="Enter stock value"
                  />
                </div>
              </div>
            )}
            
            <button
              className="btn"
              style={{background: '#28a745'}}
              onClick={handleOperation}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Execute Operation'}
            </button>
            
            {isProcessing && (
              <div style={{textAlign: 'center', marginTop: '20px'}}>
                <div className="loading"></div>
                <p>Processing operation...</p>
              </div>
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
          isService: false
        });
        const [uploadedImages, setUploadedImages] = useState([]);
        
        // Translation form states - local to ModalsComponent to prevent focus loss
        const [newTranslation, setNewTranslation] = useState({ language: '', name: '', description: '', sourceUrl: '' });
        const [editingTranslation, setEditingTranslation] = useState(null);
        
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
              productCode: '', ncCode: '', cpvCode: '', status: 'active', images: [],
              weight: '', length: '', width: '', height: '', piecesPerPackage: '',
              productQuantity: '', specs: [], volumeDiscounts: [], priority: 0, isService: false
            });
            setUploadedImages([]);
            setImportUrl('');
            setImportedData(null);
            setUsageRightsConfirmed(false);
            fetchProducts();
            setTimeout(() => fetchProducts(), 1500);
          };

          // Helper: save market-specific fields (price/currency/stock) to product_markets
          const saveMarketData = async (productId, market) => {
            try {
              await fetch(`/admin/api/products/${productId}/markets/${market}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  isActive: true,
                  price: productData.price || null,
                  compareAtPrice: productData.compareAtPrice || null,
                  currency: productData.currency || null,
                  stockQuantity: productData.stockQuantity !== '' && productData.stockQuantity !== null ? parseInt(String(productData.stockQuantity)) : null,
                  inStock: productData.stockQuantity ? parseInt(String(productData.stockQuantity)) > 0 : null,
                })
              });
            } catch (err) {
              console.error('Failed to save market-specific data:', err);
            }
          };

          if (editingProduct && selectedMarketTab !== 'all') {
            // ── EDITING on specific market tab ──────────────────────────────
            // 1. Save global fields (name, desc, images, specs, weight, etc.)
            //    but NOT price/compareAtPrice/currency/stockQuantity — those are market-specific
            const { price, compareAtPrice, currency, stockQuantity, inStock, ...globalFields } = productData;
            const globalResult = await updateProduct(editingProduct.id, globalFields);
            
            if (!globalResult.success) {
              alert('Eroare la salvare: ' + globalResult.message);
              return;
            }
            
            // 2. Save price/currency/stock only to this market's product_markets row
            await saveMarketData(editingProduct.id, selectedMarketTab);
            
            alert('✅ Produs salvat! Prețul/stocul au fost actualizate doar pentru piața ' + selectedMarketTab.toUpperCase() + '.');
            resetForm();

          } else if (!editingProduct && selectedMarketTab !== 'all') {
            // ── CREATING new product on specific market tab ─────────────────
            // Create globally (all fields), then also set market-specific entry
            const result = await createProduct(productData);
            if (result.success) {
              // Get the new product's id from result
              const newId = result.product?.id || result.id;
              if (newId) {
                await saveMarketData(newId, selectedMarketTab);
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
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
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
                              <option key={category.id} value={category.id}>{category.name}</option>
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
                            className="form-input"
                            value={productFormData.stockQuantity}
                            onChange={(e) => setProductFormData({...productFormData, stockQuantity: e.target.value})}
                          />
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
                            <option value="21.00">21% ({t('products.modal.vatStandard')})</option>
                            <option value="21.00">21% ({t('products.modal.vatStandardNew')})</option>
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

                    {/* Service / Subscription flag */}
                    <div style={{marginTop: '16px', padding: '10px 14px', backgroundColor: '#f0f4ff', borderRadius: '6px', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <input
                        type="checkbox"
                        id="isService"
                        checked={!!productFormData.isService}
                        onChange={(e) => setProductFormData({...productFormData, isService: e.target.checked})}
                        style={{width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0}}
                      />
                      <label htmlFor="isService" style={{margin: 0, cursor: 'pointer', fontSize: '13px', color: '#3730a3', fontWeight: '600'}}>
                        🔧 {t('products.isServiceLabel')}
                        <span style={{fontWeight: 'normal', color: '#6b7280', marginLeft: '6px'}}>— {t('products.isServiceHint')}</span>
                      </label>
                    </div>

                    {/* Volume Discounts Section */}
                    {!productFormData.isService && (
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
                            isService: false
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
            
            {/* Product Bulk Operations Modal */}
            {showProductBulkModal && (
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
                    📦 Product Bulk Operations
                  </h3>
                  <p style={{marginBottom: '20px', color: '#666'}}>
                    Selected {selectedProducts.length} products for bulk operation.
                  </p>
                  
                  <ProductBulkOperationsComponent />
                  
                  <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                    <button
                      type="button"
                      className="btn"
                      style={{background: '#6c757d'}}
                      onClick={() => {
                        setShowProductBulkModal(false);
                        setProductBulkOperation('');
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
                                  <span>{item.product ? item.product.name : `Product ID: ${item.productId}`}</span>
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
                                  window.fetchCategories(setCategories);
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
                                <span>{category.name}</span>
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
                                {category.name} 
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
                                <span>{category.name}</span>
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
                                {category.name}
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
                            homepageConfig.mainTop.map(id => categories.find(c => c.id === id)?.name).join(', ') : 
                            'None selected'
                          }
                        </div>
                      </div>
                      <div>
                        <strong style={{color: '#28a745'}}>Shop Section ({homepageConfig.mainShop.length}/3):</strong>
                        <div style={{fontSize: '14px', color: '#666'}}>
                          {homepageConfig.mainShop.length > 0 ? 
                            homepageConfig.mainShop.map(id => categories.find(c => c.id === id)?.name).join(', ') : 
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
                              mainShopCategories: homepageConfig.mainShop
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
                      description: formData.get('description'),
                      marketContacts: companySettings.marketContacts || { ro: {}, fr: {}, com: {} }
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
                            <option value="21.00">21% ({t('products.modal.vatStandard')})</option>
                            <option value="21.00">21% ({t('products.modal.vatStandardNew')})</option>
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

                    {/* Per-market contact data */}
                    <div style={{marginBottom: '20px', padding: '15px', background: '#f0fff4', border: '1px solid #28a745', borderRadius: '6px'}}>
                      <h4 style={{color: '#28a745', marginBottom: '15px', fontSize: '16px'}}>🌍 Date de contact per piață</h4>
                      <p style={{fontSize: '12px', color: '#555', marginBottom: '12px'}}>Aceste date apar pe site-ul fiecărei piețe (Home footer, Privacy, Terms). Dacă un câmp e gol, se folosesc datele generale de mai sus.</p>
                      {/* Tabs */}
                      <div style={{display: 'flex', gap: '4px', marginBottom: '15px'}}>
                        {[{key:'ro', label:'🇷🇴 xhaccp.ro'}, {key:'fr', label:'🇫🇷 xhaccp.fr'}, {key:'com', label:'🌐 xhaccp.com'}].map(tab => (
                          <button key={tab.key} type="button" onClick={() => setActiveMarketTab(tab.key)}
                            style={{padding: '6px 14px', borderRadius: '4px', border: '1px solid #28a745', cursor: 'pointer', fontSize: '13px',
                              background: activeMarketTab === tab.key ? '#28a745' : 'white',
                              color: activeMarketTab === tab.key ? 'white' : '#28a745', fontWeight: activeMarketTab === tab.key ? 'bold' : 'normal'}}>
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      {/* Fields for active tab */}
                      {['ro','fr','com'].map(mkt => activeMarketTab === mkt && (
                        <div key={mkt} style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                          {[
                            {label: 'Denumire firmă', key: 'name', type: 'text'},
                            {label: 'Email contact', key: 'email', type: 'email'},
                            {label: 'Telefon', key: 'phone', type: 'text'},
                            {label: 'CUI / TVA', key: 'vatNumber', type: 'text'},
                            {label: 'Nr. Reg. Com.', key: 'registrationNumber', type: 'text'},
                            {label: 'Adresă stradă', key: 'address', type: 'text'},
                            {label: 'Localitate', key: 'city', type: 'text'},
                            {label: 'Cod poștal', key: 'zipCode', type: 'text'},
                            {label: 'Țară', key: 'country', type: 'text'},
                          ].map(field => (
                            <div key={field.key}>
                              <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold', color: '#333'}}>{field.label}</label>
                              <input type={field.type}
                                value={(companySettings.marketContacts?.[mkt]?.[field.key]) || ''}
                                onChange={(e) => setCompanySettings(prev => ({
                                  ...prev,
                                  marketContacts: {
                                    ...prev.marketContacts,
                                    [mkt]: { ...prev.marketContacts?.[mkt], [field.key]: e.target.value }
                                  }
                                }))}
                                placeholder={`(implicit: ${field.key === 'name' ? companySettings.name : field.key === 'email' ? companySettings.email : field.key === 'phone' ? companySettings.phone : '—'})`}
                                style={{width: '100%', padding: '7px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px'}}
                              />
                            </div>
                          ))}
                        </div>
                      ))}
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
                      <p style={{color: '#666', marginTop: '10px'}}>Processing Excel file...</p>
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
                      <h4 style={{
                        color: importResults.success ? '#155724' : '#721c24',
                        marginBottom: '10px'
                      }}>
                        {importResults.success ? '✅ Import Results' : '❌ Import Failed'}
                      </h4>
                      {importResults.success ? (
                        <div style={{color: '#155724'}}>
                          <p><strong>Total processed:</strong> {importResults.total}</p>
                          <p><strong>Successfully imported:</strong> {importResults.imported}</p>
                          <p><strong>Errors:</strong> {importResults.errors?.length || 0}</p>
                          <p><strong>Duplicates skipped:</strong> {importResults.duplicates?.length || 0}</p>
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
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{background: '#fd7e14'}}
                        onClick={() => importProductsFromExcel(excelFile)}
                        disabled={!excelFile || (importResults && importResults.loading)}
                      >
                        📤 Import Products
                      </button>
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
          </div>
          
          <div className="content-area">
            {renderContent()}
          </div>
          <ModalsComponent key={modalKey} />

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
