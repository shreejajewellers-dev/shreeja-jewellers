/**
 * JSON file-based datastore — pure Node.js, no native compilation.
 */
const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'database.json');

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { /**/ }
  }
  return { products: [], admins: [], inquiries: [], settings: {}, _productSeq: 0, _adminSeq: 0, _inquirySeq: 0 };
}

function save(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

let _db = load();
if (!_db.inquiries) _db.inquiries = [];
if (!_db.settings)  _db.settings  = {};
if (!_db._inquirySeq) _db._inquirySeq = 0;

function persist() { save(_db); }
function now()  { return new Date().toISOString(); }
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function matchesFilter(item, filter) {
  return Object.entries(filter).every(([k, v]) => item[k] === v);
}
function applySort(arr, sortBy) {
  const copy = [...arr];
  if (!sortBy) return copy;
  const [key, dir] = sortBy.split(':');
  copy.sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av < bv) return dir === 'DESC' ? 1 : -1;
    if (av > bv) return dir === 'DESC' ? -1 : 1;
    return 0;
  });
  return copy;
}

/* ── Products ─────────────────────────────────────────────────────────────── */
const products = {
  _col() { return _db.products; },
  all()  { return clone(this._col()); },
  find(id) {
    const p = this._col().find(p => p.id === Number(id));
    return p ? clone(p) : null;
  },
  where(filter = {}, sort = 'created_at:DESC', limit = 0) {
    let result = this._col().filter(p => matchesFilter(p, filter));
    result = applySort(result, sort);
    if (limit > 0) result = result.slice(0, limit);
    return clone(result);
  },
  count(filter = {}) { return this._col().filter(p => matchesFilter(p, filter)).length; },
  search(q = '', category = '') {
    const ql = q.toLowerCase();
    return clone(this._col().filter(p => {
      const matchQ = !q || p.name.toLowerCase().includes(ql) || (p.description || '').toLowerCase().includes(ql);
      const matchC = !category || p.category === category;
      return matchQ && matchC;
    }).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  },
  related(excludeId, category, limit = 4) {
    const pool = this._col().filter(p => p.is_active && p.category === category && p.id !== Number(excludeId));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return clone(pool.slice(0, limit));
  },
  create(data) {
    _db._productSeq = (_db._productSeq || 0) + 1;
    const record = {
      id: _db._productSeq, name: data.name, category: data.category,
      description: data.description || '', price: parseFloat(data.price) || 0,
      weight: parseFloat(data.weight) || 0, weight_unit: data.weight_unit || 'grams',
      purity: data.purity || '', image: data.image || null,
      is_featured: data.is_featured ? 1 : 0, is_active: 1,
      created_at: now(), updated_at: now(),
    };
    _db.products.push(record); persist(); return clone(record);
  },
  update(id, data) {
    const idx = _db.products.findIndex(p => p.id === Number(id));
    if (idx === -1) return null;
    const p = _db.products[idx];
    Object.assign(p, {
      name:        data.name        !== undefined ? data.name        : p.name,
      category:    data.category    !== undefined ? data.category    : p.category,
      description: data.description !== undefined ? data.description : p.description,
      price:       data.price       !== undefined ? parseFloat(data.price)  || 0 : p.price,
      weight:      data.weight      !== undefined ? parseFloat(data.weight) || 0 : p.weight,
      weight_unit: data.weight_unit !== undefined ? data.weight_unit : p.weight_unit,
      purity:      data.purity      !== undefined ? data.purity      : p.purity,
      image:       data.image       !== undefined ? data.image       : p.image,
      is_featured: data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : p.is_featured,
      is_active:   data.is_active   !== undefined ? (data.is_active  ? 1 : 0) : p.is_active,
      updated_at:  now(),
    });
    persist(); return clone(p);
  },
  toggleActive(id) {
    const p = _db.products.find(p => p.id === Number(id));
    if (!p) return;
    p.is_active = p.is_active ? 0 : 1; p.updated_at = now(); persist();
  },
  delete(id) {
    const idx = _db.products.findIndex(p => p.id === Number(id));
    if (idx === -1) return null;
    const [removed] = _db.products.splice(idx, 1); persist(); return clone(removed);
  },
};

/* ── Admins ───────────────────────────────────────────────────────────────── */
const admins = {
  findByUsername(username) { const a = _db.admins.find(a => a.username === username); return a ? clone(a) : null; },
  findById(id)             { const a = _db.admins.find(a => a.id === Number(id));    return a ? clone(a) : null; },
  create(username, hashedPassword) {
    _db._adminSeq = (_db._adminSeq || 0) + 1;
    const record = { id: _db._adminSeq, username, password: hashedPassword, created_at: now() };
    _db.admins.push(record); persist(); return clone(record);
  },
  updatePassword(id, hashedPassword) {
    const a = _db.admins.find(a => a.id === Number(id));
    if (!a) return; a.password = hashedPassword; persist();
  },
};

/* ── Settings ─────────────────────────────────────────────────────────────── */
const settings = {
  get(key)        { return _db.settings[key] || ''; },
  set(key, value) { _db.settings[key] = value; persist(); },
  all()           { return clone(_db.settings); },
  setMany(obj)    { Object.assign(_db.settings, obj); persist(); },
};

/* ── Inquiries ────────────────────────────────────────────────────────────── */
const inquiries = {
  all()  { return clone(_db.inquiries).reverse(); },
  find(id) { const i = _db.inquiries.find(i => i.id === Number(id)); return i ? clone(i) : null; },
  create(data) {
    _db._inquirySeq = (_db._inquirySeq || 0) + 1;
    const record = {
      id: _db._inquirySeq,
      customer_name:  data.customer_name,
      customer_email: data.customer_email || '',
      customer_phone: data.customer_phone || '',
      message:        data.message || '',
      items:          data.items || [],
      total:          data.total || 0,
      status:         'new',
      created_at:     now(),
    };
    _db.inquiries.push(record); persist(); return clone(record);
  },
  markRead(id) {
    const i = _db.inquiries.find(i => i.id === Number(id));
    if (i) { i.status = 'read'; persist(); }
  },
  delete(id) {
    const idx = _db.inquiries.findIndex(i => i.id === Number(id));
    if (idx !== -1) { _db.inquiries.splice(idx, 1); persist(); }
  },
  countNew() { return _db.inquiries.filter(i => i.status === 'new').length; },
};

module.exports = { products, admins, settings, inquiries };
