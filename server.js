const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies up to 20MB (for base64 PDF + DL image)
app.use(express.json({ limit: '20mb' }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Email configuration using environment variables
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// POST /api/submit-waiver
app.post('/api/submit-waiver', async (req, res) => {
  const { riderName, riderDate, pdfBase64, dlImageBase64 } = req.body;

  if (!riderName || !pdfBase64) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Check that email is configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({
      success: false,
      error: 'Email not configured. Set SMTP_USER and SMTP_PASS in .env file.'
    });
  }

  const safeName = riderName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  const filename = `RideAlong_Waiver_${safeName}.pdf`;

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.RECIPIENT_EMAIL || process.env.SMTP_USER,
      subject: `Ride-Along Waiver - ${riderName} - ${riderDate}`,
      text: [
        `A new Ride-Along Waiver has been submitted.`,
        ``,
        `Rider Name: ${riderName}`,
        `Date: ${riderDate}`,
        ``,
        `The signed PDF waiver (with DL photo embedded) is attached.`,
        dlImageBase64 ? `A separate copy of the Driver License photo is also attached.` : ''
      ].filter(Boolean).join('\n'),
      attachments: [
        {
          filename: filename,
          content: pdfBase64,
          encoding: 'base64',
          contentType: 'application/pdf'
        },
        ...(dlImageBase64 ? [{
          filename: `DL_Photo_${safeName}.jpg`,
          content: dlImageBase64,
          encoding: 'base64',
          contentType: 'image/jpeg'
        }] : [])
      ]
    };

    await transporter.sendMail(mailOptions);

    console.log(`Waiver emailed for: ${riderName}`);
    res.json({ success: true, message: 'Waiver emailed successfully' });

  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ride-Along Waiver server running at http://localhost:${PORT}`);
});
