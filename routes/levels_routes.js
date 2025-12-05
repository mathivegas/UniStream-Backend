import express from 'express';
import { pool } from '../database/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/streamers/:streamerId/levels - Get all levels for a streamer
router.get('/:streamerId/levels', async (req, res) => {
    try {
        const { streamerId } = req.params;
        
        const [levels] = await pool.query(
            'SELECT * FROM Levels WHERE streamerId = ? ORDER BY levelNumber ASC',
            [streamerId]
        );
        
        res.json(levels);
    } catch (error) {
        console.error('Error fetching levels:', error);
        res.status(500).json({ error: 'Error al obtener niveles' });
    }
});

// POST /api/streamers/:streamerId/levels - Create a new level
router.post('/:streamerId/levels', verifyToken, async (req, res) => {
    try {
        const { streamerId } = req.params;
        const { levelNumber, levelName, requiredPoints } = req.body;
        
        // Verify the authenticated user is the same streamer
        if (req.user.id !== streamerId) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        // Validation
        if (!levelNumber || !levelName || requiredPoints === undefined) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        
        const [result] = await pool.query(
            'INSERT INTO Levels (streamerId, levelNumber, levelName, requiredPoints) VALUES (?, ?, ?, ?)',
            [streamerId, levelNumber, levelName, requiredPoints]
        );
        
        res.status(201).json({
            id: result.insertId,
            streamerId,
            levelNumber,
            levelName,
            requiredPoints
        });
    } catch (error) {
        console.error('Error creating level:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Este nivel ya existe para este streamer' });
        }
        res.status(500).json({ error: 'Error al crear nivel' });
    }
});

// PUT /api/streamers/:streamerId/levels/:levelId - Update a level
router.put('/:streamerId/levels/:levelId', verifyToken, async (req, res) => {
    try {
        const { streamerId, levelId } = req.params;
        const { levelName, requiredPoints } = req.body;
        
        // Verify the authenticated user is the same streamer
        if (req.user.id !== streamerId) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        // Validation
        if (!levelName || requiredPoints === undefined) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        
        const [result] = await pool.query(
            'UPDATE Levels SET levelName = ?, requiredPoints = ? WHERE id = ? AND streamerId = ?',
            [levelName, requiredPoints, levelId, streamerId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Nivel no encontrado' });
        }
        
        res.json({
            id: levelId,
            streamerId,
            levelName,
            requiredPoints
        });
    } catch (error) {
        console.error('Error updating level:', error);
        res.status(500).json({ error: 'Error al actualizar nivel' });
    }
});

// DELETE /api/streamers/:streamerId/levels/:levelId - Delete a level
router.delete('/:streamerId/levels/:levelId', verifyToken, async (req, res) => {
    try {
        const { streamerId, levelId } = req.params;
        
        // Verify the authenticated user is the same streamer
        if (req.user.id !== streamerId) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const [result] = await pool.query(
            'DELETE FROM Levels WHERE id = ? AND streamerId = ?',
            [levelId, streamerId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Nivel no encontrado' });
        }
        
        res.json({ message: 'Nivel eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting level:', error);
        res.status(500).json({ error: 'Error al eliminar nivel' });
    }
});

export default router;
