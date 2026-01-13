import jwt from 'jsonwebtoken';
import { User, Department } from '../models/index.js';

// Generate JWT token
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    department_id: user.department_id
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
}

// Verify JWT token middleware
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get fresh user data from database
    const user = await User.findByPk(decoded.id, {
      include: [{
        model: Department,
        as: 'Department'
      }],
      attributes: { exclude: ['ad_groups'] } // Exclude sensitive data
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found or inactive'
      });
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'The provided token has expired'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}

// Role-based authorization middleware
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    // Flatten the allowedRoles array in case arrays are passed
    const roles = allowedRoles.flat();
    
    // Debug logging (can be removed in production)
    console.log('Role check:', {
      userRole: req.user.role,
      allowedRoles: roles,
      user: req.user.username
    });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
}

// Department-specific authorization
export function requireDepartmentAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  // Super administrators can access all departments
  if (req.user.role === 'super_administrator') {
    return next();
  }

  // IT managers can access all departments
  if (req.user.role === 'it_manager') {
    return next();
  }

  // Department approvers can only access their own department
  if (req.user.role === 'department_approver') {
    const requestedDepartmentId = req.params.departmentId || req.body.department_id;
    
    if (requestedDepartmentId && requestedDepartmentId !== req.user.department_id) {
      return res.status(403).json({ 
        error: 'Department access denied',
        message: 'You can only access resources from your own department'
      });
    }
  }

  next();
}

// Request ownership or approval authorization
export function requireRequestAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    });
  }

  // Super administrators can access all requests
  if (req.user.role === 'super_administrator') {
    return next();
  }

  // This will be enhanced in the request routes to check specific request ownership
  next();
}

// Optional authentication (for public endpoints that can benefit from user context)
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        include: [{
          model: Department,
          as: 'Department'
        }]
      });

      if (user && user.is_active) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    console.log('Optional auth failed (ignored):', error.message);
  }

  next();
}

// Rate limiting for sensitive operations
export function sensitiveOperationLimit(req, res, next) {
  // This would typically integrate with a Redis-based rate limiter
  // For now, we'll use a simple in-memory approach
  const userKey = req.user?.id || req.ip;
  const now = Date.now();
  
  if (!req.app.locals.rateLimitStore) {
    req.app.locals.rateLimitStore = new Map();
  }
  
  const userAttempts = req.app.locals.rateLimitStore.get(userKey) || [];
  const recentAttempts = userAttempts.filter(time => now - time < 60000); // Last minute
  
  if (recentAttempts.length >= 5) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many attempts. Please try again in a minute.'
    });
  }
  
  recentAttempts.push(now);
  req.app.locals.rateLimitStore.set(userKey, recentAttempts);
  
  next();
}

