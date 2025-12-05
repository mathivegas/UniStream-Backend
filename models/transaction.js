import { DataTypes } from "sequelize";
import { sequelize } from "../database/db.js";

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    senderId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    receiverId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    giftId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM('gift_sent', 'coins_purchased'),
        allowNull: false,
    },
    amount: {
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

export default Transaction;
