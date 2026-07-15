const express = require('express');
const router  = express.Router();
const store   = require('../datastore');
const { sendInquiryEmail } = require('../mailer');

/* ── Public pages ─────────────────────────────────────────────────────────── */
router.get('/', (req, res) => {
  const featured = store.products.where({ is_featured: 1, is_active: 1 }, 'updated_at:DESC', 8);
  const latest   = store.products.where({ is_active: 1 }, 'created_at:DESC', 8);
  const counts   = {
    gold:    store.products.count({ category: 'gold',    is_active: 1 }),
    diamond: store.products.count({ category: 'diamond', is_active: 1 }),
    silver:  store.products.count({ category: 'silver',  is_active: 1 }),
  };
  const cartCount = (req.session.cart || []).length;
  res.render('index', { title: 'Shreeja Jewellers – Fine Jewelry Collection', featured, latest, counts, cartCount });
});

router.get('/category/:type', (req, res) => {
  const type = req.params.type.toLowerCase();
  if (!['gold', 'diamond', 'silver'].includes(type)) return res.redirect('/');
  const sortBy  = req.query.sort || 'newest';
  const sortMap = { newest: 'created_at:DESC', oldest: 'created_at:ASC', 'price-low': 'price:ASC', 'price-high': 'price:DESC', name: 'name:ASC' };
  const products  = store.products.where({ category: type, is_active: 1 }, sortMap[sortBy] || 'created_at:DESC');
  const names     = { gold: 'Gold Jewellery', diamond: 'Diamond Jewellery', silver: 'Silver Jewellery' };
  const cartCount = (req.session.cart || []).length;
  res.render('category', { title: `${names[type]} – Shreeja Jewellers`, category: type, categoryName: names[type], products, sortBy, cartCount });
});

router.get('/product/:id', (req, res) => {
  const product = store.products.find(req.params.id);
  if (!product || !product.is_active) return res.redirect('/');
  const related   = store.products.related(req.params.id, product.category, 4);
  const cartCount = (req.session.cart || []).length;
  const inCart    = (req.session.cart || []).some(i => i.id === product.id);
  res.render('product', { title: `${product.name} – Shreeja Jewellers`, product, related, cartCount, inCart });
});

router.get('/about', (req, res) => {
  const cartCount = (req.session.cart || []).length;
  res.render('about', { title: 'About Us – Shreeja Jewellers', cartCount });
});

/* ── Cart ─────────────────────────────────────────────────────────────────── */
router.post('/cart/add/:id', (req, res) => {
  const product = store.products.find(req.params.id);
  if (!product || !product.is_active) return res.redirect('back');
  if (!req.session.cart) req.session.cart = [];
  if (!req.session.cart.some(i => i.id === product.id)) {
    req.session.cart.push({
      id: product.id, name: product.name, category: product.category,
      price: product.price, weight: product.weight, weight_unit: product.weight_unit,
      purity: product.purity, image: product.image,
    });
  }
  res.redirect('/cart');
});

router.post('/cart/remove/:id', (req, res) => {
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(i => i.id !== Number(req.params.id));
  }
  res.redirect('/cart');
});

router.get('/cart/clear', (req, res) => {
  req.session.cart = [];
  res.redirect('/cart');
});

router.get('/cart', (req, res) => {
  const cart      = req.session.cart || [];
  const total     = cart.reduce((sum, i) => sum + i.price, 0);
  const cartCount = cart.length;
  res.render('cart', { title: 'My Enquiry Cart – Shreeja Jewellers', cart, total, cartCount });
});

/* ── Checkout / Inquiry ───────────────────────────────────────────────────── */
router.get('/checkout', (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');
  const total     = cart.reduce((sum, i) => sum + i.price, 0);
  const cartCount = cart.length;
  res.render('checkout', { title: 'Place Enquiry – Shreeja Jewellers', cart, total, cartCount, error: null });
});

router.post('/checkout', async (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');

  const { customer_name, customer_email, message } = req.body;
  const customer_phone = (req.body.customer_phone || '').replace(/\D/g, '').slice(0, 10);
  const renderErr = (error) => {
    const t = cart.reduce((s, i) => s + i.price, 0);
    return res.render('checkout', { title: 'Place Enquiry – Shreeja Jewellers', cart, total: t, cartCount: cart.length, error });
  };
  if (!customer_name || !customer_phone) return renderErr('Name and phone number are required.');
  if (customer_phone.length !== 10)      return renderErr('Phone number must be exactly 10 digits.');

  const total   = cart.reduce((sum, i) => sum + i.price, 0);
  const inquiry = store.inquiries.create({ customer_name, customer_email, customer_phone, message, items: cart, total });

  // Send email (non-blocking)
  sendInquiryEmail(inquiry).catch(e => console.error('Email error:', e));

  // Build WhatsApp message
  const itemsList = cart.map(i => `• ${i.name} (${i.category}) — ₹${Number(i.price).toLocaleString('en-IN')}`).join('\n');
  const waText = encodeURIComponent(
    `Hello Shreeja Jewellers,\n\nI would like to enquire about the following products:\n\n${itemsList}\n\nTotal: ₹${Number(total).toLocaleString('en-IN')}\n\nMy details:\nName: ${customer_name}\nPhone: ${customer_phone}\n${customer_email ? 'Email: ' + customer_email : ''}\n${message ? 'Message: ' + message : ''}`
  );
  const waLink = `https://wa.me/917049035660?text=${waText}`;

  // Clear cart
  req.session.cart = [];

  res.render('inquiry-success', {
    title: 'Enquiry Sent – Shreeja Jewellers',
    cartCount: 0,
    inquiry,
    waLink,
    emailSent: !!(store.settings.get('smtp_user') && store.settings.get('smtp_pass')),
  });
});

module.exports = router;
