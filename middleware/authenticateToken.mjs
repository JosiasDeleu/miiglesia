import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY} from '#root';
import { 
  generateAccessToken, 
  setTokenCookies, 
  verifyRefreshToken, 
  RENEWAL_THRESHOLD 
} from '../utils/tokenUtils.mjs';

export async function authenticateToken(req, res, next) {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;
  
  if (!accessToken) {
    console.log('no access token');
    if (!refreshToken) {
      console.log('no refresh token');
      return res.redirect('/login');
    }
    
    // Try to refresh the access token
    try {
      const decoded = await verifyRefreshToken(refreshToken);

      const newAccessToken = generateAccessToken({
        username: decoded.username,
        id: decoded.id,
        rol: decoded.rol,
      });

      setTokenCookies(res, { 
        accessToken: newAccessToken,
        refreshToken: refreshToken
      });

      req.user = decoded;
      // updateUserState(decoded);
      return next();
    } catch (err) {
      console.log("refresh token error", err);
      return res.redirect('/login');
    }
  }
  
  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET_KEY);
    req.user = decoded;
    // updateUserState(decoded);
    next();
  } catch (err) {
    console.log("access token error", err);
    return res.redirect('/login');
  }
}
