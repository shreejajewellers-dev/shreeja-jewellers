const bcrypt = require('bcryptjs');
const store  = require('./datastore');

// Seed default admin on first run
const admin = store.admins.findByUsername('admin');
if (!admin) {
  const hashed = bcrypt.hashSync('shreeja@2024', 10);
  store.admins.create('admin', hashed);
  console.log('Default admin created  →  username: admin  |  password: shreeja@2024');
}

module.exports = store;
