import { DataTypes } from "sequelize";
import { sequelize } from "../database/db.js";

const Gift = sequelize.define('Gift', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    emoji: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    points: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        defaultValue: '',
    },
}, {
    timestamps: true,
});

export default Gift;
