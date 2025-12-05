import { DataTypes } from "sequelize";
import { sequelize } from "../database/db.js";

const Streamer = sequelize.define('Streamer', {
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
    hoursStreamed: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
    },
    avatar: {
        type: DataTypes.STRING,
        defaultValue: 'https://via.placeholder.com/150',
    },
    bio: {
        type: DataTypes.TEXT,
        defaultValue: 'Streamer sin descripción',
    },
    isLive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    timestamps: true,
});

export default Streamer;