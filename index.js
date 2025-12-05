import { testConnection } from "./database/db.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth_routes.js";
import spectatorRoutes from "./routes/spectactor_routes.js";
import streamerRoutes from "./routes/streamer_routes.js";
import settingsRoutes from "./routes/settings_routes.js";
import levelsRoutes from "./routes/levels_routes.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configurado para desarrollo y producción
const allowedOrigins = [
    "http://localhost:3001",
    process.env.FRONTEND_URL || "https://unistream-frontend.vercel.app"
];

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sin origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS no permitido'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));
app.use(express.json());

app.use("/api", authRoutes);
app.use("/api", spectatorRoutes);
app.use("/api", streamerRoutes);
app.use("/api", settingsRoutes);
app.use("/api/streamers", levelsRoutes);

// Configuración de Socket.io para chat en tiempo real
io.on("connection", (socket) => {
    console.log(`✅ Socket conectado: ${socket.id}`);

    // Unirse al chat de un streamer específico
    socket.on("join-chat", (data) => {
        const streamerId = typeof data === 'string' ? data : data.streamerId;
        const userName = typeof data === 'object' ? data.userName : 'Usuario';
        
        socket.join(`chat_${streamerId}`);
        console.log(`👤 ${userName} se unió al chat de ${streamerId}`);
    });

    // Enviar mensaje de chat
    socket.on("send-message", (data) => {
        const { streamerId, message } = data;
        console.log(`💬 ${message.userName}: ${message.text}`);
        // Enviar el mensaje a todos en la sala del streamer
        io.to(`chat_${streamerId}`).emit("new-message", message);
    });

    // Notificar regalo enviado
    socket.on("send-gift", (data) => {
        const { streamerId, giftData } = data;
        console.log(`🎁 ${giftData.senderName} envió ${giftData.giftEmoji} ${giftData.giftName} (+${giftData.giftPoints} pts)`);
        // Notificar al streamer sobre el regalo
        io.to(`chat_${streamerId}`).emit("gift-received", giftData);
    });

    // Notificar cuando se agrega un nuevo regalo
    socket.on("new-gift-added", (data) => {
        const { streamerId, gift } = data;
        console.log(`➕ Nuevo regalo agregado: ${gift.emoji} ${gift.name} (${gift.cost} monedas)`);
        // Notificar a todos los espectadores del streamer
        io.to(`chat_${streamerId}`).emit("gift-list-updated", gift);
    });

    // Notificar cuando un streamer inicia transmisión
    socket.on("streamer-went-live", (data) => {
        const { streamerId, channelName } = data;
        console.log(`🔴 Streamer ${streamerId} comenzó a transmitir en ${channelName}`);
        // Notificar a TODOS los clientes conectados
        io.emit("streamer-status-changed", { streamerId, isLive: true, liveChannelName: channelName });
    });

    // Notificar cuando un streamer termina transmisión
    socket.on("streamer-went-offline", (data) => {
        const { streamerId } = data;
        console.log(`⚫ Streamer ${streamerId} dejó de transmitir`);
        // Notificar a TODOS los clientes conectados
        io.emit("streamer-status-changed", { streamerId, isLive: false, liveChannelName: null });
    });

    // Heartbeat de stream activo (cada 30s)
    socket.on("stream-heartbeat", (data) => {
        const { streamerId, timestamp } = data;
        // Registrar que el streamer sigue activo
        socket.streamerId = streamerId;
        socket.lastHeartbeat = timestamp;
    });

    socket.on("disconnect", () => {
        console.log(`❌ Socket desconectado: ${socket.id}`);
    });
});

// Ruta de prueba
app.get("/", (req, res) => {
    res.json({ message: "UniStream API está en línea 🚀" });
});

async function startServer() {
    try {
        await testConnection();
        console.log("✅ Conectado a la base de datos MySQL.");

        httpServer.listen(PORT, () => {
            console.log(`✅ Servidor iniciado en puerto ${PORT}`);
            console.log(`📍 Accede a http://localhost:${PORT}`);
            console.log(`🔌 Socket.io listo para conexiones en tiempo real`);
        });
    } catch (error) {
        console.error("❌ Error al conectar a la base de datos:", error);
        process.exit(1);
    }
}

startServer();

