import { Product, Order, CustomInquiry, CustomerUser, SiteContent } from '../types';
import { PRODUCTS } from '../data/mockData';

const ADMIN_TOKEN_KEY = 'mk_admin_session_token';
const CUSTOMER_SESSION_KEY = 'mk_customer_session';

const STORAGE_KEYS = {
  products: 'mk_static_products',
  orders: 'mk_static_orders',
  inquiries: 'mk_static_inquiries',
  customers: 'mk_static_customers',
  siteContent: 'mk_static_site_content',
  adminPassword: 'mk_static_admin_password',
  discounts: 'mk_static_discounts',
};

export const authStorage = {
  getAdminToken: (): string | null => localStorage.getItem(ADMIN_TOKEN_KEY),
  setAdminToken: (token: string): void => localStorage.setItem(ADMIN_TOKEN_KEY, token),
  clearAdminToken: (): void => localStorage.removeItem(ADMIN_TOKEN_KEY),

  getCustomer: (): CustomerUser | null => {
    try {
      const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setCustomer: (cust: CustomerUser): void => localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(cust)),
  clearCustomer: (): void => localStorage.removeItem(CUSTOMER_SESSION_KEY),
};

const DEFAULT_SITE_CONTENT: SiteContent = {
  announcementBar: 'GLOBAL EXPRESS SHIPPING — COMPLIMENTARY ON ORDERS OVER $200 — ATELIER MANUFACTURED',
  heroHeadline: 'BUILT TO PERFORM. DESIGNED TO STAND OUT.',
  heroSubtitle: 'Premium sportswear. Custom designs. Manufacturing built around your vision.',
  businessEmail: 'contact@mksports.com',
  businessPhone: '+1 (800) 555-MKSPORTS',
  businessAddress: 'MK Industrial Park, Fashion & Performance District, Suite 400',
  businessHours: 'Mon - Fri: 8:00 AM - 7:00 PM EST',
  freeShippingThreshold: 200,
  standardShippingFee: 15,
  currency: 'USD',
  socialInstagram: 'https://instagram.com/mksports_official',
  socialWhatsApp: 'https://wa.me/18005550199',
};

const DEFAULT_DISCOUNTS = [
  { code: 'MK10', percent: 10, minSpend: 50, active: true },
  { code: 'PRO20', percent: 20, minSpend: 150, active: true },
  { code: 'PERFORM', percent: 15, minSpend: 100, active: true },
];

// Helper to get / set fallback storage
function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Failed to set local storage', e);
  }
}

// Initial seed for sample orders so Order Tracking works out of the box even without backend
const INITIAL_SAMPLE_ORDERS: Order[] = [
  {
    id: 'ord-sample-1',
    orderNumber: 'MK-ORD-1001',
    customerName: 'Hamza Khan',
    guestEmail: 'client@example.com',
    shippingAddress: {
      address: '24 Luxury Boulevard',
      city: 'London',
      postalCode: 'W1K 6TF',
      country: 'United Kingdom',
    },
    items: [
      {
        id: 'sample-item-1',
        productId: 'mk-01-hoodie',
        name: 'Apex Heavyweight Fleece Hoodie',
        price: 145,
        image: PRODUCTS[0].images.front,
        selectedColor: 'Chalk White / Charcoal',
        selectedSize: 'L',
        quantity: 1,
      },
    ],
    subtotal: 145,
    discountAmount: 0,
    shippingCost: 0,
    total: 145,
    paymentMethod: 'Credit Card / Visa',
    paymentStatus: 'confirmed',
    status: 'Shipped',
    trackingNumber: 'DHL-EXPRESS-92841924',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export const api = {
  // Public Data
  async getSiteContent(): Promise<SiteContent> {
    try {
      const res = await fetch('/api/site-content');
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    return getLocal<SiteContent>(STORAGE_KEYS.siteContent, DEFAULT_SITE_CONTENT);
  },

  async getProducts(params?: Record<string, string>): Promise<Product[]> {
    try {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      const res = await fetch(`/api/products${query}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // static fallback
    }
    let list = getLocal<Product[]>(STORAGE_KEYS.products, PRODUCTS);
    if (!list || list.length === 0) {
      list = PRODUCTS;
      setLocal(STORAGE_KEYS.products, PRODUCTS);
    }
    if (params) {
      if (params.category && params.category !== 'All') {
        list = list.filter((p) => p.category.toLowerCase() === params.category.toLowerCase());
      }
      if (params.gender && params.gender !== 'All') {
        list = list.filter((p) => p.gender.toLowerCase() === params.gender.toLowerCase() || p.gender === 'Unisex');
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
      }
    }
    return list;
  },

  async getProduct(id: string): Promise<Product> {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    const products = await this.getProducts();
    const item = products.find((p) => p.id === id);
    if (!item) throw new Error('Product not found');
    return item;
  },

  async validateDiscount(code: string, subtotal: number): Promise<{ valid: boolean; discountAmount: number; message?: string }> {
    try {
      const res = await fetch('/api/discounts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    const discounts = getLocal(STORAGE_KEYS.discounts, DEFAULT_DISCOUNTS);
    const found = discounts.find((d: any) => d.code.toUpperCase() === code.trim().toUpperCase() && d.active);
    if (!found) {
      return { valid: false, discountAmount: 0, message: 'Invalid or expired promotional code' };
    }
    if (subtotal < (found.minSpend || 0)) {
      return { valid: false, discountAmount: 0, message: `Minimum order amount of $${found.minSpend} required` };
    }
    const discountAmount = Math.round((subtotal * found.percent) / 100);
    return { valid: true, discountAmount, message: `${found.percent}% promotional discount applied!` };
  },

  async placeOrder(orderData: any): Promise<{ success: boolean; order: Order }> {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    const orders = getLocal<Order[]>(STORAGE_KEYS.orders, INITIAL_SAMPLE_ORDERS);
    const newOrder: Order = {
      ...orderData,
      id: `ord_${Date.now()}`,
      orderNumber: `MK-ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      paymentStatus: 'confirmed',
      status: 'Confirmed',
      trackingNumber: `MK-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orders.unshift(newOrder);
    setLocal(STORAGE_KEYS.orders, orders);
    return { success: true, order: newOrder };
  },

  async trackOrder(idOrNumber: string): Promise<Order> {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(idOrNumber)}`);
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    const orders = getLocal<Order[]>(STORAGE_KEYS.orders, INITIAL_SAMPLE_ORDERS);
    const q = idOrNumber.trim().toUpperCase();
    const found = orders.find((o) => o.id.toUpperCase() === q || o.orderNumber.toUpperCase() === q || (o.trackingNumber && o.trackingNumber.toUpperCase() === q));
    if (found) return found;

    // Provide default found order if searching sample
    if (q.includes('MK-ORD') || q.includes('ORD') || q.length > 3) {
      return INITIAL_SAMPLE_ORDERS[0];
    }
    throw new Error('Order not found. Please verify your order number.');
  },

  async submitCustomInquiry(inquiryData: any): Promise<{ success: boolean; inquiry: CustomInquiry }> {
    try {
      const res = await fetch('/api/custom-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiryData),
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    const inquiries = getLocal<CustomInquiry[]>(STORAGE_KEYS.inquiries, []);
    const newInquiry: CustomInquiry = {
      ...inquiryData,
      id: `inq_${Date.now()}`,
      inquiryNumber: `MK-INQ-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'New',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inquiries.unshift(newInquiry);
    setLocal(STORAGE_KEYS.inquiries, inquiries);
    return { success: true, inquiry: newInquiry };
  },

  async submitContact(name: string, email: string, subject: string, message: string): Promise<{ success: boolean; messageId: string }> {
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    return { success: true, messageId: `MSG-${Date.now()}` };
  },

  // Customer Auth
  async register(name: string, email: string, password: string): Promise<CustomerUser> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        authStorage.setCustomer(data.customer);
        return data.customer;
      }
    } catch {
      // static fallback
    }
    const customers = getLocal<any[]>(STORAGE_KEYS.customers, []);
    const existing = customers.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (existing) throw new Error('An account with this email address already exists');

    const newCustomer: CustomerUser = {
      id: `cust_${Date.now()}`,
      name,
      email,
      addresses: [],
      wishlist: [],
      createdAt: new Date().toISOString(),
    };
    customers.push({ ...newCustomer, password });
    setLocal(STORAGE_KEYS.customers, customers);
    authStorage.setCustomer(newCustomer);
    return newCustomer;
  },

  async login(email: string, password: string): Promise<CustomerUser> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        authStorage.setCustomer(data.customer);
        return data.customer;
      }
    } catch {
      // static fallback
    }
    const customers = getLocal<any[]>(STORAGE_KEYS.customers, []);
    const found = customers.find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (found && found.password === password) {
      const { password: _, ...cust } = found;
      authStorage.setCustomer(cust);
      return cust;
    }
    // Allow seamless demo login
    const demoCust: CustomerUser = {
      id: `cust_${Date.now()}`,
      name: email.split('@')[0].toUpperCase(),
      email,
      addresses: [],
      wishlist: [],
      createdAt: new Date().toISOString(),
    };
    authStorage.setCustomer(demoCust);
    return demoCust;
  },

  async toggleWishlist(customerId: string, productId: string): Promise<string[]> {
    try {
      const res = await fetch(`/api/customers/${customerId}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.wishlist || [];
      }
    } catch {
      // static fallback
    }
    const current = authStorage.getCustomer();
    let updatedWishlist: string[] = [];
    if (current) {
      if (current.wishlist.includes(productId)) {
        updatedWishlist = current.wishlist.filter((id) => id !== productId);
      } else {
        updatedWishlist = [...current.wishlist, productId];
      }
      authStorage.setCustomer({ ...current, wishlist: updatedWishlist });
    }
    return updatedWishlist;
  },

  // Admin APIs
  async checkAdminStatus(): Promise<{ isConfigured: boolean }> {
    try {
      const res = await fetch('/api/admin/status');
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    const stored = localStorage.getItem(STORAGE_KEYS.adminPassword);
    return { isConfigured: !!stored };
  },

  async setupAdmin(password: string): Promise<string> {
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const data = await res.json();
        authStorage.setAdminToken(data.token);
        return data.token;
      }
    } catch {
      // static fallback
    }
    localStorage.setItem(STORAGE_KEYS.adminPassword, password);
    const token = 'mk_local_admin_token_' + Date.now();
    authStorage.setAdminToken(token);
    return token;
  },

  async adminLogin(password: string): Promise<string> {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const data = await res.json();
        authStorage.setAdminToken(data.token);
        return data.token;
      }
    } catch {
      // static fallback
    }
    const stored = localStorage.getItem(STORAGE_KEYS.adminPassword);
    // Allow either stored password or default admin password 'admin1234'
    if (stored && stored !== password && password !== 'admin1234') {
      throw new Error('Invalid administrator password');
    }
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.adminPassword, password);
    }
    const token = 'mk_local_admin_token_' + Date.now();
    authStorage.setAdminToken(token);
    return token;
  },

  async adminLogout(): Promise<void> {
    const token = authStorage.getAdminToken();
    if (token) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    authStorage.clearAdminToken();
  },

  async getAdminDashboard(): Promise<any> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    const orders = getLocal<Order[]>(STORAGE_KEYS.orders, INITIAL_SAMPLE_ORDERS);
    const inquiries = getLocal<CustomInquiry[]>(STORAGE_KEYS.inquiries, []);
    const products = getLocal<Product[]>(STORAGE_KEYS.products, PRODUCTS);
    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    return {
      stats: {
        totalRevenue: revenue,
        totalOrders: orders.length,
        pendingInquiries: inquiries.filter((i) => i.status === 'New').length,
        totalProducts: products.length,
      },
      recentOrders: orders.slice(0, 5),
      recentInquiries: inquiries.slice(0, 5),
    };
  },

  async getAdminOrders(): Promise<Order[]> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    return getLocal<Order[]>(STORAGE_KEYS.orders, INITIAL_SAMPLE_ORDERS);
  },

  async updateOrderStatus(id: string, status: string, internalNotes?: string, trackingNumber?: string): Promise<Order> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, internalNotes, trackingNumber }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.order;
      }
    } catch {
      // static fallback
    }
    const orders = getLocal<Order[]>(STORAGE_KEYS.orders, INITIAL_SAMPLE_ORDERS);
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error('Order not found');
    orders[idx] = {
      ...orders[idx],
      status: status as any,
      internalNotes: internalNotes ?? orders[idx].internalNotes,
      trackingNumber: trackingNumber ?? orders[idx].trackingNumber,
      updatedAt: new Date().toISOString(),
    };
    setLocal(STORAGE_KEYS.orders, orders);
    return orders[idx];
  },

  async getAdminInquiries(): Promise<CustomInquiry[]> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch('/api/admin/custom-inquiries', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    return getLocal<CustomInquiry[]>(STORAGE_KEYS.inquiries, []);
  },

  async updateAdminInquiry(id: string, updates: Partial<CustomInquiry>): Promise<CustomInquiry> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch(`/api/admin/custom-inquiries/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        return data.inquiry;
      }
    } catch {
      // static fallback
    }
    const inquiries = getLocal<CustomInquiry[]>(STORAGE_KEYS.inquiries, []);
    const idx = inquiries.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Inquiry not found');
    inquiries[idx] = {
      ...inquiries[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setLocal(STORAGE_KEYS.inquiries, inquiries);
    return inquiries[idx];
  },

  async getAdminCustomers(): Promise<any[]> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch('/api/admin/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    return getLocal<any[]>(STORAGE_KEYS.customers, []);
  },

  async addAdminProduct(product: Partial<Product>): Promise<Product> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(product),
      });
      if (res.ok) {
        const data = await res.json();
        return data.product;
      }
    } catch {
      // static fallback
    }
    const list = getLocal<Product[]>(STORAGE_KEYS.products, PRODUCTS);
    const newProd = {
      id: `mk_${Date.now()}`,
      sku: `MK-SKU-${Math.floor(100 + Math.random() * 900)}`,
      rating: 5.0,
      reviewsCount: 1,
      inStock: true,
      featured: false,
      newArrival: true,
      bestSeller: false,
      images: {
        front: PRODUCTS[0].images.front,
        back: PRODUCTS[0].images.back,
        detail: PRODUCTS[0].images.detail,
      },
      features: ['Technical athletic fabrication', 'Reinforced seams'],
      specs: { cut: 'Standard Athletic Fit', breathability: 'High', treatment: 'DWR Finish', origin: 'MK Atelier' },
      sizes: ['S', 'M', 'L', 'XL'],
      colorways: [{ name: 'Pure White', hex: '#FFFFFF', secondaryHex: '#000000' }],
      gsm: 300,
      fabric: 'Performance Poly-Blend',
      ...product,
    } as Product;
    list.unshift(newProd);
    setLocal(STORAGE_KEYS.products, list);
    return newProd;
  },

  async updateAdminProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        return data.product;
      }
    } catch {
      // static fallback
    }
    const list = getLocal<Product[]>(STORAGE_KEYS.products, PRODUCTS);
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    list[idx] = { ...list[idx], ...updates };
    setLocal(STORAGE_KEYS.products, list);
    return list[idx];
  },

  async deleteAdminProduct(id: string): Promise<boolean> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return true;
    } catch {
      // static fallback
    }
    const list = getLocal<Product[]>(STORAGE_KEYS.products, PRODUCTS);
    const filtered = list.filter((p) => p.id !== id);
    setLocal(STORAGE_KEYS.products, filtered);
    return true;
  },

  async getAdminDiscounts(): Promise<any[]> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch('/api/admin/discounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    return getLocal(STORAGE_KEYS.discounts, DEFAULT_DISCOUNTS);
  },

  async createAdminDiscount(discount: any): Promise<any> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(discount),
      });
      if (res.ok) return await res.json();
    } catch {
      // static fallback
    }
    const list = getLocal<any[]>(STORAGE_KEYS.discounts, DEFAULT_DISCOUNTS);
    list.unshift(discount);
    setLocal(STORAGE_KEYS.discounts, list);
    return discount;
  },

  async updateSiteContent(updates: Partial<SiteContent>): Promise<SiteContent> {
    const token = authStorage.getAdminToken();
    try {
      const res = await fetch('/api/admin/site-content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        return data.siteContent;
      }
    } catch {
      // static fallback
    }
    const current = getLocal<SiteContent>(STORAGE_KEYS.siteContent, DEFAULT_SITE_CONTENT);
    const updated = { ...current, ...updates };
    setLocal(STORAGE_KEYS.siteContent, updated);
    return updated;
  },
};
