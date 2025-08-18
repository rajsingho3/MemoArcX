import JWT from 'jsonwebtoken';
const JWT_SECRET = "rajsinghMemoArcX";
export const userMiddleware = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    // Support both raw token and `Bearer <token>`
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    try {
        const decoded = JWT.verify(token, JWT_SECRET);
        const uid = decoded?.id ?? '';
        if (!uid) {
            res.status(401).json({ message: 'Invalid token' });
            return;
        }
        req.userId = uid;
        next();
    }
    catch {
        res.status(401).json({ message: 'Invalid token' });
    }
};
//# sourceMappingURL=middleware.js.map