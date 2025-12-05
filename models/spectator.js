import { DataTypes } from "sequelize";
import { sequelize } from "../database/db.js";

const Spectator = sequelize.define('Spectator', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    coins: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    },
    avatar: {
        type: DataTypes.STRING,
        defaultValue: 'https://via.placeholder.com/150',
    },
    bio: {
        type: DataTypes.TEXT,
        defaultValue: 'Espectador sin descripción',
    },
}, {
    timestamps: true,
});

export default Spectator;