import express from 'express';
import { pool } from '../database/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// ========== OBTENER TODAS LAS CONFIGURACIONES ==========
router.get('/settings', async (req, res) => {
    try {
        const [settings] = await pool.query('SELECT * FROM Settings');
        
        // Convertir array a objeto key-value
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.settingKey] = {
                value: setting.settingValue,
                description: setting.description,
                updatedAt: setting.updatedAt
            };
        });

        res.json(settingsObj);
    } catch (error) {
        console.error('Error al obtener configuraciones:', error);
        res.status(500).json({ message: 'Error al obtener configuraciones' });
    }
});

// ========== OBTENER UNA CONFIGURACIÓN ESPECÍFICA ==========
router.get('/settings/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const [settings] = await pool.query(
            'SELECT * FROM Settings WHERE settingKey = ?',
            [key]
        );

        if (settings.length === 0) {
            return res.status(404).json({ message: 'Configuración no encontrada' });
        }

        res.json(settings[0]);
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ message: 'Error al obtener configuración' });
    }
});

// ========== ACTUALIZAR CONFIGURACIÓN (SOLO ADMIN) ==========
router.put('/settings/:key', verifyToken, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        // Verificar que el usuario sea administrador (por ahora, cualquier streamer puede actualizar)
        // En producción, agregar verificación de rol admin

        if (!value) {
            return res.status(400).json({ message: 'El valor es requerido' });
        }

        const [result] = await pool.query(
            'UPDATE Settings SET settingValue = ?, updatedAt = NOW() WHERE settingKey = ?',
            [value, key]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Configuración no encontrada' });
        }

        const [updated] = await pool.query(
            'SELECT * FROM Settings WHERE settingKey = ?',
            [key]
        );

        res.json({
            message: 'Configuración actualizada exitosamente',
            setting: updated[0]
        });
    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        res.status(500).json({ message: 'Error al actualizar configuración' });
    }
});

export default router;
