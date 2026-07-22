const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const XLSX     = require('xlsx');
const store    = require('../datastore');
const { requireAuth, redirectIfAuth } = require('../middleware/auth');

/* ── Multer ───────────────────────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, `product-${Date.now()}-${Math.floor(Math.random()*9999)}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    /jpeg|jpg|png|gif|webp/i.test(path.extname(file.originalname)) && /image/.test(file.mimetype)
      ? cb(null, true) : cb(new Error('Only image files allowed'));
  }
});

// Import multer — Excel goes to data/tmp, product images go to public/uploads
const importStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = file.fieldname === 'productImages'
      ? path.join(__dirname, '..', 'public', 'uploads')
      : path.join(__dirname, '..', 'data', 'tmp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    if (file.fieldname === 'productImages') {
      cb(null, `product-${Date.now()}-${Math.floor(Math.random()*9999)}${path.extname(file.originalname)}`);
    } else {
      cb(null, `import-${Date.now()}${path.extname(file.originalname)}`);
    }
  }
});
const uploadExcel = multer({
  storage: importStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.fieldname === 'productImages') {
      return /jpeg|jpg|png|gif|webp/i.test(path.extname(file.originalname)) && /image/.test(file.mimetype)
        ? cb(null, true) : cb(new Error('Only image files allowed'));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    ['.xlsx', '.xls', '.csv'].includes(ext)
      ? cb(null, true)
      : cb(new Error(`Invalid file type "${ext}". Only .xlsx, .xls, .csv are allowed.`));
  }
});

function deleteImage(imgPath) {
  if (!imgPath) return;
  const full = path.join(__dirname, '..', 'public', imgPath);
  try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch { /**/ }
}

/* ── Auth ─────────────────────────────────────────────────────────────────── */
router.get('/', (req, res) => res.redirect('/admin/dashboard'));

router.get('/login', redirectIfAuth, (req, res) =>
  res.render('admin/login', { title: 'Admin Login', error: null }));

router.post('/login', redirectIfAuth, (req, res) => {
  const { username, password } = req.body;
  const user = store.admins.findByUsername(username);
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.adminId       = user.id;
    req.session.adminUsername = user.username;
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { title: 'Admin Login', error: 'Invalid username or password' });
});

router.get('/logout', (req, res) => { req.session = null; res.redirect('/admin/login'); });

/* ── Dashboard ────────────────────────────────────────────────────────────── */
router.get('/dashboard', requireAuth, (req, res) => {
  const stats = {
    total:      store.products.count({ is_active: 1 }),
    gold:       store.products.count({ category: 'gold',    is_active: 1 }),
    diamond:    store.products.count({ category: 'diamond', is_active: 1 }),
    silver:     store.products.count({ category: 'silver',  is_active: 1 }),
    featured:   store.products.count({ is_featured: 1, is_active: 1 }),
    inquiries:  store.inquiries.countNew(),
  };
  const recent    = store.products.where({}, 'created_at:DESC', 5);
  const newInquiries = store.inquiries.all().slice(0, 3);
  res.render('admin/dashboard', { title: 'Dashboard – Admin', adminUsername: req.session.adminUsername, stats, recent, newInquiries });
});

/* ── Products list ────────────────────────────────────────────────────────── */
router.get('/products', requireAuth, (req, res) => {
  const cat      = req.query.category || '';
  const q        = req.query.search   || '';
  const products = store.products.search(q, cat);
  res.render('admin/products', { title: 'Products – Admin', adminUsername: req.session.adminUsername, products, category: cat, search: q });
});

/* ── Import from Excel ────────────────────────────────────────────────────── */
router.get('/products/import', requireAuth, (req, res) =>
  res.render('admin/import', { title: 'Import Products – Admin', adminUsername: req.session.adminUsername, result: null, error: null }));

router.get('/products/import/template', requireAuth, (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Product Name', 'Category', 'Price (₹)', 'Weight', 'Weight Unit', 'Purity', 'Description', 'Featured', 'Image URL'],
    ['22K Gold Necklace Set', 'gold', 45000, 18.5, 'grams', '22K', 'Beautiful traditional necklace with intricate design', 'Yes', ''],
    ['Diamond Solitaire Ring', 'diamond', 85000, 0.5, 'carats', 'VVS1', 'Premium solitaire diamond ring in 18K gold setting', 'No', ''],
    ['Silver Anklet Pair', 'silver', 2500, 25, 'grams', '92.5%', 'Traditional silver anklet pair with bells', 'No', ''],
  ]);
  ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 10 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="shreeja-import-template.xlsx"');
  res.send(buf);
});

router.post('/products/import', requireAuth, (req, res, next) => {
  uploadExcel.fields([
    { name: 'importFile',     maxCount: 1   },
    { name: 'productImages',  maxCount: 500 },
  ])(req, res, (err) => {
    if (err) {
      return res.render('admin/import', {
        title: 'Import Products – Admin',
        adminUsername: req.session.adminUsername,
        result: null,
        error: err.message,
      });
    }
    next();
  });
}, (req, res) => {
  const render = (result, error) =>
    res.render('admin/import', { title: 'Import Products – Admin', adminUsername: req.session.adminUsername, result, error });

  const excelFile = req.files && req.files.importFile ? req.files.importFile[0] : null;
  if (!excelFile) return render(null, 'Please select an Excel or CSV file to upload.');

  // Build filename → /uploads/savedname map from any uploaded images
  const imageMap = {};
  if (req.files && req.files.productImages) {
    req.files.productImages.forEach(f => {
      const orig = f.originalname.toLowerCase();
      const base = path.basename(f.originalname, path.extname(f.originalname)).toLowerCase();
      imageMap[orig] = '/uploads/' + f.filename;
      imageMap[base] = '/uploads/' + f.filename;
    });
  }

  // Image folder entered manually in the form (e.g. D:\Photos\Products)
  const imageFolder = (req.body.imageFolder || '').trim().replace(/[/\\]+$/, '');

  // Copy a local file to uploads, return '/uploads/filename' or null on error
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  function copyLocalImage(srcPath, suffix) {
    try {
      // Normalise mixed slashes to OS separator
      const normalised = srcPath.replace(/[/\\]+/g, path.sep);
      if (!fs.existsSync(normalised)) return null;
      const ext      = path.extname(normalised).toLowerCase();
      const destName = `product-${Date.now()}-${suffix}${ext}`;
      fs.copyFileSync(normalised, path.join(uploadsDir, destName));
      return '/uploads/' + destName;
    } catch { return null; }
  }

  try {
    const wb = XLSX.readFile(excelFile.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rows.length === 0) {
      try { fs.unlinkSync(excelFile.path); } catch { /**/ }
      return render(null, 'The uploaded file contains no data rows.');
    }

    const VALID_CATS = ['gold', 'diamond', 'silver'];
    const skipDups = !!req.body.skip_duplicates;
    const overDups = !!req.body.overwrite_duplicates;

    let imported = 0, skipped = 0;
    const errors = [];

    // Normalise header keys (trim, lowercase)
    const normalise = str => String(str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const keyMap = {};
    if (rows.length > 0) {
      Object.keys(rows[0]).forEach(k => { keyMap[normalise(k)] = k; });
    }
    const col = alias => {
      for (const a of alias) { if (keyMap[normalise(a)]) return keyMap[normalise(a)]; }
      return null;
    };

    const nameCol  = col(['Product Name', 'Name', 'ProductName']);
    const catCol   = col(['Category', 'Cat']);
    const priceCol = col(['Price', 'Price ₹', 'Price (₹)', 'Amount']);
    const weightCol= col(['Weight', 'Wt']);
    const unitCol  = col(['Weight Unit', 'WeightUnit', 'Unit']);
    const purityCol= col(['Purity', 'Karat', 'Fineness']);
    const descCol  = col(['Description', 'Desc', 'Details']);
    const featCol  = col(['Featured', 'Feature', 'IsFeatured']);
    const imgCol   = col(['Image URL', 'ImageURL', 'Image', 'Photo', 'Picture', 'Img']);

    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const name  = String(row[nameCol]  || '').trim();
      const cat   = String(row[catCol]   || '').trim().toLowerCase();
      const price = parseFloat(row[priceCol]) || 0;

      if (!name) { errors.push({ row: rowNum, reason: 'Product Name is required' }); skipped++; return; }
      if (!VALID_CATS.includes(cat)) { errors.push({ row: rowNum, reason: `Invalid category "${row[catCol]}" — must be gold, diamond, or silver` }); skipped++; return; }
      if (price <= 0) { errors.push({ row: rowNum, reason: `Invalid price "${row[priceCol]}"` }); skipped++; return; }

      const rawImg = imgCol ? String(row[imgCol] || '').trim() : '';
      let image = null;
      if (rawImg) {
        const fname = path.basename(rawImg).toLowerCase();
        const fbase = path.basename(rawImg, path.extname(rawImg)).toLowerCase();

        if (/^https?:\/\//i.test(rawImg)) {
          // 1. HTTP URL — use directly
          image = rawImg;

        } else if (imageMap[fname] || imageMap[fbase]) {
          // 2. Matched an uploaded image file by filename
          image = imageMap[fname] || imageMap[fbase];

        } else {
          // 3. Try local disk paths (full path in cell, or folder + filename)
          const candidates = [
            rawImg,                                         // as typed in Excel
            imageFolder ? path.join(imageFolder, path.basename(rawImg)) : null, // folder + filename
          ].filter(Boolean);

          let copied = null;
          for (const candidate of candidates) {
            copied = copyLocalImage(candidate, i);
            if (copied) break;
          }

          if (copied) {
            image = copied;
          } else {
            const tried = candidates.map(c => `"${c}"`).join(', ');
            errors.push({ row: rowNum, reason: `Image "${fname}" not found (tried ${tried}). Check path or use the image folder field.` });
          }
        }
      }

      // Duplicate check
      const existing = store.products.search(name, cat).find(p => p.name.toLowerCase() === name.toLowerCase() && p.category === cat);
      if (existing) {
        if (skipDups) { errors.push({ row: rowNum, reason: `Duplicate skipped: "${name}" already exists in ${cat}` }); skipped++; return; }
        if (overDups) {
          const updateData = {
            name, category: cat, price,
            weight:      parseFloat(row[weightCol]) || 0,
            weight_unit: String(row[unitCol] || 'grams').trim(),
            purity:      String(row[purityCol] || '').trim(),
            description: String(row[descCol]  || '').trim(),
            is_featured: /yes|true|1/i.test(String(row[featCol] || '')),
          };
          if (image) updateData.image = image;
          store.products.update(existing.id, updateData);
          imported++; return;
        }
      }

      store.products.create({
        name, category: cat, price,
        weight:      parseFloat(row[weightCol]) || 0,
        weight_unit: String(row[unitCol] || 'grams').trim() || 'grams',
        purity:      String(row[purityCol] || '').trim(),
        description: String(row[descCol]  || '').trim(),
        is_featured: /yes|true|1/i.test(String(row[featCol] || '')),
        image,
      });
      imported++;
    });

    try { fs.unlinkSync(excelFile.path); } catch { /**/ }
    render({ imported, skipped, total: rows.length, errors }, null);
  } catch (err) {
    try { fs.unlinkSync(excelFile.path); } catch { /**/ }
    render(null, `Failed to read file: ${err.message}`);
  }
});

/* ── Export to Excel ──────────────────────────────────────────────────────── */
router.get('/products/export', requireAuth, (req, res) => {
  const products = store.products.all();
  const data = products.map(p => ({
    'ID':           p.id,
    'Product Name': p.name,
    'Category':     p.category.charAt(0).toUpperCase() + p.category.slice(1),
    'Price (₹)':   p.price,
    'Weight':       p.weight || '',
    'Weight Unit':  p.weight > 0 ? p.weight_unit : '',
    'Purity':       p.purity || '',
    'Description':  p.description || '',
    'Featured':     p.is_featured ? 'Yes' : 'No',
    'Status':       p.is_active   ? 'Active' : 'Hidden',
    'Image Path':   p.image || '',
    'Created Date': p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{ Message: 'No products found' }]);

  // Column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
    { wch: 10 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 30 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `shreeja-products-${new Date().toISOString().slice(0,10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});

/* ── Add product ──────────────────────────────────────────────────────────── */
router.get('/products/add', requireAuth, (req, res) =>
  res.render('admin/add-product', { title: 'Add Product – Admin', adminUsername: req.session.adminUsername, error: null, success: null }));

router.post('/products/add', requireAuth, upload.single('image'), (req, res) => {
  const { name, category, description, price, weight, weight_unit, purity, is_featured } = req.body;
  try {
    store.products.create({
      name, category, description, price, weight, weight_unit, purity,
      image: req.file ? '/uploads/' + req.file.filename : null,
      is_featured: !!is_featured,
    });
    res.render('admin/add-product', { title: 'Add Product – Admin', adminUsername: req.session.adminUsername, error: null, success: 'Product added successfully!' });
  } catch(err) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch { /**/ }
    res.render('admin/add-product', { title: 'Add Product – Admin', adminUsername: req.session.adminUsername, error: 'Error: ' + err.message, success: null });
  }
});

/* ── Edit product ─────────────────────────────────────────────────────────── */
router.get('/products/edit/:id', requireAuth, (req, res) => {
  const product = store.products.find(req.params.id);
  if (!product) return res.redirect('/admin/products');
  res.render('admin/edit-product', { title: 'Edit Product – Admin', adminUsername: req.session.adminUsername, product, error: null, success: null });
});

router.post('/products/edit/:id', requireAuth, upload.single('image'), (req, res) => {
  const id = req.params.id;
  const existing = store.products.find(id);
  if (!existing) return res.redirect('/admin/products');
  const { name, category, description, price, weight, weight_unit, purity, is_featured, is_active } = req.body;
  try {
    let image = existing.image;
    if (req.file) { deleteImage(existing.image); image = '/uploads/' + req.file.filename; }
    store.products.update(id, { name, category, description, price, weight, weight_unit, purity, image, is_featured: !!is_featured, is_active: !!is_active });
    const product = store.products.find(id);
    res.render('admin/edit-product', { title: 'Edit Product – Admin', adminUsername: req.session.adminUsername, product, error: null, success: 'Product updated successfully!' });
  } catch(err) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch { /**/ }
    res.render('admin/edit-product', { title: 'Edit Product – Admin', adminUsername: req.session.adminUsername, product: existing, error: 'Error: ' + err.message, success: null });
  }
});

router.post('/products/delete/:id', requireAuth, (req, res) => {
  const product = store.products.delete(req.params.id);
  if (product) deleteImage(product.image);
  res.redirect('/admin/products');
});

router.post('/products/toggle/:id', requireAuth, (req, res) => {
  store.products.toggleActive(req.params.id);
  res.redirect('/admin/products');
});

/* ── Inquiries ────────────────────────────────────────────────────────────── */
router.get('/inquiries', requireAuth, (req, res) => {
  const all = store.inquiries.all();
  res.render('admin/inquiries', { title: 'Enquiries – Admin', adminUsername: req.session.adminUsername, inquiries: all, newCount: store.inquiries.countNew() });
});

router.get('/inquiries/:id', requireAuth, (req, res) => {
  const inquiry = store.inquiries.find(req.params.id);
  if (!inquiry) return res.redirect('/admin/inquiries');
  store.inquiries.markRead(inquiry.id);
  res.render('admin/inquiry-detail', { title: 'Enquiry Detail – Admin', adminUsername: req.session.adminUsername, inquiry });
});

router.post('/inquiries/delete/:id', requireAuth, (req, res) => {
  store.inquiries.delete(req.params.id);
  res.redirect('/admin/inquiries');
});

/* ── Settings ─────────────────────────────────────────────────────────────── */
router.get('/settings', requireAuth, (req, res) => {
  const s = store.settings.all();
  res.render('admin/settings', { title: 'Settings – Admin', adminUsername: req.session.adminUsername, settings: s, success: null, error: null });
});

router.post('/settings', requireAuth, (req, res) => {
  const { ga4_id, smtp_host, smtp_port, smtp_user, smtp_pass, notify_email } = req.body;
  store.settings.setMany({ ga4_id: ga4_id || '', smtp_host: smtp_host || 'smtp.gmail.com', smtp_port: smtp_port || '587', smtp_user: smtp_user || '', smtp_pass: smtp_pass || '', notify_email: notify_email || '' });
  const s = store.settings.all();
  res.render('admin/settings', { title: 'Settings – Admin', adminUsername: req.session.adminUsername, settings: s, success: 'Settings saved successfully!', error: null });
});

/* ── Change password ──────────────────────────────────────────────────────── */
router.get('/change-password', requireAuth, (req, res) =>
  res.render('admin/change-password', { title: 'Change Password – Admin', adminUsername: req.session.adminUsername, error: null, success: null }));

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const user   = store.admins.findById(req.session.adminId);
  const render = (error, success) =>
    res.render('admin/change-password', { title: 'Change Password – Admin', adminUsername: req.session.adminUsername, error, success });
  if (!bcrypt.compareSync(current_password, user.password)) return render('Current password is incorrect', null);
  if (new_password !== confirm_password) return render('New passwords do not match', null);
  if (new_password.length < 6) return render('Password must be at least 6 characters', null);
  store.admins.updatePassword(req.session.adminId, bcrypt.hashSync(new_password, 10));
  render(null, 'Password changed successfully!');
});

module.exports = router;
