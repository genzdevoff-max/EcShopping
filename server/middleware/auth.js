import jwt from 'jsonwebtoken';
import { fail } from '../utils/errors.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 24) {
  console.error(
    '❌ JWT_SECRET is missing or too short (need at least 24 characters).\n' +
    '   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
  process.exit(1);
}

const TOKEN_TTL = '7d';

export const signToken = ({ sub, role, email, name }) => {
  const payload = { sub, role, email, name };
  if (role === 'vendor') payload.vendorId = sub;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

const extractBearer = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
};

// requireAuth()          — any authenticated role
// requireAuth('admin')   — admins only
// requireAuth('vendor','admin') — any of the listed roles
export const requireAuth = (...roles) => (req, res, next) => {
  const token = extractBearer(req);
  if (!token) {
    return fail(res, 401, 'Authentication required');
  }

  const payload = verifyToken(token);
  if (!payload || !payload.sub || !payload.role) {
    return fail(res, 401, 'Session expired — please log in again');
  }

  if (roles.length > 0 && !roles.includes(payload.role)) {
    return fail(res, 403, 'You do not have permission to do this');
  }

  req.auth = {
    id: payload.sub,
    role: payload.role,
    email: payload.email || '',
    name: payload.name || '',
    vendorId: payload.role === 'vendor' ? payload.sub : null
  };
  next();
};

export const requireAdmin = requireAuth('admin');
export const requireVendorOrAdmin = requireAuth('vendor', 'admin');
export const requireCustomer = requireAuth('customer');

// Populates req.auth when a valid token is present; never rejects. Used by
// GET endpoints whose scope widens with a token but stay public otherwise.
export const optionalAuth = (req, res, next) => {
  const token = extractBearer(req);
  if (!token) {
    req.auth = null;
    return next();
  }
  const payload = verifyToken(token);
  if (payload && payload.sub && payload.role) {
    req.auth = {
      id: payload.sub,
      role: payload.role,
      email: payload.email || '',
      name: payload.name || '',
      vendorId: payload.role === 'vendor' ? payload.sub : null
    };
  } else {
    req.auth = null;
  }
  next();
};

export const requireCustomerOrAnon = (req, res, next) => {
  const token = extractBearer(req);
  if (!token) {
    req.auth = null;
    return next();
  }
  const payload = verifyToken(token);
  if (payload && payload.role === 'customer') {
    req.auth = { id: payload.sub, role: 'customer', email: payload.email || '', name: payload.name || '' };
  } else {
    req.auth = null;
  }
  next();
};
