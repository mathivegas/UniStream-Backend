import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// ========== OBTENER TODOS LOS STREAMERS ==========
router.get("/streamers", async (req, res) => {
    try {
        const [streamers] = await pool.query(
            'SELECT id, name, email, avatar, bio, isLive, liveChannelName, liveStartedAt, level, points FROM Streamers'
        );
        res.status(200).json(streamers);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener streamers", error: error.message });
    }
});

// ========== CREAR REGALO (STREAMER) ==========
router.post("/gifts", verifyToken, async (req, res) => {
    try {
        const { name, emoji, cost, points, description } = req.body;
        const streamerId = req.user.id;

        if (!name || !emoji || !cost || !points) {
            return res.status(400).json({ message: "Faltan campos requeridos: name, emoji, cost, points" });
        }

        const giftId = uuidv4();
        const now = new Date();

        await pool.query(
            'INSERT INTO Gifts (id, streamerId, name, emoji, cost, points, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [giftId, streamerId, name, emoji, cost, points, description || '', now, now]
        );

        const [newGift] = await pool.query('SELECT * FROM Gifts WHERE id = ?', [giftId]);
        res.status(201).json(newGift[0]);
    } catch (error) {
        res.status(500).json({ message: "Error al crear regalo", error: error.message });
    }
});

// ========== ELIMINAR REGALO (STREAMER) ==========
router.delete("/gifts/:giftId", verifyToken, async (req, res) => {
    try {
        const { giftId } = req.params;
        const streamerId = req.user.id;

        // Verificar que el regalo pertenece al streamer
        const [gifts] = await pool.query('SELECT * FROM Gifts WHERE id = ? AND streamerId = ?', [giftId, streamerId]);
        if (gifts.length === 0) {
            return res.status(404).json({ message: "Regalo no encontrado o no tienes permiso para eliminarlo" });
        }

        await pool.query('DELETE FROM Gifts WHERE id = ?', [giftId]);
        res.status(200).json({ message: "Regalo eliminado exitosamente" });
    } catch (error) {
        res.status(500).json({ message: "Error al eliminar regalo", error: error.message });
    }
});

// ========== OBTENER REGALOS DE UN STREAMER ==========
router.get("/gifts/:streamerId", async (req, res) => {
    try {
        const { streamerId } = req.params;
        const [gifts] = await pool.query(
            'SELECT id, name, emoji, cost, points, description FROM Gifts WHERE streamerId = ? ORDER BY cost ASC',
            [streamerId]
        );
        res.status(200).json(gifts);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener regalos", error: error.message });
    }
});

// ========== OBTENER TODOS LOS REGALOS (deprecado - usar /gifts/:streamerId) ==========
router.get("/gifts", async (req, res) => {
    try {
        const [gifts] = await pool.query(
            'SELECT id, name, emoji, cost, points, description, streamerId FROM Gifts ORDER BY cost ASC'
        );
        res.status(200).json(gifts);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener regalos", error: error.message });
    }
});

// ========== OBTENER TODOS LOS ESPECTADORES ==========
router.get("/spectators", async (req, res) => {
    try {
        const [spectators] = await pool.query(
            'SELECT id, name, email, coins, points, level, avatar, bio, createdAt, updatedAt FROM Spectators'
        );
        res.status(200).json(spectators);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener espectadores", error: error.message });
    }
});

// ========== OBTENER DATOS DEL ESPECTADOR ACTUAL (usando token) ==========
// CRÍTICO: Esta ruta DEBE ir ANTES que /spectators/:id para evitar conflictos
router.get("/spectators/me", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('📡 GET /spectators/me - userId:', userId);

        // Solo retornar datos globales (coins). Points y level son per-streamer (SpectatorStreamerProgress)
        let [spectators] = await pool.query(
            'SELECT id, name, email, coins FROM Spectators WHERE id = ?',
            [userId]
        );

        // Si no existe, crear espectador con valores por defecto
        if (spectators.length === 0) {
            const email = req.user.email;
            const now = new Date();
            console.log('➕ Creando nuevo espectador:', { userId, email });
            
            await pool.query(
                'INSERT INTO Spectators (id, name, email, coins, points, level, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, email.split('@')[0], email, 0, 0, 1, now, now]
            );

            [spectators] = await pool.query(
                'SELECT id, name, email, coins FROM Spectators WHERE id = ?',
                [userId]
            );
        }

        console.log('✅ Datos del espectador (solo globales):', spectators[0]);
        res.json(spectators[0]);
    } catch (error) {
        console.error('❌ Error en GET /spectators/me:', error);
        res.status(500).json({ message: "Error al obtener espectador", error: error.message });
    }
});

// ========== ACTUALIZAR PUNTOS DEL ESPECTADOR ACTUAL ==========
// CRÍTICO: Esta ruta DEBE ir ANTES que /spectators/:id/points
router.put("/spectators/me/points", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { pointsToAdd, streamerId } = req.body;
        console.log('📡 PUT /spectators/me/points - userId:', userId, 'pointsToAdd:', pointsToAdd, 'streamerId:', streamerId);

        if (!streamerId) {
            return res.status(400).json({ message: "streamerId es requerido" });
        }

        // Obtener o crear progreso para este espectador con este streamer
        let [progress] = await pool.query(
            'SELECT points, level FROM SpectatorStreamerProgress WHERE spectatorId = ? AND streamerId = ?',
            [userId, streamerId]
        );

        let currentPoints = 0;
        if (progress.length === 0) {
            // Crear nuevo registro de progreso
            await pool.query(
                'INSERT INTO SpectatorStreamerProgress (spectatorId, streamerId, points, level) VALUES (?, ?, 0, 1)',
                [userId, streamerId]
            );
            currentPoints = 0;
        } else {
            currentPoints = progress[0].points || 0;
        }

        const newPoints = currentPoints + (pointsToAdd || 0);
        
        // Calculate level based on streamer's custom levels
        let newLevel = 1;
        const [levels] = await pool.query(
            'SELECT levelNumber, requiredPoints FROM Levels WHERE streamerId = ? ORDER BY requiredPoints DESC',
            [streamerId]
        );
        
        if (levels.length > 0) {
            // Find the highest level the spectator qualifies for
            for (const level of levels) {
                if (newPoints >= level.requiredPoints) {
                    newLevel = level.levelNumber;
                    break;
                }
            }
        } else {
            // Fallback to default calculation if no levels configured
            newLevel = Math.floor(newPoints / 50) + 1;
        }

        await pool.query(
            'UPDATE SpectatorStreamerProgress SET points = ?, level = ?, updatedAt = ? WHERE spectatorId = ? AND streamerId = ?',
            [newPoints, newLevel, new Date(), userId, streamerId]
        );

        console.log('✅ Puntos actualizados:', { newPoints, newLevel });
        res.json({ points: newPoints, level: newLevel });
    } catch (error) {
        console.error('❌ Error en PUT /spectators/me/points:', error);
        res.status(500).json({ message: "Error al actualizar puntos", error: error.message });
    }
});

// ========== OBTENER PROGRESO CON UN STREAMER ESPECÍFICO ==========
router.get("/spectators/me/progress/:streamerId", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { streamerId } = req.params;

        const [progress] = await pool.query(
            'SELECT points, level FROM SpectatorStreamerProgress WHERE spectatorId = ? AND streamerId = ?',
            [userId, streamerId]
        );

        if (progress.length === 0) {
            // No hay progreso aún, devolver valores por defecto
            return res.json({ points: 0, level: 1 });
        }

        res.json(progress[0]);
    } catch (error) {
        console.error('Error al obtener progreso:', error);
        res.status(500).json({ message: "Error al obtener progreso", error: error.message });
    }
});

// ========== OBTENER UN ESPECTADOR POR ID ==========
router.get("/spectators/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [spectators] = await pool.query(
            'SELECT id, name, email, coins, points, level, avatar, bio, createdAt, updatedAt FROM Spectators WHERE id = ?',
            [id]
        );

        if (spectators.length === 0) {
            return res.status(404).json({ message: "Espectador no encontrado" });
        }

        res.status(200).json(spectators[0]);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener espectador", error: error.message });
    }
});

// ========== ACTUALIZAR PERFIL DE ESPECTADOR ==========
router.put("/spectators/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bio, avatar } = req.body;

        if (req.user.id !== id) {
            return res.status(403).json({ message: "No tienes permiso para editar este perfil" });
        }

        const updates = [];
        const values = [];
        
        if (name) { updates.push('name = ?'); values.push(name); }
        if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
        if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
        
        if (updates.length === 0) {
            return res.status(400).json({ message: "No hay datos para actualizar" });
        }

        values.push(new Date());
        values.push(id);

        await pool.query(
            `UPDATE Spectators SET ${updates.join(', ')}, updatedAt = ? WHERE id = ?`,
            values
        );

        const [updated] = await pool.query(
            'SELECT id, name, email, coins, points, level, avatar, bio FROM Spectators WHERE id = ?',
            [id]
        );

        res.status(200).json(updated[0]);
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar perfil", error: error.message });
    }
});

// ========== ENVIAR REGALO ==========
router.post("/gifts/send", verifyToken, async (req, res) => {
    try {
        const { receiverId, giftId, amount = 1 } = req.body;
        const senderId = req.user.id;

        if (!receiverId || !giftId) {
            return res.status(400).json({ message: "Faltan receiverId o giftId" });
        }

        const [gifts] = await pool.query('SELECT * FROM Gifts WHERE id = ?', [giftId]);
        if (gifts.length === 0) {
            return res.status(404).json({ message: "Regalo no encontrado" });
        }
        const gift = gifts[0];

        const [senders] = await pool.query('SELECT * FROM Spectators WHERE id = ?', [senderId]);
        if (senders.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        const sender = senders[0];

        const totalCost = gift.cost * amount;

        if (sender.coins < totalCost) {
            return res.status(400).json({ message: "No tienes suficientes monedas" });
        }

        await pool.query(
            'UPDATE Spectators SET coins = coins - ?, updatedAt = ? WHERE id = ?',
            [totalCost, new Date(), senderId]
        );

        const pointsToAdd = gift.points * amount;
        await pool.query(
            'UPDATE Streamers SET points = points + ?, level = FLOOR((points + ?) / 100) + 1, updatedAt = ? WHERE id = ?',
            [pointsToAdd, pointsToAdd, new Date(), receiverId]
        );

        const transactionId = uuidv4();
        const now = new Date();
        await pool.query(
            'INSERT INTO Transactions (id, senderId, receiverId, giftId, type, amount, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [transactionId, senderId, receiverId, giftId, 'gift_sent', totalCost, `Envió ${amount} ${gift.name}(s)`, now, now]
        );

        const [updatedSender] = await pool.query('SELECT coins FROM Spectators WHERE id = ?', [senderId]);
        const [updatedReceiver] = await pool.query('SELECT points, level FROM Streamers WHERE id = ?', [receiverId]);

        res.json({
            message: "Regalo enviado exitosamente",
            senderCoins: updatedSender[0]?.coins || sender.coins - totalCost,
            receiverPoints: updatedReceiver[0]?.points,
            receiverLevel: updatedReceiver[0]?.level,
        });
    } catch (error) {
        console.error("Error en envío de regalo:", error);
        res.status(500).json({ message: "Error al enviar regalo", error: error.message });
    }
});

// ========== OBTENER HISTORIAL DE REGALOS ==========
router.get("/gifts/history/:userId", verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const [transactions] = await pool.query(
            `SELECT 
                t.id, 
                t.createdAt, 
                t.amount, 
                s.name AS senderName, 
                s.email AS senderEmail,
                g.name AS giftName, 
                g.emoji AS giftEmoji,
                g.points AS giftPoints
            FROM Transactions t
            LEFT JOIN Spectators s ON t.senderId = s.id
            LEFT JOIN Gifts g ON t.giftId = g.id
            WHERE t.receiverId = ? AND t.type = ?
            ORDER BY t.createdAt DESC
            LIMIT 50`,
            [userId, 'gift_sent']
        );
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener historial", error: error.message });
    }
});

// ========== COMPRAR MONEDAS ==========
router.post("/coins/purchase", verifyToken, async (req, res) => {
    try {
        const { coinAmount, price } = req.body;
        const userId = req.user.id;

        if (!coinAmount || !price) {
            return res.status(400).json({ message: "Faltan coinAmount o price" });
        }

        await pool.query(
            'UPDATE Spectators SET coins = coins + ?, updatedAt = ? WHERE id = ?',
            [coinAmount, new Date(), userId]
        );

        const purchaseId = uuidv4();
        const now = new Date();
        await pool.query(
            'INSERT INTO Purchases (id, userId, coinAmount, price, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [purchaseId, userId, coinAmount, price, 'completed', now, now]
        );

        const [updated] = await pool.query('SELECT coins FROM Spectators WHERE id = ?', [userId]);

        res.json({
            message: "Compra realizada exitosamente",
            newBalance: updated[0].coins,
            coinsPurchased: coinAmount,
        });
    } catch (error) {
        res.status(500).json({ message: "Error al comprar monedas", error: error.message });
    }
});

// ========== OBTENER SALDO DE MONEDAS ==========
router.get("/coins/balance/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [spectators] = await pool.query(
            'SELECT id, coins, points, level FROM Spectators WHERE id = ?',
            [id]
        );

        if (spectators.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json(spectators[0]);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener saldo", error: error.message });
    }
});

// ========== INICIAR TRANSMISIÓN ==========
router.post("/streaming/start", verifyToken, async (req, res) => {
    try {
        const streamerId = req.user.id;
        const { channelName } = req.body;

        if (!channelName) {
            return res.status(400).json({ message: "channelName es requerido" });
        }

        const now = new Date();
        await pool.query(
            'UPDATE Streamers SET isLive = ?, liveChannelName = ?, liveStartedAt = ?, updatedAt = ? WHERE id = ?',
            [true, channelName, now, now, streamerId]
        );

        res.json({ 
            message: "Transmisión iniciada", 
            channelName,
            startedAt: now
        });
    } catch (error) {
        console.error("Error al iniciar transmisión:", error);
        res.status(500).json({ message: "Error al iniciar transmisión", error: error.message });
    }
});

// ========== DETENER TRANSMISIÓN ==========
router.post("/streaming/stop", verifyToken, async (req, res) => {
    try {
        const streamerId = req.user.id;

        const [streamers] = await pool.query('SELECT liveStartedAt FROM Streamers WHERE id = ?', [streamerId]);
        const startedAt = streamers[0]?.liveStartedAt;

        // Calcular horas transmitidas
        let hoursStreamed = 0;
        if (startedAt) {
            const duration = Date.now() - new Date(startedAt).getTime();
            hoursStreamed = duration / (1000 * 60 * 60); // convertir a horas
        }

        const now = new Date();
        await pool.query(
            'UPDATE Streamers SET isLive = ?, liveChannelName = NULL, liveStartedAt = NULL, hoursStreamed = hoursStreamed + ?, updatedAt = ? WHERE id = ?',
            [false, hoursStreamed, now, streamerId]
        );

        res.json({ 
            message: "Transmisión detenida",
            hoursStreamed: hoursStreamed.toFixed(2)
        });
    } catch (error) {
        console.error("Error al detener transmisión:", error);
        res.status(500).json({ message: "Error al detener transmisión", error: error.message });
    }
});

// ========== OBTENER STREAMERS EN VIVO ==========
router.get("/streaming/live", async (req, res) => {
    try {
        const [liveStreamers] = await pool.query(
            'SELECT id, name, email, avatar, bio, isLive, liveChannelName, liveStartedAt, level, points FROM Streamers WHERE isLive = ?',
            [true]
        );
        res.json(liveStreamers);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener streamers en vivo", error: error.message });
    }
});

// ========== OBTENER DATOS DE ESPECTADOR POR EMAIL (DEPRECADO - usar /me) ==========
router.get("/spectators/:email", verifyToken, async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);

        let [spectators] = await pool.query(
            'SELECT id, name, email, coins, points, level FROM Spectators WHERE email = ?',
            [email]
        );

        // Si no existe, crear espectador con valores por defecto
        if (spectators.length === 0) {
            const newId = uuidv4();
            const now = new Date();
            
            await pool.query(
                'INSERT INTO Spectators (id, name, email, coins, points, level, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [newId, email.split('@')[0], email, 0, 0, 1, now, now]
            );

            [spectators] = await pool.query(
                'SELECT id, name, email, coins, points, level FROM Spectators WHERE email = ?',
                [email]
            );
        }

        res.json(spectators[0]);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener espectador", error: error.message });
    }
});

// ========== ACTUALIZAR PUNTOS DE ESPECTADOR POR EMAIL (DEPRECADO - usar /me/points) ==========
router.put("/spectators/:email/points", verifyToken, async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const { pointsToAdd } = req.body;

        const [spectators] = await pool.query('SELECT * FROM Spectators WHERE email = ?', [email]);
        if (spectators.length === 0) {
            return res.status(404).json({ message: "Espectador no encontrado" });
        }

        const spectator = spectators[0];
        const newPoints = (spectator.points || 0) + (pointsToAdd || 0);
        
        // Calcular nivel basado en puntos (lógica simple: cada 50 puntos = 1 nivel)
        const newLevel = Math.floor(newPoints / 50) + 1;

        await pool.query(
            'UPDATE Spectators SET points = ?, level = ?, updatedAt = ? WHERE email = ?',
            [newPoints, Math.max(spectator.level, newLevel), new Date(), email]
        );

        res.json({
            points: newPoints,
            level: Math.max(spectator.level, newLevel),
        });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar puntos", error: error.message });
    }
});

export default router;

