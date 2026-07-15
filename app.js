const express       = require('express');
const cookieSession = require('cookie-session');
const path          = require('path');
const fs            = require('fs');

require('./database'); // init DB + seed admin
const store = require('./datastore');

const app = express();

// Ensure dirs exist (safe on read-only FS — just ignores errors)
['data', path.join('public', 'uploads')].forEach(d => {
  try {
    const full = path.join(__dirname, d);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  } catch (_) { /* read-only FS on serverless — skip */ }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// cookie-session: stores cart + admin auth in a signed cookie
// Works on serverless (no server-side storage needed)
// Set SESSION_SECRET env var in Netlify dashboard for production security
app.use(cookieSession({
  name:     'sj_session',
  secret:   process.env.SESSION_SECRET || 'dev-only-change-in-production',
  maxAge:   24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure:   !!process.env.NETLIFY, // HTTPS on Netlify, HTTP locally
}));

// Expose GA4 ID to all templates
app.use((req, res, next) => {
  res.locals.ga4_id = store.settings.get('ga4_id') || '';
  next();
});

app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('404', { title: 'Page Not Found' }));
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).render('404', { title: 'Server Error' }); });

module.exports = app;
