// Configuración centralizada para producción y desarrollo
import dotenv from 'dotenv';
dotenv.config();

const config = {
  // Base de datos
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'unistream',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  // Servidor
  server: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_key_change_in_production',
    expiresIn: '7d'
  },

  // URLs
  urls: {
    frontend: process.env.FRONTEND_URL || 'http://localhost:3001',
  },

  // Agora
  agora: {
    appId: process.env.AGORA_APP_ID || ''
  },

  // CORS
  cors: {
    origin: function(origin, callback) {
      const allowedOrigins = [
        'http://localhost:3001',
        'http://localhost:3000',
        process.env.FRONTEND_URL || 'https://uni-stream-frontend.vercel.app'
      ];
      
      // Permitir requests sin origin (mobile apps, Postman, etc)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
};

export default config;
