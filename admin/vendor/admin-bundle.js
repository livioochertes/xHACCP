var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
const { useState, useEffect } = React;
console.log("Defining uploadCategoryImage function on window object");
window.uploadCategoryImage = async (categoryId, file) => {
  try {
    const token = localStorage.getItem("adminToken");
    console.log("uploadCategoryImage called with:", { categoryId, fileName: file.name, fileSize: file.size, fileType: file.type });
    console.log("Current token:", token);
    if (!file) {
      return { success: false, message: "No file provided" };
    }
    if (!file.type.startsWith("image/")) {
      return { success: false, message: "File must be an image" };
    }
    const formData = new FormData();
    formData.append("image", file);
    console.log("FormData created successfully");
    console.log("FormData entries:", [...formData.entries()].map(([key, value]) => [key, value instanceof File ? `File: ${value.name}` : value]));
    const url = `/admin/api/categories/${categoryId}/upload-image`;
    console.log("Making request to:", url);
    try {
      const testResponse = await fetch(url, {
        method: "OPTIONS",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      console.log("OPTIONS request status:", testResponse.status);
    } catch (optionsError) {
      console.error("OPTIONS request failed:", optionsError);
    }
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });
    console.log("POST response received");
    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    const responseText = await response.text();
    console.log("Response text:", responseText);
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log("Upload successful, result:", result);
      return { success: true, message: result.message, imageUrl: result.imageUrl };
    } else {
      try {
        const error = JSON.parse(responseText);
        console.log("Upload failed, error:", error);
        return { success: false, message: error.message };
      } catch (parseError) {
        console.log("Failed to parse error response:", parseError);
        return { success: false, message: `HTTP ${response.status}: ${responseText}` };
      }
    }
  } catch (error) {
    console.error("Error uploading category image:", error);
    console.error("Error stack:", error.stack);
    return { success: false, message: `Network error: ${error.message}` };
  }
};
window.fetchCategories = async (setCategoriesCallback) => {
  try {
    const token = localStorage.getItem("adminToken");
    const market = sessionStorage.getItem("adminMarketTab");
    const marketParam = market && market !== "all" ? `?market=${market}` : "";
    const response = await fetch(`/admin/api/categories${marketParam}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (setCategoriesCallback && typeof setCategoriesCallback === "function") {
        setCategoriesCallback(data);
      }
      return data;
    }
  } catch (error) {
    console.error("Error fetching categories:", error);
  }
};
console.log("Global functions defined successfully");
function AdminLogin({ onLoginSuccess }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/admin/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminUser", JSON.stringify(data.admin));
        onLoginSuccess(data.token, data.admin);
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { className: "login-container" }, /* @__PURE__ */ React.createElement("div", { className: "login-header" }, /* @__PURE__ */ React.createElement("div", { className: "login-logo" }, /* @__PURE__ */ React.createElement("img", { src: "/attached_assets/logo_xHACCP-S1_1772812623761.png", alt: "xHACCP Logo" }), /* @__PURE__ */ React.createElement("span", null, "xHACCP")), /* @__PURE__ */ React.createElement("h1", { className: "login-title" }, "Admin Panel"), /* @__PURE__ */ React.createElement("p", { className: "login-subtitle" }, "Welcome back! Please sign in to continue.")), error && /* @__PURE__ */ React.createElement("div", { className: "error-message" }, error), /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Email"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "email",
      className: "form-input",
      value: formData.email,
      onChange: (e) => setFormData(__spreadProps(__spreadValues({}, formData), { email: e.target.value })),
      required: true,
      placeholder: "admin@xhaccp.com"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Password"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "password",
      className: "form-input",
      value: formData.password,
      onChange: (e) => setFormData(__spreadProps(__spreadValues({}, formData), { password: e.target.value })),
      required: true,
      placeholder: "Enter your password"
    }
  )), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn", disabled: loading }, loading && /* @__PURE__ */ React.createElement("span", { className: "loading" }), loading ? "Logging in..." : "Login")), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-center", style: { marginTop: "20px" } }, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Demo Credentials:")), /* @__PURE__ */ React.createElement("p", null, "Email: admin@xhaccp.com"), /* @__PURE__ */ React.createElement("p", null, "Password: admin123")));
}
function AdminDashboard({ token, admin, onLogout }) {
  const getImageUrlGlobal = (image) => {
    if (!image) return "";
    if (typeof image === "string") {
      if (image.startsWith("{") && image.includes('"url"')) {
        try {
          const parsed = JSON.parse(image);
          return parsed.thumbnailUrl || parsed.url || "";
        } catch (e) {
          return image;
        }
      }
      return image;
    }
    if (typeof image === "object") {
      return image.thumbnailUrl || image.url || "";
    }
    return "";
  };
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const adminIsSuperAdmin = !(admin == null ? void 0 : admin.adminMarkets) || admin.adminMarkets.length === 0;
  const [selectedMarketTab, setSelectedMarketTab] = useState(() => {
    const saved = sessionStorage.getItem("adminMarketTab");
    const allowed = (admin == null ? void 0 : admin.adminMarkets) || [];
    if (allowed.length > 0) return saved && allowed.includes(saved) ? saved : allowed[0];
    return saved || "all";
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
  const [bulkOperation, setBulkOperation] = useState("");
  const [bulkResults, setBulkResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showSearchFilter, setShowSearchFilter] = useState(false);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [statusChangeOrderId, setStatusChangeOrderId] = useState(null);
  const [statusChangeValue, setStatusChangeValue] = useState("");
  const [showOrderTools, setShowOrderTools] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showProductBulkModal, setShowProductBulkModal] = useState(false);
  const [productBulkOperation, setProductBulkOperation] = useState("");
  const [showProductSearchFilter, setShowProductSearchFilter] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
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
  const [supplierBulkOperation, setSupplierBulkOperation] = useState("");
  const supplierInitialDataRef = React.useRef(null);
  const [supplierLoadTrigger, setSupplierLoadTrigger] = useState(0);
  const [showHomepageConfigModal, setShowHomepageConfigModal] = useState(false);
  const [homepageConfig, setHomepageConfig] = useState({
    mainTop: [],
    mainShop: []
  });
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogGenerating, setBlogGenerating] = useState(false);
  const [blogGenerateForm, setBlogGenerateForm] = useState({ title: "", category: "HACCP", language: (() => { var _m = sessionStorage.getItem("adminMarketTab"); return _m === "fr" ? "fr" : _m === "com" ? "en" : "ro"; })() });
  const [editingBlogPost, setEditingBlogPost] = useState(null);
  const [previewBlogPost, setPreviewBlogPost] = useState(null);
  const [blogEditForm, setBlogEditForm] = useState({ title: "", excerpt: "", content: "", imageUrl: "", category: "", published: true });
  const [scheduleConfig, setScheduleConfig] = useState({ enabled: true, intervalDays: 7, hour: 8 });
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [showAddVoucherModal, setShowAddVoucherModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [voucherForm, setVoucherForm] = useState({
    code: "",
    name: "",
    discountType: "fixed",
    discountValue: "",
    minOrderAmount: "",
    maxUses: "",
    isActive: true,
    validFrom: "",
    validUntil: "",
    marketCode: "ro"
  });
  const [marketsData, setMarketsData] = useState({ ro: null, fr: null, com: null });
  const [marketsLoading, setMarketsLoading] = useState(false);
  const [marketFilter, setMarketFilter] = useState("all");
  const [productMarketsMap, setProductMarketsMap] = useState({});
  const [editingProductMarkets, setEditingProductMarkets] = useState({ ro: null, fr: null, com: null });
  const [companySettings, setCompanySettings] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    contactPerson: "",
    website: "",
    vatNumber: "",
    registrationNumber: "",
    description: "",
    marketContacts: { ro: {}, fr: {}, com: {} }
  });
  const [activeMarketTab, setActiveMarketTab] = useState("ro");
  const [showCompanySettingsModal, setShowCompanySettingsModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [initialProductData, setInitialProductData] = useState(null);
  const [modalKey, setModalKey] = useState(0);
  const [productTranslations, setProductTranslations] = useState([]);
  const [showTranslationsTab, setShowTranslationsTab] = useState(false);
  const lastLoadedProductIdRef = React.useRef(null);
  const initialProductDataRef = React.useRef(null);
  const [productLoadTrigger, setProductLoadTrigger] = useState(0);
  useEffect(() => {
    var _a, _b, _c, _d, _e;
    if (editingProduct) {
      if (lastLoadedProductIdRef.current === editingProduct.id) {
        return;
      }
      console.log("Loading product for editing:", editingProduct.id);
      lastLoadedProductIdRef.current = editingProduct.id;
      initialProductDataRef.current = {
        name: editingProduct.name || "",
        description: editingProduct.description || "",
        price: editingProduct.price || "",
        compareAtPrice: editingProduct.compareAtPrice || "",
        categoryId: editingProduct.categoryId || "",
        supplierId: editingProduct.supplierId || "",
        imageUrl: editingProduct.imageUrl || "",
        stockQuantity: editingProduct.stockQuantity || "",
        featured: editingProduct.featured || false,
        vatValue: editingProduct.vatValue || "",
        vatPercentage: editingProduct.vatPercentage || "19.00",
        currency: editingProduct.currency || "EUR",
        productCode: editingProduct.productCode || "",
        ncCode: editingProduct.ncCode || "",
        cpvCode: editingProduct.cpvCode || "",
        status: editingProduct.status || "active",
        images: editingProduct.images || [],
        weight: ((_a = editingProduct.weight) == null ? void 0 : _a.toString()) || "",
        length: ((_b = editingProduct.length) == null ? void 0 : _b.toString()) || "",
        width: ((_c = editingProduct.width) == null ? void 0 : _c.toString()) || "",
        height: ((_d = editingProduct.height) == null ? void 0 : _d.toString()) || "",
        piecesPerPackage: ((_e = editingProduct.piecesPerPackage) == null ? void 0 : _e.toString()) || "",
        productQuantity: editingProduct.productQuantity || "",
        specs: Array.isArray(editingProduct.specs) ? editingProduct.specs : [],
        volumeDiscounts: Array.isArray(editingProduct.volumeDiscounts) ? editingProduct.volumeDiscounts : [],
        priority: editingProduct.priority || 0
      };
      setProductLoadTrigger((prev) => prev + 1);
      setShowAddProductModal(true);
      const fetchTranslations = async () => {
        try {
          const response = await fetch(`/admin/api/products/${editingProduct.id}/translations`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (response.ok) {
            const translations = await response.json();
            setProductTranslations(translations);
          }
        } catch (error2) {
          console.error("Error fetching translations:", error2);
          setProductTranslations([]);
        }
      };
      fetchTranslations();
      const fetchProductMarketData = async () => {
        try {
          const response = await fetch(`/admin/api/products/${editingProduct.id}/markets`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            const map = { ro: null, fr: null, com: null };
            data.forEach((pm) => {
              map[pm.market] = pm;
            });
            setEditingProductMarkets(map);
          }
        } catch (error2) {
          console.error("Error fetching product markets:", error2);
          setEditingProductMarkets({ ro: null, fr: null, com: null });
        }
      };
      fetchProductMarketData();
    } else {
      lastLoadedProductIdRef.current = null;
      initialProductDataRef.current = null;
      setEditingProductMarkets({ ro: null, fr: null, com: null });
    }
  }, [editingProduct == null ? void 0 : editingProduct.id]);
  useEffect(() => {
    fetchStats();
  }, []);
  useEffect(() => {
    if ((admin == null ? void 0 : admin.adminMarkets) && admin.adminMarkets.length > 0) {
      const allowed = admin.adminMarkets;
      if (selectedMarketTab === "all" || !allowed.includes(selectedMarketTab)) {
        setSelectedMarketTab(allowed[0]);
      }
    }
  }, [admin]);
  useEffect(() => {
    sessionStorage.setItem("adminMarketTab", selectedMarketTab);
    setMarketFilter(selectedMarketTab);
    var _bLang = selectedMarketTab === "fr" ? "fr" : selectedMarketTab === "com" ? "en" : "ro";
    setBlogGenerateForm(function(_bf) { return __spreadProps(__spreadValues({}, _bf), { language: _bLang }); });
    if (activeView === "users") fetchUsers();
    else if (activeView === "products") fetchProducts();
    else if (activeView === "categories") fetchCategories();
    else if (activeView === "suppliers") fetchSuppliers();
    else if (activeView === "vouchers") fetchVouchers();
    else if (activeView === "company-settings") fetchCompanySettings();
    else if (activeView === "blog") fetchBlogPosts();
  }, [selectedMarketTab]);
  useEffect(() => {
    if (activeView === "orders") {
      fetchOrders(marketFilter);
    } else if (activeView === "blog") {
      fetchBlogPosts();
    }
  }, [marketFilter, activeView]);
  useEffect(() => {
    let filtered = orders;
    if (searchTerm) {
      filtered = filtered.filter(
        (order) => order.id.toString().includes(searchTerm) || ((order.shippingAddress.firstName || "") + " " + (order.shippingAddress.lastName || "")).toLowerCase().includes(searchTerm.toLowerCase()) || order.shippingAddress.city.toLowerCase().includes(searchTerm.toLowerCase()) || order.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (companySearch) {
      filtered = filtered.filter(
        (order) => {
          var _a;
          return (((_a = order.billingAddress) == null ? void 0 : _a.companyName) || "").toLowerCase().includes(companySearch.toLowerCase());
        }
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }
    if (marketFilter !== "all") {
      filtered = filtered.filter((order) => (order.market || "ro") === marketFilter);
    }
    setFilteredOrders(filtered);
    setOrdersPage(1);
  }, [orders, searchTerm, companySearch, statusFilter, marketFilter]);
  useEffect(() => {
    let filtered = products;
    if (productSearchTerm) {
      filtered = filtered.filter(
        (product) => {
          var _a, _b, _c;
          return product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || product.id.toString().includes(productSearchTerm) || ((_b = (_a = product.category) == null ? void 0 : _a.name) == null ? void 0 : _b.toLowerCase().includes(productSearchTerm.toLowerCase())) || ((_c = product.description) == null ? void 0 : _c.toLowerCase().includes(productSearchTerm.toLowerCase()));
        }
      );
    }
    if (productCategoryFilter !== "all") {
      filtered = filtered.filter((product) => product.categoryId === parseInt(productCategoryFilter));
    }
    if (productStatusFilter !== "all") {
      filtered = filtered.filter((product) => (product.status || "active") === productStatusFilter);
    }
    setFilteredProducts(filtered);
    setProductPage(1);
    console.log("Products filtered:", {
      searchTerm: productSearchTerm,
      categoryFilter: productCategoryFilter,
      statusFilter: productStatusFilter,
      totalProducts: products.length,
      filteredProducts: filtered.length
    });
  }, [products, productSearchTerm, productCategoryFilter, productStatusFilter]);
  const fetchStats = async () => {
    try {
      const response = await fetch("/admin/api/stats", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setStats(data);
      } else {
        setError(data.message || "Failed to fetch stats");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const fetchUsers = async () => {
    try {
      const marketParam = selectedMarketTab && selectedMarketTab !== "all" ? `?market=${selectedMarketTab}` : "";
      const response = await fetch(`/admin/api/users${marketParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      } else {
        console.error("Failed to fetch users:", data.message);
      }
    } catch (err) {
      console.error("Network error fetching users:", err);
    }
  };
  const fetchOrders = async (mktFilter) => {
    try {
      const mkt = mktFilter || marketFilter;
      const url = mkt && mkt !== "all" ? `/admin/api/orders?market=${mkt}` : "/admin/api/orders";
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setOrders(data);
      } else {
        console.error("Failed to fetch orders:", data.message);
      }
    } catch (err) {
      console.error("Network error fetching orders:", err);
    }
  };
  const fetchProducts = async () => {
    try {
      const marketParam = selectedMarketTab && selectedMarketTab !== "all" ? `?market=${selectedMarketTab}` : "";
      const response = await fetch(`/admin/api/products${marketParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setProducts(data);
      } else {
        console.error("Failed to fetch products:", data.message);
      }
    } catch (err) {
      console.error("Network error fetching products:", err);
    }
  };
  const fetchCategories = async () => {
    try {
      const marketParam = selectedMarketTab && selectedMarketTab !== "all" ? `?market=${selectedMarketTab}` : "";
      const response = await fetch(`/admin/api/categories${marketParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setCategories(data);
      } else {
        console.error("Failed to fetch categories:", data.message);
      }
    } catch (err) {
      console.error("Network error fetching categories:", err);
    }
  };
  const fetchSuppliers = async () => {
    try {
      const marketParam = selectedMarketTab && selectedMarketTab !== "all" ? `?market=${selectedMarketTab}` : "";
      const response = await fetch(`/admin/api/suppliers${marketParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setSuppliers(data);
      } else {
        console.error("Failed to fetch suppliers:", data.message);
      }
    } catch (err) {
      console.error("Network error fetching suppliers:", err);
    }
  };
  const fetchVouchers = async () => {
    try {
      const marketParam = selectedMarketTab && selectedMarketTab !== "all" ? `?market=${selectedMarketTab}` : "";
      const response = await fetch(`/admin/api/vouchers${marketParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setVouchers(data);
      } else {
        console.error("Failed to fetch vouchers:", data.message);
      }
    } catch (err) {
      console.error("Network error fetching vouchers:", err);
    }
  };
  const fetchBlogPosts = async () => {
    try {
      var _bMkt = sessionStorage.getItem("adminMarketTab");
      var _bMktQ = _bMkt && _bMkt !== "all" ? "?market=" + _bMkt : "";
      const response = await fetch("/admin/api/blog/posts" + _bMktQ, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setBlogPosts(data);
    } catch (err) {
      console.error("Error fetching blog posts:", err);
    }
  };
  const generateBlogPost = async () => {
    setBlogGenerating(true);
    try {
      const response = await fetch("/admin/api/blog/generate", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(blogGenerateForm)
      });
      const data = await response.json();
      if (response.ok) {
        alert("\u2705 Articol generat cu succes! ID: " + data.postId);
        setBlogGenerateForm({ title: "", category: "HACCP", language: "ro" });
        fetchBlogPosts();
      } else {
        alert("\u274C Eroare: " + (data.message || "Necunoscut"));
      }
    } catch (err) {
      alert("\u274C Eroare re\u021Bea la generare articol");
    } finally {
      setBlogGenerating(false);
    }
  };
  const generateWeeklyForMarket = async (market) => {
    setBlogGenerating(true);
    try {
      const response = await fetch("/admin/api/blog/generate-weekly", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ market })
      });
      const data = await response.json();
      if (response.ok) {
        const marketLabel = market === "fr" ? "\u{1F1EB}\u{1F1F7} FR" : market === "com" ? "\u{1F1EC}\u{1F1E7} COM" : "\u{1F1F7}\u{1F1F4} RO";
        alert("\u2705 Articol s\u0103pt\u0103m\xE2nal generat pentru pia\u021Ba " + marketLabel + "! ID: " + data.postId);
        fetchBlogPosts();
      } else {
        alert("\u274C Eroare: " + (data.message || "Necunoscut"));
      }
    } catch (err) {
      alert("\u274C Eroare re\u021Bea la generare articol s\u0103pt\u0103m\xE2nal");
    } finally {
      setBlogGenerating(false);
    }
  };
  const toggleBlogPostPublished = async (post) => {
    try {
      const response = await fetch("/admin/api/blog/posts/" + post.id, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ published: !post.published })
      });
      if (response.ok) fetchBlogPosts();
    } catch (err) {
      console.error("Error toggling blog post:", err);
    }
  };
  const deleteBlogPost = async (id) => {
    if (!confirm("E\u0219ti sigur c\u0103 vrei s\u0103 \u0219tergi acest articol?")) return;
    try {
      await fetch("/admin/api/blog/posts/" + id, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      fetchBlogPosts();
    } catch (err) {
      console.error("Error deleting blog post:", err);
    }
  };
  const openEditBlogPost = (post) => {
    setBlogEditForm({
      title: post.title || "",
      excerpt: post.excerpt || "",
      content: post.content || "",
      imageUrl: post.imageUrl || "",
      category: post.category || "",
      published: post.published
    });
    setEditingBlogPost(post);
  };
  const saveBlogPost = async () => {
    try {
      const response = await fetch("/admin/api/blog/posts/" + editingBlogPost.id, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(blogEditForm)
      });
      if (response.ok) {
        setEditingBlogPost(null);
        fetchBlogPosts();
        alert("Articol actualizat cu succes!");
      } else {
        alert("Eroare la salvare!");
      }
    } catch (err) {
      alert("Eroare: " + err.message);
    }
  };
  const fetchScheduleConfig = async () => {
    try {
      const res = await fetch("/admin/api/blog/schedule", { headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) {
        setScheduleConfig(await res.json());
        setScheduleLoaded(true);
      }
    } catch (_) {
    }
  };
  const saveScheduleConfig = async () => {
    try {
      const res = await fetch("/admin/api/blog/schedule", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(scheduleConfig)
      });
      if (res.ok) {
        alert("Configura\u021Bie salvat\u0103! Scheduler-ul a fost repornit.");
      } else {
        alert("Eroare la salvare!");
      }
    } catch (err) {
      alert("Eroare: " + err.message);
    }
  };
  const fetchMarkets = async () => {
    setMarketsLoading(true);
    try {
      const res = await fetch("/admin/api/markets/settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const map = { ro: null, fr: null, com: null };
        data.forEach((m) => {
          map[m.market] = m;
        });
        setMarketsData(map);
      }
    } catch (err) {
      console.error("Error fetching markets:", err);
    }
    setMarketsLoading(false);
  };
  const saveMarket = async (market, data) => {
    try {
      const res = await fetch(`/admin/api/markets/${market}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        fetchMarkets();
        alert("\u2705 Pia\u021Ba a fost salvat\u0103!");
      } else {
        const err = await res.json();
        alert("\u274C Eroare: " + (err.message || "Necunoscut\u0103"));
      }
    } catch (err) {
      alert("\u274C Eroare re\u021Bea: " + err.message);
    }
  };
  const fetchProductMarkets = async () => {
    try {
      const res = await fetch("/admin/api/market-products", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const map = {};
        data.forEach((pm) => {
          if (!map[pm.productId]) map[pm.productId] = {};
          map[pm.productId][pm.market] = pm;
        });
        setProductMarketsMap(map);
      }
    } catch (err) {
      console.error("Error fetching product markets:", err);
    }
  };
  const toggleProductMarket = async (productId, market, currentIsActive) => {
    try {
      const res = await fetch(`/admin/api/products/${productId}/markets/${market}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentIsActive })
      });
      if (res.ok) {
        setProductMarketsMap((prev) => {
          var _a;
          return __spreadProps(__spreadValues({}, prev), {
            [productId]: __spreadProps(__spreadValues({}, prev[productId] || {}), {
              [market]: __spreadProps(__spreadValues({}, ((_a = prev[productId]) == null ? void 0 : _a[market]) || {}), { isActive: !currentIsActive, market })
            })
          });
        });
      }
    } catch (err) {
      console.error("Error toggling product market:", err);
    }
  };
  const createCategory = async (categoryData) => {
    try {
      const token2 = localStorage.getItem("adminToken");
      const response = await fetch("/admin/api/categories", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token2}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(categoryData)
      });
      const data = await response.json();
      if (response.ok) {
        await fetchCategories();
        return { success: true, message: "Category created successfully" };
      } else {
        return { success: false, message: data.message || "Failed to create category" };
      }
    } catch (error2) {
      console.error("Error creating category:", error2);
      return { success: false, message: "Network error. Please try again." };
    }
  };
  const updateCategory = async (categoryId, categoryData) => {
    try {
      const response = await fetch(`/admin/api/categories/${categoryId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(categoryData)
      });
      const data = await response.json();
      if (response.ok) {
        await fetchCategories();
        return { success: true, message: "Category updated successfully" };
      } else {
        return { success: false, message: data.message || "Failed to update category" };
      }
    } catch (error2) {
      console.error("Error updating category:", error2);
      return { success: false, message: "Network error. Please try again." };
    }
  };
  const syncSupplierPrices = async (supplierId) => {
    try {
      const response = await fetch(`/admin/api/suppliers/${supplierId}/sync-prices`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (response.ok) {
        alert(`\u2705 Price Sync Successful!

${data.message}

Updated Products:
${data.data.filter((r) => r.success).map((r) => `\u2022 ${r.productName}: \u20AC${r.oldPrice} \u2192 \u20AC${r.newPrice}`).join("\n")}`);
        fetchProducts();
      } else {
        alert(`\u274C Price Sync Failed

${data.message}`);
      }
    } catch (error2) {
      console.error("Error syncing prices:", error2);
      alert("\u274C Network error during price sync");
    }
  };
  const syncSupplierStock = async (supplierId) => {
    try {
      const response = await fetch(`/admin/api/suppliers/${supplierId}/sync-stock`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (response.ok) {
        alert(`\u2705 Stock Sync Successful!

${data.message}

Updated Products:
${data.data.filter((r) => r.success).map((r) => `\u2022 ${r.productName}: ${r.oldStock} \u2192 ${r.newStock} units`).join("\n")}`);
        fetchProducts();
      } else {
        alert(`\u274C Stock Sync Failed

${data.message}`);
      }
    } catch (error2) {
      console.error("Error syncing stock:", error2);
      alert("\u274C Network error during stock sync");
    }
  };
  const forwardOrderToSuppliers = async (orderId) => {
    try {
      const response = await fetch("/admin/api/suppliers/forward-order", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderId })
      });
      const data = await response.json();
      if (response.ok) {
        const results = data.data.map(
          (r) => `\u2022 ${r.supplierName}: ${r.success ? "\u2705 Forwarded" : "\u274C Failed"} (${r.itemCount} items)`
        ).join("\n");
        alert(`\u{1F4E4} Order Forward Results

${data.message}

Supplier Results:
${results}`);
      } else {
        alert(`\u274C Order Forward Failed

${data.message}`);
      }
    } catch (error2) {
      console.error("Error forwarding order:", error2);
      alert("\u274C Network error during order forwarding");
    }
  };
  const updateSupplier = async (supplierId, supplierData) => {
    try {
      const response = await fetch(`/admin/api/suppliers/${supplierId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(supplierData)
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, data };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error2) {
      console.error("Error updating supplier:", error2);
      return { success: false, message: "Network error during supplier update" };
    }
  };
  const fetchSupplierDetails = async (supplierId) => {
    try {
      const supplierResponse = await fetch(`/admin/api/suppliers/${supplierId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const supplier = await supplierResponse.json();
      const productsResponse = await fetch(`/admin/api/products?supplierId=${supplierId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const supplierProducts = await productsResponse.json();
      const ordersResponse = await fetch(`/admin/api/orders?supplierId=${supplierId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const supplierOrders = await ordersResponse.json();
      return {
        supplier,
        products: supplierProducts || [],
        orders: supplierOrders || [],
        totalProducts: (supplierProducts == null ? void 0 : supplierProducts.length) || 0,
        totalOrders: (supplierOrders == null ? void 0 : supplierOrders.length) || 0,
        totalRevenue: (supplierOrders == null ? void 0 : supplierOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0)) || 0
      };
    } catch (error2) {
      console.error("Error fetching supplier details:", error2);
      return null;
    }
  };
  const handleSupplierSelection = (supplierId, isChecked) => {
    setSelectedSuppliers((prev) => {
      if (isChecked) {
        return [...prev, supplierId];
      } else {
        return prev.filter((id) => id !== supplierId);
      }
    });
  };
  const handleSelectAllSuppliers = (isChecked) => {
    if (isChecked) {
      setSelectedSuppliers(suppliers.map((s) => s.id));
    } else {
      setSelectedSuppliers([]);
    }
  };
  const performSupplierBulkOperation = async (operation, formData) => {
    try {
      const response = await fetch("/admin/api/suppliers/bulk", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(__spreadValues({
          operation,
          supplierIds: selectedSuppliers
        }, formData))
      });
      const result = await response.json();
      if (response.ok) {
        alert(`\u2705 Bulk operation completed successfully!

${result.message}
Processed: ${result.processed} suppliers
Success: ${result.success}
Failed: ${result.failed}`);
        fetchSuppliers();
        setSelectedSuppliers([]);
        setShowSupplierBulkModal(false);
      } else {
        alert(`\u274C Bulk operation failed: ${result.message}`);
      }
    } catch (error2) {
      console.error("Error performing bulk operation:", error2);
      alert("\u274C Network error during bulk operation");
    }
  };
  const generateProductAnalytics = () => {
    console.log("Generating product analytics with data:", products.length, "products");
    console.log("Categories available:", categories.length, "categories");
    if (products.length === 0) {
      setAnalyticsData({
        error: "No products found to analyze"
      });
      return;
    }
    if (categories.length === 0) {
      fetchCategories();
    }
    const analytics = {
      totalProducts: products.length,
      // Category analysis
      categoryBreakdown: categories.reduce((acc, cat) => {
        const categoryProducts = products.filter((p) => p.categoryId === cat.id);
        if (categoryProducts.length > 0) {
          acc[cat.name] = {
            count: categoryProducts.length,
            percentage: (categoryProducts.length / products.length * 100).toFixed(1)
          };
        }
        return acc;
      }, {}),
      // Status analysis
      statusBreakdown: {
        active: products.filter((p) => (p.status || "active") === "active").length,
        inactive: products.filter((p) => p.status === "inactive").length,
        draft: products.filter((p) => p.status === "draft").length,
        discontinued: products.filter((p) => p.status === "discontinued").length
      },
      // Price analysis
      priceAnalysis: (() => {
        const prices = products.map((p) => parseFloat(p.price) || 0).filter((p) => p > 0);
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
        inStock: products.filter((p) => (p.stockQuantity || 0) > 0).length,
        outOfStock: products.filter((p) => (p.stockQuantity || 0) === 0).length,
        lowStock: products.filter((p) => (p.stockQuantity || 0) > 0 && (p.stockQuantity || 0) < 10).length
      },
      // Top products by price
      topPriceProducts: products.filter((p) => p.price && parseFloat(p.price) > 0).sort((a, b) => parseFloat(b.price) - parseFloat(a.price)).slice(0, 5).map((p) => {
        var _a;
        return {
          name: p.name,
          price: parseFloat(p.price).toFixed(2),
          category: ((_a = categories.find((c) => c.id === p.categoryId)) == null ? void 0 : _a.name) || "Unknown"
        };
      }),
      // Generated timestamp
      generatedAt: (/* @__PURE__ */ new Date()).toLocaleString()
    };
    console.log("Analytics generated:", analytics);
    setAnalyticsData(analytics);
  };
  const createUser = async (userData) => {
    try {
      const response = await fetch("/admin/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      if (response.ok) {
        fetchUsers();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const updateUser = async (userId, userData) => {
    try {
      const response = await fetch(`/admin/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      if (response.ok) {
        fetchUsers();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const deleteUser = async (userId) => {
    try {
      const response = await fetch(`/admin/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        fetchUsers();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const createProduct = async (productData) => {
    try {
      const response = await fetch("/admin/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });
      const data = await response.json();
      if (response.ok) {
        fetchProducts();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const updateProduct = async (productId, productData) => {
    try {
      const response = await fetch(`/admin/api/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });
      const data = await response.json();
      if (response.ok) {
        fetchProducts();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const deleteProduct = async (productId) => {
    try {
      const response = await fetch(`/admin/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        fetchProducts();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        "Product Name": "Example Product",
        "Description": "This is an example product description",
        "Price": "29.99",
        "Stock Quantity": "100",
        "Category ID": "1",
        "Category Name": "Cleaning & Sanitizing",
        "Status": "active",
        "VAT %": "21",
        "Product Code": "KO001",
        "NC Code": "3924100000",
        "CPV Code": "39830000-9",
        "Supplier Name": "xHACCP Direct",
        "Weight (kg)": "2.5",
        "Length (cm)": "25.0",
        "Width (cm)": "15.0",
        "Height (cm)": "10.0",
        "Pieces Per Package": "6"
      },
      {
        "Product Name": "Another Product",
        "Description": "Second example product",
        "Price": "45.50",
        "Stock Quantity": "50",
        "Category ID": "2",
        "Category Name": "Food Labels",
        "Status": "active",
        "VAT %": "21",
        "Product Code": "KO002",
        "NC Code": "4821100000",
        "CPV Code": "30199700-3",
        "Supplier Name": "xHACCP Direct",
        "Weight (kg)": "1.0",
        "Length (cm)": "20.0",
        "Width (cm)": "15.0",
        "Height (cm)": "5.0",
        "Pieces Per Package": "12"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    const instructionsData = [
      { Field: "Product Name", Required: "Yes", Description: "Unique product name" },
      { Field: "Description", Required: "No", Description: "Product description" },
      { Field: "Price", Required: "Yes", Description: "Product price in decimal format (e.g., 29.99)" },
      { Field: "Stock Quantity", Required: "Yes", Description: "Available stock quantity" },
      { Field: "Category ID", Required: "Yes", Description: "Category ID number from system" },
      { Field: "Category Name", Required: "No", Description: "Category name for reference only" },
      { Field: "Status", Required: "No", Description: "Product status: active, inactive, draft, discontinued" },
      { Field: "VAT %", Required: "No", Description: "VAT percentage (default: 19)" },
      { Field: "Product Code", Required: "No", Description: "Alphanumeric product code" },
      { Field: "NC Code", Required: "No", Description: "Nomenclature code" },
      { Field: "CPV Code", Required: "No", Description: "Common Procurement Vocabulary code" },
      { Field: "Supplier Name", Required: "No", Description: "Supplier name (default: xHACCP Direct)" },
      { Field: "Weight (kg)", Required: "No", Description: "Product weight in kilograms (minimum 1kg for parcel compliance)" },
      { Field: "Length (cm)", Required: "No", Description: "Product length in centimeters for shipping calculations" },
      { Field: "Width (cm)", Required: "No", Description: "Product width in centimeters for shipping calculations" },
      { Field: "Height (cm)", Required: "No", Description: "Product height in centimeters for shipping calculations" },
      { Field: "Pieces Per Package", Required: "No", Description: "Maximum pieces per shipping package for AWB generation (default: 1)" }
    ];
    const instructionsWs = XLSX.utils.json_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(wb, instructionsWs, "Instructions");
    XLSX.writeFile(wb, "xHACCP_Products_Import_Template.xlsx");
    alert('\u2705 Excel template downloaded successfully!\\n\\nPlease fill in the template with your product data and use "Import from Excel" to upload it.');
  };
  const importProductsFromExcel = async (file) => {
    var _a, _b;
    if (!file) {
      alert("Please select an Excel file to import.");
      return;
    }
    try {
      setImportResults({ loading: true });
      const formData = new FormData();
      formData.append("excelFile", file);
      const response = await fetch("/admin/api/products/import-excel", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
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
        console.log("Excel import completed, refreshing product list...");
        await fetchProducts();
        setTimeout(async () => {
          console.log("Performing delayed product list refresh...");
          await fetchProducts();
        }, 1e3);
        alert(`\u2705 Import completed!\\n\\nImported: ${result.imported}\\nErrors: ${((_a = result.errors) == null ? void 0 : _a.length) || 0}\\nDuplicates: ${((_b = result.duplicates) == null ? void 0 : _b.length) || 0}\\n\\nProduct list has been refreshed. The new products should now be visible.`);
      } else {
        setImportResults({
          success: false,
          message: result.message || "Import failed"
        });
        alert("\u274C Import failed: " + (result.message || "Unknown error"));
      }
    } catch (error2) {
      console.error("Error importing Excel:", error2);
      setImportResults({
        success: false,
        message: "Network error during import"
      });
      alert("\u274C Network error during import");
    }
  };
  const updateOrderStatus = async (orderId, status) => {
    try {
      const response = await fetch(`/admin/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (response.ok) {
        fetchOrders();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const generateAWB = async (orderId) => {
    try {
      console.log(`\u{1F69A} Generating AWB for order ${orderId}...`);
      const response = await fetch(`/admin/api/orders/${orderId}/generate-awb`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      console.log(`\u{1F4E1} AWB response status: ${response.status}`);
      const data = await response.json();
      console.log("\u{1F4E6} AWB response data:", data);
      if (response.ok && data.success) {
        await fetchOrders();
        alert(`\u2705 AWB generat cu succes!\\n\\nAWB: ${data.awbNumber}\\nCurier: ${data.courier}\\nCost: ${data.awbCost || data.cost} ${data.currency}\\n\\nStatus comand\u0103: in_delivery\\nTracking: ${data.trackingUrl || "Disponibil \xEEn portalul Sameday"}`);
      } else if (response.status === 503 && data.retryAfter) {
        alert(`\u23F3 Sameday API Rate Limited\\n\\n${data.message}\\n\\nPlease wait ${data.retryAfter} seconds before trying again.`);
      } else {
        console.error("AWB generation failed:", data);
        alert(`\u274C Generare AWB e\u0219uat\u0103\\n\\n${data.message || "Eroare necunoscut\u0103"}\\n\\n${data.error ? "Detalii: " + data.error.substring(0, 150) : ""}\\n\\nPo\u021Bi re\xEEncerca sau crea AWB manual \xEEn portalul Sameday.`);
      }
    } catch (err) {
      console.error("AWB generation error:", err);
      alert("\u274C Network error during AWB generation. Check console for details.");
    }
  };
  const acceptOrder = async (orderId) => {
    try {
      const response = await fetch(`/admin/api/orders/${orderId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        fetchOrders();
        return {
          success: true,
          message: data.message,
          notifications: data.notifications
        };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const performBulkOperation = async (operation, orderIds, data = {}) => {
    try {
      let endpoint = "";
      let payload = __spreadValues({ orderIds }, data);
      switch (operation) {
        case "status":
          endpoint = "/admin/api/orders/bulk/status";
          break;
        case "shipping":
          endpoint = "/admin/api/orders/bulk/shipping-labels";
          break;
        case "notifications":
          endpoint = "/admin/api/orders/bulk/notifications";
          break;
        case "refunds":
          endpoint = "/admin/api/orders/bulk/refunds";
          break;
        default:
          return { success: false, message: "Invalid operation" };
      }
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (response.ok) {
        fetchOrders();
        return { success: true, message: result.message, results: result.results };
      } else {
        return { success: false, message: result.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const performProductBulkOperation = async (operation, productIds, data = {}) => {
    try {
      let endpoint = "";
      let payload = __spreadValues({ productIds }, data);
      switch (operation) {
        case "update-prices":
          endpoint = "/admin/api/products/bulk/prices";
          break;
        case "update-categories":
          endpoint = "/admin/api/products/bulk/categories";
          break;
        case "update-status":
          endpoint = "/admin/api/products/bulk/status";
          break;
        case "update-stock":
          endpoint = "/admin/api/products/bulk/stock";
          break;
        case "export":
          endpoint = "/admin/api/products/bulk/export";
          break;
        case "delete":
          endpoint = "/admin/api/products/bulk/delete";
          break;
        default:
          return { success: false, message: "Invalid operation" };
      }
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const createCategory2 = async (categoryData) => {
        try {
          const response2 = await fetch("/admin/api/categories", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(categoryData)
          });
          const data2 = await response2.json();
          if (response2.ok) {
            fetchCategories();
            return { success: true, message: "Category created successfully" };
          } else {
            return { success: false, message: data2.message };
          }
        } catch (err) {
          return { success: false, message: "Network error" };
        }
      };
      const updateCategory2 = async (categoryId, categoryData) => {
        try {
          const token2 = localStorage.getItem("adminToken");
          const response2 = await fetch(`/admin/api/categories/${categoryId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token2}`
            },
            body: JSON.stringify(categoryData)
          });
          const data2 = await response2.json();
          if (response2.ok) {
            fetchCategories();
            return { success: true, message: "Category updated successfully" };
          } else {
            return { success: false, message: data2.message };
          }
        } catch (err) {
          return { success: false, message: "Network error" };
        }
      };
      const deleteCategory2 = async (categoryId) => {
        try {
          const token2 = localStorage.getItem("adminToken");
          const response2 = await fetch(`/admin/api/categories/${categoryId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${token2}`
            }
          });
          const data2 = await response2.json();
          if (response2.ok) {
            fetchCategories();
            return { success: true, message: data2.message };
          } else {
            return { success: false, message: data2.message };
          }
        } catch (err) {
          return { success: false, message: "Network error" };
        }
      };
      const updateHomepageCategories = async (mainTopCategories, mainShopCategories) => {
        try {
          const token2 = localStorage.getItem("adminToken");
          const response2 = await fetch("/admin/api/categories/bulk/homepage", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token2}`
            },
            body: JSON.stringify({
              mainTopCategories,
              mainShopCategories
            })
          });
          const data2 = await response2.json();
          if (response2.ok) {
            fetchCategories();
            return { success: true, message: data2.message };
          } else {
            return { success: false, message: data2.message };
          }
        } catch (err) {
          return { success: false, message: "Network error" };
        }
      };
      const result = await response.json();
      if (response.ok) {
        fetchProducts();
        return { success: true, message: result.message, results: result.results };
      } else {
        return { success: false, message: result.message };
      }
    } catch (err) {
      return { success: false, message: "Network error" };
    }
  };
  const fetchCompanySettings = async () => {
    try {
      const mkt = sessionStorage.getItem("adminMarketTab");
      const mktParam = mkt && mkt !== "all" ? `?market=${mkt}` : "";
      const response = await fetch(`/admin/api/company-settings${mktParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok && data) {
        setCompanySettings(__spreadProps(__spreadValues({}, data), {
          marketContacts: data.marketContacts || { ro: {}, fr: {}, com: {} }
        }));
      } else {
        setCompanySettings({
          name: "xHACCP",
          email: "info@xhaccp.com",
          phone: "+40 123 456 789",
          address: "Calea Mosilor 158",
          city: "Bucharest",
          state: "Bucuresti",
          zipCode: "020883",
          country: "Romania",
          contactPerson: "Company Administrator",
          website: "https://xhaccp.com",
          vatNumber: "",
          registrationNumber: "",
          defaultCurrency: "EUR",
          defaultVatPercentage: "19.00",
          reverseChargeVat: "0.00",
          freeShippingThreshold: "500.00",
          standardShippingCost: "25.00",
          description: "Professional kitchen equipment and supplies for the HORECA industry."
        });
      }
    } catch (err) {
      console.error("Network error fetching company settings:", err);
    }
  };
  const fetchCompanyDefaults = async () => {
    try {
      const response = await fetch("/admin/api/company-settings", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok && data) {
        return {
          currency: data.defaultCurrency || "EUR",
          vatPercentage: data.defaultVatPercentage || "21.00"
        };
      }
    } catch (err) {
      console.error("Error fetching company defaults:", err);
    }
    return {
      currency: "EUR",
      vatPercentage: "21.00"
    };
  };
  const exchangeRates = {
    "EUR": { "RON": 4.95, "USD": 1.1, "GBP": 0.86 },
    "RON": { "EUR": 0.2, "USD": 0.22, "GBP": 0.17 },
    "USD": { "EUR": 0.91, "RON": 4.5, "GBP": 0.78 },
    "GBP": { "EUR": 1.16, "RON": 5.88, "USD": 1.28 }
  };
  const handleCurrencyChange = (event) => {
    var _a;
    const newCurrency = event.target.value;
    const currentCurrency = companySettings.defaultCurrency || "EUR";
    if (newCurrency === currentCurrency) return;
    const form = event.target.closest("form");
    const shippingThresholdInput = form.querySelector('input[name="freeShippingThreshold"]');
    const shippingCostInput = form.querySelector('input[name="standardShippingCost"]');
    if (shippingThresholdInput && shippingCostInput) {
      const currentThreshold = parseFloat(shippingThresholdInput.value) || 500;
      const currentCost = parseFloat(shippingCostInput.value) || 25;
      const rate = ((_a = exchangeRates[currentCurrency]) == null ? void 0 : _a[newCurrency]) || 1;
      const newThreshold = (currentThreshold * rate).toFixed(2);
      const newCost = (currentCost * rate).toFixed(2);
      shippingThresholdInput.value = newThreshold;
      shippingCostInput.value = newCost;
      const thresholdLabel = shippingThresholdInput.parentNode.querySelector("label");
      if (thresholdLabel) {
        thresholdLabel.innerHTML = `Free Shipping Threshold (${newCurrency})`;
      }
      const costLabel = shippingCostInput.parentNode.querySelector("label");
      if (costLabel) {
        costLabel.innerHTML = `Standard Shipping Cost (${newCurrency})`;
      }
      console.log(`Currency changed from ${currentCurrency} to ${newCurrency}: Threshold ${currentThreshold} \u2192 ${newThreshold}, Cost ${currentCost} \u2192 ${newCost}`);
    }
  };
  const updateCompanySettings = async (settingsData) => {
    try {
      const mkt = sessionStorage.getItem("adminMarketTab");
      const mktParam = mkt && mkt !== "all" ? `?market=${mkt}` : "";
      const response = await fetch(`/admin/api/company-settings${mktParam}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(settingsData)
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, message: "Company settings updated successfully" };
      } else {
        return { success: false, message: data.message || "Failed to update company settings" };
      }
    } catch (error2) {
      console.error("Error updating company settings:", error2);
      return { success: false, message: "Network error. Please try again." };
    }
  };
  const handleViewChange = (view) => {
    setActiveView(view);
    if (view === "users") {
      fetchUsers();
    } else if (view === "orders" && orders.length === 0) {
      fetchOrders();
    } else if (view === "products") {
      if (products.length === 0) {
        fetchProducts();
      }
      if (suppliers.length === 0) {
        fetchSuppliers();
      }
      fetchProductMarkets();
    } else if (view === "categories") {
      fetchCategories();
    } else if (view === "suppliers") {
      fetchSuppliers();
    } else if (view === "company-settings") {
      fetchCompanySettings();
    } else if (view === "vouchers") {
      fetchVouchers();
    } else if (view === "blog") {
      fetchBlogPosts();
    } else if (view === "markets") {
      fetchMarkets();
    }
  };
  const handleLogout = async () => {
    try {
      await fetch("/admin/api/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      window.location.reload();
    }
  };
  if (loading) {
    return /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("div", { className: "text-center" }, /* @__PURE__ */ React.createElement("div", { className: "loading" }), /* @__PURE__ */ React.createElement("p", null, "Loading dashboard...")));
  }
  if (error) {
    return /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("div", { className: "error-message" }, error), /* @__PURE__ */ React.createElement("button", { onClick: handleLogout, className: "btn btn-secondary" }, "Logout"));
  }
  const renderContent = () => {
    var _a, _b, _c;
    switch (activeView) {
      case "orders":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", margin: "0" } }, "\u{1F4CB} Order Management"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#17a2b8", width: "auto", padding: "8px 16px" },
            onClick: () => alert("Export orders functionality:\n\n\u2022 Export to CSV/Excel\n\u2022 Filter by date range\n\u2022 Include customer details\n\u2022 Sales reports\n\u2022 Tax documentation")
          },
          "\u{1F4CA} Export Orders"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#6c757d", width: "auto", padding: "8px 16px" },
            onClick: () => alert("Order analytics:\n\n\u2022 Sales performance\n\u2022 Revenue trends\n\u2022 Customer behavior\n\u2022 Popular products\n\u2022 Seasonal patterns")
          },
          "\u{1F4C8} Analytics"
        ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px" } }, "Order Actions"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#007bff", width: "auto", padding: "8px 16px" },
            onClick: () => setShowSearchFilter(!showSearchFilter)
          },
          "\u{1F50D} Search & Filter"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "8px 16px" },
            onClick: () => {
              if (selectedOrders.length === 0) {
                alert("Please select orders first by checking the checkboxes.");
                return;
              }
              setBulkOperation("status");
              setShowBulkModal(true);
            }
          },
          "\u{1F504} Bulk Operations"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#dc3545", width: "auto", padding: "8px 16px" },
            onClick: () => {
              if (selectedOrders.length === 0) {
                alert("Please select orders first by checking the checkboxes.");
                return;
              }
              setShowOrderTools(true);
            }
          },
          "\u{1F6E0}\uFE0F Order Tools"
        ))), showSearchFilter && /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", padding: "20px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px" } }, "\u{1F50D} Search & Filter Orders"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1", minWidth: "200px" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            placeholder: "Caut\u0103 dup\u0103 ID, client, ora\u0219...",
            value: searchTerm,
            onChange: (e) => setSearchTerm(e.target.value),
            style: {
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px"
            }
          }
        )), /* @__PURE__ */ React.createElement("div", { style: { flex: "1", minWidth: "180px" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            placeholder: "Caut\u0103 dup\u0103 firm\u0103...",
            value: companySearch,
            onChange: (e) => setCompanySearch(e.target.value),
            style: {
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px"
            }
          }
        )), /* @__PURE__ */ React.createElement("div", { style: { minWidth: "150px" } }, /* @__PURE__ */ React.createElement(
          "select",
          {
            value: statusFilter,
            onChange: (e) => setStatusFilter(e.target.value),
            style: {
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px"
            }
          },
          /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Status"),
          /* @__PURE__ */ React.createElement("option", { value: "pending" }, "Pending"),
          /* @__PURE__ */ React.createElement("option", { value: "accepted" }, "Accepted"),
          /* @__PURE__ */ React.createElement("option", { value: "processing" }, "Processing"),
          /* @__PURE__ */ React.createElement("option", { value: "shipped" }, "Shipped"),
          /* @__PURE__ */ React.createElement("option", { value: "in_delivery" }, "In Delivery"),
          /* @__PURE__ */ React.createElement("option", { value: "delivered" }, "Delivered"),
          /* @__PURE__ */ React.createElement("option", { value: "cancelled" }, "Cancelled")
        )), /* @__PURE__ */ React.createElement("div", { style: { minWidth: "130px" } }, /* @__PURE__ */ React.createElement(
          "select",
          {
            value: marketFilter,
            onChange: (e) => setMarketFilter(e.target.value),
            style: {
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px"
            }
          },
          /* @__PURE__ */ React.createElement("option", { value: "all" }, "\u{1F30D} Toate pie\u021Bele"),
          /* @__PURE__ */ React.createElement("option", { value: "ro" }, "\u{1F1F7}\u{1F1F4} .ro"),
          /* @__PURE__ */ React.createElement("option", { value: "fr" }, "\u{1F1EB}\u{1F1F7} .fr"),
          /* @__PURE__ */ React.createElement("option", { value: "com" }, "\u{1F310} .com")
        )), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#6c757d", width: "auto", padding: "8px 16px" },
            onClick: () => {
              setSearchTerm("");
              setCompanySearch("");
              setStatusFilter("all");
              setMarketFilter("all");
            }
          },
          "Clear"
        )), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "10px", color: "#666", fontSize: "14px" } }, "Showing ", filteredOrders.length, " of ", orders.length, " orders")), orders.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#f5f5f5" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "center", borderBottom: "2px solid #ddd", width: "40px", minWidth: "40px", whiteSpace: "nowrap" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            onChange: (e) => {
              if (e.target.checked) {
                setSelectedOrders(filteredOrders.map((order) => order.id));
              } else {
                setSelectedOrders([]);
              }
            },
            checked: selectedOrders.length === filteredOrders.length && filteredOrders.length > 0
          }
        )), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd", width: "70px" } }, "Order ID"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd", width: "150px" } }, "Client"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd", width: "280px" } }, "Firm\u0103"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd", width: "90px" } }, "Total"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd", width: "100px" } }, "Status"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd", width: "90px" } }, "Dat\u0103"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Ac\u021Biuni"))), /* @__PURE__ */ React.createElement("tbody", null, filteredOrders.slice((ordersPage - 1) * 50, ordersPage * 50).map((order, index) => {
          var _a2, _b2;
          return /* @__PURE__ */ React.createElement("tr", { key: index, style: { borderBottom: "1px solid #eee" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "8px", textAlign: "center" } }, /* @__PURE__ */ React.createElement(
            "input",
            {
              type: "checkbox",
              checked: selectedOrders.includes(order.id),
              onChange: (e) => {
                if (e.target.checked) {
                  setSelectedOrders([...selectedOrders, order.id]);
                } else {
                  setSelectedOrders(selectedOrders.filter((id) => id !== order.id));
                }
              }
            }
          )), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "#", order.id, /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "4px", padding: "1px 5px", borderRadius: "3px", fontSize: "10px", fontWeight: "bold", background: (order.market || "ro") === "ro" ? "#fff3cd" : order.market === "fr" ? "#cfe2ff" : "#d1e7dd", color: "#333" } }, (order.market || "ro").toUpperCase())), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: (() => {
            const sa = order.shippingAddress;
            const name = [sa == null ? void 0 : sa.firstName, sa == null ? void 0 : sa.lastName].filter(Boolean).join(" ");
            return name || `#${order.userId}`;
          })() }, (() => {
            const sa = order.shippingAddress;
            const name = [sa == null ? void 0 : sa.firstName, sa == null ? void 0 : sa.lastName].filter(Boolean).join(" ");
            return name || `#${order.userId}`;
          })()), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "280px" }, title: ((_a2 = order.billingAddress) == null ? void 0 : _a2.companyName) || "" }, ((_b2 = order.billingAddress) == null ? void 0 : _b2.companyName) || ""), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 12px", color: "#28a745", fontWeight: "bold", whiteSpace: "nowrap" } }, parseFloat(order.totalAmount).toFixed(2), " lei"), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 12px", whiteSpace: "nowrap" } }, /* @__PURE__ */ React.createElement("span", { style: {
            padding: "4px 8px",
            borderRadius: "4px",
            backgroundColor: order.status === "pending" ? "#fff3cd" : order.status === "accepted" ? "#d1ecf1" : order.status === "processing" ? "#cce5ff" : order.status === "shipped" ? "#d4edda" : order.status === "in_delivery" ? "#d4f4f4" : order.status === "delivered" ? "#d4edda" : order.status === "cancelled" ? "#f8d7da" : "#e2e3e5",
            color: order.status === "pending" ? "#856404" : order.status === "accepted" ? "#0c5460" : order.status === "processing" ? "#0056b3" : order.status === "shipped" ? "#155724" : order.status === "in_delivery" ? "#0e7c7b" : order.status === "delivered" ? "#155724" : order.status === "cancelled" ? "#721c24" : "#383d41"
          } }, order.status === "in_delivery" ? "In Delivery" : order.status === "cash_on_delivery" ? "COD" : order.status)), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 12px", whiteSpace: "nowrap" } }, new Date(order.createdAt).toLocaleDateString()), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 12px", whiteSpace: "nowrap" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "5px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                padding: "4px 8px",
                border: "none",
                borderRadius: "3px",
                backgroundColor: "#007bff",
                color: "white",
                cursor: "pointer",
                fontSize: "12px"
              },
              onClick: () => {
                setSelectedOrder(order);
                setShowOrderDetails(true);
              }
            },
            "\u{1F441}\uFE0F View"
          ), order.status === "pending" && /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                padding: "4px 8px",
                border: "none",
                borderRadius: "3px",
                backgroundColor: "#17a2b8",
                color: "white",
                cursor: "pointer",
                fontSize: "12px"
              },
              onClick: async () => {
                if (confirm(`Accept order #${order.id}?

This will:
\u2022 Update order status to 'processing'
\u2022 Send confirmation email to customer
\u2022 Send notification to logistics team
\u2022 Enable AWB generation button`)) {
                  const result = await acceptOrder(order.id);
                  if (result.success) {
                    let message = "Order accepted successfully!";
                    if (result.notifications) {
                      message += "\n\nEmail notifications:";
                      message += result.notifications.customerEmail ? "\n\u2705 Customer confirmation sent" : "\n\u274C Customer email failed";
                      message += result.notifications.logisticsEmail ? "\n\u2705 Logistics notification sent" : "\n\u274C Logistics email failed";
                    }
                    alert(message);
                  } else {
                    alert("Error: " + result.message);
                  }
                }
              }
            },
            "\u2705 Accept"
          ), !["delivered", "cancelled"].includes(order.status) && (!order.awbNumber || order.awbNumber.includes("-API") || order.awbNumber.includes("-MANUAL-")) && /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                padding: "4px 8px",
                border: "none",
                borderRadius: "3px",
                backgroundColor: "#8e44ad",
                color: "white",
                cursor: "pointer",
                fontSize: "12px"
              },
              onClick: () => generateAWB(order.id)
            },
            "\u{1F69B} Generate AWB"
          ), order.awbNumber && !order.awbNumber.includes("-API") && !order.awbNumber.includes("-MANUAL-") && /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                padding: "4px 8px",
                border: "none",
                borderRadius: "3px",
                backgroundColor: "#17a2b8",
                color: "white",
                cursor: "pointer",
                fontSize: "12px"
              },
              onClick: () => window.open(`https://sameday.ro/status-colet/?awb=${order.awbNumber}`, "_blank")
            },
            "\u{1F4E6} Track Package"
          ), /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                padding: "4px 8px",
                border: "none",
                borderRadius: "3px",
                backgroundColor: "#fd7e14",
                color: "white",
                cursor: "pointer",
                fontSize: "12px"
              },
              onClick: () => forwardOrderToSuppliers(order.id)
            },
            "\u{1F4E4} Forward to Suppliers"
          ), /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                padding: "4px 8px",
                border: "none",
                borderRadius: "3px",
                backgroundColor: "#28a745",
                color: "white",
                cursor: "pointer",
                fontSize: "12px"
              },
              onClick: () => {
                setStatusChangeOrderId(order.id);
                setStatusChangeValue(order.status);
              }
            },
            "\u270F\uFE0F Update"
          ))));
        }))), filteredOrders.length > 50 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #dee2e6", background: "#f8f9fa" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setOrdersPage((p) => Math.max(1, p - 1)),
            disabled: ordersPage === 1,
            style: { padding: "6px 14px", border: "1px solid #ced4da", borderRadius: "4px", background: ordersPage === 1 ? "#e9ecef" : "white", cursor: ordersPage === 1 ? "default" : "pointer", color: ordersPage === 1 ? "#aaa" : "#333" }
          },
          "\u2190 Anterior"
        ), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", color: "#555" } }, "Pagina ", /* @__PURE__ */ React.createElement("strong", null, ordersPage), " din ", /* @__PURE__ */ React.createElement("strong", null, Math.ceil(filteredOrders.length / 50)), " \xA0\xB7\xA0 ", filteredOrders.length, " comenzi total"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setOrdersPage((p) => Math.min(Math.ceil(filteredOrders.length / 50), p + 1)),
            disabled: ordersPage >= Math.ceil(filteredOrders.length / 50),
            style: { padding: "6px 14px", border: "1px solid #ced4da", borderRadius: "4px", background: ordersPage >= Math.ceil(filteredOrders.length / 50) ? "#e9ecef" : "white", cursor: ordersPage >= Math.ceil(filteredOrders.length / 50) ? "default" : "pointer", color: ordersPage >= Math.ceil(filteredOrders.length / 50) ? "#aaa" : "#333" }
          },
          "Urm\u0103tor \u2192"
        ))) : /* @__PURE__ */ React.createElement("div", { style: { padding: "40px", textAlign: "center", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "18px", marginBottom: "15px" } }, "No orders found"), /* @__PURE__ */ React.createElement("p", { style: { color: "#6c757d", marginBottom: "20px" } }, "Orders will appear here once customers start purchasing your products."), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#007bff", width: "auto", padding: "12px 24px" },
            onClick: () => setActiveView("dashboard")
          },
          "\u{1F4CA} View Dashboard"
        )));
      case "users":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", margin: "0" } }, "\u{1F465} User Management"), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "8px 16px" },
            onClick: () => setShowAddUserModal(true)
          },
          "\u2795 Add New User"
        )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "10px", color: "#495057" } }, "Total Users"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "24px", fontWeight: "bold", color: "#007bff", margin: "0" } }, (stats == null ? void 0 : stats.totalUsers) || "0")), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "10px", color: "#495057" } }, "Regular Users"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "24px", fontWeight: "bold", color: "#28a745", margin: "0" } }, users.filter((u) => !u.isAdmin).length)), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "10px", color: "#495057" } }, "Admin Users"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "24px", fontWeight: "bold", color: "#dc3545", margin: "0" } }, users.filter((u) => u.isAdmin).length))), users.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#f5f5f5" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "User ID"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Name"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Email"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Role"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, users.map((user, index) => /* @__PURE__ */ React.createElement("tr", { key: index, style: { borderBottom: "1px solid #eee" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, "#", user.id), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", fontWeight: "500" } }, user.firstName, " ", user.lastName), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, user.email), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("span", { style: {
          padding: "4px 8px",
          borderRadius: "4px",
          backgroundColor: user.isAdmin ? "#f8d7da" : "#d4edda",
          color: user.isAdmin ? "#721c24" : "#155724"
        } }, user.isAdmin ? "Admin" : "User"), user.isAdmin && (user.adminMarkets || []).length === 0 && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "4px", padding: "2px 6px", borderRadius: "3px", fontSize: "10px", fontWeight: "bold", background: "#f8d7da", color: "#721c24" } }, "SUPER"), user.isAdmin && (user.adminMarkets || []).map((m) => /* @__PURE__ */ React.createElement("span", { key: m, style: { marginLeft: "4px", padding: "2px 6px", borderRadius: "3px", fontSize: "10px", fontWeight: "bold", background: m === "ro" ? "#fff3cd" : m === "fr" ? "#cfe2ff" : "#d1e7dd", color: "#333" } }, m.toUpperCase())), !user.isAdmin && (() => {
          const userMarkets = [...new Set(orders.filter((o) => o.userId === user.id).map((o) => o.market || "ro"))];
          return userMarkets.map((m) => /* @__PURE__ */ React.createElement("span", { key: m, style: { marginLeft: "4px", padding: "2px 4px", borderRadius: "3px", fontSize: "10px", fontWeight: "bold", background: m === "ro" ? "#fff3cd" : m === "fr" ? "#cfe2ff" : "#d1e7dd", color: "#333" } }, m.toUpperCase()));
        })()), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "5px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#007bff",
              color: "white",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: () => setEditingUser(user)
          },
          "\u270F\uFE0F Edit"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#dc3545",
              color: "white",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: async () => {
              if (confirm(`Delete user "${user.firstName} ${user.lastName}"?

This action cannot be undone.`)) {
                const result = await deleteUser(user.id);
                if (result.success) {
                  alert("User deleted successfully");
                } else {
                  alert("Error: " + result.message);
                }
              }
            }
          },
          "\u{1F5D1}\uFE0F Delete"
        )))))))) : /* @__PURE__ */ React.createElement("div", { style: { padding: "40px", textAlign: "center", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "18px", marginBottom: "15px" } }, "No users found"), /* @__PURE__ */ React.createElement("p", { style: { color: "#6c757d", marginBottom: "20px" } }, "Create your first user to get started with user management."), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "12px 24px" },
            onClick: () => setShowAddUserModal(true)
          },
          "\u2795 Add Your First User"
        )));
      case "products":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", margin: "0" } }, "\u{1F4E6} Product Management"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#fd7e14", width: "auto", padding: "8px 16px" },
            onClick: () => setShowExcelImportModal(true)
          },
          "\u{1F4E4} Import from Excel"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "8px 16px" },
            onClick: () => {
              fetchCategories();
              fetchSuppliers();
              setEditingProduct(null);
              const timestamp = Date.now().toString(36).toUpperCase();
              const random = Math.random().toString(36).substring(2, 5).toUpperCase();
              const generatedCode = `PRD-${timestamp}${random}`;
              fetchCompanyDefaults().then((defaults) => {
                console.log("Company defaults for new product:", defaults);
                initialProductDataRef.current = {
                  name: "",
                  description: "",
                  price: "",
                  compareAtPrice: "",
                  categoryId: "",
                  supplierId: "",
                  imageUrl: "",
                  stockQuantity: "",
                  featured: false,
                  vatValue: "",
                  vatPercentage: defaults.vatPercentage || "21.00",
                  currency: defaults.currency || "RON",
                  productCode: generatedCode,
                  ncCode: "",
                  cpvCode: "",
                  status: "active",
                  images: [],
                  weight: "",
                  length: "",
                  width: "",
                  height: "",
                  piecesPerPackage: "",
                  productQuantity: "",
                  specs: [],
                  volumeDiscounts: [],
                  priority: 0
                };
                setProductLoadTrigger((prev) => prev + 1);
                setProductTranslations([]);
                setShowTranslationsTab(false);
                lastLoadedProductIdRef.current = null;
                setShowAddProductModal(true);
              });
            }
          },
          "\u2795 Add New Product"
        ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px" } }, "Product Actions"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#007bff", width: "auto", padding: "8px 16px" },
            onClick: () => {
              if (selectedProducts.length === 0) {
                alert("Please select products first by checking the boxes in the product list.");
                return;
              }
              setShowProductBulkModal(true);
            },
            disabled: selectedProducts.length === 0
          },
          "\u{1F504} Bulk Operations ",
          selectedProducts.length > 0 && `(${selectedProducts.length})`
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#17a2b8", width: "auto", padding: "8px 16px" },
            onClick: () => {
              setShowProductSearchFilter(!showProductSearchFilter);
              if (!showProductSearchFilter) {
                fetchCategories();
              }
              console.log("Product search filter toggled:", !showProductSearchFilter);
            }
          },
          "\u{1F50D} Search & Filter"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#6c757d", width: "auto", padding: "8px 16px" },
            onClick: () => {
              setShowProductAnalytics(!showProductAnalytics);
              if (!showProductAnalytics) {
                generateProductAnalytics();
              }
              console.log("Product analytics toggled:", !showProductAnalytics);
            }
          },
          "\u{1F4CA} Analytics"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "8px 16px" },
            onClick: downloadExcelTemplate
          },
          "\u{1F4E5} Download Excel Template"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#dc3545", width: "auto", padding: "8px 16px" },
            onClick: async () => {
              if (!confirm("Aceasta va genera coduri de produs pentru toate produsele care nu au cod. Continua\u021Bi?")) return;
              try {
                const response = await fetch("/admin/api/products/bulk/generate-codes", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${localStorage.getItem("adminToken")}`,
                    "Content-Type": "application/json"
                  }
                });
                const result = await response.json();
                if (response.ok) {
                  alert(`\u2705 ${result.message}

Actualizate: ${result.updated}
E\u0219uate: ${result.failed || 0}`);
                  fetchProducts();
                } else {
                  alert("\u274C Eroare: " + result.message);
                }
              } catch (error2) {
                console.error("Error generating codes:", error2);
                alert("\u274C Eroare la generarea codurilor");
              }
            }
          },
          "\u{1F522} Genereaz\u0103 Coduri Lips\u0103"
        ))), showProductSearchFilter && /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", padding: "20px", borderRadius: "6px", marginBottom: "20px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px" } }, "\u{1F50D} Search & Filter Products"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "500" } }, "Search Products:"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            placeholder: "Search by name, ID, category, or description...",
            value: productSearchTerm,
            onChange: (e) => {
              setProductSearchTerm(e.target.value);
              console.log("Product search term changed:", e.target.value);
            },
            style: { width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }
          }
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "500" } }, "Category:"), /* @__PURE__ */ React.createElement(
          "select",
          {
            value: productCategoryFilter,
            onChange: (e) => setProductCategoryFilter(e.target.value),
            style: { width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }
          },
          /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Categories"),
          categories.map((cat) => /* @__PURE__ */ React.createElement("option", { key: cat.id, value: cat.id }, cat.name))
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "500" } }, "Status:"), /* @__PURE__ */ React.createElement(
          "select",
          {
            value: productStatusFilter,
            onChange: (e) => setProductStatusFilter(e.target.value),
            style: { width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }
          },
          /* @__PURE__ */ React.createElement("option", { value: "all" }, "All Status"),
          /* @__PURE__ */ React.createElement("option", { value: "active" }, "Active"),
          /* @__PURE__ */ React.createElement("option", { value: "inactive" }, "Inactive"),
          /* @__PURE__ */ React.createElement("option", { value: "draft" }, "Draft"),
          /* @__PURE__ */ React.createElement("option", { value: "discontinued" }, "Discontinued")
        ))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "6px 12px", fontSize: "14px" },
            onClick: () => {
              console.log("Search applied with filters:", {
                searchTerm: productSearchTerm,
                categoryFilter: productCategoryFilter,
                statusFilter: productStatusFilter
              });
              alert(`Search applied! Found ${filteredProducts.length} products out of ${products.length} total.`);
            }
          },
          "\u2705 Apply Search"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#6c757d", width: "auto", padding: "6px 12px", fontSize: "14px" },
            onClick: () => {
              setProductSearchTerm("");
              setProductCategoryFilter("all");
              setProductStatusFilter("all");
              console.log("Product filters cleared");
            }
          },
          "\u{1F5D1}\uFE0F Clear Filters"
        )), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "10px", fontSize: "14px", color: "#666" } }, "Showing ", filteredProducts.length, " of ", products.length, " products")), showProductAnalytics && /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", padding: "20px", borderRadius: "6px", marginBottom: "20px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "20px" } }, "\u{1F4CA} Product Analytics Dashboard"), analyticsData && !analyticsData.error ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "20px", borderRadius: "8px", textAlign: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#007bff", fontSize: "28px", margin: "0 0 10px 0" } }, analyticsData.totalProducts), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", margin: "0", fontSize: "14px" } }, "Total Products")), /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "20px", borderRadius: "8px", textAlign: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#28a745", fontSize: "28px", margin: "0 0 10px 0" } }, analyticsData.stockAnalysis.inStock), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", margin: "0", fontSize: "14px" } }, "In Stock")), /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "20px", borderRadius: "8px", textAlign: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#ffc107", fontSize: "28px", margin: "0 0 10px 0" } }, analyticsData.stockAnalysis.lowStock), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", margin: "0", fontSize: "14px" } }, "Low Stock")), /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "20px", borderRadius: "8px", textAlign: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#dc3545", fontSize: "28px", margin: "0 0 10px 0" } }, analyticsData.stockAnalysis.outOfStock), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", margin: "0", fontSize: "14px" } }, "Out of Stock"))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "25px" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#333", marginBottom: "15px", fontSize: "16px" } }, "\u{1F4C2} Products by Category"), Object.entries(analyticsData.categoryBreakdown).map(([category, data]) => /* @__PURE__ */ React.createElement("div", { key: category, style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", padding: "8px", background: "#f8f9fa", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", color: "#333" } }, category), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", fontWeight: "bold", color: "#007bff" } }, data.count), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", color: "#666", background: "#e9ecef", padding: "2px 8px", borderRadius: "12px" } }, data.percentage, "%"))))), /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#333", marginBottom: "15px", fontSize: "16px" } }, "\u{1F4C8} Status Distribution"), Object.entries(analyticsData.statusBreakdown).map(([status, count]) => /* @__PURE__ */ React.createElement("div", { key: status, style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", padding: "8px", background: "#f8f9fa", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", color: "#333", textTransform: "capitalize" } }, status), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", fontWeight: "bold", color: status === "active" ? "#28a745" : status === "inactive" ? "#6c757d" : status === "draft" ? "#ffc107" : "#dc3545" } }, count))))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "25px" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#333", marginBottom: "15px", fontSize: "16px" } }, "\u{1F4B0} Price Analysis"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "8px", background: "#f8f9fa", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", color: "#333" } }, "Average Price"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", fontWeight: "bold", color: "#007bff" } }, "$", analyticsData.priceAnalysis.avg)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "8px", background: "#f8f9fa", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", color: "#333" } }, "Lowest Price"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", fontWeight: "bold", color: "#28a745" } }, "$", analyticsData.priceAnalysis.min)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "8px", background: "#f8f9fa", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", color: "#333" } }, "Highest Price"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", fontWeight: "bold", color: "#dc3545" } }, "$", analyticsData.priceAnalysis.max)))), /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#333", marginBottom: "15px", fontSize: "16px" } }, "\u{1F3C6} Top Products by Price"), analyticsData.topPriceProducts.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, analyticsData.topPriceProducts.map((product, index) => /* @__PURE__ */ React.createElement("div", { key: index, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px", background: "#f8f9fa", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", fontWeight: "500", color: "#333" } }, product.name), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", color: "#666" } }, product.category)), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", fontWeight: "bold", color: "#007bff" } }, product.price, " lei")))) : /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "14px", textAlign: "center", margin: "20px 0" } }, "No products with prices found"))), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginTop: "20px", padding: "10px", background: "#e9ecef", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "12px", margin: "0" } }, "Analytics generated at: ", analyticsData.generatedAt))) : analyticsData && analyticsData.error ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "40px", color: "#dc3545" } }, /* @__PURE__ */ React.createElement("h5", null, "Error: ", analyticsData.error), /* @__PURE__ */ React.createElement("p", null, "Please make sure products are loaded and try again.")) : /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "40px" } }, /* @__PURE__ */ React.createElement("div", { className: "loading" }), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", marginTop: "10px" } }, "Generating analytics...")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "20px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "6px 12px", fontSize: "14px" },
            onClick: () => {
              generateProductAnalytics();
              console.log("Analytics refreshed");
            }
          },
          "\u{1F504} Refresh Analytics"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#6c757d", width: "auto", padding: "6px 12px", fontSize: "14px" },
            onClick: () => {
              setShowProductAnalytics(false);
              console.log("Analytics closed");
            }
          },
          "\u2716\uFE0F Close"
        ))), (showProductSearchFilter ? filteredProducts : products).length > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#f5f5f5" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd", width: "50px" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: selectedProducts.length === (showProductSearchFilter ? filteredProducts : products).length && (showProductSearchFilter ? filteredProducts : products).length > 0,
            onChange: (e) => {
              const currentProducts = showProductSearchFilter ? filteredProducts : products;
              if (e.target.checked) {
                setSelectedProducts(currentProducts.map((p) => p.id));
              } else {
                setSelectedProducts([]);
              }
            }
          }
        )), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Image"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "center", borderBottom: "2px solid #ddd" } }, "Priority"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Product ID"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Name"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Pre\u021B baz\u0103"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Category"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Stock"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Status"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "VAT %"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Currency"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Product Code"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "NC Code"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "CPV Code"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "center", borderBottom: "2px solid #ddd" } }, "\u{1F1F7}\u{1F1F4} .ro", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("small", { style: { color: "#888", fontWeight: "normal" } }, "RON (lei)")), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "center", borderBottom: "2px solid #ddd" } }, "\u{1F1EB}\u{1F1F7} .fr", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("small", { style: { color: "#888", fontWeight: "normal" } }, "EUR (\u20AC)")), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "center", borderBottom: "2px solid #ddd" } }, "\u{1F310} .com", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("small", { style: { color: "#888", fontWeight: "normal" } }, "EUR (\u20AC)")), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, (showProductSearchFilter ? filteredProducts : products).sort((a, b) => {
          const priorityA = a.priority && a.priority > 0 ? a.priority : 9999;
          const priorityB = b.priority && b.priority > 0 ? b.priority : 9999;
          if (priorityA !== priorityB) return priorityA - priorityB;
          return b.id - a.id;
        }).slice((productPage - 1) * productsPerPage, productPage * productsPerPage).map((product, index) => {
          var _a2, _b2;
          return /* @__PURE__ */ React.createElement("tr", { key: index, style: { borderBottom: "1px solid #eee" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", textAlign: "center" } }, /* @__PURE__ */ React.createElement(
            "input",
            {
              type: "checkbox",
              checked: selectedProducts.includes(product.id),
              onChange: (e) => {
                if (e.target.checked) {
                  setSelectedProducts([...selectedProducts, product.id]);
                } else {
                  setSelectedProducts(selectedProducts.filter((id) => id !== product.id));
                }
              }
            }
          )), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative", display: "inline-block" } }, product.images && product.images.length > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
            "img",
            {
              src: getImageUrlGlobal(product.images[0]),
              alt: product.name,
              style: {
                width: "50px",
                height: "50px",
                objectFit: "cover",
                borderRadius: "6px",
                border: "1px solid #ddd"
              }
            }
          ), product.images.length > 1 && /* @__PURE__ */ React.createElement("span", { style: {
            position: "absolute",
            top: "-5px",
            right: "-5px",
            backgroundColor: "#007bff",
            color: "white",
            borderRadius: "50%",
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: "bold",
            border: "2px solid white"
          } }, product.images.length)) : product.imageUrl ? /* @__PURE__ */ React.createElement(
            "img",
            {
              src: product.imageUrl,
              alt: product.name,
              style: {
                width: "50px",
                height: "50px",
                objectFit: "cover",
                borderRadius: "6px",
                border: "1px solid #ddd"
              }
            }
          ) : /* @__PURE__ */ React.createElement("div", { style: {
            width: "50px",
            height: "50px",
            backgroundColor: "#f8f9fa",
            border: "1px solid #ddd",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6c757d",
            fontSize: "12px"
          } }, "\u{1F4F7}"))), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", textAlign: "center" } }, product.priority && product.priority > 0 ? /* @__PURE__ */ React.createElement("span", { style: {
            backgroundColor: "#ffc107",
            color: "#000",
            padding: "2px 8px",
            borderRadius: "12px",
            fontWeight: "bold",
            fontSize: "12px"
          } }, product.priority) : /* @__PURE__ */ React.createElement("span", { style: { color: "#999", fontSize: "12px" } }, "-")), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, "#", product.id), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", fontWeight: "500" } }, product.name), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#28a745", fontWeight: "bold" } }, "$", product.price), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, ((_a2 = product.category) == null ? void 0 : _a2.name) || "N/A"), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("span", { style: {
            padding: "4px 8px",
            borderRadius: "4px",
            backgroundColor: product.stockQuantity > 10 ? "#d4edda" : "#f8d7da",
            color: product.stockQuantity > 10 ? "#155724" : "#721c24"
          } }, (_b2 = product.stockQuantity) != null ? _b2 : 0)), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("span", { style: {
            padding: "4px 8px",
            borderRadius: "4px",
            backgroundColor: product.status === "active" ? "#d4edda" : product.status === "inactive" ? "#f8d7da" : product.status === "draft" ? "#fff3cd" : "#e2e3e5",
            color: product.status === "active" ? "#155724" : product.status === "inactive" ? "#721c24" : product.status === "draft" ? "#856404" : "#6c757d"
          } }, product.status || "active")), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#6c757d", fontSize: "14px" } }, product.vatPercentage || product.vatValue || "N/A", "%"), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#007bff", fontSize: "14px", fontWeight: "500" } }, product.currency || "EUR"), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#6c757d", fontSize: "14px", fontFamily: "monospace" } }, product.productCode || "N/A"), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#6c757d", fontSize: "14px", fontFamily: "monospace" } }, product.ncCode || "N/A"), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#6c757d", fontSize: "14px", fontFamily: "monospace" } }, product.cpvCode || "N/A"), ["ro", "fr", "com"].map((market) => {
            var _a3;
            const pm = (_a3 = productMarketsMap[product.id]) == null ? void 0 : _a3[market];
            const isActive = pm ? pm.isActive : true;
            const hasCustomPrice = pm && pm.price != null && pm.price !== "";
            const effectivePrice = hasCustomPrice ? pm.price : product.price;
            const symbol = market === "ro" ? "lei" : "\u20AC";
            return /* @__PURE__ */ React.createElement("td", { key: market, style: { padding: "8px", textAlign: "center", minWidth: "80px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" } }, /* @__PURE__ */ React.createElement(
              "span",
              {
                title: hasCustomPrice ? `Pre\u021B custom pentru .${market}` : `Pre\u021B baz\u0103 (f\u0103r\u0103 override pe .${market})`,
                style: {
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: hasCustomPrice ? "#007bff" : "#888",
                  whiteSpace: "nowrap",
                  letterSpacing: "0.3px"
                }
              },
              parseFloat(effectivePrice || 0).toFixed(2),
              " ",
              symbol,
              hasCustomPrice && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "2px", fontSize: "10px", color: "#fd7e14" } }, "\u270E")
            ), /* @__PURE__ */ React.createElement(
              "button",
              {
                title: isActive ? `Activ pe .${market} \u2014 click pentru dezactivare` : `Inactiv pe .${market} \u2014 click pentru activare`,
                onClick: () => toggleProductMarket(product.id, market, isActive),
                style: {
                  padding: "2px 8px",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: "600",
                  backgroundColor: isActive ? "#d4edda" : "#f8d7da",
                  color: isActive ? "#155724" : "#721c24",
                  minWidth: "40px"
                }
              },
              isActive ? "\u2713 ON" : "\u2717 OFF"
            )));
          }), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "5px" } }, /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                padding: "4px 8px",
                border: "none",
                borderRadius: "3px",
                backgroundColor: "#007bff",
                color: "white",
                cursor: "pointer",
                fontSize: "12px"
              },
              onClick: () => {
                fetchCategories();
                fetchSuppliers();
                setEditingProduct(product);
              }
            },
            "\u270F\uFE0F Edit"
          ), /* @__PURE__ */ React.createElement(
            "button",
            {
              style: {
                padding: "4px 8px",
                border: "none",
                borderRadius: "3px",
                backgroundColor: "#dc3545",
                color: "white",
                cursor: "pointer",
                fontSize: "12px"
              },
              onClick: async () => {
                if (confirm(`Delete product "${product.name}"?

This action cannot be undone.`)) {
                  const result = await deleteProduct(product.id);
                  if (result.success) {
                    alert("Product deleted successfully");
                  } else {
                    alert("Error: " + result.message);
                  }
                }
              }
            },
            "\u{1F5D1}\uFE0F Delete"
          ))));
        })))), Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) > 1 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderTop: "1px solid #eee", marginTop: "10px", flexWrap: "wrap", gap: "10px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#666", fontSize: "14px" } }, "Showing ", (productPage - 1) * productsPerPage + 1, "-", Math.min(productPage * productsPerPage, (showProductSearchFilter ? filteredProducts : products).length), " of ", (showProductSearchFilter ? filteredProducts : products).length, " products"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setProductPage(1),
            disabled: productPage === 1,
            style: { padding: "6px 12px", border: "1px solid #ddd", borderRadius: "4px", background: productPage === 1 ? "#f5f5f5" : "white", cursor: productPage === 1 ? "not-allowed" : "pointer", color: productPage === 1 ? "#ccc" : "#333" }
          },
          "\xAB"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setProductPage(Math.max(1, productPage - 1)),
            disabled: productPage === 1,
            style: { padding: "6px 12px", border: "1px solid #ddd", borderRadius: "4px", background: productPage === 1 ? "#f5f5f5" : "white", cursor: productPage === 1 ? "not-allowed" : "pointer", color: productPage === 1 ? "#ccc" : "#333" }
          },
          "\u2039 Prev"
        ), Array.from({ length: Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) }, (_, i) => i + 1).map((p) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: p,
            onClick: () => setProductPage(p),
            style: { padding: "6px 12px", border: "1px solid #ddd", borderRadius: "4px", background: p === productPage ? "#007bff" : "white", color: p === productPage ? "white" : "#333", cursor: "pointer", fontWeight: p === productPage ? "bold" : "normal" }
          },
          p
        )), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setProductPage(Math.min(Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage), productPage + 1)),
            disabled: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage),
            style: { padding: "6px 12px", border: "1px solid #ddd", borderRadius: "4px", background: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? "#f5f5f5" : "white", cursor: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? "not-allowed" : "pointer", color: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? "#ccc" : "#333" }
          },
          "Next \u203A"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setProductPage(Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage)),
            disabled: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage),
            style: { padding: "6px 12px", border: "1px solid #ddd", borderRadius: "4px", background: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? "#f5f5f5" : "white", cursor: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? "not-allowed" : "pointer", color: productPage === Math.ceil((showProductSearchFilter ? filteredProducts : products).length / productsPerPage) ? "#ccc" : "#333" }
          },
          "\xBB"
        )))) : /* @__PURE__ */ React.createElement("div", { style: { padding: "40px", textAlign: "center", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "18px", marginBottom: "15px" } }, "No products found"), /* @__PURE__ */ React.createElement("p", { style: { color: "#6c757d", marginBottom: "20px" } }, "Start building your product catalog by adding your first product."), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "12px 24px" },
            onClick: () => alert("Add your first product:\n\n\u2022 Product name and description\n\u2022 High-quality images\n\u2022 Pricing information\n\u2022 Category assignment\n\u2022 Inventory management")
          },
          "\u2795 Add Your First Product"
        )));
      case "categories":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", margin: "0" } }, "\u{1F4C1} Category Management"), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "8px 16px" },
            onClick: () => setShowAddCategoryModal(true)
          },
          "\u2795 Add New Category"
        )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px" } }, "Homepage Category Settings"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#495057", marginBottom: "15px" } }, "Main Top Categories (Max 4)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, categories.filter((cat) => cat.showOnMainTop).sort((a, b) => a.sortOrder - b.sortOrder).map((category) => /* @__PURE__ */ React.createElement("div", { key: category.id, style: {
          padding: "8px 12px",
          background: "#007bff",
          color: "white",
          borderRadius: "4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        } }, /* @__PURE__ */ React.createElement("span", null, category.name), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", opacity: "0.8" } }, "#", category.sortOrder))), categories.filter((cat) => cat.showOnMainTop).length === 0 && /* @__PURE__ */ React.createElement("p", { style: { color: "#6c757d", fontStyle: "italic" } }, "No categories assigned to main top section"))), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#495057", marginBottom: "15px" } }, "Shop Categories (Max 3)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, categories.filter((cat) => cat.showOnMainShop).sort((a, b) => a.sortOrder - b.sortOrder).map((category) => /* @__PURE__ */ React.createElement("div", { key: category.id, style: {
          padding: "8px 12px",
          background: "#28a745",
          color: "white",
          borderRadius: "4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        } }, /* @__PURE__ */ React.createElement("span", null, category.name), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", opacity: "0.8" } }, "#", category.sortOrder))), categories.filter((cat) => cat.showOnMainShop).length === 0 && /* @__PURE__ */ React.createElement("p", { style: { color: "#6c757d", fontStyle: "italic" } }, "No categories assigned to shop section")))), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#6c757d", width: "auto", padding: "8px 16px" },
            onClick: () => {
              const mainTopCategories = categories.filter((cat) => cat.showOnMainTop).sort((a, b) => a.sortOrder - b.sortOrder);
              const mainShopCategories = categories.filter((cat) => cat.showOnMainShop).sort((a, b) => a.sortOrder - b.sortOrder);
              alert(`Homepage Category Configuration:

Main Top (${mainTopCategories.length}/4): ${mainTopCategories.map((c) => c.name).join(", ") || "None"}

Shop Section (${mainShopCategories.length}/3): ${mainShopCategories.map((c) => c.name).join(", ") || "None"}

To modify these settings, use the "Configure Homepage" button below.`);
            }
          },
          "\u{1F4CB} View Homepage Config"
        )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#007bff", width: "auto", padding: "8px 16px" },
            onClick: () => {
              console.log("All categories:", categories);
              console.log("Categories with showOnMainTop:", categories.filter((cat) => cat.showOnMainTop));
              console.log("Categories with showOnMainShop:", categories.filter((cat) => cat.showOnMainShop));
              const currentMainTop = categories.filter((cat) => cat.showOnMainTop).sort((a, b) => a.sortOrder - b.sortOrder);
              const currentMainShop = categories.filter((cat) => cat.showOnMainShop).sort((a, b) => a.sortOrder - b.sortOrder);
              console.log("Current Main Top:", currentMainTop);
              console.log("Current Main Shop:", currentMainShop);
              setHomepageConfig({
                mainTop: currentMainTop.map((cat) => cat.id),
                mainShop: currentMainShop.map((cat) => cat.id)
              });
              setShowHomepageConfigModal(true);
            }
          },
          "\u2699\uFE0F Configure Homepage"
        )), categories.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#f5f5f5" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "ID"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Image"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Name"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Slug"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Description"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Homepage"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, categories.map((category, index) => /* @__PURE__ */ React.createElement("tr", { key: index, style: { borderBottom: "1px solid #eee" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, "#", category.id), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, category.imageUrl ? /* @__PURE__ */ React.createElement(
          "img",
          {
            src: category.imageUrl,
            alt: category.name,
            style: {
              width: "40px",
              height: "40px",
              objectFit: "cover",
              borderRadius: "4px",
              border: "1px solid #ddd"
            }
          }
        ) : /* @__PURE__ */ React.createElement("div", { style: {
          width: "40px",
          height: "40px",
          backgroundColor: "#f5f5f5",
          borderRadius: "4px",
          border: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999"
        } }, "\u{1F4F7}")), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", fontWeight: "500" } }, category.name, /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "6px", padding: "1px 6px", borderRadius: "8px", fontSize: "10px", fontWeight: "bold", background: category.marketCode === "fr" ? "#e8f4f8" : category.marketCode === "com" ? "#e8f8e8" : "#f0e8f8", color: category.marketCode === "fr" ? "#1a6080" : category.marketCode === "com" ? "#1a6030" : "#6020a0" } }, (category.marketCode || "ro").toUpperCase())), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", fontFamily: "monospace", fontSize: "14px", color: "#666" } }, category.slug), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, category.description || "No description"), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } }, category.showOnMainTop && /* @__PURE__ */ React.createElement("span", { style: {
          padding: "2px 6px",
          borderRadius: "3px",
          backgroundColor: "#007bff",
          color: "white",
          fontSize: "11px"
        } }, "Main Top #", category.sortOrder), category.showOnMainShop && /* @__PURE__ */ React.createElement("span", { style: {
          padding: "2px 6px",
          borderRadius: "3px",
          backgroundColor: "#28a745",
          color: "white",
          fontSize: "11px"
        } }, "Shop #", category.sortOrder), !category.showOnMainTop && !category.showOnMainShop && /* @__PURE__ */ React.createElement("span", { style: { color: "#6c757d", fontSize: "12px" } }, "Not featured"))), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "5px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#007bff",
              color: "white",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: () => setEditingCategory(category)
          },
          "\u270F\uFE0F Edit"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#dc3545",
              color: "white",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: async () => {
              if (confirm(`Delete category "${category.name}"?

This action cannot be undone. Make sure no products are assigned to this category.`)) {
                const result = await deleteCategory(category.id);
                if (result.success) {
                  alert("Category deleted successfully");
                } else {
                  alert("Error: " + result.message);
                }
              }
            }
          },
          "\u{1F5D1}\uFE0F Delete"
        )))))))) : /* @__PURE__ */ React.createElement("div", { style: { padding: "40px", textAlign: "center", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "18px", marginBottom: "15px" } }, "No categories found"), /* @__PURE__ */ React.createElement("p", { style: { color: "#6c757d", marginBottom: "20px" } }, "Create your first category to organize your products effectively."), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "12px 24px" },
            onClick: () => setShowAddCategoryModal(true)
          },
          "\u2795 Add Your First Category"
        )));
      case "suppliers":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", margin: "0" } }, "\u{1F3E2} Supplier Management"), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "12px 20px" },
            onClick: () => {
              setEditingSupplier(null);
              supplierInitialDataRef.current = {
                name: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                state: "",
                zipCode: "",
                country: "",
                contactPerson: "",
                apiEndpoint: "",
                apiKey: "",
                integrationType: "email",
                notes: "",
                isActive: true,
                marketCode: selectedMarketTab && selectedMarketTab !== "all" ? selectedMarketTab : "ro"
              };
              setSupplierLoadTrigger((prev) => prev + 1);
              setShowEditSupplierModal(true);
            }
          },
          "\u2795 Add New Supplier"
        )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px" } }, "Supplier Overview"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#007bff", width: "auto", padding: "8px 16px" },
            onClick: () => alert("Supplier analytics:\n\n\u2022 Order volume by supplier\n\u2022 Performance metrics\n\u2022 Delivery times\n\u2022 Quality ratings\n\u2022 Cost analysis")
          },
          "\u{1F4CA} Analytics"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#17a2b8", width: "auto", padding: "8px 16px" },
            onClick: () => {
              if (selectedSuppliers.length === 0) {
                alert("Please select suppliers first by checking the boxes in the table");
              } else {
                setSupplierBulkOperation("menu");
                setShowSupplierBulkModal(true);
              }
            }
          },
          "\u{1F504} Bulk Operations ",
          selectedSuppliers.length > 0 ? `(${selectedSuppliers.length})` : ""
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#6c757d", width: "auto", padding: "8px 16px" },
            onClick: () => alert("Export suppliers:\n\n\u2022 Contact directory\n\u2022 Performance reports\n\u2022 Contract details\n\u2022 Integration settings\n\u2022 Compliance documentation")
          },
          "\u{1F4E4} Export"
        ))), suppliers.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { marginTop: "20px", maxHeight: "500px", overflowY: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#f8f9fa" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6", color: "#333", width: "50px" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: selectedSuppliers.length === suppliers.length && suppliers.length > 0,
            onChange: (e) => handleSelectAllSuppliers(e.target.checked),
            style: { cursor: "pointer" }
          }
        )), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6", color: "#333" } }, "Supplier Name"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6", color: "#333" } }, "Contact"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6", color: "#333" } }, "Location"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6", color: "#333" } }, "Integration"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6", color: "#333" } }, "Status"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6", color: "#333" } }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, suppliers.map((supplier) => /* @__PURE__ */ React.createElement("tr", { key: supplier.id, style: { borderBottom: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", textAlign: "center" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: selectedSuppliers.includes(supplier.id),
            onChange: (e) => handleSupplierSelection(supplier.id, e.target.checked),
            style: { cursor: "pointer" }
          }
        )), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#333" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold" } }, supplier.name, /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "6px", padding: "1px 6px", borderRadius: "8px", fontSize: "10px", fontWeight: "bold", background: supplier.marketCode === "fr" ? "#e8f4f8" : supplier.marketCode === "com" ? "#e8f8e8" : "#f0e8f8", color: supplier.marketCode === "fr" ? "#1a6080" : supplier.marketCode === "com" ? "#1a6030" : "#6020a0" } }, (supplier.marketCode || "ro").toUpperCase())), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", color: "#666" } }, supplier.contactPerson)), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#333" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "14px" } }, supplier.email), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", color: "#666" } }, supplier.phone)), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#333" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "14px" } }, supplier.city, ", ", supplier.country), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", color: "#666" } }, supplier.address)), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#333" } }, /* @__PURE__ */ React.createElement("span", { style: {
          padding: "4px 8px",
          borderRadius: "12px",
          fontSize: "12px",
          backgroundColor: supplier.integrationType === "api" ? "#d4edda" : "#fff3cd",
          color: supplier.integrationType === "api" ? "#155724" : "#856404"
        } }, supplier.integrationType === "api" ? "\u{1F517} API" : "\u{1F4E7} Email")), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", color: "#333" } }, /* @__PURE__ */ React.createElement("span", { style: {
          padding: "4px 8px",
          borderRadius: "12px",
          fontSize: "12px",
          backgroundColor: supplier.isActive ? "#d4edda" : "#f8d7da",
          color: supplier.isActive ? "#155724" : "#721c24"
        } }, supplier.isActive ? "\u2705 Active" : "\u274C Inactive")), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "8px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#28a745",
              color: "white",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: () => syncSupplierPrices(supplier.id)
          },
          "\u{1F4B0} Sync Prices"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#ffc107",
              color: "black",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: () => syncSupplierStock(supplier.id)
          },
          "\u{1F4E6} Sync Stock"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#17a2b8",
              color: "white",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: () => {
              setEditingSupplier(supplier);
              supplierInitialDataRef.current = {
                name: supplier.name || "",
                email: supplier.email || "",
                phone: supplier.phone || "",
                address: supplier.address || "",
                city: supplier.city || "",
                state: supplier.state || "",
                zipCode: supplier.zipCode || "",
                country: supplier.country || "",
                contactPerson: supplier.contactPerson || "",
                apiEndpoint: supplier.apiEndpoint || "",
                apiKey: supplier.apiKey || "",
                integrationType: supplier.integrationType || "email",
                notes: supplier.notes || "",
                isActive: supplier.isActive !== void 0 ? supplier.isActive : true,
                marketCode: supplier.marketCode || "ro"
              };
              setSupplierLoadTrigger((prev) => prev + 1);
              setShowEditSupplierModal(true);
            }
          },
          "\u270F\uFE0F Edit"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#6c757d",
              color: "white",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: async () => {
              setViewingSupplier(supplier);
              setShowViewSupplierModal(true);
              const details = await fetchSupplierDetails(supplier.id);
              setSupplierDetails(details);
            }
          },
          "\u{1F441}\uFE0F View"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            style: {
              padding: "4px 8px",
              border: "none",
              borderRadius: "3px",
              backgroundColor: "#dc3545",
              color: "white",
              cursor: "pointer",
              fontSize: "12px"
            },
            onClick: () => {
              if (confirm(`Delete supplier "${supplier.name}"?

This will remove the supplier and unassign all associated products.

This action cannot be undone.`)) {
                alert("Supplier deletion functionality:\n\n\u2022 Remove supplier record\n\u2022 Unassign products\n\u2022 Archive order history\n\u2022 Send notifications\n\u2022 Update system logs");
              }
            }
          },
          "\u{1F5D1}\uFE0F Delete"
        )))))))) : /* @__PURE__ */ React.createElement("div", { style: { padding: "40px", textAlign: "center", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "18px", marginBottom: "15px" } }, "No suppliers found"), /* @__PURE__ */ React.createElement("p", { style: { color: "#6c757d", marginBottom: "20px" } }, "Start building your supplier network by adding your first supplier."), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "12px 24px" },
            onClick: () => {
              setEditingSupplier(null);
              supplierInitialDataRef.current = {
                name: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                state: "",
                zipCode: "",
                country: "",
                contactPerson: "",
                apiEndpoint: "",
                apiKey: "",
                integrationType: "email",
                notes: "",
                isActive: true
              };
              setSupplierLoadTrigger((prev) => prev + 1);
              setShowEditSupplierModal(true);
            }
          },
          "\u2795 Add Your First Supplier"
        )));
      case "company-settings":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", margin: "0" } }, "\u{1F3E2} Company Settings"), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#007bff", width: "auto", padding: "8px 16px" },
            onClick: () => setShowCompanySettingsModal(true)
          },
          "\u270F\uFE0F Edit Company Info"
        )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" } }, /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", padding: "20px", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px", borderBottom: "2px solid #007bff", paddingBottom: "5px" } }, "Basic Information"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Company Name:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.name || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Email:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.email || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Phone:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.phone || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Website:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.website || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Logistics Email:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.logisticsEmail || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "IBAN:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d", fontFamily: "monospace" } }, companySettings.iban || "Not set"))), /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", padding: "20px", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px", borderBottom: "2px solid #28a745", paddingBottom: "5px" } }, "Address"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Street Address:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.address || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "City:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.city || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "State/Province:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.state || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "ZIP/Postal Code:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.zipCode || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Country:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.country || "Not set"))), /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", padding: "20px", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px", borderBottom: "2px solid #ffc107", paddingBottom: "5px" } }, "Legal & Business"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Contact Person:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.contactPerson || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "VAT Number:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.vatNumber || "Not set")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Registration Number:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#6c757d" } }, companySettings.registrationNumber || "Not set"))), /* @__PURE__ */ React.createElement("div", { style: { background: "#f0f8ff", padding: "20px", borderRadius: "6px", border: "1px solid #007bff" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#007bff", marginBottom: "15px", borderBottom: "2px solid #007bff", paddingBottom: "5px" } }, "\u{1F4B0} Default Product Settings"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Default Currency:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#007bff", fontWeight: "500" } }, companySettings.defaultCurrency || "EUR")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Default VAT Percentage:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#007bff", fontWeight: "500" } }, companySettings.defaultVatPercentage || "21.00", "%")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Reverse Charge VAT:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#007bff", fontWeight: "500" } }, companySettings.reverseChargeVat || "0.00", "%")), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "12px", color: "#666", marginTop: "10px", fontStyle: "italic" } }, "Used as defaults when creating new products")), /* @__PURE__ */ React.createElement("div", { style: { background: "#e3f2fd", padding: "20px", borderRadius: "6px", border: "1px solid #bbdefb" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#1976d2", marginBottom: "15px", borderBottom: "2px solid #2196f3", paddingBottom: "5px" } }, "\u{1F69A} Shipping Settings"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Free Shipping Threshold:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#1976d2", fontWeight: "500" } }, companySettings.freeShippingThreshold || "500.00", " ", companySettings.defaultCurrency || "EUR")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "10px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "#495057" } }, "Standard Shipping Cost:"), /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0", color: "#1976d2", fontWeight: "500" } }, companySettings.standardShippingCost || "25.00", " ", companySettings.defaultCurrency || "EUR")), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "12px", color: "#666", marginTop: "10px", fontStyle: "italic" } }, "Orders over ", companySettings.freeShippingThreshold || "500.00", " ", companySettings.defaultCurrency || "EUR", " qualify for free shipping")), /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", padding: "20px", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px", borderBottom: "2px solid #dc3545", paddingBottom: "5px" } }, "Company Description"), /* @__PURE__ */ React.createElement("p", { style: { margin: "0", color: "#6c757d", lineHeight: "1.6" } }, companySettings.description || 'No description available. Click "Edit Company Info" to add your company description.'))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "30px", padding: "20px", background: "#e8f4f8", borderRadius: "6px", border: "1px solid #bee5eb" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "\u{1F4DD} Important Notes"), /* @__PURE__ */ React.createElement("ul", { style: { margin: "0", paddingLeft: "20px", color: "#495057" } }, /* @__PURE__ */ React.createElement("li", { style: { marginBottom: "5px" } }, "This information is used throughout the system for invoices, emails, and customer communications"), /* @__PURE__ */ React.createElement("li", { style: { marginBottom: "5px" } }, "VAT Number and Registration Number are required for proper invoice generation"), /* @__PURE__ */ React.createElement("li", { style: { marginBottom: "5px" } }, "Contact information will be displayed to customers for support inquiries"), /* @__PURE__ */ React.createElement("li", null, "All changes are automatically saved and will be reflected in new orders and communications"))));
      case "vouchers":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", margin: "0" } }, "\u{1F39F}\uFE0F Voucher Management"), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "8px 16px" },
            onClick: () => {
              setVoucherForm({
                code: "",
                name: "",
                discountType: "fixed",
                discountValue: "",
                minOrderAmount: "",
                maxUses: "",
                isActive: true,
                validFrom: "",
                validUntil: "",
                marketCode: selectedMarketTab && selectedMarketTab !== "all" ? selectedMarketTab : "ro"
              });
              setEditingVoucher(null);
              setShowAddVoucherModal(true);
            }
          },
          "+ Add New Voucher"
        )), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", marginBottom: "20px" } }, "Manage discount voucher codes. Customers can apply these codes at checkout to receive discounts."), vouchers.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#f5f5f5" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Code"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Name"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Discount"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Min Order"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Pia\u021B\u0103"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Usage"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Valid Period"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Status"), /* @__PURE__ */ React.createElement("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" } }, "Actions"))), /* @__PURE__ */ React.createElement("tbody", null, vouchers.map((voucher) => /* @__PURE__ */ React.createElement("tr", { key: voucher.id, style: { borderBottom: "1px solid #eee" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("code", { style: { background: "#f0f0f0", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" } }, voucher.code)), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, voucher.name), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, voucher.discountType === "percentage" ? `${voucher.discountValue}%` : `${voucher.discountValue} RON`), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, voucher.minOrderAmount ? `${voucher.minOrderAmount} RON` : "-"), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("span", { style: { padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold", background: voucher.marketCode === "fr" ? "#e8f4f8" : voucher.marketCode === "com" ? "#e8f8e8" : "#f0e8f8", color: voucher.marketCode === "fr" ? "#1a6080" : voucher.marketCode === "com" ? "#1a6030" : "#6020a0" } }, (voucher.marketCode || "ro").toUpperCase())), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, voucher.usedCount || 0, voucher.maxUses ? ` / ${voucher.maxUses}` : ""), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px", fontSize: "12px" } }, voucher.validFrom || voucher.validUntil ? /* @__PURE__ */ React.createElement(React.Fragment, null, voucher.validFrom ? new Date(voucher.validFrom).toLocaleDateString() : "N/A", " - ", voucher.validUntil ? new Date(voucher.validUntil).toLocaleDateString() : "N/A") : "No expiry"), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("span", { style: {
          padding: "4px 8px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: "bold",
          background: voucher.isActive ? "#d4edda" : "#f8d7da",
          color: voucher.isActive ? "#155724" : "#721c24"
        } }, voucher.isActive ? "Active" : "Inactive")), /* @__PURE__ */ React.createElement("td", { style: { padding: "12px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "5px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#007bff", width: "auto", padding: "4px 10px", fontSize: "12px" },
            onClick: () => {
              setEditingVoucher(voucher);
              setVoucherForm({
                code: voucher.code || "",
                name: voucher.name || "",
                discountType: voucher.discountType || "fixed",
                discountValue: voucher.discountValue || "",
                minOrderAmount: voucher.minOrderAmount || "",
                maxUses: voucher.maxUses || "",
                isActive: voucher.isActive !== false,
                validFrom: voucher.validFrom ? new Date(voucher.validFrom).toISOString().slice(0, 16) : "",
                validUntil: voucher.validUntil ? new Date(voucher.validUntil).toISOString().slice(0, 16) : "",
                marketCode: voucher.marketCode || "ro"
              });
              setShowAddVoucherModal(true);
            }
          },
          "Edit"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#dc3545", width: "auto", padding: "4px 10px", fontSize: "12px" },
            onClick: async () => {
              if (confirm(`Are you sure you want to delete voucher "${voucher.code}"?`)) {
                try {
                  const response = await fetch(`/admin/api/vouchers/${voucher.id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` }
                  });
                  if (response.ok) {
                    setVouchers(vouchers.filter((v) => v.id !== voucher.id));
                  } else {
                    alert("Failed to delete voucher");
                  }
                } catch (err) {
                  console.error("Error deleting voucher:", err);
                  alert("Failed to delete voucher");
                }
              }
            }
          },
          "Delete"
        )))))))) : /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "40px", color: "#666" } }, /* @__PURE__ */ React.createElement("p", null, 'No vouchers created yet. Click "Add New Voucher" to create one.')), showAddVoucherModal && /* @__PURE__ */ React.createElement("div", { className: "modal-backdrop", onClick: () => setShowAddVoucherModal(false) }, /* @__PURE__ */ React.createElement("div", { className: "modal-content", onClick: (e) => e.stopPropagation(), style: { maxWidth: "500px" } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px" } }, editingVoucher ? "Edit Voucher" : "Add New Voucher"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "15px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Pia\u021B\u0103 *"), /* @__PURE__ */ React.createElement(
          "select",
          {
            value: voucherForm.marketCode,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { marketCode: e.target.value })),
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          },
          /* @__PURE__ */ React.createElement("option", { value: "ro" }, "\u{1F1F7}\u{1F1F4} Rom\xE2nia (ro)"),
          /* @__PURE__ */ React.createElement("option", { value: "fr" }, "\u{1F1EB}\u{1F1F7} France (fr)"),
          /* @__PURE__ */ React.createElement("option", { value: "com" }, "\u{1F30D} International (com)")
        )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "15px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Voucher Code *"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            value: voucherForm.code,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { code: e.target.value.toUpperCase() })),
            placeholder: "e.g., DISCOUNT10",
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          }
        )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "15px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Name/Description *"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            value: voucherForm.name,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { name: e.target.value })),
            placeholder: "e.g., 10% Summer Sale",
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          }
        )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Discount Type"), /* @__PURE__ */ React.createElement(
          "select",
          {
            value: voucherForm.discountType,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { discountType: e.target.value })),
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          },
          /* @__PURE__ */ React.createElement("option", { value: "fixed" }, "Fixed Amount (RON)"),
          /* @__PURE__ */ React.createElement("option", { value: "percentage" }, "Percentage (%)")
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Discount Value *"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "number",
            value: voucherForm.discountValue,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { discountValue: e.target.value })),
            placeholder: voucherForm.discountType === "percentage" ? "e.g., 10" : "e.g., 50",
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          }
        ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Min Order Amount"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "number",
            value: voucherForm.minOrderAmount,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { minOrderAmount: e.target.value })),
            placeholder: "Optional",
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          }
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Max Uses"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "number",
            value: voucherForm.maxUses,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { maxUses: e.target.value })),
            placeholder: "Unlimited",
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          }
        ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Valid From"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "datetime-local",
            value: voucherForm.validFrom,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { validFrom: e.target.value })),
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          }
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Valid Until"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "datetime-local",
            value: voucherForm.validUntil,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { validUntil: e.target.value })),
            style: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ddd" }
          }
        ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: voucherForm.isActive,
            onChange: (e) => setVoucherForm(__spreadProps(__spreadValues({}, voucherForm), { isActive: e.target.checked }))
          }
        ), /* @__PURE__ */ React.createElement("span", { style: { fontWeight: "bold" } }, "Voucher is active"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn btn-secondary",
            onClick: () => setShowAddVoucherModal(false),
            style: { width: "auto", padding: "10px 20px" }
          },
          "Cancel"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#28a745", width: "auto", padding: "10px 20px" },
            onClick: async () => {
              if (!voucherForm.code || !voucherForm.name || !voucherForm.discountValue) {
                alert("Please fill in all required fields (Code, Name, Discount Value)");
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
                  marketCode: voucherForm.marketCode || "ro"
                };
                const url = editingVoucher ? `/admin/api/vouchers/${editingVoucher.id}` : "/admin/api/vouchers";
                const method = editingVoucher ? "PUT" : "POST";
                const response = await fetch(url, {
                  method,
                  headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify(voucherData)
                });
                if (response.ok) {
                  const savedVoucher = await response.json();
                  if (editingVoucher) {
                    setVouchers(vouchers.map((v) => v.id === savedVoucher.id ? savedVoucher : v));
                  } else {
                    setVouchers([savedVoucher, ...vouchers]);
                  }
                  setShowAddVoucherModal(false);
                  setEditingVoucher(null);
                } else {
                  const error2 = await response.json();
                  alert(error2.message || "Failed to save voucher");
                }
              } catch (err) {
                console.error("Error saving voucher:", err);
                alert("Failed to save voucher");
              }
            }
          },
          editingVoucher ? "Update Voucher" : "Create Voucher"
        )))));
      case "markets":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", marginTop: 0 } }, "\u{1F30D} Gestiune Pie\u021Be / Market Settings"), marketsLoading && /* @__PURE__ */ React.createElement("div", { style: { color: "#666", marginBottom: "16px" } }, /* @__PURE__ */ React.createElement("span", { className: "loading" }), " Se \xEEncarc\u0103..."), (() => {
          const myMarkets = (admin == null ? void 0 : admin.adminMarkets) || [];
          const canSee = (m) => adminIsSuperAdmin || myMarkets.includes(m);
          const showTab = selectedMarketTab === "all";
          return ["ro", "fr", "com"].map(
            (m) => canSee(m) && (showTab || selectedMarketTab === m) ? /* @__PURE__ */ React.createElement(MarketSettingCard, { key: m, market: m, marketsData, saveMarket }) : null
          );
        })());
      case "blog":
        return /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h3", { style: { color: "#333", marginTop: 0 } }, "\u{1F4DD} Blog \u2014 Generare Automat\u0103 cu Claude AI"), /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", borderRadius: "8px", padding: "20px", marginBottom: "24px", border: "1px solid #e9ecef" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginTop: 0, color: "#495057" } }, "Genereaz\u0103 articol nou"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "12px", alignItems: "end" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#6c757d" } }, "Titlu (op\u021Bional)"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            placeholder: "Las\u0103 gol pentru tem\u0103 automat\u0103",
            value: blogGenerateForm.title,
            onChange: (e) => setBlogGenerateForm(__spreadProps(__spreadValues({}, blogGenerateForm), { title: e.target.value })),
            style: { width: "100%", padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }
          }
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#6c757d" } }, "Categorie"), /* @__PURE__ */ React.createElement(
          "select",
          {
            value: blogGenerateForm.category,
            onChange: (e) => setBlogGenerateForm(__spreadProps(__spreadValues({}, blogGenerateForm), { category: e.target.value })),
            style: { width: "100%", padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }
          },
          /* @__PURE__ */ React.createElement("option", { value: "HACCP" }, "HACCP"),
          /* @__PURE__ */ React.createElement("option", { value: "Legisla\u021Bie" }, "Legisla\u021Bie"),
          /* @__PURE__ */ React.createElement("option", { value: "Etichetare" }, "Etichetare"),
          /* @__PURE__ */ React.createElement("option", { value: "Trasabilitate" }, "Trasabilitate"),
          /* @__PURE__ */ React.createElement("option", { value: "Echipamente" }, "Echipamente"),
          /* @__PURE__ */ React.createElement("option", { value: "Digitalizare" }, "Digitalizare"),
          /* @__PURE__ */ React.createElement("option", { value: "Opera\u021Biuni" }, "Opera\u021Biuni"),
          /* @__PURE__ */ React.createElement("option", { value: "General" }, "General")
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#6c757d" } }, "Limb\u0103"), /* @__PURE__ */ React.createElement(
          "select",
          {
            value: blogGenerateForm.language,
            onChange: (e) => setBlogGenerateForm(__spreadProps(__spreadValues({}, blogGenerateForm), { language: e.target.value })),
            disabled: !adminIsSuperAdmin,
            title: !adminIsSuperAdmin ? (window.ADMIN_LANG === "fr" ? "Langue fix\xE9e par votre march\xE9" : window.ADMIN_LANG === "en" ? "Language locked to your market" : "Limba este fix\u0103 pentru marketplace-ul t\u0103u") : "",
            style: { width: "100%", padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box", opacity: adminIsSuperAdmin ? 1 : 0.75, cursor: adminIsSuperAdmin ? "auto" : "not-allowed" }
          },
          /* @__PURE__ */ React.createElement("option", { value: "ro" }, "\u{1F1F7}\u{1F1F4} Rom\xE2n\u0103 (RO)"),
          /* @__PURE__ */ React.createElement("option", { value: "fr" }, "\u{1F1EB}\u{1F1F7} Francez\u0103 (FR)"),
          /* @__PURE__ */ React.createElement("option", { value: "en" }, "\u{1F1EC}\u{1F1E7} Englez\u0103 (COM)")
        )), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: generateBlogPost,
            disabled: blogGenerating,
            style: { background: blogGenerating ? "#6c757d" : "#0066cc", color: "white", border: "none", borderRadius: "6px", padding: "8px 18px", fontSize: "14px", cursor: blogGenerating ? "not-allowed" : "pointer", whiteSpace: "nowrap", fontWeight: "600" }
          },
          blogGenerating ? "\u23F3 Generez..." : "\u2728 Genereaz\u0103"
        )), /* @__PURE__ */ React.createElement("p", { style: { margin: "10px 0 0", fontSize: "12px", color: "#868e96" } }, '\u2139\uFE0F Generarea dureaz\u0103 ~25-40 secunde. "Etichete HACCP" este inclus \xEEn toate articolele.')), /* @__PURE__ */ React.createElement("div", { style: { background: "#f0f7ff", borderRadius: "8px", padding: "20px", marginBottom: "24px", border: "1px solid #b8d4f5" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" } }, /* @__PURE__ */ React.createElement("h4", { style: { margin: 0, color: "#1565c0" } }, "\u23F0 Generare automat\u0103"), !scheduleLoaded && /* @__PURE__ */ React.createElement("button", { onClick: fetchScheduleConfig, style: { background: "none", border: "1px solid #1565c0", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", fontSize: "12px", color: "#1565c0" } }, "\xCEncarc\u0103 configura\u021Bie")), scheduleLoaded && /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: "12px", alignItems: "end" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", paddingBottom: "8px" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            id: "schedEnabled",
            checked: scheduleConfig.enabled,
            onChange: (e) => setScheduleConfig((c) => __spreadProps(__spreadValues({}, c), { enabled: e.target.checked })),
            style: { width: "16px", height: "16px", cursor: "pointer" }
          }
        ), /* @__PURE__ */ React.createElement("label", { htmlFor: "schedEnabled", style: { fontSize: "14px", fontWeight: "600", color: "#333", cursor: "pointer" } }, "Activat")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#495057" } }, "La fiecare (zile)"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "number",
            min: "1",
            max: "30",
            value: scheduleConfig.intervalDays,
            onChange: (e) => setScheduleConfig((c) => __spreadProps(__spreadValues({}, c), { intervalDays: parseInt(e.target.value) || 1 })),
            style: { width: "100%", padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }
          }
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#495057" } }, "Ora (0-23, Bucharest)"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "number",
            min: "0",
            max: "23",
            value: scheduleConfig.hour,
            onChange: (e) => setScheduleConfig((c) => __spreadProps(__spreadValues({}, c), { hour: parseInt(e.target.value) || 8 })),
            style: { width: "100%", padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }
          }
        )), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: saveScheduleConfig,
            style: { background: "#1565c0", color: "white", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }
          },
          "\u{1F4BE} Salveaz\u0103"
        )), scheduleLoaded && /* @__PURE__ */ React.createElement("p", { style: { margin: "10px 0 0", fontSize: "12px", color: "#666" } }, "Curent: ", scheduleConfig.enabled ? `la fiecare ${scheduleConfig.intervalDays} zi(le), ora ${scheduleConfig.hour}:00 Bucharest` : "dezactivat")), /* @__PURE__ */ React.createElement("div", { style: { background: "#fff8e1", borderRadius: "8px", padding: "16px", marginBottom: "24px", border: "1px solid #ffe082" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginTop: 0, marginBottom: "10px", color: "#e65100", fontSize: "14px" } }, "\u{1F30D} Generare s\u0103pt\u0103m\xE2nal\u0103 pe pia\u021B\u0103"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", color: "#555" } }, "Genereaz\u0103 un articol din subiectele predefinite pentru:"), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => generateWeeklyForMarket("ro"),
            disabled: blogGenerating,
            style: { background: blogGenerating ? "#9e9e9e" : "#1b5e20", color: "white", border: "none", borderRadius: "6px", padding: "7px 14px", fontSize: "13px", cursor: blogGenerating ? "not-allowed" : "pointer", fontWeight: "600" }
          },
          "\u{1F1F7}\u{1F1F4} RO"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => generateWeeklyForMarket("fr"),
            disabled: blogGenerating,
            style: { background: blogGenerating ? "#9e9e9e" : "#1a237e", color: "white", border: "none", borderRadius: "6px", padding: "7px 14px", fontSize: "13px", cursor: blogGenerating ? "not-allowed" : "pointer", fontWeight: "600" }
          },
          "\u{1F1EB}\u{1F1F7} FR"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => generateWeeklyForMarket("com"),
            disabled: blogGenerating,
            style: { background: blogGenerating ? "#9e9e9e" : "#006064", color: "white", border: "none", borderRadius: "6px", padding: "7px 14px", fontSize: "13px", cursor: blogGenerating ? "not-allowed" : "pointer", fontWeight: "600" }
          },
          "\u{1F1EC}\u{1F1E7} COM"
        ), blogGenerating && /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", color: "#e65100" } }, "\u23F3 Generez (~30s)..."))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" } }, /* @__PURE__ */ React.createElement("h4", { style: { margin: 0, color: "#495057" } }, "Articole (", blogPosts.length, ")"), /* @__PURE__ */ React.createElement("button", { onClick: fetchBlogPosts, style: { background: "none", border: "1px solid #ced4da", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px" } }, "\u{1F504} Re\xEEncarc\u0103")), blogPosts.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "40px", color: "#868e96", background: "#f8f9fa", borderRadius: "8px", border: "1px dashed #ced4da" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "48px", marginBottom: "12px" } }, "\u{1F4ED}"), /* @__PURE__ */ React.createElement("p", { style: { margin: 0 } }, "Niciun articol generat \xEEnc\u0103. Folose\u0219te formularul de mai sus pentru a genera primul articol.")) : /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "14px" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { background: "#f8f9fa", borderBottom: "2px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "10px 12px", textAlign: "left", color: "#495057" } }, "Titlu"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px 12px", textAlign: "left", color: "#495057" } }, "Categorie"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px 12px", textAlign: "left", color: "#495057" } }, "Limb\u0103"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px 12px", textAlign: "center", color: "#495057" } }, "Citit"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px 12px", textAlign: "center", color: "#495057" } }, "Status"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px 12px", textAlign: "left", color: "#495057" } }, "Data"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px 12px", textAlign: "center", color: "#495057" } }, "Ac\u021Biuni"))), /* @__PURE__ */ React.createElement("tbody", null, blogPosts.map((post, idx) => /* @__PURE__ */ React.createElement("tr", { key: post.id, style: { borderBottom: "1px solid #dee2e6", background: idx % 2 === 0 ? "white" : "#fafafa" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 12px", maxWidth: "280px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "600", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, post.title), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", color: "#868e96", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" } }, post.excerpt)), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 12px", color: "#495057" } }, post.category), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 12px", textAlign: "center" } }, post.language === "ro" ? "\u{1F1F7}\u{1F1F4}" : post.language === "fr" ? "\u{1F1EB}\u{1F1F7}" : "\u{1F1EC}\u{1F1E7}"), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 12px", textAlign: "center", color: "#495057" } }, post.readTimeMinutes ? post.readTimeMinutes + " min" : "-"), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 12px", textAlign: "center" } }, /* @__PURE__ */ React.createElement("span", { style: {
          background: post.published ? "#d4edda" : "#fff3cd",
          color: post.published ? "#155724" : "#856404",
          padding: "2px 10px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: "600"
        } }, post.published ? "Publicat" : "Draft")), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 12px", color: "#868e96", fontSize: "12px", whiteSpace: "nowrap" } }, post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("ro-RO") : "-"), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setPreviewBlogPost(post),
            style: { background: "#6c757d", color: "white", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "12px", marginRight: "4px" },
            title: "Previzualizare articol"
          },
          "\u{1F441}"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => openEditBlogPost(post),
            style: { background: "#0d6efd", color: "white", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "12px", marginRight: "4px" },
            title: "Editeaz\u0103 articol"
          },
          "\u270F\uFE0F"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => toggleBlogPostPublished(post),
            style: { background: post.published ? "#ffc107" : "#28a745", color: "white", border: "none", borderRadius: "4px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", marginRight: "4px" }
          },
          post.published ? "Ascunde" : "Public\u0103"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => deleteBlogPost(post.id),
            style: { background: "#dc3545", color: "white", border: "none", borderRadius: "4px", padding: "4px 10px", cursor: "pointer", fontSize: "12px" }
          },
          "\u0218terge"
        ))))))));
      default:
        return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "dashboard-grid" }, /* @__PURE__ */ React.createElement("div", { className: "stat-card" }, /* @__PURE__ */ React.createElement("div", { className: "stat-number" }, (stats == null ? void 0 : stats.totalUsers) || "0"), /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Total Users")), /* @__PURE__ */ React.createElement("div", { className: "stat-card" }, /* @__PURE__ */ React.createElement("div", { className: "stat-number" }, (stats == null ? void 0 : stats.totalOrders) || "0"), /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Total Orders")), /* @__PURE__ */ React.createElement("div", { className: "stat-card" }, /* @__PURE__ */ React.createElement("div", { className: "stat-number" }, (stats == null ? void 0 : stats.totalProducts) || "0"), /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Total Products")), /* @__PURE__ */ React.createElement("div", { className: "stat-card" }, /* @__PURE__ */ React.createElement("div", { className: "stat-number" }, ((_a = stats == null ? void 0 : stats.recentOrders) == null ? void 0 : _a.length) || "0"), /* @__PURE__ */ React.createElement("div", { className: "stat-label" }, "Recent Orders"))), /* @__PURE__ */ React.createElement("div", { style: { background: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "System Overview"), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", lineHeight: "1.6" } }, "Welcome to the xHACCP Admin Panel. Here you can manage your e-commerce platform, view statistics, and monitor system performance. The dashboard shows real-time data from your PostgreSQL database."), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "30px", padding: "20px", background: "#f8f9ff", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "Quick Stats Summary"), /* @__PURE__ */ React.createElement("ul", { style: { listStyle: "none", padding: 0 } }, /* @__PURE__ */ React.createElement("li", { style: { marginBottom: "5px" } }, "\u{1F4CA} ", (stats == null ? void 0 : stats.totalUsers) || "0", " registered users"), /* @__PURE__ */ React.createElement("li", { style: { marginBottom: "5px" } }, "\u{1F6D2} ", (stats == null ? void 0 : stats.totalOrders) || "0", " orders processed"), /* @__PURE__ */ React.createElement("li", { style: { marginBottom: "5px" } }, "\u{1F4E6} ", (stats == null ? void 0 : stats.totalProducts) || "0", " products in catalog"), /* @__PURE__ */ React.createElement("li", { style: { marginBottom: "5px" } }, "\u{1F504} ", ((_b = stats == null ? void 0 : stats.recentOrders) == null ? void 0 : _b.length) || "0", " recent orders"))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "30px", padding: "20px", background: "#fff8e1", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "Admin Actions"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginTop: "15px" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: activeView === "orders" ? "#2E7D32" : "#4CAF50", width: "auto", padding: "10px 16px" },
            onClick: () => handleViewChange("orders")
          },
          "\u{1F4CB} Manage Orders"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: activeView === "users" ? "#1565C0" : "#2196F3", width: "auto", padding: "10px 16px" },
            onClick: () => handleViewChange("users")
          },
          "\u{1F465} Manage Users"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: activeView === "products" ? "#F57C00" : "#FF9800", width: "auto", padding: "10px 16px" },
            onClick: () => handleViewChange("products")
          },
          "\u{1F4E6} Manage Products"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#9C27B0", width: "auto", padding: "10px 16px" },
            onClick: () => setShowTwoFactor(!showTwoFactor)
          },
          "\u{1F510} Two-Factor Auth"
        ))), showTwoFactor && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "30px", padding: "20px", background: "#e8f5e8", borderRadius: "6px", border: "2px solid #4CAF50" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "\u{1F510} Two-Factor Authentication"), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", marginBottom: "15px" } }, "Status: ", (admin == null ? void 0 : admin.twoFactorEnabled) ? /* @__PURE__ */ React.createElement("span", { style: { color: "#4CAF50", fontWeight: "bold" } }, "\u2705 Enabled") : /* @__PURE__ */ React.createElement("span", { style: { color: "#f44336", fontWeight: "bold" } }, "\u274C Disabled")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: (admin == null ? void 0 : admin.twoFactorEnabled) ? "#f44336" : "#4CAF50", width: "auto", padding: "8px 16px" },
            onClick: () => alert("2FA management functionality will be implemented")
          },
          (admin == null ? void 0 : admin.twoFactorEnabled) ? "\u{1F513} Disable 2FA" : "\u{1F512} Enable 2FA"
        ), (admin == null ? void 0 : admin.twoFactorEnabled) && /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "btn",
            style: { background: "#FF9800", width: "auto", padding: "8px 16px" },
            onClick: () => alert("Backup codes regeneration will be implemented")
          },
          "\u{1F504} Regenerate Backup Codes"
        ))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "30px", padding: "20px", background: "#f0f8ff", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "Recent Activity"), ((_c = stats == null ? void 0 : stats.recentOrders) == null ? void 0 : _c.length) > 0 ? /* @__PURE__ */ React.createElement("div", { style: { maxHeight: "200px", overflowY: "auto" } }, stats.recentOrders.map((order, index) => /* @__PURE__ */ React.createElement("div", { key: index, style: {
          padding: "10px",
          marginBottom: "10px",
          background: "white",
          borderRadius: "4px",
          borderLeft: "4px solid #2196F3"
        } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold" } }, "Order #", order.id), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "14px", color: "#666" } }, "Amount: $", order.totalAmount, " | Status: ", order.status)))) : /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontStyle: "italic" } }, "No recent orders"))));
    }
  };
  const BulkStatusComponent = () => {
    const [newStatus, setNewStatus] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const handleStatusUpdate = async () => {
      if (!newStatus) {
        alert("Please select a status");
        return;
      }
      setIsProcessing(true);
      const result = await performBulkOperation("status", selectedOrders, { status: newStatus });
      if (result.success) {
        alert(`Status updated successfully for ${selectedOrders.length} orders`);
        setSelectedOrders([]);
        setShowBulkModal(false);
        setBulkOperation("");
      } else {
        alert("Error: " + result.message);
      }
      setIsProcessing(false);
    };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Select New Status"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: newStatus,
        onChange: (e) => setNewStatus(e.target.value)
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Choose Status..."),
      /* @__PURE__ */ React.createElement("option", { value: "pending" }, "Pending"),
      /* @__PURE__ */ React.createElement("option", { value: "processing" }, "Processing"),
      /* @__PURE__ */ React.createElement("option", { value: "in_delivery" }, "In Delivery"),
      /* @__PURE__ */ React.createElement("option", { value: "delivered" }, "Delivered"),
      /* @__PURE__ */ React.createElement("option", { value: "cancelled" }, "Cancelled")
    )), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#28a745" },
        onClick: handleStatusUpdate,
        disabled: isProcessing
      },
      isProcessing ? "Updating..." : "Update Status"
    ));
  };
  const BulkToolsComponent = () => {
    const [selectedTool, setSelectedTool] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState("");
    const handleToolOperation = async (operation) => {
      setIsProcessing(true);
      let result;
      switch (operation) {
        case "shipping":
          result = await performBulkOperation("shipping", selectedOrders);
          break;
        case "notifications":
          result = await performBulkOperation("notifications", selectedOrders, { message: notificationMessage });
          break;
        case "refunds":
          result = await performBulkOperation("refunds", selectedOrders);
          break;
        default:
          result = { success: false, message: "Invalid operation" };
      }
      if (result.success) {
        alert(`${operation} operation completed successfully for ${selectedOrders.length} orders`);
        setSelectedOrders([]);
        setShowBulkModal(false);
        setBulkOperation("");
      } else {
        alert("Error: " + result.message);
      }
      setIsProcessing(false);
    };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "15px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#17a2b8" },
        onClick: () => handleToolOperation("shipping"),
        disabled: isProcessing
      },
      "\u{1F4E6} Generate Shipping Labels"
    ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Custom Notification Message"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "form-input",
        value: notificationMessage,
        onChange: (e) => setNotificationMessage(e.target.value),
        placeholder: "Enter custom notification message...",
        rows: "3"
      }
    )), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#ffc107" },
        onClick: () => handleToolOperation("notifications"),
        disabled: isProcessing
      },
      "\u{1F4E7} Send Notifications"
    )), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#dc3545" },
        onClick: () => {
          if (confirm("Are you sure you want to process refunds for the selected orders? This action cannot be undone.")) {
            handleToolOperation("refunds");
          }
        },
        disabled: isProcessing
      },
      "\u{1F4B8} Process Refunds"
    )), isProcessing && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginTop: "20px" } }, /* @__PURE__ */ React.createElement("div", { className: "loading" }), /* @__PURE__ */ React.createElement("p", null, "Processing operation...")));
  };
  const ProductBulkOperationsComponent = () => {
    const [selectedOperation, setSelectedOperation] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [priceMultiplier, setPriceMultiplier] = useState("");
    const [fixedPrice, setFixedPrice] = useState("");
    const [newCategoryId, setNewCategoryId] = useState("");
    const [newStatus, setNewStatus] = useState("");
    const [stockOperation, setStockOperation] = useState("set");
    const [stockValue, setStockValue] = useState("");
    const handleOperation = async () => {
      if (!selectedOperation) {
        alert("Please select an operation");
        return;
      }
      setIsProcessing(true);
      let result;
      switch (selectedOperation) {
        case "update-prices":
          if (!priceMultiplier && !fixedPrice) {
            alert("Please enter a price multiplier or fixed price");
            setIsProcessing(false);
            return;
          }
          result = await performProductBulkOperation("update-prices", selectedProducts, {
            multiplier: priceMultiplier ? parseFloat(priceMultiplier) : null,
            fixedPrice: fixedPrice ? parseFloat(fixedPrice) : null
          });
          break;
        case "update-categories":
          if (!newCategoryId) {
            alert("Please select a category");
            setIsProcessing(false);
            return;
          }
          result = await performProductBulkOperation("update-categories", selectedProducts, {
            categoryId: parseInt(newCategoryId)
          });
          break;
        case "update-status":
          if (!newStatus) {
            alert("Please select a status");
            setIsProcessing(false);
            return;
          }
          result = await performProductBulkOperation("update-status", selectedProducts, {
            status: newStatus
          });
          break;
        case "update-stock":
          if (!stockValue) {
            alert("Please enter a stock value");
            setIsProcessing(false);
            return;
          }
          result = await performProductBulkOperation("update-stock", selectedProducts, {
            operation: stockOperation,
            value: parseInt(stockValue)
          });
          break;
        case "export":
          result = await performProductBulkOperation("export", selectedProducts);
          break;
        case "delete":
          if (!confirm(`Are you sure you want to delete ${selectedProducts.length} products? This action cannot be undone.`)) {
            setIsProcessing(false);
            return;
          }
          result = await performProductBulkOperation("delete", selectedProducts);
          break;
        default:
          result = { success: false, message: "Invalid operation" };
      }
      if (result.success) {
        alert(`${selectedOperation} operation completed successfully for ${selectedProducts.length} products`);
        setSelectedProducts([]);
        setShowProductBulkModal(false);
        setProductBulkOperation("");
        setTimeout(() => {
          fetchProducts();
        }, 1e3);
      } else {
        alert("Error: " + result.message);
      }
      setIsProcessing(false);
    };
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Select Operation"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: selectedOperation,
        onChange: (e) => setSelectedOperation(e.target.value)
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Choose Operation..."),
      /* @__PURE__ */ React.createElement("option", { value: "update-prices" }, "\u{1F4B0} Update Prices"),
      /* @__PURE__ */ React.createElement("option", { value: "update-categories" }, "\u{1F4C1} Update Categories"),
      /* @__PURE__ */ React.createElement("option", { value: "update-status" }, "\u{1F504} Update Status"),
      /* @__PURE__ */ React.createElement("option", { value: "update-stock" }, "\u{1F4E6} Update Stock"),
      /* @__PURE__ */ React.createElement("option", { value: "export" }, "\u{1F4E4} Export Products"),
      /* @__PURE__ */ React.createElement("option", { value: "delete" }, "\u{1F5D1}\uFE0F Delete Products")
    )), selectedOperation === "update-prices" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Price Multiplier (e.g., 1.1 for 10% increase)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        className: "form-input",
        value: priceMultiplier,
        onChange: (e) => setPriceMultiplier(e.target.value),
        placeholder: "Enter multiplier (e.g., 1.1)"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "OR Set Fixed Price"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        className: "form-input",
        value: fixedPrice,
        onChange: (e) => setFixedPrice(e.target.value),
        placeholder: "Enter fixed price"
      }
    ))), selectedOperation === "update-categories" && /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "New Category"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: newCategoryId,
        onChange: (e) => setNewCategoryId(e.target.value)
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Select Category..."),
      categories.map((category) => /* @__PURE__ */ React.createElement("option", { key: category.id, value: category.id }, category.name))
    )), selectedOperation === "update-status" && /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "New Status"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: newStatus,
        onChange: (e) => setNewStatus(e.target.value)
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Select Status..."),
      /* @__PURE__ */ React.createElement("option", { value: "active" }, "Active"),
      /* @__PURE__ */ React.createElement("option", { value: "inactive" }, "Inactive"),
      /* @__PURE__ */ React.createElement("option", { value: "draft" }, "Draft"),
      /* @__PURE__ */ React.createElement("option", { value: "discontinued" }, "Discontinued")
    )), selectedOperation === "update-stock" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Stock Operation"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: stockOperation,
        onChange: (e) => setStockOperation(e.target.value)
      },
      /* @__PURE__ */ React.createElement("option", { value: "set" }, "Set Stock To"),
      /* @__PURE__ */ React.createElement("option", { value: "add" }, "Add To Stock"),
      /* @__PURE__ */ React.createElement("option", { value: "subtract" }, "Subtract From Stock")
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Stock Value"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        className: "form-input",
        value: stockValue,
        onChange: (e) => setStockValue(e.target.value),
        placeholder: "Enter stock value"
      }
    ))), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#28a745" },
        onClick: handleOperation,
        disabled: isProcessing
      },
      isProcessing ? "Processing..." : "Execute Operation"
    ), isProcessing && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginTop: "20px" } }, /* @__PURE__ */ React.createElement("div", { className: "loading" }), /* @__PURE__ */ React.createElement("p", null, "Processing operation...")));
  };
  const MarketSettingCard = ({ market, marketsData: marketsData2, saveMarket: saveMarket2 }) => {
    const defaults = {
      ro: { label: "Rom\xE2nia (.ro)", currency: "RON", vatPercentage: "19.00", freeShippingThreshold: "500", standardShippingCost: "20", isActive: true },
      fr: { label: "France (.fr)", currency: "EUR", vatPercentage: "20.00", freeShippingThreshold: "150", standardShippingCost: "10", isActive: false },
      com: { label: "International (.com)", currency: "EUR", vatPercentage: "0.00", freeShippingThreshold: "200", standardShippingCost: "15", isActive: false }
    }[market];
    const serverVals = marketsData2[market];
    const [local, setLocal] = useState(serverVals || defaults);
    const flag = market === "ro" ? "\u{1F1F7}\u{1F1F4}" : market === "fr" ? "\u{1F1EB}\u{1F1F7}" : "\u{1F310}";
    useEffect(() => {
      if (serverVals) setLocal(serverVals);
    }, [JSON.stringify(serverVals)]);
    const set = (field, val) => setLocal((prev) => __spreadProps(__spreadValues({}, prev), { [field]: val }));
    return /* @__PURE__ */ React.createElement("div", { style: { background: "#f8f9fa", borderRadius: "8px", padding: "24px", marginBottom: "20px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" } }, /* @__PURE__ */ React.createElement("h4", { style: { margin: 0, color: "#333" } }, flag, " ", local.label || defaults.label), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "14px", color: "#555", fontWeight: "600" } }, "Activ:"), /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: local.isActive || false, onChange: (e) => set("isActive", e.target.checked), style: { width: "18px", height: "18px", cursor: "pointer" } }))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#495057" } }, "Moned\u0103"), /* @__PURE__ */ React.createElement("input", { type: "text", value: local.currency || "", onChange: (e) => set("currency", e.target.value), placeholder: "RON / EUR", style: { width: "100%", padding: "8px 10px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" } })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#495057" } }, "TVA %"), /* @__PURE__ */ React.createElement("input", { type: "number", step: "0.01", min: "0", max: "100", value: local.vatPercentage || "", onChange: (e) => set("vatPercentage", e.target.value), placeholder: "19.00", style: { width: "100%", padding: "8px 10px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" } })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#495057" } }, "Prag transport gratuit"), /* @__PURE__ */ React.createElement("input", { type: "number", step: "0.01", min: "0", value: local.freeShippingThreshold || "", onChange: (e) => set("freeShippingThreshold", e.target.value), placeholder: "500.00", style: { width: "100%", padding: "8px 10px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" } })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "600", color: "#495057" } }, "Cost transport standard"), /* @__PURE__ */ React.createElement("input", { type: "number", step: "0.01", min: "0", value: local.standardShippingCost || "", onChange: (e) => set("standardShippingCost", e.target.value), placeholder: "20.00", style: { width: "100%", padding: "8px 10px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" } }))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "16px", display: "flex", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => saveMarket2(market, {
          currency: local.currency,
          vatPercentage: local.vatPercentage,
          freeShippingThreshold: local.freeShippingThreshold,
          standardShippingCost: local.standardShippingCost,
          isActive: local.isActive,
          label: local.label || defaults.label
        }),
        style: { background: "#28a745", color: "white", border: "none", borderRadius: "6px", padding: "8px 20px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }
      },
      "\u{1F4BE} Salveaz\u0103 ",
      flag
    )));
  };
  const MarketPricesSection = ({ editingProduct: editingProduct2, editingProductMarkets: editingProductMarkets2, token: token2, fetchProductMarkets: fetchProductMarkets2 }) => {
    const emptyRow = () => ({ isActive: true, price: "", compareAtPrice: "" });
    const [local, setLocal] = useState({ ro: emptyRow(), fr: emptyRow(), com: emptyRow() });
    useEffect(() => {
      setLocal({
        ro: (editingProductMarkets2 == null ? void 0 : editingProductMarkets2.ro) ? { isActive: editingProductMarkets2.ro.isActive, price: editingProductMarkets2.ro.price || "", compareAtPrice: editingProductMarkets2.ro.compareAtPrice || "" } : emptyRow(),
        fr: (editingProductMarkets2 == null ? void 0 : editingProductMarkets2.fr) ? { isActive: editingProductMarkets2.fr.isActive, price: editingProductMarkets2.fr.price || "", compareAtPrice: editingProductMarkets2.fr.compareAtPrice || "" } : emptyRow(),
        com: (editingProductMarkets2 == null ? void 0 : editingProductMarkets2.com) ? { isActive: editingProductMarkets2.com.isActive, price: editingProductMarkets2.com.price || "", compareAtPrice: editingProductMarkets2.com.compareAtPrice || "" } : emptyRow()
      });
    }, [editingProductMarkets2]);
    const setField = (market, field, val) => setLocal((prev) => __spreadProps(__spreadValues({}, prev), { [market]: __spreadProps(__spreadValues({}, prev[market]), { [field]: val }) }));
    const save = async () => {
      try {
        const markets = ["ro", "fr", "com"].map((m) => ({
          market: m,
          isActive: local[m].isActive,
          price: local[m].price || null,
          compareAtPrice: local[m].compareAtPrice || null
        }));
        const res = await fetch(`/admin/api/products/${editingProduct2.id}/markets/bulk`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token2}`, "Content-Type": "application/json" },
          body: JSON.stringify({ markets })
        });
        if (res.ok) {
          alert("\u2705 Pre\u021Buri per pia\u021B\u0103 salvate!");
          fetchProductMarkets2();
        } else {
          alert("\u274C Eroare la salvare");
        }
      } catch (err) {
        alert("\u274C Eroare: " + err.message);
      }
    };
    const rows = [
      { market: "ro", flag: "\u{1F1F7}\u{1F1F4}", label: "Rom\xE2nia (.ro)", currency: "RON" },
      { market: "fr", flag: "\u{1F1EB}\u{1F1F7}", label: "France (.fr)", currency: "EUR" },
      { market: "com", flag: "\u{1F310}", label: "International (.com)", currency: "EUR" }
    ];
    return /* @__PURE__ */ React.createElement("div", { style: { marginTop: "20px", padding: "15px", backgroundColor: "#fff8e1", borderRadius: "6px", border: "1px solid #ffe082" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#333", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" } }, "\u{1F30D} Pre\u021Buri per Pia\u021B\u0103"), /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "13px" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#fff3cd" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #ffe082" } }, "Pia\u021B\u0103"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #ffe082" } }, "Activ"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #ffe082" } }, "Pre\u021B override"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #ffe082" } }, "Pre\u021B vechi (bar\xE1t)"))), /* @__PURE__ */ React.createElement("tbody", null, rows.map(({ market, flag, label, currency }) => /* @__PURE__ */ React.createElement("tr", { key: market, style: { borderBottom: "1px solid #ffe082" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 10px", fontWeight: "600" } }, flag, " ", label), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 10px", textAlign: "center" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: local[market].isActive || false,
        onChange: (e) => setField(market, "isActive", e.target.checked),
        style: { width: "16px", height: "16px", cursor: "pointer" }
      }
    )), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 10px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "4px" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        min: "0",
        value: local[market].price,
        onChange: (e) => setField(market, "price", e.target.value),
        placeholder: "(pre\u021B implicit)",
        style: { width: "120px", padding: "5px 8px", border: "1px solid #ced4da", borderRadius: "4px", fontSize: "13px" }
      }
    ), /* @__PURE__ */ React.createElement("span", { style: { color: "#666", fontSize: "12px" } }, currency))), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px 10px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "4px" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        min: "0",
        value: local[market].compareAtPrice,
        onChange: (e) => setField(market, "compareAtPrice", e.target.value),
        placeholder: "(op\u021Bional)",
        style: { width: "120px", padding: "5px 8px", border: "1px solid #ced4da", borderRadius: "4px", fontSize: "13px" }
      }
    ), /* @__PURE__ */ React.createElement("span", { style: { color: "#666", fontSize: "12px" } }, currency)))))))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "10px", display: "flex", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: save,
        style: { background: "#ff8f00", color: "white", border: "none", borderRadius: "6px", padding: "7px 18px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }
      },
      "\u{1F4BE} Salveaz\u0103 pre\u021Buri pie\u021Be"
    )), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "6px", fontSize: "11px", color: "#795548" } }, 'Las\u0103 pre\u021Bul gol pentru a folosi pre\u021Bul implicit al produsului. Bifeaz\u0103 \u201EActiv" pentru ca produsul s\u0103 fie vizibil pe pia\u021Ba respectiv\u0103.'));
  };
  const ModalsComponent = () => {
    var _a, _b, _c, _d;
    const [productFormData, setProductFormData] = useState({
      name: "",
      description: "",
      price: "",
      compareAtPrice: "",
      categoryId: "",
      supplierId: "",
      imageUrl: "",
      stockQuantity: "",
      featured: false,
      vatValue: "",
      vatPercentage: "21.00",
      currency: "RON",
      productCode: "",
      ncCode: "",
      cpvCode: "",
      status: "active",
      images: [],
      weight: "",
      length: "",
      width: "",
      height: "",
      piecesPerPackage: "",
      productQuantity: "",
      specs: [],
      volumeDiscounts: [],
      priority: 0
    });
    const [uploadedImages, setUploadedImages] = useState([]);
    const [newTranslation, setNewTranslation] = useState({ language: "", name: "", description: "", sourceUrl: "" });
    const [editingTranslation, setEditingTranslation] = useState(null);
    React.useEffect(() => {
      if (productLoadTrigger > 0 && initialProductDataRef.current) {
        console.log("ModalsComponent: Loading product data from ref");
        setProductFormData(initialProductDataRef.current);
        setUploadedImages(initialProductDataRef.current.images || []);
      }
    }, [productLoadTrigger]);
    React.useEffect(() => {
      if (!editingProduct || selectedMarketTab === "all") return;
      const mktData = editingProductMarkets[selectedMarketTab];
      if (!mktData) return;
      setProductFormData((prev) => __spreadProps(__spreadValues({}, prev), {
        price: mktData.price !== null && mktData.price !== void 0 && mktData.price !== "" ? String(mktData.price) : prev.price,
        compareAtPrice: mktData.compareAtPrice !== null && mktData.compareAtPrice !== void 0 && mktData.compareAtPrice !== "" ? String(mktData.compareAtPrice) : prev.compareAtPrice,
        currency: mktData.currency || prev.currency,
        stockQuantity: mktData.stockQuantity !== null && mktData.stockQuantity !== void 0 ? String(mktData.stockQuantity) : prev.stockQuantity
      }));
    }, [editingProductMarkets, selectedMarketTab]);
    const [userFormData, setUserFormData] = useState({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      isAdmin: false,
      adminMarkets: []
    });
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [importUrl, setImportUrl] = useState("");
    const [importLanguage, setImportLanguage] = useState("ro");
    const [importLoading, setImportLoading] = useState(false);
    const [importedData, setImportedData] = useState(null);
    const [usageRightsConfirmed, setUsageRightsConfirmed] = useState(false);
    const handleImportFromUrl = async () => {
      if (!importUrl.trim()) {
        alert("Please enter a URL to import from");
        return;
      }
      setImportLoading(true);
      try {
        const response = await fetch("/admin/api/products/import-from-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ url: importUrl })
        });
        const result = await response.json();
        if (result.success) {
          setImportedData(result.data);
          setProductFormData((prev) => __spreadProps(__spreadValues({}, prev), {
            name: result.data.title || prev.name,
            description: result.data.description || prev.description,
            imageUrl: result.data.imageUrl || prev.imageUrl,
            price: result.data.price || prev.price
          }));
        } else {
          alert(`Import failed: ${result.message}`);
        }
      } catch (error2) {
        console.error("Import error:", error2);
        alert("Failed to import data from URL");
      } finally {
        setImportLoading(false);
      }
    };
    const getImageUrl = (image) => {
      if (!image) return "";
      if (typeof image === "string") {
        if (image.startsWith("{") && image.includes('"url"')) {
          try {
            const parsed = JSON.parse(image);
            return parsed.thumbnailUrl || parsed.url || "";
          } catch (e) {
            return image;
          }
        }
        return image;
      }
      if (typeof image === "object") {
        return image.thumbnailUrl || image.url || "";
      }
      return "";
    };
    const [supplierFormData, setSupplierFormData] = useState({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      contactPerson: "",
      apiEndpoint: "",
      apiKey: "",
      integrationType: "email",
      notes: "",
      isActive: true,
      marketCode: "ro"
    });
    useEffect(() => {
      if (supplierLoadTrigger > 0 && supplierInitialDataRef.current) {
        console.log("ModalsComponent: Loading supplier data from ref");
        setSupplierFormData(supplierInitialDataRef.current);
      }
    }, [supplierLoadTrigger]);
    const handleSupplierSubmit = async (e) => {
      e.preventDefault();
      if (editingSupplier) {
        const result = await updateSupplier(editingSupplier.id, supplierFormData);
        if (result.success) {
          alert("\u2705 Supplier updated successfully!");
          setShowEditSupplierModal(false);
          setEditingSupplier(null);
          fetchSuppliers();
        } else {
          alert(`\u274C Error updating supplier: ${result.message}`);
        }
      } else {
        try {
          const token2 = localStorage.getItem("adminToken");
          const response = await fetch("/admin/api/suppliers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token2}`
            },
            body: JSON.stringify(supplierFormData)
          });
          if (response.ok) {
            alert("\u2705 Supplier created successfully!");
            setShowEditSupplierModal(false);
            setSupplierFormData({
              name: "",
              email: "",
              phone: "",
              address: "",
              city: "",
              state: "",
              zipCode: "",
              country: "",
              contactPerson: "",
              apiEndpoint: "",
              apiKey: "",
              integrationType: "email",
              notes: "",
              isActive: true
            });
            fetchSuppliers();
          } else {
            const error2 = await response.json();
            alert(`\u274C Error creating supplier: ${error2.message || "Unknown error"}`);
          }
        } catch (error2) {
          console.error("Error creating supplier:", error2);
          alert("\u274C Failed to create supplier");
        }
      }
    };
    const uploadImages = async (files) => {
      const validFiles = Array.from(files).filter((file) => {
        const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        const maxSize = 5 * 1024 * 1024;
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
        alert("Maximum 10 images per product. Please remove some images first.");
        return;
      }
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      validFiles.forEach((file) => {
        formData.append("images", file);
      });
      try {
        const response = await fetch("/admin/api/upload-images", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("adminToken")}`
          },
          body: formData
        });
        const result = await response.json();
        if (result.success) {
          const newImages = [...uploadedImages, ...result.files];
          setUploadedImages(newImages);
          setProductFormData((prev) => __spreadProps(__spreadValues({}, prev), {
            images: newImages
          }));
          alert(`${result.files.length} image(s) uploaded successfully`);
        } else {
          alert("Error: " + result.message);
        }
      } catch (error2) {
        console.error("Upload error:", error2);
        alert("Error uploading images. Please try again.");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    };
    const deleteImage = async (image, index) => {
      try {
        let imageUrl = null;
        if (typeof image === "string") {
          imageUrl = image;
        } else if (image && image.url) {
          imageUrl = image.url;
        } else if (image && image.filename) {
          imageUrl = image.filename;
        }
        if (imageUrl) {
          console.log("Deleting image from R2:", imageUrl);
          const response = await fetch("/admin/api/delete-image-by-url", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("adminToken")}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ imageUrl })
          });
          const result = await response.json();
          console.log("Delete result:", result);
          if (!result.success) {
            console.warn("Server delete failed:", result.message);
          }
        }
        const newImages = uploadedImages.filter((_, i) => i !== index);
        setUploadedImages(newImages);
        setProductFormData((prev) => __spreadProps(__spreadValues({}, prev), {
          images: newImages
        }));
        alert("Image deleted successfully");
      } catch (error2) {
        console.error("Delete error:", error2);
        const newImages = uploadedImages.filter((_, i) => i !== index);
        setUploadedImages(newImages);
        setProductFormData((prev) => __spreadProps(__spreadValues({}, prev), {
          images: newImages
        }));
        alert("Image removed from list");
      }
    };
    const setAsMainImage = async (selectedIndex) => {
      if (selectedIndex === 0) return;
      const newImages = [...uploadedImages];
      const mainImage = newImages.splice(selectedIndex, 1)[0];
      newImages.unshift(mainImage);
      setUploadedImages(newImages);
      setProductFormData((prev) => __spreadProps(__spreadValues({}, prev), {
        images: newImages
      }));
    };
    const handleUserSubmit = async (e) => {
      e.preventDefault();
      const result = editingUser ? await updateUser(editingUser.id, userFormData) : await createUser(userFormData);
      if (result.success) {
        alert(result.message);
        setShowAddUserModal(false);
        setEditingUser(null);
        setUserFormData({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          isAdmin: false
        });
      } else {
        alert("Error: " + result.message);
      }
    };
    const handleProductSubmit = async (e) => {
      var _b2;
      e.preventDefault();
      if (importedData && !usageRightsConfirmed) {
        alert("Te rog confirm\u0103 c\u0103 ai dreptul de utilizare a datelor \u0219i imaginilor importate.");
        return;
      }
      const productData = __spreadProps(__spreadValues({}, productFormData), {
        images: uploadedImages
      });
      console.log("Product form data being submitted:", productData);
      console.log("selectedMarketTab:", selectedMarketTab);
      const resetForm = () => {
        setShowAddProductModal(false);
        setEditingProduct(null);
        setProductFormData({
          name: "",
          description: "",
          price: "",
          compareAtPrice: "",
          categoryId: "",
          supplierId: "",
          imageUrl: "",
          stockQuantity: "",
          featured: false,
          vatValue: "",
          vatPercentage: "21.00",
          currency: "EUR",
          productCode: "",
          ncCode: "",
          cpvCode: "",
          status: "active",
          images: [],
          weight: "",
          length: "",
          width: "",
          height: "",
          piecesPerPackage: "",
          productQuantity: "",
          specs: [],
          volumeDiscounts: [],
          priority: 0
        });
        setUploadedImages([]);
        setImportUrl("");
        setImportedData(null);
        setUsageRightsConfirmed(false);
        fetchProducts();
        setTimeout(() => fetchProducts(), 1500);
      };
      const saveMarketData = async (productId, market) => {
        try {
          await fetch(`/admin/api/products/${productId}/markets/${market}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
              isActive: true,
              price: productData.price || null,
              compareAtPrice: productData.compareAtPrice || null,
              currency: productData.currency || null,
              stockQuantity: productData.stockQuantity !== "" && productData.stockQuantity !== null ? parseInt(String(productData.stockQuantity)) : null,
              inStock: productData.stockQuantity ? parseInt(String(productData.stockQuantity)) > 0 : null
            })
          });
        } catch (err) {
          console.error("Failed to save market-specific data:", err);
        }
      };
      if (editingProduct && selectedMarketTab !== "all") {
        const _a2 = productData, { price, compareAtPrice, currency, stockQuantity, inStock } = _a2, globalFields = __objRest(_a2, ["price", "compareAtPrice", "currency", "stockQuantity", "inStock"]);
        const globalResult = await updateProduct(editingProduct.id, globalFields);
        if (!globalResult.success) {
          alert("Eroare la salvare: " + globalResult.message);
          return;
        }
        await saveMarketData(editingProduct.id, selectedMarketTab);
        alert("\u2705 Produs salvat! Pre\u021Bul/stocul au fost actualizate doar pentru pia\u021Ba " + selectedMarketTab.toUpperCase() + ".");
        resetForm();
      } else if (!editingProduct && selectedMarketTab !== "all") {
        const result = await createProduct(productData);
        if (result.success) {
          const newId = ((_b2 = result.product) == null ? void 0 : _b2.id) || result.id;
          if (newId) {
            await saveMarketData(newId, selectedMarketTab);
          }
          alert(result.message);
          resetForm();
        } else {
          alert("Error: " + result.message);
        }
      } else {
        const result = editingProduct ? await updateProduct(editingProduct.id, productData) : await createProduct(productData);
        if (result.success) {
          alert(result.message);
          resetForm();
        } else {
          alert("Error: " + result.message);
        }
      }
    };
    React.useEffect(() => {
      if (editingUser) {
        setUserFormData({
          email: editingUser.email || "",
          password: "",
          firstName: editingUser.firstName || "",
          lastName: editingUser.lastName || "",
          isAdmin: editingUser.isAdmin || false,
          adminMarkets: editingUser.adminMarkets || []
        });
        setShowAddUserModal(true);
      }
    }, [editingUser]);
    const handleAddTranslation = async (productId) => {
      if (!newTranslation.language || !newTranslation.name) {
        alert("Language and name are required");
        return;
      }
      try {
        const response = await fetch(`/admin/api/products/${productId}/translations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(newTranslation)
        });
        if (response.ok) {
          const translation = await response.json();
          setProductTranslations([...productTranslations, translation]);
          setNewTranslation({ language: "", name: "", description: "", sourceUrl: "" });
          alert("\u2705 Translation added successfully!");
        } else {
          const error2 = await response.json();
          alert("Error: " + error2.message);
        }
      } catch (error2) {
        console.error("Error adding translation:", error2);
        alert("Failed to add translation");
      }
    };
    const handleDeleteTranslation = async (translationId) => {
      if (!confirm("Are you sure you want to delete this translation?")) return;
      try {
        const response = await fetch(`/admin/api/products/translations/${translationId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          setProductTranslations(productTranslations.filter((t) => t.id !== translationId));
          alert("\u2705 Translation deleted!");
        }
      } catch (error2) {
        console.error("Error deleting translation:", error2);
      }
    };
    const handleUpdateTranslation = async () => {
      if (!editingTranslation || !editingTranslation.name) {
        alert("Name is required");
        return;
      }
      try {
        const response = await fetch(`/admin/api/products/translations/${editingTranslation.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
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
          setProductTranslations(productTranslations.map((t) => t.id === updated.id ? updated : t));
          setEditingTranslation(null);
          alert("\u2705 Translation updated!");
        } else {
          const error2 = await response.json();
          alert("Error: " + error2.message);
        }
      } catch (error2) {
        console.error("Error updating translation:", error2);
        alert("Failed to update translation");
      }
    };
    return /* @__PURE__ */ React.createElement(React.Fragment, null, showAddUserModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "500px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, editingUser ? "Edit User" : "Add New User"), /* @__PURE__ */ React.createElement("form", { onSubmit: handleUserSubmit }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Email"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "email",
        className: "form-input",
        value: userFormData.email,
        onChange: (e) => setUserFormData(__spreadProps(__spreadValues({}, userFormData), { email: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Password ", editingUser && "(leave empty to keep current)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "password",
        className: "form-input",
        value: userFormData.password,
        onChange: (e) => setUserFormData(__spreadProps(__spreadValues({}, userFormData), { password: e.target.value })),
        required: !editingUser
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "First Name"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: userFormData.firstName,
        onChange: (e) => setUserFormData(__spreadProps(__spreadValues({}, userFormData), { firstName: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Last Name"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: userFormData.lastName,
        onChange: (e) => setUserFormData(__spreadProps(__spreadValues({}, userFormData), { lastName: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: userFormData.isAdmin,
        onChange: (e) => setUserFormData(__spreadProps(__spreadValues({}, userFormData), { isAdmin: e.target.checked }))
      }
    ), "Admin User")), adminIsSuperAdmin && userFormData.isAdmin && /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label", style: { marginBottom: "8px", display: "block" } }, "Market Access ", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", color: "#888", fontWeight: "400" } }, "(empty = superadmin, can see all)")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap" } }, ["ro", "fr", "com"].map((mkt) => {
      const flags = { ro: "\u{1F1F7}\u{1F1F4}", fr: "\u{1F1EB}\u{1F1F7}", com: "\u{1F310}" };
      const labels = { ro: "Romania", fr: "France", com: "International" };
      const checked = (userFormData.adminMarkets || []).includes(mkt);
      return /* @__PURE__ */ React.createElement("label", { key: mkt, style: { display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "6px 12px", border: `2px solid ${checked ? "#667eea" : "#e0e0e0"}`, borderRadius: "8px", background: checked ? "#f0f0ff" : "white", transition: "all 0.2s" } }, /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "checkbox",
          checked,
          onChange: (e) => {
            const prev = userFormData.adminMarkets || [];
            setUserFormData(__spreadProps(__spreadValues({}, userFormData), { adminMarkets: e.target.checked ? [...prev, mkt] : prev.filter((m) => m !== mkt) }));
          },
          style: { accentColor: "#667eea" }
        }
      ), flags[mkt], " ", labels[mkt]);
    }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowAddUserModal(false);
          setEditingUser(null);
          setUserFormData({
            email: "",
            password: "",
            firstName: "",
            lastName: "",
            isAdmin: false,
            adminMarkets: []
          });
        }
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn", style: { background: "#28a745" } }, editingUser ? "Update User" : "Create User"))))), showAddProductModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "600px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, editingProduct ? "Edit Product" : "Add New Product"), !editingProduct && /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "#f8f9fa",
      padding: "15px",
      borderRadius: "8px",
      marginBottom: "20px",
      border: "1px solid #e9ecef"
    } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "10px", color: "#495057", fontSize: "14px" } }, "\u{1F517} Import din URL (Op\u021Bional)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "url",
        className: "form-input",
        placeholder: "https://example.com/product-page",
        value: importUrl,
        onChange: (e) => setImportUrl(e.target.value),
        style: { flex: "1 1 300px", minWidth: "250px", padding: "10px", fontSize: "14px" }
      }
    ), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: importLanguage,
        onChange: (e) => setImportLanguage(e.target.value),
        style: { width: "100px" }
      },
      /* @__PURE__ */ React.createElement("option", { value: "en" }, "\u{1F1EC}\u{1F1E7} EN"),
      /* @__PURE__ */ React.createElement("option", { value: "ro" }, "\u{1F1F7}\u{1F1F4} RO"),
      /* @__PURE__ */ React.createElement("option", { value: "de" }, "\u{1F1E9}\u{1F1EA} DE"),
      /* @__PURE__ */ React.createElement("option", { value: "fr" }, "\u{1F1EB}\u{1F1F7} FR"),
      /* @__PURE__ */ React.createElement("option", { value: "it" }, "\u{1F1EE}\u{1F1F9} IT"),
      /* @__PURE__ */ React.createElement("option", { value: "es" }, "\u{1F1EA}\u{1F1F8} ES"),
      /* @__PURE__ */ React.createElement("option", { value: "zh" }, "\u{1F1E8}\u{1F1F3} ZH")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        onClick: handleImportFromUrl,
        disabled: importLoading || !importUrl.trim(),
        style: {
          backgroundColor: importLoading ? "#6c757d" : "#17a2b8",
          whiteSpace: "nowrap"
        }
      },
      importLoading ? "\u23F3" : "\u{1F4E5}",
      " Fetch"
    )), importedData && /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "#d4edda",
      padding: "10px",
      borderRadius: "6px",
      marginTop: "10px",
      fontSize: "13px"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold", marginBottom: "5px", color: "#155724" } }, "\u2705 Date extrase cu succes!"), importedData.imageUrl && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: importedData.imageUrl,
        alt: "Preview",
        style: {
          maxWidth: "100px",
          maxHeight: "100px",
          objectFit: "cover",
          borderRadius: "4px",
          border: "1px solid #ccc"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Titlu:"), " ", (_a = importedData.title) == null ? void 0 : _a.substring(0, 50), "..."), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Descriere:"), " ", (_b = importedData.description) == null ? void 0 : _b.substring(0, 80), "..."), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "10px", padding: "8px", backgroundColor: "#fff3cd", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: usageRightsConfirmed,
        onChange: (e) => setUsageRightsConfirmed(e.target.checked)
      }
    ), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", color: "#856404" } }, "\u26A0\uFE0F Confirm c\u0103 am dreptul de utilizare a acestor date \u0219i imagini"))))), /* @__PURE__ */ React.createElement("form", { onSubmit: handleProductSubmit }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "#e3f2fd",
      border: "1px solid #2196f3",
      borderRadius: "6px",
      padding: "12px",
      marginBottom: "15px",
      display: "flex",
      alignItems: "center",
      gap: "10px"
    } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "20px" } }, "\u{1F1EC}\u{1F1E7}"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "13px", color: "#1565c0" } }, /* @__PURE__ */ React.createElement("strong", null, "Limba de baz\u0103: Englez\u0103"), ' - Completa\u021Bi informa\u021Biile produsului \xEEn englez\u0103. Pentru alte limbi, folosi\u021Bi sec\u021Biunea "Traduceri" de mai jos.')), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Product Name (English)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: productFormData.name,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { name: e.target.value })),
        required: true,
        placeholder: "Enter product name in English"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Description (English)"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "form-input",
        value: productFormData.description,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { description: e.target.value })),
        rows: "3",
        placeholder: "Enter product description in English"
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Price"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        className: "form-input",
        value: productFormData.price,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { price: e.target.value })),
        required: true
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Compare At Price"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        className: "form-input",
        value: productFormData.compareAtPrice,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { compareAtPrice: e.target.value }))
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Category"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: productFormData.categoryId,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { categoryId: e.target.value }))
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Select Category"),
      categories.map((category) => /* @__PURE__ */ React.createElement("option", { key: category.id, value: category.id }, category.name))
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Supplier"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: productFormData.supplierId || "",
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { supplierId: e.target.value }))
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Select Supplier"),
      suppliers.map((supplier) => /* @__PURE__ */ React.createElement("option", { key: supplier.id, value: supplier.id }, supplier.name))
    ))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Image URL (Legacy - Optional)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: productFormData.imageUrl,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { imageUrl: e.target.value })),
        placeholder: "/r2/products/image.jpg or https://example.com/image.jpg"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Product Images"), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "image-upload-zone",
        style: {
          border: "2px dashed #ddd",
          borderRadius: "8px",
          padding: "20px",
          textAlign: "center",
          backgroundColor: "#f9f9f9",
          marginBottom: "15px"
        },
        onDragOver: (e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "#007bff";
          e.currentTarget.style.backgroundColor = "#e3f2fd";
        },
        onDragLeave: (e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "#ddd";
          e.currentTarget.style.backgroundColor = "#f9f9f9";
        },
        onDrop: (e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "#ddd";
          e.currentTarget.style.backgroundColor = "#f9f9f9";
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            uploadImages(files);
          }
        }
      },
      /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "file",
          multiple: true,
          accept: "image/*",
          onChange: (e) => {
            if (e.target.files && e.target.files.length > 0) {
              uploadImages(e.target.files);
            }
          },
          style: { display: "none" },
          id: "image-upload"
        }
      ),
      /* @__PURE__ */ React.createElement(
        "label",
        {
          htmlFor: "image-upload",
          style: {
            cursor: uploading ? "not-allowed" : "pointer",
            color: uploading ? "#666" : "#007bff",
            textDecoration: uploading ? "none" : "underline"
          }
        },
        uploading ? "Uploading..." : "Click to upload images or drag and drop"
      ),
      uploading && /* @__PURE__ */ React.createElement("div", { style: {
        width: "100%",
        height: "4px",
        backgroundColor: "#e0e0e0",
        borderRadius: "2px",
        margin: "10px 0",
        overflow: "hidden"
      } }, /* @__PURE__ */ React.createElement("div", { style: {
        height: "100%",
        backgroundColor: "#007bff",
        width: "100%",
        animation: "pulse 1.5s ease-in-out infinite"
      } })),
      /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "14px", marginTop: "10px" } }, "Maximum 10 images, 5MB each. Supported formats: JPG, PNG, GIF, WebP", uploadedImages.length > 0 && /* @__PURE__ */ React.createElement("span", { style: { display: "block", marginTop: "5px", color: "#28a745" } }, "(", uploadedImages.length, "/10 images uploaded)"))
    ), uploadedImages.length > 0 && /* @__PURE__ */ React.createElement("div", { style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
      gap: "10px",
      marginTop: "15px"
    } }, uploadedImages.map((image, index) => /* @__PURE__ */ React.createElement("div", { key: index, className: "image-thumbnail", style: {
      position: "relative",
      border: "1px solid #ddd",
      borderRadius: "8px",
      overflow: "hidden",
      backgroundColor: "#fff"
    } }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: getImageUrl(image),
        alt: `Product image ${index + 1}`,
        style: {
          width: "100%",
          height: "100px",
          objectFit: "cover",
          display: "block"
        }
      }
    ), /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      top: "5px",
      right: "5px",
      display: "flex",
      gap: "5px"
    } }, index === 0 && /* @__PURE__ */ React.createElement("span", { style: {
      backgroundColor: "#28a745",
      color: "white",
      padding: "2px 6px",
      borderRadius: "3px",
      fontSize: "10px",
      fontWeight: "bold"
    } }, "MAIN"), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => deleteImage(image, index),
        style: {
          backgroundColor: "#dc3545",
          color: "white",
          border: "none",
          borderRadius: "3px",
          padding: "2px 6px",
          fontSize: "10px",
          cursor: "pointer"
        }
      },
      "\xD7"
    )), index !== 0 && /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      bottom: "25px",
      left: "5px",
      right: "5px"
    } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setAsMainImage(index),
        style: {
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "3px",
          padding: "3px 6px",
          fontSize: "10px",
          cursor: "pointer",
          width: "100%"
        }
      },
      "Set as Main"
    )), /* @__PURE__ */ React.createElement("div", { style: {
      padding: "5px",
      fontSize: "11px",
      color: "#666",
      textAlign: "center",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    } }, typeof image === "string" ? image.split("/").pop() : image.originalName || image.filename || "Image"))))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Stock Quantity"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        className: "form-input",
        value: productFormData.stockQuantity,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { stockQuantity: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "VAT Percentage (%)"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: productFormData.vatPercentage || "21.00",
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { vatPercentage: e.target.value }))
      },
      /* @__PURE__ */ React.createElement("option", { value: "0.00" }, "0% (Reverse Charge)"),
      /* @__PURE__ */ React.createElement("option", { value: "5.00" }, "5% (Reduced VAT)"),
      /* @__PURE__ */ React.createElement("option", { value: "9.00" }, "9% (Reduced VAT)"),
      /* @__PURE__ */ React.createElement("option", { value: "21.00" }, "21% (Standard VAT)"),
      /* @__PURE__ */ React.createElement("option", { value: "21.00" }, "21% (Standard VAT - from 01.08.2025)"),
      /* @__PURE__ */ React.createElement("option", { value: "24.00" }, "24% (Luxury VAT)")
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Currency"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: productFormData.currency,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { currency: e.target.value }))
      },
      /* @__PURE__ */ React.createElement("option", { value: "EUR" }, "EUR (Euro)"),
      /* @__PURE__ */ React.createElement("option", { value: "RON" }, "RON (Romanian Leu)"),
      /* @__PURE__ */ React.createElement("option", { value: "USD" }, "USD (US Dollar)"),
      /* @__PURE__ */ React.createElement("option", { value: "GBP" }, "GBP (British Pound)")
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "VAT Value (%)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        className: "form-input",
        value: productFormData.vatValue,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { vatValue: e.target.value })),
        placeholder: "19.00"
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Product Code"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: productFormData.productCode,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { productCode: e.target.value })),
        placeholder: "ABC-123-DEF"
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "NC Code"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: productFormData.ncCode,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { ncCode: e.target.value })),
        placeholder: "1234.56.78"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "CPV Code"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: productFormData.cpvCode,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { cpvCode: e.target.value })),
        placeholder: "39000000-0"
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Status"), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: productFormData.status,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { status: e.target.value }))
      },
      /* @__PURE__ */ React.createElement("option", { value: "active" }, "Active"),
      /* @__PURE__ */ React.createElement("option", { value: "inactive" }, "Inactive"),
      /* @__PURE__ */ React.createElement("option", { value: "draft" }, "Draft"),
      /* @__PURE__ */ React.createElement("option", { value: "discontinued" }, "Discontinued")
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: productFormData.featured,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { featured: e.target.checked }))
      }
    ), "Featured Product"))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Prioritate afi\u0219are"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "0",
        className: "form-input",
        value: productFormData.priority || 0,
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { priority: parseInt(e.target.value) || 0 })),
        placeholder: "0"
      }
    ), /* @__PURE__ */ React.createElement("small", { style: { color: "#666", fontSize: "12px", marginTop: "4px", display: "block" } }, "1 = prioritate maxim\u0103 (afi\u0219at primul), 2, 3 = priorit\u0103\u021Bi mai mici, 0 = ordine implicit\u0103")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#333", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" } }, "\u{1F4E6} Logistics Details"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("label", { className: "form-label", style: { height: "40px", display: "flex", flexDirection: "column", justifyContent: "flex-start" } }, "Weight (kg)", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "#666", fontWeight: "normal" } }, "Min: 1kg, Increment: 1kg")), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        step: "1",
        className: "form-input",
        value: productFormData.weight || "",
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { weight: e.target.value })),
        placeholder: "e.g. 1, 2, 3..."
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("label", { className: "form-label", style: { height: "40px", display: "flex", flexDirection: "column", justifyContent: "flex-start" } }, "Length (cm)", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "transparent", fontWeight: "normal" } }, "placeholder")), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        min: "0",
        className: "form-input",
        value: productFormData.length || "",
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { length: e.target.value })),
        placeholder: "e.g. 30.00"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("label", { className: "form-label", style: { height: "40px", display: "flex", flexDirection: "column", justifyContent: "flex-start" } }, "Width (cm)", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "transparent", fontWeight: "normal" } }, "placeholder")), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        min: "0",
        className: "form-input",
        value: productFormData.width || "",
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { width: e.target.value })),
        placeholder: "e.g. 20.00"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("label", { className: "form-label", style: { height: "40px", display: "flex", flexDirection: "column", justifyContent: "flex-start" } }, "Height (cm)", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "transparent", fontWeight: "normal" } }, "placeholder")), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        min: "0",
        className: "form-input",
        value: productFormData.height || "",
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { height: e.target.value })),
        placeholder: "e.g. 15.00"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("label", { className: "form-label", style: { height: "40px", display: "flex", flexDirection: "column", justifyContent: "flex-start" } }, "Pieces per Package", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "#666", fontWeight: "normal" } }, "Max items per package")), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        step: "1",
        className: "form-input",
        value: productFormData.piecesPerPackage || "",
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { piecesPerPackage: e.target.value })),
        placeholder: "e.g. 6"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group", style: { display: "flex", flexDirection: "column" } }, /* @__PURE__ */ React.createElement("label", { className: "form-label", style: { height: "40px", display: "flex", flexDirection: "column", justifyContent: "flex-start" } }, "Cantitate (text liber)", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "#666", fontWeight: "normal" } }, "ex: 5L, 500g, 1 set")), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: productFormData.productQuantity || "",
        onChange: (e) => setProductFormData(__spreadProps(__spreadValues({}, productFormData), { productQuantity: e.target.value })),
        placeholder: "e.g. 5L, 500g, 1 set"
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "10px", fontSize: "12px", color: "#666" } }, "These dimensions and pieces per package are used for AWB generation and shipping calculations. Cantitate is displayed on the product page.")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#333", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" } }, "\u{1F4CB} Specifica\u021Bii produs", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", fontWeight: "normal", color: "#666" } }, "\u2014 caracteristici tehnice afi\u0219ate pe pagina produsului")), /* @__PURE__ */ React.createElement("div", null, (productFormData.specs || []).map((spec, idx) => /* @__PURE__ */ React.createElement("div", { key: idx, style: { display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        style: { flex: 1 },
        value: spec.label || "",
        onChange: (e) => {
          const newSpecs = [...productFormData.specs || []];
          newSpecs[idx] = __spreadProps(__spreadValues({}, newSpecs[idx]), { label: e.target.value });
          setProductFormData(__spreadProps(__spreadValues({}, productFormData), { specs: newSpecs }));
        },
        placeholder: "Denumire (ex: Dimensiunea etichetei)"
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        style: { flex: 1 },
        value: spec.value || "",
        onChange: (e) => {
          const newSpecs = [...productFormData.specs || []];
          newSpecs[idx] = __spreadProps(__spreadValues({}, newSpecs[idx]), { value: e.target.value });
          setProductFormData(__spreadProps(__spreadValues({}, productFormData), { specs: newSpecs }));
        },
        placeholder: "Valoare (ex: 38\xD758 mm)"
      }
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          const newSpecs = (productFormData.specs || []).filter((_, i) => i !== idx);
          setProductFormData(__spreadProps(__spreadValues({}, productFormData), { specs: newSpecs }));
        },
        style: { padding: "6px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", flexShrink: 0, fontSize: "16px", lineHeight: "1" },
        title: "\u0218terge specifica\u021Bie"
      },
      "\xD7"
    ))), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          const newSpecs = [...productFormData.specs || [], { label: "", value: "" }];
          setProductFormData(__spreadProps(__spreadValues({}, productFormData), { specs: newSpecs }));
        },
        style: { marginTop: "4px", padding: "6px 14px", backgroundColor: "#0d6efd", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }
      },
      "+ Adaug\u0103 specifica\u021Bie"
    )), (productFormData.specs || []).length === 0 && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "8px", fontSize: "12px", color: "#999" } }, "Nicio specifica\u021Bie ad\u0103ugat\u0103. Exemplu: Dimensiunea etichetei \u2192 38\xD758 mm")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "20px", padding: "15px", backgroundColor: "#fff8e1", borderRadius: "6px", border: "1px solid #ffd54f" } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#333", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" } }, "\u{1F3F7}\uFE0F Cumperi mai mult, pl\u0103te\u0219ti mai pu\u021Bin", /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", fontWeight: "normal", color: "#666" } }, "\u2014 discount automat pe cantitate")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", marginBottom: "6px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "#666", fontWeight: "600", paddingLeft: "2px" } }, "Cantitate minim\u0103 (buc)"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "#666", fontWeight: "600", paddingLeft: "2px" } }, "Discount (%)"), /* @__PURE__ */ React.createElement("span", null)), (productFormData.volumeDiscounts || []).map((tier, idx) => /* @__PURE__ */ React.createElement("div", { key: idx, style: { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", marginBottom: "8px", alignItems: "center" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        className: "form-input",
        min: "2",
        step: "1",
        value: tier.minQty || "",
        onChange: (e) => {
          const newTiers = [...productFormData.volumeDiscounts || []];
          newTiers[idx] = __spreadProps(__spreadValues({}, newTiers[idx]), { minQty: parseInt(e.target.value) || 0 });
          setProductFormData(__spreadProps(__spreadValues({}, productFormData), { volumeDiscounts: newTiers }));
        },
        placeholder: "ex: 5"
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        className: "form-input",
        min: "1",
        max: "99",
        step: "1",
        value: tier.discountPercent || "",
        onChange: (e) => {
          const newTiers = [...productFormData.volumeDiscounts || []];
          newTiers[idx] = __spreadProps(__spreadValues({}, newTiers[idx]), { discountPercent: parseFloat(e.target.value) || 0 });
          setProductFormData(__spreadProps(__spreadValues({}, productFormData), { volumeDiscounts: newTiers }));
        },
        placeholder: "ex: 10"
      }
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          const newTiers = (productFormData.volumeDiscounts || []).filter((_, i) => i !== idx);
          setProductFormData(__spreadProps(__spreadValues({}, productFormData), { volumeDiscounts: newTiers }));
        },
        style: { padding: "6px 12px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px", lineHeight: "1" },
        title: "\u0218terge treapt\u0103"
      },
      "\xD7"
    ))), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          const newTiers = [...productFormData.volumeDiscounts || [], { minQty: "", discountPercent: "" }];
          setProductFormData(__spreadProps(__spreadValues({}, productFormData), { volumeDiscounts: newTiers }));
        },
        style: { marginTop: "4px", padding: "6px 14px", backgroundColor: "#e6a817", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }
      },
      "+ Adaug\u0103 treapt\u0103 discount"
    )), (productFormData.volumeDiscounts || []).length === 0 && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "8px", fontSize: "12px", color: "#999" } }, "Nicio treapt\u0103 definit\u0103. Exemplu: de la 5 buc \u2192 10% discount, de la 10 buc \u2192 20% discount")), editingProduct && /* @__PURE__ */ React.createElement(
      MarketPricesSection,
      {
        editingProduct,
        editingProductMarkets,
        token,
        fetchProductMarkets
      }
    ), /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "#f0f7ff",
      padding: "15px",
      borderRadius: "8px",
      marginTop: "20px",
      border: "1px solid #b3d4fc"
    } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "15px", color: "#1976d2", fontSize: "14px" } }, "\u{1F30D} Traduceri Produs (", productTranslations.length, ")"), !editingProduct && /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "#fff3cd",
      border: "1px solid #ffc107",
      borderRadius: "6px",
      padding: "12px",
      marginBottom: "15px",
      fontSize: "13px",
      color: "#856404"
    } }, "\u26A0\uFE0F Salveaz\u0103 produsul mai \xEEnt\xE2i pentru a putea ad\u0103uga traduceri."), editingProduct && /* @__PURE__ */ React.createElement(React.Fragment, null, productTranslations.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "15px" } }, productTranslations.map((translation) => /* @__PURE__ */ React.createElement("div", { key: translation.id, style: {
      backgroundColor: "#fff",
      padding: "10px 12px",
      borderRadius: "4px",
      marginBottom: "8px",
      border: (editingTranslation == null ? void 0 : editingTranslation.id) === translation.id ? "2px solid #1976d2" : "1px solid #e0e0e0"
    } }, (editingTranslation == null ? void 0 : editingTranslation.id) === translation.id ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: {
      backgroundColor: "#1976d2",
      color: "#fff",
      padding: "4px 10px",
      borderRadius: "4px",
      fontSize: "12px",
      textTransform: "uppercase"
    } }, editingTranslation.language), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        value: editingTranslation.name,
        onChange: (e) => setEditingTranslation(__spreadProps(__spreadValues({}, editingTranslation), { name: e.target.value })),
        style: { flex: 1, fontSize: "13px" },
        placeholder: "Name"
      }
    )), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "form-input",
        value: editingTranslation.description || "",
        onChange: (e) => setEditingTranslation(__spreadProps(__spreadValues({}, editingTranslation), { description: e.target.value })),
        rows: "2",
        style: { marginBottom: "8px", fontSize: "13px" },
        placeholder: "Description"
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "8px" } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn", onClick: handleUpdateTranslation, style: { backgroundColor: "#28a745", fontSize: "12px" } }, "\u2713 Save"), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn", onClick: () => setEditingTranslation(null), style: { backgroundColor: "#6c757d", fontSize: "12px" } }, "\u2715 Cancel"))) : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: {
      backgroundColor: "#1976d2",
      color: "#fff",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: "11px",
      marginRight: "10px",
      textTransform: "uppercase"
    } }, translation.language), /* @__PURE__ */ React.createElement("strong", null, translation.name), translation.sourceUrl && /* @__PURE__ */ React.createElement("a", { href: translation.sourceUrl, target: "_blank", style: { marginLeft: "8px", fontSize: "11px" } }, "\u{1F517}")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "5px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setEditingTranslation(__spreadValues({}, translation)),
        style: { background: "none", border: "none", color: "#1976d2", cursor: "pointer", fontSize: "14px" }
      },
      "\u270F\uFE0F"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => handleDeleteTranslation(translation.id),
        style: { background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: "14px" }
      },
      "\u{1F5D1}\uFE0F"
    )))))), /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "#fff",
      padding: "12px",
      borderRadius: "6px",
      border: "1px dashed #1976d2"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "13px", fontWeight: "bold", marginBottom: "10px", color: "#1976d2" } }, "\u2795 Adaug\u0103 traducere"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "100px 1fr", gap: "10px", marginBottom: "10px" } }, /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "form-input",
        value: newTranslation.language,
        onChange: (e) => setNewTranslation(__spreadProps(__spreadValues({}, newTranslation), { language: e.target.value })),
        style: { fontSize: "13px" }
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Limb\u0103"),
      /* @__PURE__ */ React.createElement("option", { value: "ro" }, "\u{1F1F7}\u{1F1F4} Rom\xE2n\u0103"),
      /* @__PURE__ */ React.createElement("option", { value: "de" }, "\u{1F1E9}\u{1F1EA} Deutsch"),
      /* @__PURE__ */ React.createElement("option", { value: "fr" }, "\u{1F1EB}\u{1F1F7} Fran\xE7ais"),
      /* @__PURE__ */ React.createElement("option", { value: "it" }, "\u{1F1EE}\u{1F1F9} Italiano"),
      /* @__PURE__ */ React.createElement("option", { value: "es" }, "\u{1F1EA}\u{1F1F8} Espa\xF1ol"),
      /* @__PURE__ */ React.createElement("option", { value: "zh" }, "\u{1F1E8}\u{1F1F3} \u4E2D\u6587")
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        className: "form-input",
        placeholder: "Nume produs tradus",
        value: newTranslation.name,
        onChange: (e) => setNewTranslation(__spreadProps(__spreadValues({}, newTranslation), { name: e.target.value })),
        style: { fontSize: "13px" }
      }
    )), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "form-input",
        placeholder: "Descriere tradus\u0103 (op\u021Bional)",
        value: newTranslation.description,
        onChange: (e) => setNewTranslation(__spreadProps(__spreadValues({}, newTranslation), { description: e.target.value })),
        rows: "2",
        style: { marginBottom: "10px", fontSize: "13px" }
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "url",
        className: "form-input",
        placeholder: "URL surs\u0103 (op\u021Bional)",
        value: newTranslation.sourceUrl,
        onChange: (e) => setNewTranslation(__spreadProps(__spreadValues({}, newTranslation), { sourceUrl: e.target.value })),
        style: { flex: 1, fontSize: "13px" }
      }
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        onClick: () => handleAddTranslation(editingProduct.id),
        disabled: !newTranslation.language || !newTranslation.name,
        style: {
          backgroundColor: newTranslation.language && newTranslation.name ? "#28a745" : "#ccc",
          whiteSpace: "nowrap",
          fontSize: "13px"
        }
      },
      "\u2795 Adaug\u0103"
    ))))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowAddProductModal(false);
          setEditingProduct(null);
          setProductFormData({
            name: "",
            description: "",
            price: "",
            compareAtPrice: "",
            categoryId: "",
            supplierId: "",
            imageUrl: "",
            stockQuantity: "",
            featured: false,
            vatValue: "",
            vatPercentage: "21.00",
            currency: "RON",
            productCode: "",
            ncCode: "",
            cpvCode: "",
            status: "active",
            images: [],
            weight: "",
            length: "",
            width: "",
            height: "",
            piecesPerPackage: "",
            productQuantity: "",
            specs: [],
            volumeDiscounts: [],
            priority: 0
          });
          setUploadedImages([]);
          setImportUrl("");
          setImportedData(null);
          setUsageRightsConfirmed(false);
          setProductTranslations([]);
          setNewTranslation({ language: "", name: "", description: "", sourceUrl: "" });
          setEditingTranslation(null);
        }
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn", style: { background: "#28a745" } }, editingProduct ? "Update Product" : "Create Product"))))), showBulkModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "600px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, bulkOperation === "status" ? "\u{1F504} Bulk Status Update" : "\u{1F6E0}\uFE0F Bulk Order Tools"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: "20px", color: "#666" } }, "Selected ", selectedOrders.length, " orders for bulk operation."), bulkOperation === "status" && /* @__PURE__ */ React.createElement(BulkStatusComponent, null), bulkOperation === "tools" && /* @__PURE__ */ React.createElement(BulkToolsComponent, null), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "20px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowBulkModal(false);
          setBulkOperation("");
          setBulkResults(null);
        }
      },
      "Cancel"
    )))), showProductBulkModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "600px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "\u{1F4E6} Product Bulk Operations"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: "20px", color: "#666" } }, "Selected ", selectedProducts.length, " products for bulk operation."), /* @__PURE__ */ React.createElement(ProductBulkOperationsComponent, null), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "20px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowProductBulkModal(false);
          setProductBulkOperation("");
        }
      },
      "Cancel"
    )))), statusChangeOrderId && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1100
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "25px",
      borderRadius: "8px",
      width: "350px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
    } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "15px", color: "#333" } }, "\u{1F504} Update Status \u2014 Order #", statusChangeOrderId), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: statusChangeValue,
        onChange: (e) => setStatusChangeValue(e.target.value),
        style: {
          width: "100%",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #ced4da",
          fontSize: "14px",
          marginBottom: "15px"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "pending" }, "Pending"),
      /* @__PURE__ */ React.createElement("option", { value: "processing" }, "Processing"),
      /* @__PURE__ */ React.createElement("option", { value: "in_delivery" }, "In Delivery (\xCEn curs de livrare)"),
      /* @__PURE__ */ React.createElement("option", { value: "delivered" }, "Delivered (Livrat)"),
      /* @__PURE__ */ React.createElement("option", { value: "cancelled" }, "Cancelled (Anulat)")
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d", padding: "8px 16px" },
        onClick: () => {
          setStatusChangeOrderId(null);
          setStatusChangeValue("");
        }
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#28a745", padding: "8px 16px" },
        onClick: async () => {
          const result = await updateOrderStatus(statusChangeOrderId, statusChangeValue);
          if (result.success) {
            alert(`Order #${statusChangeOrderId} status updated to "${statusChangeValue}"`);
            if (selectedOrder && selectedOrder.id === statusChangeOrderId) {
              setSelectedOrder(__spreadProps(__spreadValues({}, selectedOrder), { status: statusChangeValue }));
            }
          } else {
            alert("Error: " + (result.message || "Unknown error"));
          }
          setStatusChangeOrderId(null);
          setStatusChangeValue("");
        }
      },
      "\u2705 Confirm"
    )))), showOrderDetails && selectedOrder && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "800px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "\u{1F4CB} Order Details - #", selectedOrder.id), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "15px", background: "#f8f9fa", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "Order Information"), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Order ID:"), " #", selectedOrder.id), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Status:"), " ", /* @__PURE__ */ React.createElement("span", { style: {
      padding: "4px 8px",
      borderRadius: "4px",
      backgroundColor: selectedOrder.status === "pending" ? "#fff3cd" : selectedOrder.status === "accepted" ? "#d1ecf1" : selectedOrder.status === "processing" ? "#cce5ff" : selectedOrder.status === "shipped" ? "#d4edda" : selectedOrder.status === "in_delivery" ? "#d4f4f4" : selectedOrder.status === "delivered" ? "#d4edda" : selectedOrder.status === "cancelled" ? "#f8d7da" : "#e2e3e5",
      color: selectedOrder.status === "pending" ? "#856404" : selectedOrder.status === "accepted" ? "#0c5460" : selectedOrder.status === "processing" ? "#0056b3" : selectedOrder.status === "shipped" ? "#155724" : selectedOrder.status === "in_delivery" ? "#0e7c7b" : selectedOrder.status === "delivered" ? "#155724" : selectedOrder.status === "cancelled" ? "#721c24" : "#383d41"
    } }, selectedOrder.status === "in_delivery" ? "In Delivery" : selectedOrder.status)), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Payment Method:"), " ", (() => {
      const pm = selectedOrder.paymentMethod;
      if (pm === "cash_on_delivery" || pm === "cod" || pm === "cash") return "Ramburs (plata la livrare)";
      if (pm === "card" || pm === "viva") return "Card online";
      return pm;
    })()), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Payment Status:"), " ", /* @__PURE__ */ React.createElement("span", { style: {
      padding: "3px 8px",
      borderRadius: "4px",
      fontSize: "13px",
      backgroundColor: (() => {
        const pm = selectedOrder.paymentMethod;
        if (pm === "cash_on_delivery" || pm === "cod" || pm === "cash") return "#fff3cd";
        return selectedOrder.paymentStatus === "paid" ? "#d4edda" : "#f8d7da";
      })(),
      color: (() => {
        const pm = selectedOrder.paymentMethod;
        if (pm === "cash_on_delivery" || pm === "cod" || pm === "cash") return "#856404";
        return selectedOrder.paymentStatus === "paid" ? "#155724" : "#721c24";
      })()
    } }, (() => {
      const pm = selectedOrder.paymentMethod;
      if (pm === "cash_on_delivery" || pm === "cod" || pm === "cash") return "Ramburs / Numerar";
      return selectedOrder.paymentStatus === "paid" ? "Pl\u0103tit \u2713" : selectedOrder.paymentStatus || "Nepl\u0103tit";
    })())), (() => {
      const sc = parseFloat(selectedOrder.shippingCost || "0");
      const total = parseFloat(selectedOrder.totalAmount || "0");
      const discount = parseFloat(selectedOrder.discountAmount || "0");
      const subtotal = (total - sc + discount).toFixed(2);
      return /* @__PURE__ */ React.createElement("div", { style: { marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #dee2e6" } }, /* @__PURE__ */ React.createElement("p", { style: { margin: "4px 0" } }, /* @__PURE__ */ React.createElement("strong", null, "Subtotal:"), " ", subtotal, " lei"), discount > 0 && selectedOrder.voucherCode && /* @__PURE__ */ React.createElement("p", { style: { margin: "4px 0", color: "#28a745" } }, /* @__PURE__ */ React.createElement("strong", null, "Discount voucher ", selectedOrder.voucherCode, ":"), " -", discount.toFixed(2), " lei"), /* @__PURE__ */ React.createElement("p", { style: { margin: "4px 0" } }, /* @__PURE__ */ React.createElement("strong", null, "Transport:"), " ", sc > 0 ? sc.toFixed(2) + " lei" : /* @__PURE__ */ React.createElement("span", { style: { color: "#28a745" } }, "Gratuit")), /* @__PURE__ */ React.createElement("p", { style: { margin: "6px 0 0", fontSize: "15px", fontWeight: "bold", borderTop: "1px solid #dee2e6", paddingTop: "6px" } }, /* @__PURE__ */ React.createElement("strong", null, "Total:"), " ", total.toFixed(2), " lei"));
    })(), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Created:"), " ", new Date(selectedOrder.createdAt).toLocaleString()), selectedOrder.awbNumber && !selectedOrder.awbNumber.includes("-API") && !selectedOrder.awbNumber.includes("-MANUAL-") && /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "AWB:"), " ", /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "monospace", background: "#e9ecef", padding: "2px 6px", borderRadius: "3px" } }, selectedOrder.awbNumber)), selectedOrder.invoiceNumber && /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Factur\u0103:"), " ", selectedOrder.invoiceNumber)), /* @__PURE__ */ React.createElement("div", { style: { padding: "15px", background: "#f8f9fa", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "Customer Information"), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Name:"), " ", selectedOrder.shippingAddress.firstName, " ", selectedOrder.shippingAddress.lastName), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Email:"), " ", selectedOrder.shippingAddress.email || "\u2014"), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Phone:"), " ", selectedOrder.shippingAddress.phone || "\u2014"), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "User ID:"), " #", selectedOrder.userId || "Guest"))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "15px", background: "#f8f9fa", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "Shipping Address"), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, selectedOrder.shippingAddress.firstName, " ", selectedOrder.shippingAddress.lastName)), /* @__PURE__ */ React.createElement("p", null, selectedOrder.shippingAddress.address), /* @__PURE__ */ React.createElement("p", null, selectedOrder.shippingAddress.city, selectedOrder.shippingAddress.county ? `, ${selectedOrder.shippingAddress.county}` : "", selectedOrder.shippingAddress.state ? `, ${selectedOrder.shippingAddress.state}` : ""), /* @__PURE__ */ React.createElement("p", null, selectedOrder.shippingAddress.zipCode, " ", selectedOrder.shippingAddress.country), selectedOrder.shippingAddress.phone && /* @__PURE__ */ React.createElement("p", null, "\u{1F4DE} ", selectedOrder.shippingAddress.phone)), /* @__PURE__ */ React.createElement("div", { style: { padding: "15px", background: "#f8f9fa", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "Billing Address / Facturare"), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, selectedOrder.billingAddress.firstName, " ", selectedOrder.billingAddress.lastName)), selectedOrder.billingAddress.companyName && /* @__PURE__ */ React.createElement("p", { style: { color: "#0056b3" } }, "\u{1F3E2} ", selectedOrder.billingAddress.companyName), selectedOrder.billingAddress.vatNumber && /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "CUI:"), " ", selectedOrder.billingAddress.vatNumber), selectedOrder.billingAddress.regCom && /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Reg. Com.:"), " ", selectedOrder.billingAddress.regCom), /* @__PURE__ */ React.createElement("p", null, selectedOrder.billingAddress.address), /* @__PURE__ */ React.createElement("p", null, selectedOrder.billingAddress.city, selectedOrder.billingAddress.county ? `, ${selectedOrder.billingAddress.county}` : "", selectedOrder.billingAddress.state ? `, ${selectedOrder.billingAddress.state}` : ""), /* @__PURE__ */ React.createElement("p", null, selectedOrder.billingAddress.zipCode, " ", selectedOrder.billingAddress.country), selectedOrder.billingAddress.phone && /* @__PURE__ */ React.createElement("p", null, "\u{1F4DE} ", selectedOrder.billingAddress.phone))), /* @__PURE__ */ React.createElement("div", { style: { padding: "15px", background: "#f8f9fa", borderRadius: "6px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px" } }, "Order Items"), /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#e9ecef" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "10px", textAlign: "left", borderBottom: "1px solid #dee2e6" } }, "Product"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px", textAlign: "left", borderBottom: "1px solid #dee2e6" } }, "Quantity"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px", textAlign: "left", borderBottom: "1px solid #dee2e6" } }, "Price"), /* @__PURE__ */ React.createElement("th", { style: { padding: "10px", textAlign: "left", borderBottom: "1px solid #dee2e6" } }, "Total"))), /* @__PURE__ */ React.createElement("tbody", null, selectedOrder.items && selectedOrder.items.map((item, index) => /* @__PURE__ */ React.createElement("tr", { key: index, style: { borderBottom: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "10px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, item.product && item.product.imageUrl && /* @__PURE__ */ React.createElement(
      "img",
      {
        src: item.product.imageUrl,
        alt: item.product.name,
        style: { width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }
      }
    ), /* @__PURE__ */ React.createElement("span", null, item.product ? item.product.name : `Product ID: ${item.productId}`))), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px" } }, item.quantity), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px" } }, parseFloat(item.price).toFixed(2), " lei"), /* @__PURE__ */ React.createElement("td", { style: { padding: "10px", fontWeight: "bold" } }, parseFloat(item.totalPrice).toFixed(2), " lei"))))))), selectedOrder.notes && /* @__PURE__ */ React.createElement("div", { style: { padding: "15px", background: "#fff3cd", borderRadius: "6px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "10px" } }, "Order Notes"), /* @__PURE__ */ React.createElement("p", null, selectedOrder.notes)), /* @__PURE__ */ React.createElement("div", { style: { padding: "15px", background: "#f8f9fa", borderRadius: "6px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px" } }, "Order Tools"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#17a2b8", padding: "10px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" },
        onClick: async () => {
          const result = await performBulkOperation("shipping", [selectedOrder.id]);
          if (result.success) {
            alert(`Shipping label generated for Order #${selectedOrder.id}`);
          } else {
            alert("Error: " + result.message);
          }
        }
      },
      /* @__PURE__ */ React.createElement("span", null, "\u{1F4E6}"),
      /* @__PURE__ */ React.createElement("span", null, "Generate Shipping Label")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#ffc107", padding: "10px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" },
        onClick: () => {
          const message = prompt("Enter notification message for customer:");
          if (message) {
            performBulkOperation("notifications", [selectedOrder.id], { message }).then((result) => {
              if (result.success) {
                alert(`Notification sent to customer for Order #${selectedOrder.id}`);
              } else {
                alert("Error: " + result.message);
              }
            });
          }
        }
      },
      /* @__PURE__ */ React.createElement("span", null, "\u{1F4E7}"),
      /* @__PURE__ */ React.createElement("span", null, "Send Notification")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#dc3545", padding: "10px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" },
        onClick: () => {
          if (confirm(`Are you sure you want to process a refund for Order #${selectedOrder.id}? This action cannot be undone.`)) {
            performBulkOperation("refunds", [selectedOrder.id]).then((result) => {
              if (result.success) {
                alert(`Refund processed for Order #${selectedOrder.id}`);
              } else {
                alert("Error: " + result.message);
              }
            });
          }
        }
      },
      /* @__PURE__ */ React.createElement("span", null, "\u{1F4B8}"),
      /* @__PURE__ */ React.createElement("span", null, "Process Refund")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#28a745", padding: "10px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" },
        onClick: () => {
          const csvContent = `Order ID,Customer,Status,Amount (lei),Date
${selectedOrder.id},${selectedOrder.shippingAddress.firstName} ${selectedOrder.shippingAddress.lastName},${selectedOrder.status},${selectedOrder.totalAmount},${new Date(selectedOrder.createdAt).toLocaleDateString()}`;
          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `order_${selectedOrder.id}_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
          alert(`Order #${selectedOrder.id} exported to CSV`);
        }
      },
      /* @__PURE__ */ React.createElement("span", null, "\u{1F4CA}"),
      /* @__PURE__ */ React.createElement("span", null, "Export to CSV")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6f42c1", padding: "10px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" },
        onClick: () => {
          setStatusChangeOrderId(selectedOrder.id);
          setStatusChangeValue(selectedOrder.status);
        }
      },
      /* @__PURE__ */ React.createElement("span", null, "\u270F\uFE0F"),
      /* @__PURE__ */ React.createElement("span", null, "Update Status")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#fd7e14", padding: "10px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" },
        onClick: () => {
          const pm = selectedOrder.paymentMethod;
          const isCOD = pm === "cash_on_delivery" || pm === "cod" || pm === "cash";
          const invoice = `
INVOICE - Order #${selectedOrder.id}
========================================
Customer: ${selectedOrder.shippingAddress.firstName} ${selectedOrder.shippingAddress.lastName}
Email: ${selectedOrder.shippingAddress.email || "\u2014"}
Phone: ${selectedOrder.shippingAddress.phone || "\u2014"}
Date: ${new Date(selectedOrder.createdAt).toLocaleDateString()}
Status: ${selectedOrder.status}
Payment Method: ${isCOD ? "Ramburs (plata la livrare)" : pm === "card" || pm === "viva" ? "Card online" : pm}
Payment Status: ${isCOD ? "Ramburs / Numerar" : selectedOrder.paymentStatus === "paid" ? "Platit" : selectedOrder.paymentStatus || "Neplatit"}
${selectedOrder.awbNumber && !selectedOrder.awbNumber.includes("-API") && !selectedOrder.awbNumber.includes("-MANUAL-") ? "AWB: " + selectedOrder.awbNumber : ""}${selectedOrder.invoiceNumber ? "\nFactura: " + selectedOrder.invoiceNumber : ""}

SHIPPING ADDRESS:
${selectedOrder.shippingAddress.firstName} ${selectedOrder.shippingAddress.lastName}
${selectedOrder.shippingAddress.address}
${selectedOrder.shippingAddress.city}${selectedOrder.shippingAddress.county ? ", " + selectedOrder.shippingAddress.county : ""} ${selectedOrder.shippingAddress.zipCode}
${selectedOrder.shippingAddress.country}

BILLING:
${selectedOrder.billingAddress.firstName} ${selectedOrder.billingAddress.lastName}
${selectedOrder.billingAddress.companyName ? "Company: " + selectedOrder.billingAddress.companyName : ""}${selectedOrder.billingAddress.vatNumber ? "\nCUI: " + selectedOrder.billingAddress.vatNumber : ""}
${selectedOrder.billingAddress.address}
${selectedOrder.billingAddress.city}${selectedOrder.billingAddress.county ? ", " + selectedOrder.billingAddress.county : ""} ${selectedOrder.billingAddress.zipCode}
${selectedOrder.billingAddress.country}

ITEMS:
${selectedOrder.items ? selectedOrder.items.map((item) => `${item.quantity}x ${item.product ? item.product.name : "Product ID: " + item.productId} - ${parseFloat(item.price).toFixed(2)} lei x${item.quantity} = ${parseFloat(item.totalPrice).toFixed(2)} lei`).join("\n") : "No items"}
${selectedOrder.discountAmount && parseFloat(selectedOrder.discountAmount) > 0 && selectedOrder.voucherCode ? "\nDiscount voucher " + selectedOrder.voucherCode + ": -" + parseFloat(selectedOrder.discountAmount).toFixed(2) + " lei" : ""}${selectedOrder.shippingCost && parseFloat(selectedOrder.shippingCost) > 0 ? "\nTransport: " + parseFloat(selectedOrder.shippingCost).toFixed(2) + " lei" : ""}
TOTAL: ${parseFloat(selectedOrder.totalAmount).toFixed(2)} lei
========================================
                          `;
          const blob = new Blob([invoice], { type: "text/plain" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `invoice_${selectedOrder.id}.txt`;
          a.click();
          window.URL.revokeObjectURL(url);
          alert(`Invoice for Order #${selectedOrder.id} downloaded`);
        }
      },
      /* @__PURE__ */ React.createElement("span", null, "\u{1F4C4}"),
      /* @__PURE__ */ React.createElement("span", null, "Download Invoice")
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowOrderDetails(false);
          setSelectedOrder(null);
        }
      },
      "Close"
    )))), showOrderTools && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "600px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "\u{1F6E0}\uFE0F Order Tools"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: "20px", color: "#666" } }, "Selected ", selectedOrders.length, " orders for advanced operations."), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "15px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#17a2b8", padding: "15px", display: "flex", alignItems: "center", gap: "10px" },
        onClick: async () => {
          const result = await performBulkOperation("shipping", selectedOrders);
          if (result.success) {
            alert(`Shipping labels generated for ${selectedOrders.length} orders`);
            setShowOrderTools(false);
            setSelectedOrders([]);
          } else {
            alert("Error: " + result.message);
          }
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: "20px" } }, "\u{1F4E6}"),
      /* @__PURE__ */ React.createElement("div", { style: { textAlign: "left" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold" } }, "Generate Shipping Labels"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.8" } }, "Create shipping labels for selected orders"))
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#ffc107", padding: "15px", display: "flex", alignItems: "center", gap: "10px" },
        onClick: () => {
          const message = prompt("Enter notification message for customers:");
          if (message) {
            performBulkOperation("notifications", selectedOrders, { message }).then((result) => {
              if (result.success) {
                alert(`Notifications sent to ${selectedOrders.length} customers`);
                setShowOrderTools(false);
                setSelectedOrders([]);
              } else {
                alert("Error: " + result.message);
              }
            });
          }
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: "20px" } }, "\u{1F4E7}"),
      /* @__PURE__ */ React.createElement("div", { style: { textAlign: "left" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold" } }, "Send Notifications"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.8" } }, "Send email notifications to customers"))
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#dc3545", padding: "15px", display: "flex", alignItems: "center", gap: "10px" },
        onClick: () => {
          if (confirm("Are you sure you want to process refunds for the selected orders? This action cannot be undone.")) {
            performBulkOperation("refunds", selectedOrders).then((result) => {
              if (result.success) {
                alert(`Refunds processed for ${selectedOrders.length} orders`);
                setShowOrderTools(false);
                setSelectedOrders([]);
              } else {
                alert("Error: " + result.message);
              }
            });
          }
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: "20px" } }, "\u{1F4B8}"),
      /* @__PURE__ */ React.createElement("div", { style: { textAlign: "left" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold" } }, "Process Refunds"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.8" } }, "Issue refunds for selected orders"))
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#28a745", padding: "15px", display: "flex", alignItems: "center", gap: "10px" },
        onClick: () => {
          const escCsv = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
          const csvContent = `Order ID,Customer Name,Customer Email,Shipping Address,Payment Method,Status,Amount,Voucher Code,Discount Amount,Date
${selectedOrders.map((id) => {
            const order = filteredOrders.find((o) => o.id === id);
            const sa = order.shippingAddress || {};
            const customerName = [sa.firstName, sa.lastName].filter(Boolean).join(" ") || sa.name || "";
            const customerEmail = sa.email || "";
            const shippingAddress = [sa.address, sa.city, sa.county, sa.postalCode, sa.country].filter(Boolean).join(", ");
            const paymentMethod = order.paymentMethod || "";
            const voucherCode = order.voucherCode || "";
            const discountAmount = order.discountAmount ? parseFloat(order.discountAmount).toFixed(2) : "0.00";
            return `${order.id},${escCsv(customerName)},${escCsv(customerEmail)},${escCsv(shippingAddress)},${escCsv(paymentMethod)},${escCsv(order.status)},${order.totalAmount},${escCsv(voucherCode)},${discountAmount},${new Date(order.createdAt).toLocaleDateString()}`;
          }).join("\n")}`;
          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `orders_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
          alert(`Exported ${selectedOrders.length} orders to CSV`);
          setShowOrderTools(false);
          setSelectedOrders([]);
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: "20px" } }, "\u{1F4CA}"),
      /* @__PURE__ */ React.createElement("div", { style: { textAlign: "left" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: "bold" } }, "Export to CSV"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.8" } }, "Download order data as CSV file"))
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowOrderTools(false);
        }
      },
      "Cancel"
    )))), showEditSupplierModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "800px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, editingSupplier ? "\u270F\uFE0F Edit Supplier" : "\u2795 Add New Supplier"), /* @__PURE__ */ React.createElement("form", { onSubmit: handleSupplierSubmit }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Company Name *"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: supplierFormData.name,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { name: e.target.value })),
        required: true,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Email *"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "email",
        value: supplierFormData.email,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { email: e.target.value })),
        required: true,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Phone"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "tel",
        value: supplierFormData.phone,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { phone: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Contact Person"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: supplierFormData.contactPerson,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { contactPerson: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "20px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Address"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: supplierFormData.address,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { address: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginTop: "20px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "City"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: supplierFormData.city,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { city: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "State/Region"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: supplierFormData.state,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { state: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "ZIP Code"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: supplierFormData.zipCode,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { zipCode: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Country"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: supplierFormData.country,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { country: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginTop: "20px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Integration Type"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: supplierFormData.integrationType,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { integrationType: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "email" }, "Email"),
      /* @__PURE__ */ React.createElement("option", { value: "api" }, "API"),
      /* @__PURE__ */ React.createElement("option", { value: "manual" }, "Manual")
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Status"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: supplierFormData.isActive,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { isActive: e.target.value === "true" })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "true" }, "Active"),
      /* @__PURE__ */ React.createElement("option", { value: "false" }, "Inactive")
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Pia\u021B\u0103"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: supplierFormData.marketCode || "ro",
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { marketCode: e.target.value })),
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "ro" }, "\u{1F1F7}\u{1F1F4} Rom\xE2nia (ro)"),
      /* @__PURE__ */ React.createElement("option", { value: "fr" }, "\u{1F1EB}\u{1F1F7} France (fr)"),
      /* @__PURE__ */ React.createElement("option", { value: "com" }, "\u{1F30D} International (com)")
    ))), supplierFormData.integrationType === "api" && /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginTop: "20px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "API Endpoint"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "url",
        value: supplierFormData.apiEndpoint,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { apiEndpoint: e.target.value })),
        placeholder: "https://api.supplier.com/v1/",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "API Key"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "password",
        value: supplierFormData.apiKey,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { apiKey: e.target.value })),
        placeholder: "Enter API key",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "20px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold" } }, "Notes"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: supplierFormData.notes,
        onChange: (e) => setSupplierFormData(__spreadProps(__spreadValues({}, supplierFormData), { notes: e.target.value })),
        rows: "3",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px",
          resize: "vertical"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowEditSupplierModal(false);
          setEditingSupplier(null);
        }
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "submit",
        className: "btn",
        style: { background: editingSupplier ? "#007bff" : "#28a745" }
      },
      editingSupplier ? "\u2705 Update Supplier" : "\u2795 Create Supplier"
    ))))), showViewSupplierModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "1000px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "\u{1F441}\uFE0F Supplier Details - ", viewingSupplier == null ? void 0 : viewingSupplier.name), supplierDetails ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "30px" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "10px", color: "#495057" } }, "Total Products"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "24px", fontWeight: "bold", color: "#007bff", margin: "0" } }, supplierDetails.totalProducts)), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "10px", color: "#495057" } }, "Total Orders"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "24px", fontWeight: "bold", color: "#28a745", margin: "0" } }, supplierDetails.totalOrders)), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "10px", color: "#495057" } }, "Total Revenue"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "24px", fontWeight: "bold", color: "#28a745", margin: "0" } }, "\u20AC", supplierDetails.totalRevenue.toFixed(2))), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "6px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "10px", color: "#495057" } }, "Status"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "18px", fontWeight: "bold", color: supplierDetails.supplier.isActive ? "#28a745" : "#dc3545", margin: "0" } }, supplierDetails.supplier.isActive ? "Active" : "Inactive"))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "30px" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "15px", color: "#333", borderBottom: "2px solid #007bff", paddingBottom: "5px" } }, "\u{1F4DE} Contact Information"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Email:"), " ", supplierDetails.supplier.email || "Not provided"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Phone:"), " ", supplierDetails.supplier.phone || "Not provided"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Contact Person:"), " ", supplierDetails.supplier.contactPerson || "Not provided"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Integration Type:"), " ", supplierDetails.supplier.integrationType || "Email")), supplierDetails.supplier.address && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "15px" } }, /* @__PURE__ */ React.createElement("strong", null, "Address:"), /* @__PURE__ */ React.createElement("br", null), supplierDetails.supplier.address, /* @__PURE__ */ React.createElement("br", null), supplierDetails.supplier.city && `${supplierDetails.supplier.city}, `, supplierDetails.supplier.state && `${supplierDetails.supplier.state} `, supplierDetails.supplier.zipCode, /* @__PURE__ */ React.createElement("br", null), supplierDetails.supplier.country), supplierDetails.supplier.notes && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "15px" } }, /* @__PURE__ */ React.createElement("strong", null, "Notes:"), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("div", { style: { padding: "10px", background: "#f8f9fa", borderRadius: "4px", marginTop: "5px" } }, supplierDetails.supplier.notes))), supplierDetails.supplier.integrationType === "api" && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "30px" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "15px", color: "#333", borderBottom: "2px solid #17a2b8", paddingBottom: "5px" } }, "\u{1F517} API Integration"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "API Endpoint:"), " ", supplierDetails.supplier.apiEndpoint || "Not configured"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "API Key:"), " ", supplierDetails.supplier.apiKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "Not configured"))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "30px" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "15px", color: "#333", borderBottom: "2px solid #ffc107", paddingBottom: "5px" } }, "\u{1F4E6} Associated Products (", supplierDetails.totalProducts, ")"), supplierDetails.products.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#f5f5f5" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" } }, "Product"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" } }, "Price"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" } }, "Stock"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" } }, "Status"))), /* @__PURE__ */ React.createElement("tbody", null, supplierDetails.products.slice(0, 5).map((product, index) => /* @__PURE__ */ React.createElement("tr", { key: index, style: { borderBottom: "1px solid #eee" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, product.name), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, "\u20AC", product.price), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, product.stockQuantity), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: {
      padding: "2px 6px",
      borderRadius: "3px",
      backgroundColor: product.status === "active" ? "#d4edda" : "#f8d7da",
      color: product.status === "active" ? "#155724" : "#721c24",
      fontSize: "12px"
    } }, product.status)))))), supplierDetails.products.length > 5 && /* @__PURE__ */ React.createElement("p", { style: { textAlign: "center", marginTop: "10px", color: "#666" } }, "... and ", supplierDetails.products.length - 5, " more products")) : /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontStyle: "italic" } }, "No products associated with this supplier")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "30px" } }, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "15px", color: "#333", borderBottom: "2px solid #28a745", paddingBottom: "5px" } }, "\u{1F4CB} Recent Orders (", supplierDetails.totalOrders, ")"), supplierDetails.orders.length > 0 ? /* @__PURE__ */ React.createElement("div", { style: { overflowX: "auto" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { backgroundColor: "#f5f5f5" } }, /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" } }, "Order ID"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" } }, "Date"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" } }, "Amount"), /* @__PURE__ */ React.createElement("th", { style: { padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd" } }, "Status"))), /* @__PURE__ */ React.createElement("tbody", null, supplierDetails.orders.slice(0, 5).map((order, index) => /* @__PURE__ */ React.createElement("tr", { key: index, style: { borderBottom: "1px solid #eee" } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, "#", order.id), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, new Date(order.createdAt).toLocaleDateString()), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, "\u20AC", order.totalAmount), /* @__PURE__ */ React.createElement("td", { style: { padding: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: {
      padding: "2px 6px",
      borderRadius: "3px",
      backgroundColor: order.status === "delivered" ? "#d4edda" : order.status === "pending" ? "#fff3cd" : "#f8d7da",
      color: order.status === "delivered" ? "#155724" : order.status === "pending" ? "#856404" : "#721c24",
      fontSize: "12px"
    } }, order.status)))))), supplierDetails.orders.length > 5 && /* @__PURE__ */ React.createElement("p", { style: { textAlign: "center", marginTop: "10px", color: "#666" } }, "... and ", supplierDetails.orders.length - 5, " more orders")) : /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontStyle: "italic" } }, "No orders from this supplier yet"))) : /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "40px" } }, /* @__PURE__ */ React.createElement("div", { className: "loading" }), /* @__PURE__ */ React.createElement("p", { style: { marginTop: "20px", color: "#666" } }, "Loading supplier details...")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowViewSupplierModal(false);
          setViewingSupplier(null);
          setSupplierDetails(null);
        }
      },
      "Close"
    )))), showSupplierBulkModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "600px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "\u{1F504} Bulk Operations - ", selectedSuppliers.length, " supplier(s) selected"), supplierBulkOperation === "menu" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", { style: { marginBottom: "20px" } }, "Choose Operation"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "15px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: {
          background: "#28a745",
          padding: "20px",
          textAlign: "left",
          height: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start"
        },
        onClick: () => setSupplierBulkOperation("activate")
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold", marginBottom: "8px" } }, "\u2705 Activate Suppliers"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.9" } }, "Enable order processing and API sync")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: {
          background: "#ffc107",
          padding: "20px",
          textAlign: "left",
          height: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start"
        },
        onClick: () => setSupplierBulkOperation("deactivate")
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold", marginBottom: "8px" } }, "\u274C Deactivate Suppliers"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.9" } }, "Disable order processing and pause sync")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: {
          background: "#17a2b8",
          padding: "20px",
          textAlign: "left",
          height: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start"
        },
        onClick: () => setSupplierBulkOperation("sync-prices")
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold", marginBottom: "8px" } }, "\u{1F4B0} Sync Prices"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.9" } }, "Fetch latest prices from supplier APIs")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: {
          background: "#fd7e14",
          padding: "20px",
          textAlign: "left",
          height: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start"
        },
        onClick: () => setSupplierBulkOperation("sync-stock")
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold", marginBottom: "8px" } }, "\u{1F4CA} Sync Stock"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.9" } }, "Update inventory levels from suppliers")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: {
          background: "#6c757d",
          padding: "20px",
          textAlign: "left",
          height: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start"
        },
        onClick: () => setSupplierBulkOperation("status")
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold", marginBottom: "8px" } }, "\u{1F504} Update Status"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.9" } }, "Change supplier status with options")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: {
          background: "#dc3545",
          padding: "20px",
          textAlign: "left",
          height: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start"
        },
        onClick: () => setSupplierBulkOperation("delete")
      },
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold", marginBottom: "8px" } }, "\u{1F5D1}\uFE0F Delete Suppliers"),
      /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", opacity: "0.9" } }, "Permanently remove suppliers (requires confirmation)")
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setShowSupplierBulkModal(false)
      },
      "Cancel"
    ))), supplierBulkOperation === "status" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", null, "Update Status"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "15px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", color: "#555" } }, "New Status:"), /* @__PURE__ */ React.createElement(
      "select",
      {
        id: "bulkStatus",
        style: { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" },
        defaultValue: "active"
      },
      /* @__PURE__ */ React.createElement("option", { value: "active" }, "Active"),
      /* @__PURE__ */ React.createElement("option", { value: "inactive" }, "Inactive")
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setSupplierBulkOperation("menu")
      },
      "\u2190 Back to Menu"
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setShowSupplierBulkModal(false)
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#28a745" },
        onClick: async () => {
          const status = document.getElementById("bulkStatus").value;
          await performSupplierBulkOperation("status", { status });
        }
      },
      "Update Status"
    )))), supplierBulkOperation === "activate" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", null, "Activate Suppliers"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: "20px", color: "#666" } }, "Are you sure you want to activate ", selectedSuppliers.length, " supplier(s)? This will:"), /* @__PURE__ */ React.createElement("ul", { style: { marginBottom: "20px", paddingLeft: "20px" } }, /* @__PURE__ */ React.createElement("li", null, "Enable order processing from these suppliers"), /* @__PURE__ */ React.createElement("li", null, "Allow API synchronization (if configured)"), /* @__PURE__ */ React.createElement("li", null, "Include suppliers in bulk operations"), /* @__PURE__ */ React.createElement("li", null, "Enable automatic notifications")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setSupplierBulkOperation("menu")
      },
      "\u2190 Back to Menu"
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setShowSupplierBulkModal(false)
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#28a745" },
        onClick: async () => {
          await performSupplierBulkOperation("activate", {});
        }
      },
      "Activate Suppliers"
    )))), supplierBulkOperation === "deactivate" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", null, "Deactivate Suppliers"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: "20px", color: "#666" } }, "Are you sure you want to deactivate ", selectedSuppliers.length, " supplier(s)? This will:"), /* @__PURE__ */ React.createElement("ul", { style: { marginBottom: "20px", paddingLeft: "20px" } }, /* @__PURE__ */ React.createElement("li", null, "Disable order processing from these suppliers"), /* @__PURE__ */ React.createElement("li", null, "Pause API synchronization"), /* @__PURE__ */ React.createElement("li", null, "Exclude suppliers from bulk operations"), /* @__PURE__ */ React.createElement("li", null, "Stop automatic notifications")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setSupplierBulkOperation("menu")
      },
      "\u2190 Back to Menu"
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setShowSupplierBulkModal(false)
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#ffc107" },
        onClick: async () => {
          await performSupplierBulkOperation("deactivate", {});
        }
      },
      "Deactivate Suppliers"
    )))), supplierBulkOperation === "sync-prices" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", null, "Sync Prices"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: "20px", color: "#666" } }, "Sync product prices from ", selectedSuppliers.length, " supplier(s). This will:"), /* @__PURE__ */ React.createElement("ul", { style: { marginBottom: "20px", paddingLeft: "20px" } }, /* @__PURE__ */ React.createElement("li", null, "Fetch latest prices from supplier APIs"), /* @__PURE__ */ React.createElement("li", null, "Update all associated products"), /* @__PURE__ */ React.createElement("li", null, "Maintain price history"), /* @__PURE__ */ React.createElement("li", null, "Send notifications on significant changes")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setSupplierBulkOperation("menu")
      },
      "\u2190 Back to Menu"
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setShowSupplierBulkModal(false)
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#17a2b8" },
        onClick: async () => {
          await performSupplierBulkOperation("sync-prices", {});
        }
      },
      "Sync Prices"
    )))), supplierBulkOperation === "sync-stock" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", null, "Sync Stock"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: "20px", color: "#666" } }, "Sync stock levels from ", selectedSuppliers.length, " supplier(s). This will:"), /* @__PURE__ */ React.createElement("ul", { style: { marginBottom: "20px", paddingLeft: "20px" } }, /* @__PURE__ */ React.createElement("li", null, "Fetch current inventory levels"), /* @__PURE__ */ React.createElement("li", null, "Update product availability"), /* @__PURE__ */ React.createElement("li", null, "Trigger low stock alerts"), /* @__PURE__ */ React.createElement("li", null, "Update order processing status")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setSupplierBulkOperation("menu")
      },
      "\u2190 Back to Menu"
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setShowSupplierBulkModal(false)
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#ffc107" },
        onClick: async () => {
          await performSupplierBulkOperation("sync-stock", {});
        }
      },
      "Sync Stock"
    )))), supplierBulkOperation === "delete" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", { style: { color: "#dc3545" } }, "\u26A0\uFE0F Delete Suppliers"), /* @__PURE__ */ React.createElement("p", { style: { marginBottom: "20px", color: "#666" } }, /* @__PURE__ */ React.createElement("strong", null, "WARNING:"), " This action cannot be undone. Deleting ", selectedSuppliers.length, " supplier(s) will:"), /* @__PURE__ */ React.createElement("ul", { style: { marginBottom: "20px", paddingLeft: "20px", color: "#dc3545" } }, /* @__PURE__ */ React.createElement("li", null, "Permanently remove supplier records"), /* @__PURE__ */ React.createElement("li", null, "Unlink all associated products"), /* @__PURE__ */ React.createElement("li", null, "Remove API integrations"), /* @__PURE__ */ React.createElement("li", null, "Delete order history connections")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", color: "#555" } }, 'Type "DELETE" to confirm:'), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        id: "deleteConfirmation",
        style: { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" },
        placeholder: "Type DELETE to confirm"
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setSupplierBulkOperation("menu")
      },
      "\u2190 Back to Menu"
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setShowSupplierBulkModal(false)
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "btn",
        style: { background: "#dc3545" },
        onClick: async () => {
          const confirmation = document.getElementById("deleteConfirmation").value;
          if (confirmation === "DELETE") {
            await performSupplierBulkOperation("delete", {});
          } else {
            alert('Please type "DELETE" to confirm this action');
          }
        }
      },
      "Delete Suppliers"
    )))))), (showAddCategoryModal || editingCategory) && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "500px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, editingCategory ? "Edit Category" : "Add New Category"), /* @__PURE__ */ React.createElement("form", { onSubmit: async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const categoryData = {
        name: formData.get("name"),
        description: formData.get("description"),
        slug: formData.get("slug") || formData.get("name").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        marketCode: formData.get("marketCode") || "ro"
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
        alert("Error: " + result.message);
      }
    } }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Category Name"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "name",
        className: "form-input",
        defaultValue: (editingCategory == null ? void 0 : editingCategory.name) || "",
        required: true
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Description"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        name: "description",
        className: "form-input",
        defaultValue: (editingCategory == null ? void 0 : editingCategory.description) || "",
        rows: 3,
        placeholder: "Brief description of the category"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Slug (URL-friendly name)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "slug",
        className: "form-input",
        defaultValue: (editingCategory == null ? void 0 : editingCategory.slug) || "",
        placeholder: "auto-generated-from-name"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Pia\u021B\u0103"), /* @__PURE__ */ React.createElement("select", { name: "marketCode", className: "form-input", defaultValue: (editingCategory == null ? void 0 : editingCategory.marketCode) || (selectedMarketTab && selectedMarketTab !== "all" ? selectedMarketTab : "ro") }, /* @__PURE__ */ React.createElement("option", { value: "ro" }, "\u{1F1F7}\u{1F1F4} Rom\xE2nia (ro)"), /* @__PURE__ */ React.createElement("option", { value: "fr" }, "\u{1F1EB}\u{1F1F7} France (fr)"), /* @__PURE__ */ React.createElement("option", { value: "com" }, "\u{1F30D} International (com)"))), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { className: "form-label" }, "Category Image"), (editingCategory == null ? void 0 : editingCategory.imageUrl) && /* @__PURE__ */ React.createElement("div", { style: {
      marginBottom: "10px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      padding: "10px",
      backgroundColor: "#f9f9f9"
    } }, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 8px 0", fontWeight: "bold" } }, "Current Image:"), /* @__PURE__ */ React.createElement(
      "img",
      {
        src: editingCategory.imageUrl,
        alt: "Current category image",
        style: {
          maxWidth: "100%",
          height: "120px",
          objectFit: "cover",
          borderRadius: "4px",
          border: "1px solid #ddd"
        }
      }
    )), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "image-upload-zone",
        style: {
          border: "2px dashed #ddd",
          borderRadius: "8px",
          padding: "20px",
          textAlign: "center",
          backgroundColor: "#f9f9f9",
          cursor: "pointer"
        },
        onClick: () => document.getElementById("category-image-upload").click()
      },
      /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "file",
          accept: "image/*",
          id: "category-image-upload",
          style: { display: "none" },
          onChange: async (e) => {
            var _a2;
            console.log("File input changed, files:", e.target.files);
            if (e.target.files && e.target.files[0] && editingCategory) {
              const file = e.target.files[0];
              console.log("Starting category image upload for category:", editingCategory.id);
              console.log("File selected:", file.name, file.size, file.type);
              try {
                console.log("Checking if uploadCategoryImage function exists:", typeof window.uploadCategoryImage);
                if (typeof window.uploadCategoryImage !== "function") {
                  console.error("uploadCategoryImage function not found on window object");
                  alert("Upload function not available. Please refresh the page.");
                  return;
                }
                const uploadResult = await window.uploadCategoryImage(editingCategory.id, file);
                console.log("Upload result:", uploadResult);
                if (uploadResult.success) {
                  alert("Image uploaded successfully!");
                  const updatedCategory = __spreadProps(__spreadValues({}, editingCategory), {
                    imageUrl: uploadResult.imageUrl
                  });
                  setEditingCategory(updatedCategory);
                  window.fetchCategories(setCategories);
                } else {
                  alert("Error uploading image: " + uploadResult.message);
                }
              } catch (error2) {
                console.error("Upload error:", error2);
                alert("Upload failed: Network error");
              }
            } else {
              console.log("Upload conditions not met:", {
                hasFiles: !!e.target.files,
                fileCount: (_a2 = e.target.files) == null ? void 0 : _a2.length,
                hasEditingCategory: !!editingCategory
              });
            }
          }
        }
      ),
      /* @__PURE__ */ React.createElement("p", { style: { margin: "0", color: "#666" } }, "\u{1F4F7} Click to upload new image"),
      /* @__PURE__ */ React.createElement("p", { style: { margin: "5px 0 0 0", fontSize: "12px", color: "#999" } }, "JPG, PNG, GIF up to 5MB")
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowAddCategoryModal(false);
          setEditingCategory(null);
        }
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn", style: { background: "#28a745" } }, editingCategory ? "Update Category" : "Create Category"))))), showHomepageConfigModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "800px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "\u{1F3E0} Configure Homepage Categories"), /* @__PURE__ */ React.createElement("div", { style: {
      padding: "15px",
      background: "#e3f2fd",
      border: "1px solid #2196f3",
      borderRadius: "6px",
      marginBottom: "20px"
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#1976d2", fontSize: "16px" } }, "\u2139\uFE0F"), /* @__PURE__ */ React.createElement("strong", { style: { color: "#1976d2" } }, "Important:")), /* @__PURE__ */ React.createElement("p", { style: { color: "#1976d2", fontSize: "14px", margin: "0" } }, "You can select categories for both sections while configuring. When you save, categories that appear in both sections will be kept in Main Top and automatically removed from Shop Categories.")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "30px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "30px" } }, /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: {
      display: "inline-block",
      width: "20px",
      height: "20px",
      backgroundColor: "#007bff",
      borderRadius: "50%",
      color: "white",
      textAlign: "center",
      lineHeight: "20px",
      fontSize: "12px"
    } }, "1"), "Main Top Categories (Max 4)"), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "14px", marginBottom: "15px" } }, "These categories appear in the hero section of your homepage. Select up to 4 most important categories."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px" } }, homepageConfig.mainTop.map((categoryId, index) => {
      const category = categories.find((c) => c.id === categoryId);
      return category ? /* @__PURE__ */ React.createElement("div", { key: categoryId, style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: "#007bff",
        color: "white",
        borderRadius: "4px"
      } }, /* @__PURE__ */ React.createElement("span", null, category.name), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", opacity: "0.8" } }, "#", index + 1), /* @__PURE__ */ React.createElement(
        "button",
        {
          style: {
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "white",
            cursor: "pointer",
            borderRadius: "3px",
            padding: "2px 6px",
            fontSize: "12px"
          },
          onClick: () => {
            const newMainTop = homepageConfig.mainTop.filter((id) => id !== categoryId);
            setHomepageConfig(__spreadProps(__spreadValues({}, homepageConfig), { mainTop: newMainTop }));
          }
        },
        "\u2715"
      ))) : null;
    })), homepageConfig.mainTop.length < 4 && /* @__PURE__ */ React.createElement(
      "select",
      {
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px",
          backgroundColor: "white"
        },
        onChange: (e) => {
          const categoryId = parseInt(e.target.value);
          if (categoryId && !homepageConfig.mainTop.includes(categoryId)) {
            setHomepageConfig(__spreadProps(__spreadValues({}, homepageConfig), {
              mainTop: [...homepageConfig.mainTop, categoryId]
            }));
          }
          e.target.value = "";
        },
        value: ""
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "+ Add Category to Main Top"),
      categories.map((category) => /* @__PURE__ */ React.createElement("option", { key: category.id, value: category.id }, category.name, homepageConfig.mainTop.includes(category.id) && " (Already selected)", homepageConfig.mainShop.includes(category.id) && " (In Shop section)"))
    )), /* @__PURE__ */ React.createElement("div", { style: { padding: "20px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #dee2e6" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#333", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: {
      display: "inline-block",
      width: "20px",
      height: "20px",
      backgroundColor: "#28a745",
      borderRadius: "50%",
      color: "white",
      textAlign: "center",
      lineHeight: "20px",
      fontSize: "12px"
    } }, "2"), "Shop Categories (Max 3)"), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "14px", marginBottom: "15px" } }, 'These categories appear in the "Shop by Category" section. Select up to 3 popular categories.'), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px" } }, homepageConfig.mainShop.map((categoryId, index) => {
      const category = categories.find((c) => c.id === categoryId);
      return category ? /* @__PURE__ */ React.createElement("div", { key: categoryId, style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: "#28a745",
        color: "white",
        borderRadius: "4px"
      } }, /* @__PURE__ */ React.createElement("span", null, category.name), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px", opacity: "0.8" } }, "#", index + 1), /* @__PURE__ */ React.createElement(
        "button",
        {
          style: {
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "white",
            cursor: "pointer",
            borderRadius: "3px",
            padding: "2px 6px",
            fontSize: "12px"
          },
          onClick: () => {
            const newMainShop = homepageConfig.mainShop.filter((id) => id !== categoryId);
            setHomepageConfig(__spreadProps(__spreadValues({}, homepageConfig), { mainShop: newMainShop }));
          }
        },
        "\u2715"
      ))) : null;
    })), homepageConfig.mainShop.length < 3 && /* @__PURE__ */ React.createElement(
      "select",
      {
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px",
          backgroundColor: "white"
        },
        onChange: (e) => {
          const categoryId = parseInt(e.target.value);
          if (categoryId && !homepageConfig.mainShop.includes(categoryId)) {
            setHomepageConfig(__spreadProps(__spreadValues({}, homepageConfig), {
              mainShop: [...homepageConfig.mainShop, categoryId]
            }));
          }
          e.target.value = "";
        },
        value: ""
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "+ Add Category to Shop Section"),
      categories.map((category) => /* @__PURE__ */ React.createElement("option", { key: category.id, value: category.id }, category.name, homepageConfig.mainShop.includes(category.id) && " (Already selected)", homepageConfig.mainTop.includes(category.id) && " (In Main Top)"))
    )))), /* @__PURE__ */ React.createElement("div", { style: {
      padding: "15px",
      background: "#e9ecef",
      borderRadius: "6px",
      marginBottom: "20px"
    } }, /* @__PURE__ */ React.createElement("h5", { style: { color: "#495057", marginBottom: "10px" } }, "Current Configuration Summary"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "#007bff" } }, "Main Top (", homepageConfig.mainTop.length, "/4):"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "14px", color: "#666" } }, homepageConfig.mainTop.length > 0 ? homepageConfig.mainTop.map((id) => {
      var _a2;
      return (_a2 = categories.find((c) => c.id === id)) == null ? void 0 : _a2.name;
    }).join(", ") : "None selected")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "#28a745" } }, "Shop Section (", homepageConfig.mainShop.length, "/3):"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "14px", color: "#666" } }, homepageConfig.mainShop.length > 0 ? homepageConfig.mainShop.map((id) => {
      var _a2;
      return (_a2 = categories.find((c) => c.id === id)) == null ? void 0 : _a2.name;
    }).join(", ") : "None selected")))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowHomepageConfigModal(false);
          setHomepageConfig({ mainTop: [], mainShop: [] });
        }
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#28a745" },
        onClick: async () => {
          try {
            const response = await fetch("/admin/api/categories/bulk/homepage", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                mainTopCategories: homepageConfig.mainTop,
                mainShopCategories: homepageConfig.mainShop
              })
            });
            const data = await response.json();
            if (response.ok) {
              alert("Homepage categories updated successfully!");
              setShowHomepageConfigModal(false);
              setHomepageConfig({ mainTop: [], mainShop: [] });
              fetchCategories();
            } else {
              alert("Error: " + data.message);
            }
          } catch (err) {
            alert("Network error: " + err.message);
          }
        }
      },
      "\u{1F4BE} Save Configuration"
    )))), showCompanySettingsModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      background: "white",
      borderRadius: "8px",
      padding: "30px",
      maxWidth: "600px",
      width: "90%",
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "\u{1F3E2} Edit Company Settings"), /* @__PURE__ */ React.createElement("form", { onSubmit: async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const settingsData = {
        name: formData.get("name"),
        email: formData.get("email"),
        logisticsEmail: formData.get("logisticsEmail"),
        phone: formData.get("phone"),
        address: formData.get("address"),
        city: formData.get("city"),
        state: formData.get("state"),
        zipCode: formData.get("zipCode"),
        country: formData.get("country"),
        contactPerson: formData.get("contactPerson"),
        website: formData.get("website"),
        vatNumber: formData.get("vatNumber"),
        registrationNumber: formData.get("registrationNumber"),
        bankName: formData.get("bankName"),
        iban: formData.get("iban"),
        defaultCurrency: formData.get("defaultCurrency"),
        defaultVatPercentage: formData.get("defaultVatPercentage"),
        reverseChargeVat: formData.get("reverseChargeVat"),
        freeShippingThreshold: formData.get("freeShippingThreshold"),
        standardShippingCost: formData.get("standardShippingCost"),
        description: formData.get("description"),
        marketContacts: companySettings.marketContacts || { ro: {}, fr: {}, com: {} }
      };
      const result = await updateCompanySettings(settingsData);
      if (result.success) {
        alert("\u2705 Company settings updated successfully!");
        setCompanySettings(settingsData);
        setShowCompanySettingsModal(false);
      } else {
        alert(`\u274C Error updating company settings: ${result.message}`);
      }
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Company Name *"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "name",
        defaultValue: companySettings.name,
        required: true,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Email *"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "email",
        name: "email",
        defaultValue: companySettings.email,
        required: true,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Logistics Email"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "email",
        name: "logisticsEmail",
        defaultValue: companySettings.logisticsEmail,
        placeholder: "Email for order notifications",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Phone"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "phone",
        defaultValue: companySettings.phone,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Website"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "url",
        name: "website",
        defaultValue: companySettings.website,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Street Address"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "address",
        defaultValue: companySettings.address,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "City"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "city",
        defaultValue: companySettings.city,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "State/Province"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "state",
        defaultValue: companySettings.state,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "ZIP/Postal Code"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "zipCode",
        defaultValue: companySettings.zipCode,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Country"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "country",
        defaultValue: companySettings.country,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Contact Person"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "contactPerson",
        defaultValue: companySettings.contactPerson,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "VAT Number"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "vatNumber",
        defaultValue: companySettings.vatNumber,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Registration Number"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "registrationNumber",
        defaultValue: companySettings.registrationNumber,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Bank Name"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "bankName",
        defaultValue: companySettings.bankName,
        placeholder: "Banca Comercial\u0103 Rom\xE2n\u0103",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "IBAN"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        name: "iban",
        defaultValue: companySettings.iban,
        placeholder: "RO49 AAAA 1B31 0075 9384 0000",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px", padding: "15px", background: "#f0f8ff", border: "1px solid #007bff", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#007bff", marginBottom: "15px", fontSize: "16px" } }, "\u{1F4B0} Default Product Settings"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Default Currency"), /* @__PURE__ */ React.createElement(
      "select",
      {
        name: "defaultCurrency",
        defaultValue: companySettings.defaultCurrency || "EUR",
        onChange: handleCurrencyChange,
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "EUR" }, "EUR (Euro)"),
      /* @__PURE__ */ React.createElement("option", { value: "RON" }, "RON (Romanian Leu)"),
      /* @__PURE__ */ React.createElement("option", { value: "USD" }, "USD (US Dollar)"),
      /* @__PURE__ */ React.createElement("option", { value: "GBP" }, "GBP (British Pound)")
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Default VAT %"), /* @__PURE__ */ React.createElement(
      "select",
      {
        name: "defaultVatPercentage",
        defaultValue: companySettings.defaultVatPercentage || "19.00",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "0.00" }, "0% (Reverse Charge)"),
      /* @__PURE__ */ React.createElement("option", { value: "5.00" }, "5% (Reduced VAT)"),
      /* @__PURE__ */ React.createElement("option", { value: "9.00" }, "9% (Reduced VAT)"),
      /* @__PURE__ */ React.createElement("option", { value: "21.00" }, "21% (Standard VAT)"),
      /* @__PURE__ */ React.createElement("option", { value: "21.00" }, "21% (Standard VAT - from 01.08.2025)"),
      /* @__PURE__ */ React.createElement("option", { value: "24.00" }, "24% (Luxury VAT)")
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Reverse Charge VAT %"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        name: "reverseChargeVat",
        defaultValue: companySettings.reverseChargeVat || "0.00",
        placeholder: "0.00",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { background: "#e3f2fd", padding: "20px", borderRadius: "6px", border: "1px solid #bbdefb", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#1976d2", marginBottom: "15px", borderBottom: "2px solid #2196f3", paddingBottom: "5px" } }, "\u{1F69A} Shipping Settings"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Free Shipping Threshold (", companySettings.defaultCurrency || "EUR", ")"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        name: "freeShippingThreshold",
        defaultValue: companySettings.freeShippingThreshold || "500.00",
        placeholder: "500.00",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    ), /* @__PURE__ */ React.createElement("small", { style: { color: "#666", fontSize: "12px" } }, "Orders above this amount get free shipping")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Standard Shipping Cost (", companySettings.defaultCurrency || "EUR", ")"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.01",
        name: "standardShippingCost",
        defaultValue: companySettings.standardShippingCost || "25.00",
        placeholder: "25.00",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px"
        }
      }
    ), /* @__PURE__ */ React.createElement("small", { style: { color: "#666", fontSize: "12px" } }, "Cost for orders below free shipping threshold")))), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "12px", color: "#666", marginTop: "10px", fontStyle: "italic" } }, "These values will be used as defaults when creating new products. You can still modify them per product.")), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "5px", fontWeight: "bold", color: "#333" } }, "Company Description"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        name: "description",
        defaultValue: companySettings.description,
        rows: "4",
        style: {
          width: "100%",
          padding: "8px",
          border: "1px solid #ddd",
          borderRadius: "4px",
          resize: "vertical"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px", padding: "15px", background: "#f0fff4", border: "1px solid #28a745", borderRadius: "6px" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#28a745", marginBottom: "15px", fontSize: "16px" } }, "\u{1F30D} Date de contact per pia\u021B\u0103"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "12px", color: "#555", marginBottom: "12px" } }, "Aceste date apar pe site-ul fiec\u0103rei pie\u021Be (Home footer, Privacy, Terms). Dac\u0103 un c\xE2mp e gol, se folosesc datele generale de mai sus."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "4px", marginBottom: "15px" } }, [{ key: "ro", label: "\u{1F1F7}\u{1F1F4} xhaccp.ro" }, { key: "fr", label: "\u{1F1EB}\u{1F1F7} xhaccp.fr" }, { key: "com", label: "\u{1F310} xhaccp.com" }].map((tab) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: tab.key,
        type: "button",
        onClick: () => setActiveMarketTab(tab.key),
        style: {
          padding: "6px 14px",
          borderRadius: "4px",
          border: "1px solid #28a745",
          cursor: "pointer",
          fontSize: "13px",
          background: activeMarketTab === tab.key ? "#28a745" : "white",
          color: activeMarketTab === tab.key ? "white" : "#28a745",
          fontWeight: activeMarketTab === tab.key ? "bold" : "normal"
        }
      },
      tab.label
    ))), ["ro", "fr", "com"].map((mkt) => activeMarketTab === mkt && /* @__PURE__ */ React.createElement("div", { key: mkt, style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } }, [
      { label: "Denumire firm\u0103", key: "name", type: "text" },
      { label: "Email contact", key: "email", type: "email" },
      { label: "Telefon", key: "phone", type: "text" },
      { label: "CUI / TVA", key: "vatNumber", type: "text" },
      { label: "Nr. Reg. Com.", key: "registrationNumber", type: "text" },
      { label: "Adres\u0103 strad\u0103", key: "address", type: "text" },
      { label: "Localitate", key: "city", type: "text" },
      { label: "Cod po\u0219tal", key: "zipCode", type: "text" },
      { label: "\u021Aar\u0103", key: "country", type: "text" }
    ].map((field) => {
      var _a2, _b2;
      return /* @__PURE__ */ React.createElement("div", { key: field.key }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: "bold", color: "#333" } }, field.label), /* @__PURE__ */ React.createElement(
        "input",
        {
          type: field.type,
          value: ((_b2 = (_a2 = companySettings.marketContacts) == null ? void 0 : _a2[mkt]) == null ? void 0 : _b2[field.key]) || "",
          onChange: (e) => setCompanySettings((prev) => {
            var _a3;
            return __spreadProps(__spreadValues({}, prev), {
              marketContacts: __spreadProps(__spreadValues({}, prev.marketContacts), {
                [mkt]: __spreadProps(__spreadValues({}, (_a3 = prev.marketContacts) == null ? void 0 : _a3[mkt]), { [field.key]: e.target.value })
              })
            });
          }),
          placeholder: `(implicit: ${field.key === "name" ? companySettings.name : field.key === "email" ? companySettings.email : field.key === "phone" ? companySettings.phone : "\u2014"})`,
          style: { width: "100%", padding: "7px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }
        }
      ));
    })))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => setShowCompanySettingsModal(false)
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "submit",
        className: "btn",
        style: { background: "#007bff" }
      },
      "\u{1F4BE} Save Settings"
    ))))), showExcelImportModal && /* @__PURE__ */ React.createElement("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      backgroundColor: "white",
      padding: "30px",
      borderRadius: "8px",
      width: "90%",
      maxWidth: "600px",
      maxHeight: "80vh",
      overflow: "auto"
    } }, /* @__PURE__ */ React.createElement("h3", { style: { marginBottom: "20px", color: "#333" } }, "\u{1F4E4} Import Products from Excel"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px", padding: "15px", background: "#e7f3ff", borderRadius: "6px", border: "1px solid #b8daff" } }, /* @__PURE__ */ React.createElement("h4", { style: { color: "#0c5460", marginBottom: "10px" } }, "\u{1F4CB} Import Instructions"), /* @__PURE__ */ React.createElement("ul", { style: { color: "#0c5460", margin: "0", paddingLeft: "20px" } }, /* @__PURE__ */ React.createElement("li", null, 'Download the Excel template first using the "Download Excel Template" button'), /* @__PURE__ */ React.createElement("li", null, "Fill in your product data following the template format"), /* @__PURE__ */ React.createElement("li", null, "Required fields: Product Name, Price, Stock Quantity, Category ID"), /* @__PURE__ */ React.createElement("li", null, "Optional fields: Description, Status, VAT %, Product Code, NC Code, CPV Code"), /* @__PURE__ */ React.createElement("li", null, "Category ID must match existing categories in the system"), /* @__PURE__ */ React.createElement("li", null, "Price should be in decimal format (e.g., 29.99)"))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", marginBottom: "10px", fontWeight: "bold", color: "#333" } }, "Select Excel File (.xlsx)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "file",
        accept: ".xlsx,.xls",
        onChange: (e) => setExcelFile(e.target.files[0]),
        style: {
          width: "100%",
          padding: "10px",
          border: "2px dashed #ddd",
          borderRadius: "6px",
          background: "#f8f9fa"
        }
      }
    ), excelFile && /* @__PURE__ */ React.createElement("p", { style: { marginTop: "8px", color: "#28a745", fontSize: "14px" } }, "\u{1F4C1} Selected: ", excelFile.name)), importResults && importResults.loading && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginBottom: "20px" } }, /* @__PURE__ */ React.createElement("div", { className: "loading" }), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", marginTop: "10px" } }, "Processing Excel file...")), importResults && !importResults.loading && /* @__PURE__ */ React.createElement("div", { style: {
      marginBottom: "20px",
      padding: "15px",
      borderRadius: "6px",
      background: importResults.success ? "#d4edda" : "#f8d7da",
      border: importResults.success ? "1px solid #c3e6cb" : "1px solid #f5c6cb"
    } }, /* @__PURE__ */ React.createElement("h4", { style: {
      color: importResults.success ? "#155724" : "#721c24",
      marginBottom: "10px"
    } }, importResults.success ? "\u2705 Import Results" : "\u274C Import Failed"), importResults.success ? /* @__PURE__ */ React.createElement("div", { style: { color: "#155724" } }, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Total processed:"), " ", importResults.total), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Successfully imported:"), " ", importResults.imported), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Errors:"), " ", ((_c = importResults.errors) == null ? void 0 : _c.length) || 0), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("strong", null, "Duplicates skipped:"), " ", ((_d = importResults.duplicates) == null ? void 0 : _d.length) || 0)) : /* @__PURE__ */ React.createElement("p", { style: { color: "#721c24" } }, importResults.message)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "space-between" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#28a745" },
        onClick: downloadExcelTemplate
      },
      "\u{1F4E5} Download Template"
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "10px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#6c757d" },
        onClick: () => {
          setShowExcelImportModal(false);
          setExcelFile(null);
          setImportResults(null);
        }
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "btn",
        style: { background: "#fd7e14" },
        onClick: () => importProductsFromExcel(excelFile),
        disabled: !excelFile || importResults && importResults.loading
      },
      "\u{1F4E4} Import Products"
    ))))));
  };
  return /* @__PURE__ */ React.createElement("div", { className: "container" }, /* @__PURE__ */ React.createElement("div", { className: "admin-header" }, /* @__PURE__ */ React.createElement("div", { className: "logo", onClick: () => setActiveView("dashboard"), style: { cursor: "pointer" } }, /* @__PURE__ */ React.createElement("img", { src: "/attached_assets/logo_xHACCP-S1_1772812623761.png", alt: "xHACCP Logo" }), /* @__PURE__ */ React.createElement("span", null, "xHACCP Admin")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "14px", color: "#666" } }, "Welcome, ", (admin == null ? void 0 : admin.firstName) || "Admin", adminIsSuperAdmin ? /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "6px", background: "#667eea", color: "white", fontSize: "11px", padding: "2px 7px", borderRadius: "10px", fontWeight: "600" } }, "Superadmin") : /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "6px", background: "#ff9800", color: "white", fontSize: "11px", padding: "2px 7px", borderRadius: "10px", fontWeight: "600" } }, ((admin == null ? void 0 : admin.adminMarkets) || []).map((m) => m.toUpperCase()).join(", "))), /* @__PURE__ */ React.createElement("button", { onClick: handleLogout, className: "btn btn-secondary", style: { padding: "8px 16px", fontSize: "14px", width: "auto" } }, "Logout"))), /* @__PURE__ */ React.createElement("div", { style: { background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", borderRadius: "12px", padding: "8px 12px", marginBottom: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", fontWeight: "600", color: "#555", marginRight: "4px" } }, "\u{1F30D} Marketplace:"), adminIsSuperAdmin && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSelectedMarketTab("all"),
      style: {
        padding: "5px 14px",
        borderRadius: "20px",
        border: "none",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "600",
        background: selectedMarketTab === "all" ? "linear-gradient(135deg,#667eea,#764ba2)" : "#f0f0f0",
        color: selectedMarketTab === "all" ? "white" : "#555",
        boxShadow: selectedMarketTab === "all" ? "0 2px 8px rgba(102,126,234,0.4)" : "none",
        transition: "all 0.2s"
      }
    },
    "\u{1F310} All"
  ), (adminIsSuperAdmin ? ["ro", "fr", "com"] : (admin == null ? void 0 : admin.adminMarkets) || []).map((mkt) => {
    const flags = { ro: "\u{1F1F7}\u{1F1F4}", fr: "\u{1F1EB}\u{1F1F7}", com: "\u{1F310}" };
    const labels = { ro: "Romania (.ro)", fr: "France (.fr)", com: "International (.com)" };
    const active = selectedMarketTab === mkt;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: mkt,
        onClick: () => setSelectedMarketTab(mkt),
        style: {
          padding: "5px 14px",
          borderRadius: "20px",
          border: "none",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "600",
          background: active ? "linear-gradient(135deg,#667eea,#764ba2)" : "#f0f0f0",
          color: active ? "white" : "#555",
          boxShadow: active ? "0 2px 8px rgba(102,126,234,0.4)" : "none",
          transition: "all 0.2s"
        }
      },
      flags[mkt] || "\u{1F310}",
      " ",
      labels[mkt] || mkt.toUpperCase()
    );
  })), /* @__PURE__ */ React.createElement("div", { className: "nav-tabs" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "dashboard" ? "active" : ""}`,
      onClick: () => handleViewChange("dashboard")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F4CA}"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Dashboard")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "orders" ? "active" : ""}`,
      onClick: () => handleViewChange("orders")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F4CB}"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Orders")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "users" ? "active" : ""}`,
      onClick: () => handleViewChange("users")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F465}"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Users")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "products" ? "active" : ""}`,
      onClick: () => handleViewChange("products")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F4E6}"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Products")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "categories" ? "active" : ""}`,
      onClick: () => handleViewChange("categories")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F4C1}"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Categories")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "suppliers" ? "active" : ""}`,
      onClick: () => handleViewChange("suppliers")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F3E2}"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Suppliers")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "company-settings" ? "active" : ""}`,
      onClick: () => handleViewChange("company-settings")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u2699\uFE0F"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Company Settings")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "vouchers" ? "active" : ""}`,
      onClick: () => handleViewChange("vouchers")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F39F}\uFE0F"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Vouchers")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "blog" ? "active" : ""}`,
      onClick: () => handleViewChange("blog")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F4DD}"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Blog AI")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-tab ${activeView === "markets" ? "active" : ""}`,
      onClick: () => handleViewChange("markets")
    },
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F30D}"),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "12px" } }, "Markets")
  )), /* @__PURE__ */ React.createElement("div", { className: "content-area" }, renderContent()), /* @__PURE__ */ React.createElement(ModalsComponent, { key: modalKey }), previewBlogPost && /* @__PURE__ */ React.createElement(
    "div",
    {
      style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9e3, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" },
      onClick: (e) => {
        if (e.target === e.currentTarget) setPreviewBlogPost(null);
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { background: "white", borderRadius: "12px", width: "100%", maxWidth: "760px", padding: "32px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", position: "relative" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setPreviewBlogPost(null),
        style: { position: "absolute", top: "16px", right: "16px", background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#666" }
      },
      "\u2715"
    ), previewBlogPost.imageUrl && /* @__PURE__ */ React.createElement(
      "img",
      {
        src: previewBlogPost.imageUrl,
        alt: previewBlogPost.title,
        style: { width: "100%", height: "240px", objectFit: "cover", borderRadius: "8px", marginBottom: "20px" }
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { background: "#e3f2fd", color: "#1565c0", padding: "3px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" } }, previewBlogPost.category), /* @__PURE__ */ React.createElement("span", { style: { background: "#f5f5f5", color: "#666", padding: "3px 12px", borderRadius: "20px", fontSize: "12px" } }, previewBlogPost.language === "ro" ? "\u{1F1F7}\u{1F1F4} Rom\xE2n\u0103" : "\u{1F1EC}\u{1F1E7} English"), previewBlogPost.readTimeMinutes && /* @__PURE__ */ React.createElement("span", { style: { background: "#f5f5f5", color: "#666", padding: "3px 12px", borderRadius: "20px", fontSize: "12px" } }, "\u23F1 ", previewBlogPost.readTimeMinutes, " min")), /* @__PURE__ */ React.createElement("h2", { style: { margin: "0 0 8px", fontSize: "24px", color: "#1a1a1a", lineHeight: "1.3" } }, previewBlogPost.title), /* @__PURE__ */ React.createElement("p", { style: { color: "#666", fontSize: "14px", margin: "0 0 20px", fontStyle: "italic" } }, previewBlogPost.excerpt), /* @__PURE__ */ React.createElement("hr", { style: { border: "none", borderTop: "1px solid #eee", margin: "0 0 20px" } }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "15px", lineHeight: "1.7", color: "#333", whiteSpace: "pre-wrap", maxHeight: "60vh", overflowY: "auto" } }, previewBlogPost.content), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "20px", textAlign: "right" } }, /* @__PURE__ */ React.createElement(
      "a",
      {
        href: "/blog/" + previewBlogPost.slug,
        target: "_blank",
        rel: "noopener",
        style: { display: "inline-block", background: "#0d6efd", color: "white", padding: "8px 20px", borderRadius: "6px", textDecoration: "none", fontSize: "14px" }
      },
      "Deschide pe site \u2192"
    )))
  ), editingBlogPost && /* @__PURE__ */ React.createElement(
    "div",
    {
      style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9e3, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" },
      onClick: (e) => {
        if (e.target === e.currentTarget) setEditingBlogPost(null);
      }
    },
    /* @__PURE__ */ React.createElement("div", { style: { background: "white", borderRadius: "12px", width: "100%", maxWidth: "800px", padding: "32px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", position: "relative" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setEditingBlogPost(null),
        style: { position: "absolute", top: "16px", right: "16px", background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#666" }
      },
      "\u2715"
    ), /* @__PURE__ */ React.createElement("h3", { style: { margin: "0 0 24px", fontSize: "20px", color: "#1a1a1a" } }, "\u270F\uFE0F Editeaz\u0103 articol"), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "16px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", fontWeight: "600", marginBottom: "6px", fontSize: "14px", color: "#495057" } }, "Titlu"), /* @__PURE__ */ React.createElement(
      "input",
      {
        value: blogEditForm.title,
        onChange: (e) => setBlogEditForm((f) => __spreadProps(__spreadValues({}, f), { title: e.target.value })),
        style: { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "16px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", fontWeight: "600", marginBottom: "6px", fontSize: "14px", color: "#495057" } }, "Categorie"), /* @__PURE__ */ React.createElement(
      "input",
      {
        value: blogEditForm.category,
        onChange: (e) => setBlogEditForm((f) => __spreadProps(__spreadValues({}, f), { category: e.target.value })),
        style: { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "16px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", fontWeight: "600", marginBottom: "6px", fontSize: "14px", color: "#495057" } }, "Rezumat (excerpt)"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: blogEditForm.excerpt,
        onChange: (e) => setBlogEditForm((f) => __spreadProps(__spreadValues({}, f), { excerpt: e.target.value })),
        rows: 3,
        style: { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "16px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", fontWeight: "600", marginBottom: "6px", fontSize: "14px", color: "#495057" } }, "URL Imagine"), /* @__PURE__ */ React.createElement(
      "input",
      {
        value: blogEditForm.imageUrl,
        onChange: (e) => setBlogEditForm((f) => __spreadProps(__spreadValues({}, f), { imageUrl: e.target.value })),
        placeholder: "https://images.unsplash.com/...",
        style: { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }
      }
    ), blogEditForm.imageUrl && /* @__PURE__ */ React.createElement(
      "img",
      {
        src: blogEditForm.imageUrl,
        alt: "preview",
        style: { marginTop: "8px", width: "100%", height: "160px", objectFit: "cover", borderRadius: "6px" }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "16px" } }, /* @__PURE__ */ React.createElement("label", { style: { display: "block", fontWeight: "600", marginBottom: "6px", fontSize: "14px", color: "#495057" } }, "Con\u021Binut (Markdown)"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: blogEditForm.content,
        onChange: (e) => setBlogEditForm((f) => __spreadProps(__spreadValues({}, f), { content: e.target.value })),
        rows: 18,
        style: { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setEditingBlogPost(null),
        style: { padding: "10px 24px", border: "1px solid #ced4da", borderRadius: "6px", background: "white", cursor: "pointer", fontSize: "14px" }
      },
      "Anuleaz\u0103"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: saveBlogPost,
        style: { padding: "10px 24px", border: "none", borderRadius: "6px", background: "#198754", color: "white", cursor: "pointer", fontSize: "14px", fontWeight: "600" }
      },
      "\u{1F4BE} Salveaz\u0103"
    )))
  ));
}
function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem("adminToken"));
  const [admin, setAdmin] = useState(() => {
    try {
      const savedAdmin = localStorage.getItem("adminUser");
      return savedAdmin ? JSON.parse(savedAdmin) : null;
    } catch (e) {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!(localStorage.getItem("adminToken") && localStorage.getItem("adminUser"))
  );
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (token && admin && !isAuthenticated) {
      setIsAuthenticated(true);
    } else if (!token || !admin) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      setIsAuthenticated(false);
    }
  }, [token, admin, isAuthenticated]);
  const handleLoginSuccess = (token2, admin2) => {
    setToken(token2);
    setAdmin(admin2);
    setIsAuthenticated(true);
  };
  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    setToken(null);
    setAdmin(null);
    setIsAuthenticated(false);
  };
  if (!isAuthenticated) {
    return /* @__PURE__ */ React.createElement(AdminLogin, { onLoginSuccess: handleLoginSuccess });
  }
  return /* @__PURE__ */ React.createElement(AdminDashboard, { token, admin, onLogout: handleLogout });
}
const root = ReactDOM.createRoot(document.getElementById("admin-root"));
root.render(/* @__PURE__ */ React.createElement(AdminApp, null));
