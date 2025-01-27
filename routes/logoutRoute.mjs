import { Router } from 'express';
import { removeRefreshToken } from '../utils/tokenUtils.mjs';

const router = Router();

router.post('/logout', (req, res) => {
  // Remove refresh token from storage
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    removeRefreshToken(refreshToken);
  }

  // Clear both cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  
  res.status(200).send('Sesión cerrada');
});

export { router as logoutRoute };
