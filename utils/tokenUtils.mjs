import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '#root';
import { RefreshToken, cleanupExpiredTokens } from '../db/models/refreshToken.mjs';
import { Op } from 'sequelize';

const ACCESS_TOKEN_EXPIRATION = '15m';  // Shorter lifetime for access tokens
const REFRESH_TOKEN_EXPIRATION = '7d';  // Longer lifetime for refresh tokens
export const RENEWAL_THRESHOLD = 5 * 60; // 5 minutes in seconds

export function generateAccessToken(userData) {
    return jwt.sign({
        username: userData.username,
        id: userData.id,
        rol: userData.rol
    }, JWT_SECRET_KEY, { expiresIn: ACCESS_TOKEN_EXPIRATION });
}

export async function generateRefreshToken(userData) {
    console.log("userData: ", userData.id);
    const refreshToken = jwt.sign({
        username: userData.username,
        id: userData.id,
        rol: userData.rol,
        type: 'refresh'
    }, JWT_SECRET_KEY, { expiresIn: REFRESH_TOKEN_EXPIRATION });
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await RefreshToken.create({
        token: refreshToken,
        userId: userData.id,
        expiresAt
    });

    return refreshToken;
}

export function setTokenCookies(res, { accessToken, refreshToken }) {
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes
    });
    
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
}

export async function verifyRefreshToken(token) {
    const tokenRecord = await RefreshToken.findOne({
        where: { 
            token,
            expiresAt: { [Op.gt]: new Date() }
        }
    });

    if (!tokenRecord) {
        throw new Error('Refresh token not found or expired');
    }

    return jwt.verify(token, JWT_SECRET_KEY);
}

export async function removeRefreshToken(token) {
    await RefreshToken.destroy({
        where: { token }
    });
}

// Optional: Remove all refresh tokens for a user (on password change/security breach)
export async function removeAllUserRefreshTokens(userId) {
    await RefreshToken.destroy({
        where: { userId }
    });
}

// Schedule periodic cleanup of expired tokens
setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000); // Run daily
