import { readFileSync, writeFileSync } from 'fs';

const file = 'admin-src/AdminApp.jsx';
let src = readFileSync(file, 'utf8');

// Helper: replace literal JSX text nodes safely
function r(from, to) {
  if (src.includes(from)) {
    src = src.split(from).join(to);
    return true;
  }
  console.warn('NOT FOUND:', JSON.stringify(from).slice(0, 80));
  return false;
}

/* ─────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────── */
r(`<div className="stat-label">Total Products</div>`, `<div className="stat-label">{t('stats.totalProducts')}</div>`);
r(`<div className="stat-label">Recent Orders</div>`, `<div className="stat-label">{t('stats.recentOrders')}</div>`);
r(`<h3 style={{marginBottom: '20px', color: '#333'}}>System Overview</h3>`, `<h3 style={{marginBottom: '20px', color: '#333'}}>{t('dashboard.systemOverview')}</h3>`);
r(
  `Welcome to the xHACCP Admin Panel. Here you can manage your e-commerce platform, \n                    view statistics, and monitor system performance. The dashboard shows real-time data \n                    from your PostgreSQL database.`,
  `{t('dashboard.welcomeText')}`
);
r(`<h4 style={{color: '#333', marginBottom: '10px'}}>Quick Stats Summary</h4>`, `<h4 style={{color: '#333', marginBottom: '10px'}}>{t('dashboard.quickStats')}</h4>`);
r(`registered users</li>`, `{t('dashboard.registeredUsers')}</li>`);
r(`orders processed</li>`, `{t('dashboard.ordersProcessed')}</li>`);
r(`products in catalog</li>`, `{t('dashboard.productsInCatalog')}</li>`);
r(`recent orders</li>`, `{t('dashboard.recentOrdersLabel')}</li>`);
r(
  `<h4 style={{color: '#333', marginBottom: '10px'}}>Admin Actions</h4>\n                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px'}}>`,
  `<h4 style={{color: '#333', marginBottom: '10px'}}>{t('dashboard.adminActions')}</h4>\n                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px'}}>`
);
r(`        📋 Manage Orders\n                      </button>`, `        📋 {t('dashboard.manageOrders')}\n                      </button>`);
r(`        👥 Manage Users\n                      </button>`, `        👥 {t('dashboard.manageUsers')}\n                      </button>`);
r(`        📦 Manage Products\n                      </button>`, `        📦 {t('dashboard.manageProducts')}\n                      </button>`);
r(`        🔐 Two-Factor Auth\n                      </button>`, `        🔐 {t('dashboard.twoFactorAuth')}\n                      </button>`);
r(`<h4 style={{color: '#333', marginBottom: '10px'}}>🔐 Two-Factor Authentication</h4>`, `<h4 style={{color: '#333', marginBottom: '10px'}}>🔐 {t('dashboard.twoFactorAuthentication')}</h4>`);
r(`{admin?.twoFactorEnabled ? '🔓 Disable 2FA' : '🔒 Enable 2FA'}`, `{admin?.twoFactorEnabled ? \`🔓 \${t('dashboard.disable2fa')}\` : \`🔒 \${t('dashboard.enable2fa')}\`}`);
r(`<span style={{color: '#4CAF50', fontWeight: 'bold'}}>✅ Enabled</span>`, `<span style={{color: '#4CAF50', fontWeight: 'bold'}}>✅ {t('common.enabled')}</span>`);
r(`<span style={{color: '#f44336', fontWeight: 'bold'}}>❌ Disabled</span>`, `<span style={{color: '#f44336', fontWeight: 'bold'}}>❌ {t('common.disabled')}</span>`);

/* ─────────────────────────────────────────────
   PRODUCTS TAB
───────────────────────────────────────────── */
r(`<h3 style={{color: '#333', margin: '0'}}>📦 Product Management</h3>`, `<h3 style={{color: '#333', margin: '0'}}>📦 {t('products.title')}</h3>`);
r(`      📤 Import from Excel\n                    </button>`, `      📤 {t('products.importExcel')}\n                    </button>`);
r(`      ➕ Add New Product\n                    </button>`, `      ➕ {t('products.addNew')}\n                    </button>`);
r(`<h4 style={{color: '#333', marginBottom: '15px'}}>Product Actions</h4>`, `<h4 style={{color: '#333', marginBottom: '15px'}}>{t('products.actions')}</h4>`);
r(
  `      🔄 Bulk Operations {selectedProducts.length > 0 && \`(\${selectedProducts.length})\`}\n                    </button>`,
  `      🔄 {t('common.bulkOps')} {selectedProducts.length > 0 && \`(\${selectedProducts.length})\`}\n                    </button>`
);
r(`      📊 Analytics\n                    </button>\n                    <button \n                      className="btn" \n                      style={{background: '#28a745'`, `      📊 {t('common.analytics')}\n                    </button>\n                    <button \n                      className="btn" \n                      style={{background: '#28a745'`);
r(`      📥 Download Excel Template\n                    </button>`, `      📥 {t('products.downloadTemplate')}\n                    </button>`);
// Search filter panel
r(`<h4 style={{color: '#333', marginBottom: '15px'}}>🔍 Search & Filter Products</h4>`, `<h4 style={{color: '#333', marginBottom: '15px'}}>🔍 {t('products.searchFilterTitle')}</h4>`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>Search Products:</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>{t('products.searchLabel')}:</label>`);
r(`placeholder="Search by name, ID, category, or description..."`, `placeholder={t('products.searchPlaceholder')}`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>Category:</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>{t('common.category')}:</label>`);
r(`<option value="all">All Categories</option>`, `<option value="all">{t('products.allCategories')}</option>`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>Status:</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>{t('common.status')}:</label>`);
r(`<option value="all">All Status</option>`, `<option value="all">{t('common.allStatus')}</option>`);
r(`<option value="active">Active</option>\n                          <option value="inactive">Inactive</option>\n                          <option value="draft">Draft</option>\n                          <option value="discontinued">Discontinued</option>`,
  `<option value="active">{t('common.active')}</option>\n                          <option value="inactive">{t('common.inactive')}</option>\n                          <option value="draft">{t('common.draft')}</option>\n                          <option value="discontinued">{t('common.discontinued')}</option>`);
r(`      ✅ Apply Search\n                      </button>`, `      ✅ {t('common.applySearch')}\n                      </button>`);
r(`      🗑️ Clear Filters\n                      </button>`, `      🗑️ {t('common.clearFilters')}\n                      </button>`);
r(`Showing {filteredProducts.length} of {products.length} products`, `{t('products.showing', {count: filteredProducts.length, total: products.length})}`);
// Analytics panel
r(`<h4 style={{color: '#333', marginBottom: '20px'}}>📊 Product Analytics Dashboard</h4>`, `<h4 style={{color: '#333', marginBottom: '20px'}}>📊 {t('products.analyticsDashboard')}</h4>`);
r(`<p style={{color: '#666', margin: '0', fontSize: '14px'}}>Total Products</p>`, `<p style={{color: '#666', margin: '0', fontSize: '14px'}}>{t('products.totalProducts')}</p>`);
r(`<p style={{color: '#666', margin: '0', fontSize: '14px'}}>In Stock</p>`, `<p style={{color: '#666', margin: '0', fontSize: '14px'}}>{t('products.inStock')}</p>`);
r(`<p style={{color: '#666', margin: '0', fontSize: '14px'}}>Low Stock</p>`, `<p style={{color: '#666', margin: '0', fontSize: '14px'}}>{t('products.lowStock')}</p>`);
r(`<p style={{color: '#666', margin: '0', fontSize: '14px'}}>Out of Stock</p>`, `<p style={{color: '#666', margin: '0', fontSize: '14px'}}>{t('products.outOfStock')}</p>`);
r(`<h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>📂 Products by Category</h5>`, `<h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>📂 {t('products.byCategory')}</h5>`);
r(`<h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>📈 Status Distribution</h5>`, `<h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>📈 {t('products.statusDistribution')}</h5>`);
r(`<h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>💰 Price Analysis</h5>`, `<h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>💰 {t('products.priceAnalysis')}</h5>`);
r(`<h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>🏆 Top Products by Price</h5>`, `<h5 style={{color: '#333', marginBottom: '15px', fontSize: '16px'}}>🏆 {t('products.topByPrice')}</h5>`);
r(`<span style={{fontSize: '14px', color: '#333'}}>Average Price</span>`, `<span style={{fontSize: '14px', color: '#333'}}>{t('products.avgPrice')}</span>`);
r(`<span style={{fontSize: '14px', color: '#333'}}>Lowest Price</span>`, `<span style={{fontSize: '14px', color: '#333'}}>{t('products.lowestPrice')}</span>`);
r(`<span style={{fontSize: '14px', color: '#333'}}>Highest Price</span>`, `<span style={{fontSize: '14px', color: '#333'}}>{t('products.highestPrice')}</span>`);
r(`<p style={{color: '#666', fontSize: '14px', textAlign: 'center', margin: '20px 0'}}>No products with prices found</p>`, `<p style={{color: '#666', fontSize: '14px', textAlign: 'center', margin: '20px 0'}}>{t('products.noPricesFound')}</p>`);
r(`<p style={{color: '#666', fontSize: '12px', margin: '0'}}>Analytics generated at: {analyticsData.generatedAt}</p>`, `<p style={{color: '#666', fontSize: '12px', margin: '0'}}>{t('products.analyticsGeneratedAt')}: {analyticsData.generatedAt}</p>`);
r(`<p>Please make sure products are loaded and try again.</p>`, `<p>{t('products.analyticsError')}</p>`);
r(`<p style={{color: '#666', marginTop: '10px'}}>Generating analytics...</p>`, `<p style={{color: '#666', marginTop: '10px'}}>{t('products.generatingAnalytics')}</p>`);
r(`      🔄 Refresh Analytics\n                      </button>`, `      🔄 {t('products.refreshAnalytics')}\n                      </button>`);
r(`      ✖️ Close\n                      </button>`, `      ✖️ {t('common.close')}\n                      </button>`);
// Product table headers
r(`<th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Image</th>\n                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>Priority</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Product ID</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Name</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Preț bază</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Category</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Stock</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Status</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>VAT %</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Currency</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Product Code</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>NC Code</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>CPV Code</th>`,
  `<th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.image')}</th>\n                          <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd'}}>{t('products.priority')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.productId')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.name')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.basePrice')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.category')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.stock')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.status')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>VAT %</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.currency')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('products.productCode')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>NC Code</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>CPV Code</th>`);

/* ─────────────────────────────────────────────
   CATEGORIES TAB
───────────────────────────────────────────── */
r(`<h3 style={{color: '#333', margin: '0'}}>📁 Category Management</h3>`, `<h3 style={{color: '#333', margin: '0'}}>📁 {t('categories.title')}</h3>`);
r(`      ➕ Add New Category\n                  </button>`, `      ➕ {t('categories.addNew')}\n                  </button>`);
r(`<h4 style={{color: '#333', marginBottom: '15px'}}>Homepage Category Settings</h4>`, `<h4 style={{color: '#333', marginBottom: '15px'}}>{t('categories.homepageSettings')}</h4>`);
r(`<h5 style={{color: '#495057', marginBottom: '15px'}}>Main Top Categories (Max 4)</h5>`, `<h5 style={{color: '#495057', marginBottom: '15px'}}>{t('categories.mainTopMax4')}</h5>`);
r(`<h5 style={{color: '#495057', marginBottom: '15px'}}>Shop Categories (Max 3)</h5>`, `<h5 style={{color: '#495057', marginBottom: '15px'}}>{t('categories.shopCatMax3')}</h5>`);
r(`<p style={{color: '#6c757d', fontStyle: 'italic'}}>No categories assigned to main top section</p>`, `<p style={{color: '#6c757d', fontStyle: 'italic'}}>{t('categories.noCatMainTop')}</p>`);
r(`<p style={{color: '#6c757d', fontStyle: 'italic'}}>No categories assigned to shop section</p>`, `<p style={{color: '#6c757d', fontStyle: 'italic'}}>{t('categories.noCatShop')}</p>`);
r(`      📋 View Homepage Config\n                  </button>`, `      📋 {t('categories.viewHomepageConfig')}\n                  </button>`);
r(`      ⚙️ Configure Homepage\n                  </button>`, `      ⚙️ {t('categories.configureHomepage')}\n                  </button>`);
// Category table headers
r(`<th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>ID</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Image</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Name</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Slug</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Description</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Homepage</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Actions</th>`,
  `<th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>ID</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.image')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.name')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Slug</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.description')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('categories.homepage')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.actions')}</th>`);
r(`{category.description || 'No description'}`, `{category.description || t('common.noDescription')}`);
r(`<span style={{color: '#6c757d', fontSize: '12px'}}>Not featured</span>`, `<span style={{color: '#6c757d', fontSize: '12px'}}>{t('categories.notFeatured')}</span>`);
r(`<p style={{color: '#666', fontSize: '18px', marginBottom: '15px'}}>No categories found</p>`, `<p style={{color: '#666', fontSize: '18px', marginBottom: '15px'}}>{t('categories.noneFound')}</p>`);
r(`<p style={{color: '#6c757d', marginBottom: '20px'}}>Create your first category to organize your products effectively.</p>`, `<p style={{color: '#6c757d', marginBottom: '20px'}}>{t('categories.createFirst')}</p>`);
r(`      ➕ Add Your First Category\n                    </button>`, `      ➕ {t('categories.addFirst')}\n                    </button>`);

/* ─────────────────────────────────────────────
   SUPPLIERS TAB
───────────────────────────────────────────── */
r(`<h3 style={{color: '#333', margin: '0'}}>🏢 Supplier Management</h3>`, `<h3 style={{color: '#333', margin: '0'}}>🏢 {t('suppliers.title')}</h3>`);
r(`      ➕ Add New Supplier\n                  </button>`, `      ➕ {t('suppliers.addNew')}\n                  </button>`);
r(`<h4 style={{color: '#333', marginBottom: '15px'}}>Supplier Overview</h4>`, `<h4 style={{color: '#333', marginBottom: '15px'}}>{t('suppliers.overview')}</h4>`);
r(`      📊 Analytics\n                    </button>\n                    <button \n                      className="btn" \n                      style={{background: '#17a2b8'`,
  `      📊 {t('common.analytics')}\n                    </button>\n                    <button \n                      className="btn" \n                      style={{background: '#17a2b8'`);
r(`      🔄 Bulk Operations {selectedSuppliers.length > 0 ? \`(\${selectedSuppliers.length})\` : ''}`, `      🔄 {t('common.bulkOps')} {selectedSuppliers.length > 0 ? \`(\${selectedSuppliers.length})\` : ''}`);
r(`      📤 Export\n                    </button>`, `      📤 {t('common.export')}\n                    </button>`);
// Supplier table headers
r(`<th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>Supplier Name</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>Contact</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>Location</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>Integration</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>Status</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>Actions</th>`,
  `<th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('suppliers.supplierName')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('suppliers.contact')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('suppliers.location')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('suppliers.integration')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('common.status')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333'}}>{t('common.actions')}</th>`);
r(`{supplier.isActive ? '✅ Active' : '❌ Inactive'}`, `{supplier.isActive ? \`✅ \${t('common.active')}\` : \`❌ \${t('common.inactive')}\`}`);
r(`      💰 Sync Prices\n                                  </button>`, `      💰 {t('suppliers.syncPrices')}\n                                  </button>`);

/* ─────────────────────────────────────────────
   COMPANY SETTINGS TAB
───────────────────────────────────────────── */
r(`<h3 style={{color: '#333', margin: '0'}}>🏢 Company Settings</h3>`, `<h3 style={{color: '#333', margin: '0'}}>🏢 {t('companySettings.title')}</h3>`);
r(`      ✏️ Edit Company Info\n                  </button>`, `      ✏️ {t('companySettings.editInfo')}\n                  </button>`);
r(`<h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #007bff', paddingBottom: '5px'}}>Basic Information</h4>`, `<h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #007bff', paddingBottom: '5px'}}>{t('companySettings.basicInfo')}</h4>`);
r(`<h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #28a745', paddingBottom: '5px'}}>Address</h4>`, `<h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #28a745', paddingBottom: '5px'}}>{t('companySettings.address')}</h4>`);
r(`<h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #ffc107', paddingBottom: '5px'}}>Legal & Business</h4>`, `<h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #ffc107', paddingBottom: '5px'}}>{t('companySettings.legalBusiness')}</h4>`);
r(`<h4 style={{color: '#007bff', marginBottom: '15px', borderBottom: '2px solid #007bff', paddingBottom: '5px'}}>💰 Default Product Settings</h4>`, `<h4 style={{color: '#007bff', marginBottom: '15px', borderBottom: '2px solid #007bff', paddingBottom: '5px'}}>💰 {t('companySettings.defaultProductSettings')}</h4>`);
r(`<h4 style={{color: '#1976d2', marginBottom: '15px', borderBottom: '2px solid #2196f3', paddingBottom: '5px'}}>🚚 Shipping Settings</h4>`, `<h4 style={{color: '#1976d2', marginBottom: '15px', borderBottom: '2px solid #2196f3', paddingBottom: '5px'}}>🚚 {t('companySettings.shippingSettings')}</h4>`);
r(`<h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #dc3545', paddingBottom: '5px'}}>Company Description</h4>`, `<h4 style={{color: '#333', marginBottom: '15px', borderBottom: '2px solid #dc3545', paddingBottom: '5px'}}>{t('companySettings.description')}</h4>`);
// Field labels
r(`<strong style={{color: '#495057'}}>Company Name:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.companyName')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Email:</strong>`, `<strong style={{color: '#495057'}}>{t('common.email')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Phone:</strong>`, `<strong style={{color: '#495057'}}>{t('common.phone')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Website:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.website')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Logistics Email:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.logisticsEmail')}:</strong>`);
r(`<strong style={{color: '#495057'}}>IBAN:</strong>`, `<strong style={{color: '#495057'}}>IBAN:</strong>`);
r(`<strong style={{color: '#495057'}}>Street Address:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.streetAddress')}:</strong>`);
r(`<strong style={{color: '#495057'}}>City:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.city')}:</strong>`);
r(`<strong style={{color: '#495057'}}>State/Province:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.stateProvince')}:</strong>`);
r(`<strong style={{color: '#495057'}}>ZIP/Postal Code:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.zipCode')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Country:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.country')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Contact Person:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.contactPerson')}:</strong>`);
r(`<strong style={{color: '#495057'}}>VAT Number:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.vatNumber')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Registration Number:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.registrationNumber')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Default Currency:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.defaultCurrency')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Default VAT Percentage:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.defaultVatPct')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Reverse Charge VAT:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.reverseChargeVat')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Free Shipping Threshold:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.freeShippingThreshold')}:</strong>`);
r(`<strong style={{color: '#495057'}}>Standard Shipping Cost:</strong>`, `<strong style={{color: '#495057'}}>{t('companySettings.standardShippingCost')}:</strong>`);
r(`Used as defaults when creating new products`, `{t('companySettings.usedAsDefaults')}`);
r(`{companySettings.description || 'No description available. Click "Edit Company Info" to add your company description.'}`, `{companySettings.description || t('companySettings.noDescription')}`);
r(`<h4 style={{color: '#333', marginBottom: '10px'}}>📝 Important Notes</h4>`, `<h4 style={{color: '#333', marginBottom: '10px'}}>📝 {t('companySettings.importantNotes')}</h4>`);
r(`<li style={{marginBottom: '5px'}}>This information is used throughout the system for invoices, emails, and customer communications</li>`, `<li style={{marginBottom: '5px'}}>{t('companySettings.note1')}</li>`);
r(`<li style={{marginBottom: '5px'}}>VAT Number and Registration Number are required for proper invoice generation</li>`, `<li style={{marginBottom: '5px'}}>{t('companySettings.note2')}</li>`);
r(`<li style={{marginBottom: '5px'}}>Contact information will be displayed to customers for support inquiries</li>`, `<li style={{marginBottom: '5px'}}>{t('companySettings.note3')}</li>`);
r(`<li>All changes are automatically saved and will be reflected in new orders and communications</li>`, `<li>{t('companySettings.note4')}</li>`);
// "Not set" placeholders
r(`companySettings.name || 'Not set'`, `companySettings.name || t('common.notSet')`);
r(`companySettings.email || 'Not set'`, `companySettings.email || t('common.notSet')`);
r(`companySettings.phone || 'Not set'`, `companySettings.phone || t('common.notSet')`);
r(`companySettings.website || 'Not set'`, `companySettings.website || t('common.notSet')`);
r(`companySettings.logisticsEmail || 'Not set'`, `companySettings.logisticsEmail || t('common.notSet')`);
r(`companySettings.iban || 'Not set'`, `companySettings.iban || t('common.notSet')`);
r(`companySettings.address || 'Not set'`, `companySettings.address || t('common.notSet')`);
r(`companySettings.city || 'Not set'`, `companySettings.city || t('common.notSet')`);
r(`companySettings.state || 'Not set'`, `companySettings.state || t('common.notSet')`);
r(`companySettings.zipCode || 'Not set'`, `companySettings.zipCode || t('common.notSet')`);
r(`companySettings.country || 'Not set'`, `companySettings.country || t('common.notSet')`);
r(`companySettings.contactPerson || 'Not set'`, `companySettings.contactPerson || t('common.notSet')`);
r(`companySettings.vatNumber || 'Not set'`, `companySettings.vatNumber || t('common.notSet')`);
r(`companySettings.registrationNumber || 'Not set'`, `companySettings.registrationNumber || t('common.notSet')`);

/* ─────────────────────────────────────────────
   VOUCHERS TAB
───────────────────────────────────────────── */
r(`<h3 style={{color: '#333', margin: '0'}}>🎟️ Voucher Management</h3>`, `<h3 style={{color: '#333', margin: '0'}}>🎟️ {t('vouchers.title')}</h3>`);
r(`    + Add New Voucher\n                  </button>`, `    + {t('vouchers.addNew')}\n                  </button>`);
r(`  Manage discount voucher codes. Customers can apply these codes at checkout to receive discounts.\n                </p>`, `  {t('vouchers.description')}\n                </p>`);
// Voucher table headers
r(`<th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Code</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Name</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Discount</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Min Order</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Piață</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Usage</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Valid Period</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Status</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>Actions</th>`,
  `<th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.code')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.name')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.discount')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.minOrder')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.market')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.usage')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('vouchers.validPeriod')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.status')}</th>\n                          <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd'}}>{t('common.actions')}</th>`);
r(`{voucher.validFrom || voucher.validUntil ? (`, `{voucher.validFrom || voucher.validUntil ? (`); // no-op keep
r(`'No expiry'`, `t('vouchers.noExpiry')`);
r(`{voucher.isActive ? 'Active' : 'Inactive'}`, `{voucher.isActive ? t('common.active') : t('common.inactive')}`);
// Voucher action buttons
r(`                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn" 
                                  style={{background: '#dc3545', width: 'auto', padding: '4px 10px', fontSize: '12px'}}
                                  onClick={async () => {
                                    if (confirm(\`Are you sure you want to delete voucher "\${voucher.code}"?\`))`,
  `                                >
                                  {t('common.edit')}
                                </button>
                                <button 
                                  className="btn" 
                                  style={{background: '#dc3545', width: 'auto', padding: '4px 10px', fontSize: '12px'}}
                                  onClick={async () => {
                                    if (confirm(\`Are you sure you want to delete voucher "\${voucher.code}"?\`))` );
r(`                                  Delete
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
                    <p>No vouchers created yet. Click "Add New Voucher" to create one.</p>`,
  `                                  {t('common.delete')}
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
                    <p>{t('vouchers.noneFound')}</p>`);
// Voucher modal title & form labels
r(`<h3 style={{marginBottom: '20px'}}>{editingVoucher ? 'Edit Voucher' : 'Add New Voucher'}</h3>`, `<h3 style={{marginBottom: '20px'}}>{editingVoucher ? t('vouchers.editVoucher') : t('vouchers.addNew')}</h3>`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Piață *</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('common.market')} *</label>`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Voucher Code *</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.voucherCode')} *</label>`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Name/Description *</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.nameDescription')} *</label>`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Discount Type</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.discountType')}</label>`);
r(`<option value="fixed">Fixed Amount (RON)</option>\n                            <option value="percentage">Percentage (%)</option>`, `<option value="fixed">{t('vouchers.fixedAmount')}</option>\n                            <option value="percentage">{t('vouchers.percentage')}</option>`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Discount Value *</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.discountValue')} *</label>`);
r(`<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Min Order Amount</label>`, `<label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>{t('vouchers.minOrderAmount')}</label>`);

/* ─────────────────────────────────────────────
   BLOG TAB
───────────────────────────────────────────── */
r(`<h3 style={{color: '#333', marginTop: 0}}>📝 Blog — Generare Automată cu Claude AI</h3>`, `<h3 style={{color: '#333', marginTop: 0}}>📝 {t('blog.title')}</h3>`);
r(`<h4 style={{marginTop: 0, color: '#495057'}}>Generează articol nou</h4>`, `<h4 style={{marginTop: 0, color: '#495057'}}>{t('blog.generateNew')}</h4>`);
r(`<label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>Titlu (opțional)</label>`, `<label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>{t('blog.titleLabel')}</label>`);
r(`placeholder="Lasă gol pentru temă automată"`, `placeholder={t('blog.titlePlaceholder')}`);
r(`<label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>Categorie</label>`, `<label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>{t('blog.category')}</label>`);
r(`<label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>Limbă</label>`, `<label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#6c757d'}}>{t('blog.language')}</label>`);
r(`{blogGenerating ? '⏳ Generez...' : '✨ Generează'}`, `{blogGenerating ? \`⏳ \${t('blog.generating')}\` : \`✨ \${t('blog.generate')}\`}`);

/* ─────────────────────────────────────────────
   ORDER DETAILS MODAL
───────────────────────────────────────────── */
r(`📋 Order Details - #{selectedOrder.id}`, `📋 {t('orders.orderDetails')} #{selectedOrder.id}`);
r(`<h4 style={{color: '#333', marginBottom: '10px'}}>Order Information</h4>`, `<h4 style={{color: '#333', marginBottom: '10px'}}>{t('orders.orderInfo')}</h4>`);
r(`<p><strong>Order ID:</strong> #{selectedOrder.id}</p>`, `<p><strong>{t('orders.orderId')}:</strong> #{selectedOrder.id}</p>`);
r(`<p><strong>Payment Method:</strong> {(() => {`, `<p><strong>{t('orders.paymentMethod')}:</strong> {(() => {`);
r(`<p><strong>Payment Status:</strong> <span style={{`, `<p><strong>{t('orders.paymentStatus')}:</strong> <span style={{`);
r(`<h4 style={{color: '#333', marginBottom: '10px'}}>Customer Information</h4>`, `<h4 style={{color: '#333', marginBottom: '10px'}}>{t('orders.customerInfo')}</h4>`);
r(`<h4 style={{color: '#333', marginBottom: '10px'}}>Shipping Address</h4>`, `<h4 style={{color: '#333', marginBottom: '10px'}}>{t('orders.shippingAddress')}</h4>`);
r(`        <span>📄</span>\n                        <span>Download Invoice</span>`, `        <span>📄</span>\n                        <span>{t('orders.downloadInvoice')}</span>`);
// Close button in order details modal
r(`                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Order Tools Modal */}`,
  `                    >
                      {t('common.close')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Order Tools Modal */}`);

/* ─────────────────────────────────────────────
   COMMON EDIT/DELETE buttons in categories & suppliers
───────────────────────────────────────────── */
// Categories Edit/Delete buttons
r(`                                  ✏️ Edit\n                                </button>\n                                <button \n                                  style={{\n                                    padding: '4px 8px',\n                                    border: 'none',\n                                    borderRadius: '3px',\n                                    backgroundColor: '#dc3545',\n                                    color: 'white',\n                                    cursor: 'pointer',\n                                    fontSize: '12px'\n                                  }}\n                                  onClick={async () => {\n                                    if (confirm(\`Delete category`,
  `                                  ✏️ {t('common.edit')}\n                                </button>\n                                <button \n                                  style={{\n                                    padding: '4px 8px',\n                                    border: 'none',\n                                    borderRadius: '3px',\n                                    backgroundColor: '#dc3545',\n                                    color: 'white',\n                                    cursor: 'pointer',\n                                    fontSize: '12px'\n                                  }}\n                                  onClick={async () => {\n                                    if (confirm(\`Delete category`);
r(`                                  🗑️ Delete\n                                </button>\n                              </div>\n                            </td>\n                          </tr>\n                        ))}\n                      </tbody>\n                    </table>\n                  </div>\n                ) : (\n                  <div style={{padding: '40px', textAlign: 'center', background: '#f8f9fa',`,
  `                                  🗑️ {t('common.delete')}\n                                </button>\n                              </div>\n                            </td>\n                          </tr>\n                        ))}\n                      </tbody>\n                    </table>\n                  </div>\n                ) : (\n                  <div style={{padding: '40px', textAlign: 'center', background: '#f8f9fa',`);

writeFileSync(file, src);
console.log('✅ All replacements applied successfully.');
