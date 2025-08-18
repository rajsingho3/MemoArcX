import type { NextFunction, Request, Response, RequestHandler } from "express";
import JWT from 'jsonwebtoken';

const JWT_SECRET = "rajsinghMemoArcX";

export const userMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    // Support both raw token and `Bearer <token>`
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    try {
        const decoded = JWT.verify(token as string, JWT_SECRET) as any;
    const uid = (decoded?.id as string | undefined) ?? '';
    if (!uid) {
            res.status(401).json({ message: 'Invalid token' });
            return;
        }
    (req as any).userId = uid;
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }

}