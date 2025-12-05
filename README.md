# UniStream Backend 🎮

API para la plataforma de streaming **UniStream**. Desarrollada para el curso de Programación Web.

## 📋 Características

- ✅ Gestión de usuarios (Espectadores y Streamers)
- ✅ Sistema de regalos interactivo
- ✅ Sistema de compra de monedas
- ✅ Registro de transmisiones en vivo
- ✅ Historial de transacciones
- ✅ Sistema de niveles y puntos

## 🛠️ Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **PostgreSQL** - Base de datos relacional
- **Sequelize** - ORM para Node.js
- **JWT** - Autenticación segura
- **bcryptjs** - Hash de contraseñas

## 📦 Instalación

### Prerrequisitos

- Node.js v18
- mySQL Server / Workbench
- npm

### Pasos

1. **Clonar el repositorio:**

```bash
git clone https://github.com/mathivegas/UniStream-Backend.git
cd UniStream-Backend
```

2. **Instalar dependencias:**

```bash
npm install
```

3. **Crear archivo `.env`:**

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/UniDB
JWT_SECRET=clave_secreta
PORT=3000
NODE_ENV=development
```

4. **Crear la base de datos:**

```bash
node scripts/createDatabase.js
```

5. **Iniciar el servidor:**

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`


Este proyecto es de uso educativo.
