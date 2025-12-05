import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Token no proporcionado" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token inválido o expirado" });
    }
};

export const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, type: user.type },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};
