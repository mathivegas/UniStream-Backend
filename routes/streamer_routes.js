import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ========== OBTENER TODOS LOS STREAMERS ==========
router.get("/streamers", async (req, res) => {
    try {
        const [streamers] = await pool.query(
            'SELECT id, name, email, avatar, bio, isLive, liveChannelName, liveStartedAt, level, points, hoursStreamed FROM streamers ORDER BY isLive DESC'
        );
        res.status(200).json(streamers);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener streamers", error: error.message });
    }
});

// ========== OBTENER STREAMERS EN VIVO ==========
router.get("/streamers/live", async (req, res) => {
    try {
        const [liveStreamers] = await pool.query(
            'SELECT id, name, email, avatar, bio, isLive, liveChannelName, liveStartedAt, level, points FROM streamers WHERE isLive = ?',
            [true]
        );
        res.status(200).json(liveStreamers);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener streamers en vivo", error: error.message });
    }
});

// ========== OBTENER UN STREAMER POR ID ==========
router.get("/streamers/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [streamers] = await pool.query(
            'SELECT id, name, email, avatar, bio, isLive, liveChannelName, liveStartedAt, level, points, hoursStreamed, coins FROM streamers WHERE id = ?',
            [id]
        );

        if (streamers.length === 0) {
            return res.status(404).json({ message: "Streamer no encontrado" });
        }

        res.status(200).json(streamers[0]);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener streamer", error: error.message });
    }
});

// ========== ACTUALIZAR PERFIL DE STREAMER ==========
router.put("/streamers/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bio, avatar } = req.body;

        // Verificar que es el mismo usuario
        if (req.user.id !== id) {
            return res.status(403).json({ message: "No tienes permiso para editar este perfil" });
        }

        const [streamers] = await pool.query('SELECT * FROM streamers WHERE id = ?', [id]);
        if (streamers.length === 0) {
            return res.status(404).json({ message: "Streamer no encontrado" });
        }

        // Actualizar solo los campos permitidos
        const updates = [];
        const values = [];
        
        if (name) {
            updates.push('name = ?');
            values.push(name);
        }
        if (bio) {
            updates.push('bio = ?');
            values.push(bio);
        }
        if (avatar) {
            updates.push('avatar = ?');
            values.push(avatar);
        }

        if (updates.length > 0) {
            updates.push('updatedAt = ?');
            values.push(new Date());
            values.push(id);
            
            await pool.query(
                `UPDATE streamers SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        const [updatedStreamer] = await pool.query('SELECT * FROM streamers WHERE id = ?', [id]);

        res.json({
            message: "Perfil actualizado exitosamente",
            user: updatedStreamer[0],
        });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar perfil", error: error.message });
    }
});

// ========== INICIAR TRANSMISIÓN ==========
router.post("/streams/start", verifyToken, async (req, res) => {
    try {
        const streamerId = req.user.id;

        const [streamers] = await pool.query('SELECT * FROM streamers WHERE id = ?', [streamerId]);
        if (streamers.length === 0) {
            return res.status(404).json({ message: "Streamer no encontrado" });
        }

        // Marcar como en vivo
        await pool.query(
            'UPDATE streamers SET isLive = ?, updatedAt = ? WHERE id = ?',
            [true, new Date(), streamerId]
        );

        const [updatedStreamer] = await pool.query('SELECT * FROM streamers WHERE id = ?', [streamerId]);

        res.json({
            message: "Transmisión iniciada",
            streamer: updatedStreamer[0],
        });
    } catch (error) {
        res.status(500).json({ message: "Error al iniciar transmisión", error: error.message });
    }
});

// ========== TERMINAR TRANSMISIÓN ==========
router.post("/streams/end", verifyToken, async (req, res) => {
    try {
        const { hoursStreamed } = req.body;
        const streamerId = req.user.id;

        const [streamers] = await pool.query('SELECT * FROM streamers WHERE id = ?', [streamerId]);
        if (streamers.length === 0) {
            return res.status(404).json({ message: "Streamer no encontrado" });
        }

        const streamer = streamers[0];
        let newHours = streamer.hoursStreamed || 0;
        let newPoints = streamer.points || 0;
        let newLevel = streamer.level || 1;

        // Actualizar horas transmitidas
        if (hoursStreamed) {
            newHours += hoursStreamed;
            newPoints += Math.floor(hoursStreamed * 10); // 10 puntos por hora
            newLevel = Math.floor(newHours / 5) + 1; // 1 nivel cada 5 horas
        }

        // Marcar como no en vivo
        await pool.query(
            'UPDATE streamers SET isLive = ?, hoursStreamed = ?, points = ?, level = ?, updatedAt = ? WHERE id = ?',
            [false, newHours, newPoints, newLevel, new Date(), streamerId]
        );

        const [updatedStreamer] = await pool.query('SELECT * FROM streamers WHERE id = ?', [streamerId]);

        res.json({
            message: "Transmisión finalizada",
            streamer: updatedStreamer[0],
        });
    } catch (error) {
        res.status(500).json({ message: "Error al finalizar transmisión", error: error.message });
    }
});

// ========== OBTENER ESTADÍSTICAS DEL STREAMER ==========
router.get("/streamers/:id/stats", async (req, res) => {
    try {
        const { id } = req.params;

        const [streamers] = await pool.query(
            'SELECT name, level, points, hoursStreamed, coins, isLive FROM streamers WHERE id = ?',
            [id]
        );

        if (streamers.length === 0) {
            return res.status(404).json({ message: "Streamer no encontrado" });
        }

        const streamer = streamers[0];
        res.json({
            name: streamer.name,
            level: streamer.level,
            points: streamer.points,
            hoursStreamed: streamer.hoursStreamed,
            coins: streamer.coins,
            isLive: streamer.isLive,
        });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener estadísticas", error: error.message });
    }
});

// ========== ACTUALIZAR HORAS DE TRANSMISIÓN ==========
router.put("/streamers/:id/hours", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { hoursToAdd } = req.body;

        if (req.user.id !== id) {
            return res.status(403).json({ message: "No autorizado" });
        }

        const [streamers] = await pool.query('SELECT * FROM streamers WHERE id = ?', [id]);
        if (streamers.length === 0) {
            return res.status(404).json({ message: "Streamer no encontrado" });
        }

        const streamer = streamers[0];
        const oldHours = streamer.hoursStreamed || 0;
        const newHours = oldHours + (hoursToAdd || 0);
        
        // Calcular niveles GANADOS en esta sesión (1 nivel cada 5 horas)
        const oldLevelFromHours = Math.floor(oldHours / 5);
        const newLevelFromHours = Math.floor(newHours / 5);
        const levelsGained = newLevelFromHours - oldLevelFromHours;
        
        // Sumar niveles ganados al nivel actual
        const finalLevel = streamer.level + levelsGained;

        console.log('📊 Actualización de nivel:', {
            oldHours,
            newHours,
            hoursToAdd,
            oldLevelFromHours,
            newLevelFromHours,
            levelsGained,
            currentLevel: streamer.level,
            finalLevel
        });

        await pool.query(
            'UPDATE streamers SET hoursStreamed = ?, level = ?, updatedAt = ? WHERE id = ?',
            [newHours, finalLevel, new Date(), id]
        );

        res.json({
            hoursStreamed: newHours,
            level: finalLevel,
            points: streamer.points,
        });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar horas", error: error.message });
    }
});

// ========== ACTUALIZAR PUNTOS DE STREAMER ==========
router.put("/streamers/:id/points", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { pointsToAdd } = req.body;

        if (req.user.id !== id) {
            return res.status(403).json({ message: "No autorizado" });
        }

        const [streamers] = await pool.query('SELECT * FROM streamers WHERE id = ?', [id]);
        if (streamers.length === 0) {
            return res.status(404).json({ message: "Streamer no encontrado" });
        }

        const streamer = streamers[0];
        const newPoints = (streamer.points || 0) + (pointsToAdd || 0);
        
        // Calcular nivel basado en puntos (lógica simple: cada 100 puntos = 1 nivel)
        const newLevel = Math.floor(newPoints / 100) + 1;
        const finalLevel = Math.max(streamer.level, newLevel);

        await pool.query(
            'UPDATE streamers SET points = ?, level = ?, updatedAt = ? WHERE id = ?',
            [newPoints, finalLevel, new Date(), id]
        );

        res.json({
            points: newPoints,
            level: finalLevel,
        });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar puntos", error: error.message });
    }
});

export default router;
