const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');

require('./database'); // init DB + seed admin
const store = require('./datastore');

const app = express();

// Ensure dirs exist
['data', path.join('public', 'uploads')].forEach(d => {
  const full = path.join(__dirname, d);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

app.use(session({
  secret: 'sj-shreeja-jewellers-2024-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));

// Expose GA4 ID to all templates via res.locals
app.use((req, res, next) => {
  res.locals.ga4_id = store.settings.get('ga4_id') || '';
  next();
});

app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('404', { title: 'Page Not Found' }));
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).render('404', { title: 'Server Error' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════════');
  console.log('  ✦  Shreeja Jewellers Website');
  console.log('══════════════════════════════════════════════');
  console.log(`  Website : http://localhost:${PORT}`);
  console.log(`  Admin   : http://localhost:${PORT}/admin`);
  console.log('  Login   : admin  /  shreeja@2024');
  console.log('══════════════════════════════════════════════\n');
});
