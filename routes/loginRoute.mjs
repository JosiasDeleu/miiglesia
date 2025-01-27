import { Router } from 'express';
import path from 'path';
import bcrypt from 'bcrypt';
import { authenticateUser } from '../middleware/autentication.js';
import { generateAccessToken, generateRefreshToken, setTokenCookies } from '../utils/tokenUtils.mjs';
import { runQueryPrivateTables } from '../db/query.js';
import { sendPasswordResetEmail } from '../utils/emailService.mjs';

const router = Router();
const __dirname = path.resolve();

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const sanitizedUsername = username.trim().toLowerCase();
  const authResult = await authenticateUser(sanitizedUsername, password);

  if (!authResult) {
    console.log("Invalid password");
    return res.status(401).send({ message: 'Usuario o contraseña incorrecta' });
  } else {
    const userData = {
      username: authResult.username,
      id: authResult.id,
      rol: authResult.rol
    };

    try {
      const accessToken = generateAccessToken(userData);
      const refreshToken = await generateRefreshToken(userData);
      setTokenCookies(res, { accessToken, refreshToken });
      res.json({ message: 'Login exitoso' });
    } catch (error) {
      console.error('Token generation error:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
});

router.post('/refresh-token', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token not provided' });
  }

  try {
    const decoded = await verifyRefreshToken(refreshToken);
    const accessToken = generateAccessToken({
      username: decoded.username,
      id: decoded.id,
      rol: decoded.rol
    });

    setTokenCookies(res, { 
      accessToken,
      refreshToken: refreshToken // Reuse existing refresh token
    });

    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    await removeRefreshToken(refreshToken);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    const result = await runQueryPrivateTables({
      query: 'SELECT id, first_middle_name FROM users WHERE email = $1',
      values: [email.toLowerCase()]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No existe una cuenta con este correo electrónico' });
    }

    const user = result.rows[0];
    const tempPassword = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    await runQueryPrivateTables({
      query: 'UPDATE users SET password = $1 WHERE id = $2',
      values: [hashedPassword, user.id]
    });

    console.log("Password reset for user:", user.first_middle_name.split(' ')[0]);
    const emailSent = await sendPasswordResetEmail(email, tempPassword, user.first_middle_name.split(' ')[0]);

    if (emailSent) {
      res.json({ message: 'Se ha enviado una nueva contraseña a su correo electrónico' });
    } else {
      res.status(500).json({ message: 'Error al enviar el correo electrónico' });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export { router as loginRoute };
