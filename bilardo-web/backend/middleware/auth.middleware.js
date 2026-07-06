// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

// Extract a Bearer token from the Authorization header.
function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

// Verify a JWT and return its decoded payload, or null when invalid/missing.
// Shared by the Express middleware and the Socket.IO handshake guard so both
// derive identity from the token instead of trusting client-supplied values.
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.user || !decoded.user.id || !decoded.user.username) {
      return null;
    }
    return decoded.user; // { id, username }
  } catch (err) {
    return null;
  }
}

// Express middleware: require a valid JWT and attach the user to req.user.
function authRequired(req, res, next) {
  const user = verifyToken(extractBearerToken(req));
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.user = user;
  next();
}

module.exports = { authRequired, verifyToken, extractBearerToken };
