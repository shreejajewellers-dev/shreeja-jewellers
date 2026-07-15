module.exports = {
  requireAuth(req, res, next) {
    if (req.session && req.session.adminId) return next();
    res.redirect('/admin/login');
  },
  redirectIfAuth(req, res, next) {
    if (req.session && req.session.adminId) return res.redirect('/admin/dashboard');
    next();
  }
};
