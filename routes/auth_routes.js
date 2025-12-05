import express from "express";
import bcryptjs from "bcryptjs";
import { pool } from "../database/db.js";
import { generateToken } from "../middleware/auth.js";
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ========== REGISTRO ==========
router.post("/auth/register", async (req, res) => {
    try {
        const { name, email, password, type } = req.body;

        // Validar que todos los campos estén presentes
        if (!name || !email || !password || !type) {
            return res.status(400).json({ message: "Faltan campos requeridos" });
        }

        // Validar que type sea 'spectator' o 'streamer'
        if (!["spectator", "streamer"].includes(type)) {
            return res.status(400).json({ message: "Tipo de usuario inválido" });
        }

        // Seleccionar la tabla según el tipo
        const tableName = type === "spectator" ? "Spectators" : "Streamers";

        // Verificar si el email ya existe
        const [existingUsers] = await pool.query(
            `SELECT id FROM ${tableName} WHERE email = ?`,
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ message: "El email ya está registrado" });
        }

        // Encriptar la contraseña
        const hashedPassword = await bcryptjs.hash(password, 10);

        // Generar UUID
        const userId = uuidv4();

        // Obtener fecha actual
        const now = new Date();

        // Insertar el usuario
        await pool.query(
            `INSERT INTO ${tableName} (id, name, email, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, name, email, hashedPassword, now, now]
        );

        // Generar token JWT
        const token = generateToken({ id: userId, email, type });

        res.status(201).json({
            message: "Usuario registrado exitosamente",
            user: {
                id: userId,
                name: name,
                email: email,
                type,
                coins: 0,
                points: 0,
                level: 1
            },
            token,
        });
    } catch (error) {
        console.error("Error en registro:", error);
        res.status(500).json({ message: "Error al registrar usuario", error: error.message });
    }
});

// ========== LOGIN ==========
router.post("/auth/login", async (req, res) => {
    try {
        const { email, password, type } = req.body;

        // Validar que todos los campos estén presentes
        if (!email || !password || !type) {
            return res.status(400).json({ message: "Email, contraseña y tipo son requeridos" });
        }

        // Validar que type sea válido
        if (!["spectator", "streamer"].includes(type)) {
            return res.status(400).json({ message: "Tipo de usuario inválido" });
        }

        // Seleccionar la tabla según el tipo
        const tableName = type === "spectator" ? "Spectators" : "Streamers";

        // Buscar el usuario
        const [users] = await pool.query(
            `SELECT * FROM ${tableName} WHERE email = ?`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: "Email o contraseña incorrectos" });
        }

        const user = users[0];

        // Verificar la contraseña
        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Email o contraseña incorrectos" });
        }

        // Generar token JWT
        const token = generateToken({ id: user.id, email: user.email, type });

        res.json({
            message: "Login exitoso",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                type,
                coins: user.coins || 0,
                points: user.points || 0,
                level: user.level || 1
            },
            token,
        });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: "Error al iniciar sesión", error: error.message });
    }
});

export default router;
