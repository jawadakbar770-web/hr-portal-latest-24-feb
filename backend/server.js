// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

dotenv.config();

const app = express();

// ================= SECURITY =================
app.use(
  helmet({
    contentSecurityPolicy: false, // Needed for some React assets
  })
);

// Rate Limiting
// ✅ UPDATED: Increased limit to 1000 to prevent 403/429 errors during heavy Admin/Employee activity
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per window
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter); // Apply only to API routes

// ================= BODY PARSER =================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ================= CORS =================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// ================= MONGODB CONNECTION =================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds
    });

    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed');
    console.error(error.message);
    process.exit(1);
  }
};

connectDB();

// ================= ROUTES =================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/notifications', require('./routes/notifications'));

// ================= PRODUCTION STATIC SERVE (Optional) =================
// If you build frontend and want backend to serve it:
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html'))
  );
}

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});