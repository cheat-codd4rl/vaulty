import jwt from 'jsonwebtoken';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in the environment. Production builds require this secret.');
  }
  return secret;
}

export function signJwt(payload, options = {}) {
  return jwt.sign(payload, getSecret(), options);
}

export function verifyJwt(token) {
  return jwt.verify(token, getSecret());
}
