import { testConnection } from "./database/db.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import config from "./config.js";
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
    "http://localhost:3000",
    process.env.FRONTEND_URL || "https://uni-stream-frontend.vercel.app"
];

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = config.server.port;

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sin origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS no permitido'), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use("/api", authRoutes);
app.use("/api", spectatorRoutes);
app.use("/api", streamerRoutes);
app.use("/api", settingsRoutes);
app.use("/api/streamers", levelsRoutes);

// Mapa para rastrear espectadores en tiempo real
// Estructura: { streamerId: [{ socketId, userId, userName, joinedAt }] }
const activeViewers = new Map();

// Configuración de Socket.io para chat en tiempo real
io.on("connection", (socket) => {
    console.log(`✅ Socket conectado: ${socket.id}`);

    // Unirse al chat de un streamer específico
    socket.on("join-chat", (data) => {
        const streamerId = typeof data === 'string' ? data : data.streamerId;
        const userName = typeof data === 'object' ? data.userName : 'Usuario';
        const userId = typeof data === 'object' ? data.userId : null;
        
        socket.join(`chat_${streamerId}`);
        socket.currentStreamerId = streamerId;
        socket.viewerUserId = userId;
        socket.viewerUserName = userName;
        
        // Agregar espectador a la lista
        if (!activeViewers.has(streamerId)) {
            activeViewers.set(streamerId, []);
        }
        const viewers = activeViewers.get(streamerId);
        const existingViewer = viewers.find(v => v.socketId === socket.id);
        if (!existingViewer) {
            viewers.push({
                socketId: socket.id,
                userId: userId,
                userName: userName,
                joinedAt: new Date().toISOString()
            });
            console.log(`👤 ${userName} se unió al chat de ${streamerId} (${viewers.length} espectadores)`);
            
            // Notificar al streamer y espectadores sobre la lista actualizada
            io.to(`chat_${streamerId}`).emit("viewers-updated", viewers);
        }
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

    // Obtener lista de espectadores
    socket.on("get-viewers", (streamerId) => {
        const viewers = activeViewers.get(streamerId) || [];
        socket.emit("viewers-list", viewers);
    });

    socket.on("disconnect", () => {
        console.log(`❌ Socket desconectado: ${socket.id}`);
        
        // Remover espectador de la lista
        if (socket.currentStreamerId) {
            const viewers = activeViewers.get(socket.currentStreamerId);
            if (viewers) {
                const index = viewers.findIndex(v => v.socketId === socket.id);
                if (index !== -1) {
                    const removedViewer = viewers.splice(index, 1)[0];
                    console.log(`👋 ${removedViewer.userName} salió del chat de ${socket.currentStreamerId} (${viewers.length} espectadores)`);
                    
                    // Notificar la lista actualizada
                    io.to(`chat_${socket.currentStreamerId}`).emit("viewers-updated", viewers);
                    
                    // Limpiar si no hay espectadores
                    if (viewers.length === 0) {
                        activeViewers.delete(socket.currentStreamerId);
                    }
                }
            }
        }
    });
});

// Ruta de prueba
app.get("/", (req, res) => {
    res.json({ 
        message: "UniStream API está en línea 🚀",
        environment: config.server.env,
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok",
        environment: config.server.env,
        agora: config.agora.appId ? "configured" : "not-configured"
    });
});

async function startServer() {
    try {
        await testConnection();
        console.log("✅ Conectado a la base de datos MySQL.");

        httpServer.listen(PORT, () => {
            console.log(`✅ Servidor iniciado en puerto ${PORT}`);
            console.log(`📍 Entorno: ${config.server.env}`);
            console.log(`🌐 Frontend permitido: ${allowedOrigins.join(', ')}`);
            console.log(`🔌 Socket.io listo para conexiones en tiempo real`);
            console.log(`📡 Agora App ID: ${config.agora.appId ? '✅ Configurado' : '❌ No configurado'}`);
        });
    } catch (error) {
        console.error("❌ Error al conectar a la base de datos:", error);
        process.exit(1);
    }
}

startServer();

