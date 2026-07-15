const nodemailer = require('nodemailer');
const store      = require('./datastore');

async function sendInquiryEmail(inquiry) {
  const s = store.settings.all();
  if (!s.smtp_user || !s.smtp_pass) return { sent: false, reason: 'SMTP not configured' };

  try {
    const transporter = nodemailer.createTransport({
      host:   s.smtp_host || 'smtp.gmail.com',
      port:   parseInt(s.smtp_port) || 587,
      secure: false,
      auth:   { user: s.smtp_user, pass: s.smtp_pass },
    });

    const itemsHtml = inquiry.items.map(item => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #333;">${item.name}</td>
        <td style="padding:10px;border-bottom:1px solid #333;text-transform:capitalize">${item.category}</td>
        <td style="padding:10px;border-bottom:1px solid #333;">${item.purity || '—'}</td>
        <td style="padding:10px;border-bottom:1px solid #333;">${item.weight > 0 ? item.weight + ' ' + item.weight_unit : '—'}</td>
        <td style="padding:10px;border-bottom:1px solid #333;color:#d4af37;font-weight:700">₹${Number(item.price).toLocaleString('en-IN')}</td>
      </tr>`).join('');

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;color:#e0e0e0">
<div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1a1200,#0a0a0a);padding:32px;text-align:center;border-bottom:2px solid #d4af37">
    <h1 style="margin:0;font-size:22px;color:#d4af37;letter-spacing:2px">SHREEJA JEWELLERS</h1>
    <p style="margin:8px 0 0;color:#888;font-size:14px">New Product Enquiry</p>
  </div>
  <div style="padding:28px">
    <h2 style="color:#d4af37;font-size:16px;margin-bottom:20px">Customer Details</h2>
    <table style="width:100%;margin-bottom:24px">
      <tr><td style="color:#888;padding:6px 0;width:140px">Name:</td><td style="color:#fff;font-weight:700">${inquiry.customer_name}</td></tr>
      <tr><td style="color:#888;padding:6px 0">Phone:</td><td style="color:#fff">${inquiry.customer_phone || '—'}</td></tr>
      <tr><td style="color:#888;padding:6px 0">Email:</td><td style="color:#fff">${inquiry.customer_email || '—'}</td></tr>
      ${inquiry.message ? `<tr><td style="color:#888;padding:6px 0;vertical-align:top">Message:</td><td style="color:#fff">${inquiry.message}</td></tr>` : ''}
    </table>
    <h2 style="color:#d4af37;font-size:16px;margin-bottom:16px">Enquired Products</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#1a1a1a">
          <th style="padding:10px;text-align:left;color:#888;font-size:12px">Product</th>
          <th style="padding:10px;text-align:left;color:#888;font-size:12px">Category</th>
          <th style="padding:10px;text-align:left;color:#888;font-size:12px">Purity</th>
          <th style="padding:10px;text-align:left;color:#888;font-size:12px">Weight</th>
          <th style="padding:10px;text-align:left;color:#888;font-size:12px">Price</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="margin-top:24px;padding:16px;background:#1a1200;border:1px solid #d4af37;border-radius:6px;text-align:right">
      <span style="color:#888;font-size:14px">Total Enquiry Value: </span>
      <span style="color:#d4af37;font-size:22px;font-weight:700">₹${Number(inquiry.total).toLocaleString('en-IN')}</span>
    </div>
    <p style="margin-top:24px;padding:16px;background:#0d0d0d;border-radius:6px;color:#888;font-size:13px">
      Enquiry received on ${new Date(inquiry.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}<br>
      Login to admin panel to view all enquiries.
    </p>
  </div>
</div>
</body>
</html>`;

    await transporter.sendMail({
      from:    `"Shreeja Jewellers Website" <${s.smtp_user}>`,
      to:      s.notify_email || s.smtp_user,
      subject: `New Enquiry: ${inquiry.customer_name} — ${inquiry.items.length} item(s) — ₹${Number(inquiry.total).toLocaleString('en-IN')}`,
      html,
    });
    return { sent: true };
  } catch(err) {
    console.error('Email send error:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendInquiryEmail };
