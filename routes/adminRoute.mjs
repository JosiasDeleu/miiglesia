import { Router } from 'express';
import path from 'path';
import { authenticateToken } from '../middleware/authenticateToken.mjs';
import bcrypt from 'bcrypt';
import {runQueryPrivateTables} from '../db/query.js';
import { addLogFunction } from '../utils/addAuditLog.js';
import { getAuditLogs } from '../utils/getAuditLogs.mjs';
import { sendPasswordEmail } from '../utils/emailService.mjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const ADMIN_USER_ID = Number(process.env.ADMIN_USER_ID);
const STD_USER_ID = Number(process.env.STD_USER_ID);

const adminRoute = Router();

// Function to get user data from token
const getUserFromToken = (req) => {
    const token = req.cookies.accessToken;
    if (!token) {
        return null;
    }
    try {
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET_KEY);
        return {
            loggedUserId: decoded.id,
            loggedUserRol: decoded.rol
        };
    } catch (error) {
        console.log('Token error:', error);
        return null;
    }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    const user = getUserFromToken(req);
    if (!user || user.loggedUserRol !== ADMIN_USER_ID) {
        return res.status(403).send('Forbidden');
    }
    next();
};

// Serve admin page
adminRoute.get('/admin', authenticateToken, (req, res) => {
    const adminFilePath = path.join(process.cwd(), 'public', 'admin', 'admin.html');
    return res.sendFile(adminFilePath);
});

// Get current user info
adminRoute.get('/api/user/me', authenticateToken, async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).send('Unauthorized');
    try {
        const result = await runQueryPrivateTables({
            query: 'SELECT first_middle_name, last_name, email, role_id FROM users WHERE id = $1 AND active = true',
            values: [user.loggedUserId]
        });
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener información del usuario' });
    }
});

// Update user info
adminRoute.put('/api/user/update', authenticateToken, async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).send('Unauthorized');

    const { nombre, apellido, email } = req.body;
    try {
        await runQueryPrivateTables({
            query: 'UPDATE users SET first_middle_name = $1, last_name = $2, email = $3 WHERE id = $4',
            values: [nombre, apellido, email, user.loggedUserId]
        });
        
        addLogFunction(user.loggedUserId, 'Actualizar', 'Usuarios', `Actualizar usuario con ID: ${user.loggedUserId}, nombre: ${nombre}, apellido: ${apellido}, email: ${email}`);
        res.json({ message: 'Información actualizada con éxito' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la información' });
    }
});

// Change password
adminRoute.put('/api/user/password', authenticateToken, async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).send('Unauthorized');

    const { currentPassword, newPassword } = req.body;
    try {
        // Verify current password
        const userResult = await runQueryPrivateTables({
            query: 'SELECT password FROM users WHERE id = $1',
            values: [user.loggedUserId]
        });
        const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
        
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid current password' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await runQueryPrivateTables({
            query: 'UPDATE users SET password = $1 WHERE id = $2',
            values: [hashedPassword, user.loggedUserId]
        });

        addLogFunction(user.loggedUserId, 'Actualizar', 'Usuarios', `Actualizar su propia clave`);
        res.json({ message: 'Clave actualizada con éxito' });
    } catch (error) {
        console.log("Error al actualizar la clave: ", error);
        res.status(500).json({ error: 'Error al actualizar la clave' });
    }
});

// Member search for new user creation
adminRoute.get('/api/members/search', authenticateToken, async (req, res) => {
    const { query } = req.query;
    const minSimilarity = 0.1;

    try {
        const sqlQuery = `
        SELECT 
            id,
            first_middle_name,
            last_name,
            email
        FROM 
            people
        WHERE 
            SIMILARITY(normalized_full_name, LOWER(unaccent('mart'))) > 0.1
            AND people.active = true -- Exclude inactive people
            AND NOT EXISTS (
                SELECT 1 
                FROM users 
                WHERE users.person_id = people.id 
                AND users.active = true -- Exclude people with active users
            )
        ORDER BY 
            SIMILARITY(normalized_full_name, LOWER(unaccent('mart'))) DESC;
        `;
        
        const result = await runQueryPrivateTables({
            query: sqlQuery,
            values: [query, minSimilarity]
        });

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error searching members' });
    }
});

// Create new user
adminRoute.post('/api/user/create', authenticateToken, isAdmin, async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).send('Unauthorized');
    
    const { nombre, apellido, email, rol, member_id } = req.body;
    const emailLowerCase = email.toLowerCase();
    try {
        // Map frontend role values to database IDs
        const rolMapping = {
            'admin': ADMIN_USER_ID,
            'user': STD_USER_ID,
        };

        const rolId = rolMapping[rol];
        if (!rolId) {
            return res.status(400).json({ error: 'Rol inválido' });
        }

        // Check if user exists but is inactive
        const existingUser = await runQueryPrivateTables({
            query: 'SELECT id FROM users WHERE email = $1 AND active = false',
            values: [emailLowerCase]
        });

        let result;
        if (existingUser.rows.length > 0) {
            // Reactivate and update existing user
            result = await runQueryPrivateTables({
                query: `UPDATE users 
                        SET first_middle_name = $1, 
                            last_name = $2, 
                            email = $3, 
                            role_id = $4, 
                            person_id = $5,
                            active = true
                        WHERE id = $6
                        RETURNING id`,
                values: [nombre, apellido, emailLowerCase, rolId, member_id, existingUser.rows[0].id]
            });

            addLogFunction(user.loggedUserId, 'Reactivar', 'Usuarios', `Reactivar usuario con ID: ${existingUser.rows[0].id}, nombre: ${nombre}, apellido: ${apellido}, email: ${emailLowerCase}, rol: ${rol}`);
            
            // Generate new password for reactivated user
            const tempPassword = Math.random().toString(36).slice(-8);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(tempPassword, salt);

            // Update password
            await runQueryPrivateTables({
                query: 'UPDATE users SET password = $1 WHERE id = $2',
                values: [hashedPassword, existingUser.rows[0].id]
            });

            // Send password email
            const emailSent = await sendPasswordEmail(emailLowerCase, tempPassword, nombre);

            return res.json({ 
                message: emailSent 
                    ? 'Usuario reactivado con éxito. Se ha enviado la nueva contraseña por correo.' 
                    : 'Usuario reactivado con éxito, pero hubo un error al enviar el correo. Contraseña temporal: ' + tempPassword,
                tempPassword: !emailSent ? tempPassword : undefined
            });
        }

        // If no inactive user exists, create new user
        // Generate random password
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        result = await runQueryPrivateTables({
            query: 'INSERT INTO users (first_middle_name, last_name, email, password, role_id, person_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            values: [nombre, apellido, emailLowerCase, hashedPassword, rolId, member_id]
        });

        addLogFunction(user.loggedUserId, 'Crear', 'Usuarios', `Crear usuario con ID: ${result.rows[0].id}, nombre: ${nombre}, apellido: ${apellido}, email: ${emailLowerCase}`);

        // Send password email
        const emailSent = await sendPasswordEmail(emailLowerCase, tempPassword, nombre);
        
        res.json({ 
            message: emailSent 
                ? 'Usuario creado con éxito. Se ha enviado la contraseña por correo.' 
                : 'Usuario creado con éxito, pero hubo un error al enviar el correo. Contraseña temporal: ' + tempPassword,
            tempPassword: !emailSent ? tempPassword : undefined
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
});

// Get all users
adminRoute.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
    const user = getUserFromToken(req);
    try {
        const result = await runQueryPrivateTables({
            query: `SELECT u.id, u.first_middle_name, u.last_name, u.email, r.name as role_name, u.role_id
             FROM users u
             JOIN aux_user_roles r ON u.role_id = r.id
             WHERE u.id != $1 AND u.active = true`,
            values: [user.loggedUserId]
        });
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error getting users' });
    }
});

// Get specific user
adminRoute.get('/api/user/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await runQueryPrivateTables({
            query: `SELECT u.id, u.first_middle_name, u.last_name, u.email, r.name as role_name, u.role_id
             FROM users u
             JOIN aux_user_roles r ON u.role_id = r.id
             WHERE u.id = $1 AND u.active = true`,
            values: [req.params.id]
        });
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el usuario' });
    }
});

// Update specific user
adminRoute.put('/api/user/:id', authenticateToken, isAdmin, async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).send('Unauthorized');
    
    const { nombre, apellido, email, rol } = req.body;
    try {
        // First check if user exists and is active
        const userExists = await runQueryPrivateTables({
            query: 'SELECT id FROM users WHERE id = $1 AND active = true',
            values: [req.params.id]
        });

        if (userExists.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
        }

        // Map frontend role values to database IDs
        const rolMapping = {
            'admin': ADMIN_USER_ID,
            'user': STD_USER_ID,
        };

        const rolId = rolMapping[rol];
        if (!rolId) {
            return res.status(400).json({ error: 'Rol inválido' });
        }

        await runQueryPrivateTables({
            query: 'UPDATE users SET first_middle_name = $1, last_name = $2, email = $3, role_id = $4 WHERE id = $5',
            values: [nombre, apellido, email, rolId, req.params.id]
        });

        addLogFunction(user.loggedUserId, 'Actualizar', 'Usuarios', `Actualizar usuario con ID: ${req.params.id}, nombre: ${nombre}, apellido: ${apellido}, email: ${email}, rol: ${rol}`);
        res.json({ message: 'Usuario actualizado con éxito' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
});

// Delete user
adminRoute.delete('/api/user/:id', authenticateToken, isAdmin, async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).send('Unauthorized');
    
    try {
        const result = await runQueryPrivateTables({
            query: 'UPDATE users SET active = false WHERE id = $1 RETURNING first_middle_name, last_name, email, role_id',
            values: [req.params.id]
        });

        addLogFunction(user.loggedUserId, 'Desactivar', 'Usuarios', `Desactivar usuario con ID: ${req.params.id}, nombre: ${result.rows[0].first_middle_name}, apellido: ${result.rows[0].last_name}, email: ${result.rows[0].email}, rol: ${result.rows[0].role_id}`);
        res.json({ message: 'Usuario desactivado con éxito' });
    } catch (error) {
        res.status(500).json({ error: 'Error al desactivar el usuario' });
    }
});

// Get audit logs
adminRoute.get('/api/audit-logs', authenticateToken, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const filters = {
            accion: req.query.accion,
            categoria: req.query.categoria,
            detalle: req.query.detalle,
            usuario: req.query.usuario,
            fechaDesde: req.query.fechaDesde,
            fechaHasta: req.query.fechaHasta
        };
        const result = await getAuditLogs(page, limit, filters);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los registros de auditoría' });
    }
});

export { adminRoute };