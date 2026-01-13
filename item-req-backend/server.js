import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// import rateLimit from 'express-rate-limit'; // Removed for development
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import fs from 'fs';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import requestRoutes from './routes/requests.js';
import departmentRoutes from './routes/departments.js';
import svrRoutes from './routes/serviceVehicleRequests.js';
import workflowRoutes from './routes/workflows.js';

// Import database
import { sequelize } from './config/database.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting - DISABLED for development
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.'
// });

// Middleware
// Configure Helmet to work with CORS - disable crossOriginResourcePolicy for API
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - allow all origins (configure before routes)
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests explicitly
app.options('*', cors());

// app.use(limiter); // Disabled for development
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'IT Equipment Request API'
  });
});

// API Routes (must be before frontend static files)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/service-vehicle-requests', svrRoutes);
app.use('/api/workflows', workflowRoutes);
// Option 1: Serve frontend static files from backend (Single Port Deployment)
// This allows the backend to serve both API and frontend from the same port
// Works in both development and production - just needs the dist folder to exist
const frontendDistPath = join(__dirname, '..', 'item-req-frontend', 'dist');

// Check if frontend dist folder exists (built frontend)
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  // This must be LAST, after all API routes and error handlers
  app.get('*', (req, res) => {
    // Double-check it's not an API route (safety check)
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(join(frontendDistPath, 'index.html'));
  });
  console.log('✅ Option 1 Enabled: Frontend served from backend on port', PORT);
  console.log('   Frontend path:', frontendDistPath);
} else {
  console.log('⚠️  Frontend dist folder not found. Build frontend with: cd item-req-frontend && npm run build');
  console.log('   Currently running in API-only mode. Frontend should be accessed separately.');
}

// Error handling middleware (must be before frontend static serving)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors?.map(e => e.message) || err.message
    });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A record with this information already exists'
    });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Database connection and server start
async function startServer() {
  try {
    // Test database connection 
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync database models
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database models synchronized.');
    
    // Initialize default data (departments and workflows)
    try {
      const { initializeDefaultData } = await import('./models/index.js');
      await initializeDefaultData();
    } catch (error) {
      console.error('Warning: Failed to initialize default data:', error.message);
    }
    
    // Start server - listen on all interfaces (0.0.0.0) to allow network access
    const HOST = process.env.HOST || '0.0.0.0';
    
    // Get network IP addresses
    const getNetworkIPs = () => {
      const interfaces = os.networkInterfaces();
      const ips = [];
      
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          // Skip internal (loopback) and non-IPv4 addresses
          if (iface.family === 'IPv4' && !iface.internal) {
            ips.push(iface.address);
          }
        }
      }
      
      return ips.length > 0 ? ips : ['localhost'];
    };
    
    const networkIPs = getNetworkIPs();
    
    app.listen(PORT, HOST, () => {
      console.log(`\n✅ Server running on ${HOST}:${PORT}`);
      console.log(`\n📍 Access URLs:`);
      console.log(`   Local:    http://localhost:${PORT}`);
      
      if (networkIPs.length > 0) {
        networkIPs.forEach((ip, index) => {
          if (index === 0) {
            console.log(`   Network:  http://${ip}:${PORT}`);
          } else {
            console.log(`            http://${ip}:${PORT}`);
          }
        });
      }
      
      console.log(`\n📦 Deployment Mode: Option 1 (Single Port)`);
      console.log(`   - API: http://localhost:${PORT}/api/*`);
      console.log(`   - Frontend: http://localhost:${PORT}/*`);
      console.log(`\n🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 CORS: Enabled for all origins\n`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}
 
// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

startServer();
