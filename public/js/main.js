/* ── Mobile Nav Toggle ─────────────────────────────────────── */
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
    }
  });
}

/* ── Navbar scroll shadow ──────────────────────────────────── */
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(0,0,0,0.5)' : '';
  });
}

/* ── Admin Sidebar Toggle ──────────────────────────────────── */
const sidebarToggle = document.getElementById('sidebarToggle');
const adminSidebar  = document.getElementById('adminSidebar');
if (sidebarToggle && adminSidebar) {
  sidebarToggle.addEventListener('click', () => adminSidebar.classList.toggle('open'));
}

/* ── Image Preview on file input ───────────────────────────── */
const imageInput   = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg   = document.getElementById('imagePreviewImg');
if (imageInput && imagePreview) {
  imageInput.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-height:200px;margin:0 auto;border-radius:6px">`;
      imagePreview.classList.add('has-image');
      if (previewImg) previewImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── Delete confirmation (admin products table) ────────────── */
document.querySelectorAll('.delete-form').forEach(form => {
  form.addEventListener('submit', function(e) {
    const name = this.querySelector('[data-name]').dataset.name;
    if (!confirm('Delete "' + name + '"?\nThis cannot be undone.')) e.preventDefault();
  });
});

/* ── Auto-dismiss alerts ───────────────────────────────────── */
document.querySelectorAll('.alert-success').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity .5s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  }, 4000);
});

/* ── WhatsApp FAB (public pages) ──────────────────────────── */
if (!document.querySelector('.admin-topbar')) {
  const fab = document.createElement('a');
  fab.href = 'https://wa.me/917049035660?text=Hello%20Shreeja%20Jewellers%2C%20I%20would%20like%20to%20enquire%20about%20your%20jewellery.';
  fab.target = '_blank';
  fab.title = 'Chat on WhatsApp';
  fab.className = 'whatsapp-fab';
  fab.innerHTML = '<i class="fab fa-whatsapp"></i>';
  document.body.appendChild(fab);
}
