import express from 'express';
import mongoose from 'mongoose';
import JWT from 'jsonwebtoken';
import { ContentModel, LinkModel, UserModel } from './db.js';
import z from 'zod';
import bcrypt, { hash } from 'bcrypt';
import { userMiddleware } from './middleware.js';
import { random } from './util.js';
import cors from 'cors';
import { load as loadHTML } from 'cheerio';
import { fetch as undiciFetch } from 'undici';
const app = express();
app.use(express.json());
app.use(cors());
// Simple healthcheck to verify server is on the expected build
app.get('/healthz', (req, res) => {
    res.json({ ok: true, version: 'preview-v1' });
});
const JWT_SECRET = "rajsinghMemoArcX";
app.post('/signup', async (req, res) => {
    const requiredUser = z.object({
        email: z.string().regex(/^[a-zA-Z0-9._%+-]+@gmail\.com$/),
        username: z.string().min(3).max(10),
        password: z.string().min(6).max(20)
    });
    const parsedUser = requiredUser.safeParse(req.body);
    if (!parsedUser.success) {
        res.status(400).json({
            message: "Invalid user data",
            error: parsedUser.error
        });
        return;
    }
    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;
    const hashedPassword = bcrypt.hashSync(password, 7);
    try {
        await UserModel.create({
            email: email,
            username: username,
            password: hashedPassword
        });
        res.json({
            message: "user created successfully !"
        });
    }
    catch (e) {
        console.error('Database error:', e);
        // Handle duplicate key error (email or username already exists)
        if (e.code === 11000) {
            if (e.keyPattern && e.keyPattern.email) {
                res.status(409).json({
                    message: "Email already exists",
                    error: "duplicate email",
                    field: "email"
                });
            }
            else if (e.keyPattern && e.keyPattern.username) {
                res.status(409).json({
                    message: "Username already exists",
                    error: "duplicate username",
                    field: "username"
                });
            }
            else {
                res.status(409).json({
                    message: "User already exists",
                    error: "duplicate key error"
                });
            }
        }
        else {
            res.status(500).json({
                message: "Error creating user",
                error: e.message
            });
        }
    }
});
app.post('/signin', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const user = await UserModel.findOne({
        email
    });
    if (!user) {
        res.status(400).json({
            message: "User not found"
        });
        return;
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
        const token = JWT.sign({
            id: user._id
        }, JWT_SECRET);
        res.status(200).json({
            message: "User signed in successfully",
            token: token
        });
    }
    else {
        res.status(403).json({
            message: "Invalid email or password"
        });
    }
});
app.post('/content/create', userMiddleware, async (req, res) => {
    const link = req.body.link;
    const type = req.body.type;
    await ContentModel.create({
        link,
        type,
        //@ts-ignore
        userId: req.userId,
        tags: []
    });
    res.json({
        message: "Content created successfully"
    });
});
app.get('/content/view', userMiddleware, async (req, res) => {
    //@ts-ignore
    const userId = req.userId;
    const content = await ContentModel.find({
        userId: userId
    }).populate("userId", "username");
    res.json({
        content
    });
});
app.delete('/content/delete', userMiddleware, async (req, res) => {
    const contentId = req.body.contentId;
    await ContentModel.deleteMany({
        contentId,
        //@ts-ignore
        userId: req.userId
    });
    res.json({
        message: "Content deleted successfully"
    });
});
app.post('/content/share', userMiddleware, async (req, res) => {
    const share = req.body.share;
    if (share) {
        try {
            const existingLink = await LinkModel.findOne({
                //@ts-ignore
                userId: req.userId
            });
            if (existingLink) {
                res.json({
                    hash: existingLink.hash
                });
                return;
            }
            ;
            const newHash = random(10);
            await LinkModel.create({
                // @ts-ignore
                userId: req.userId,
                hash: newHash
            });
            res.json({
                message: "share/" + newHash
            });
        }
        catch (e) {
            res.status(500).json({
                message: "Error creating share link",
                error: e.message
            });
        }
    }
    else {
        await LinkModel.deleteOne({
            //@ts-ignore
            userId: req.userId
        });
    }
    res.json({
        message: "Removed share link"
    });
});
app.get('/content/shareLink/:shareLink', userMiddleware, async (req, res) => {
    const hash = req.params.shareLink;
    const link = await LinkModel.findOne({
        hash
    });
    if (!link) {
        res.status(404).json({
            message: "Link not found"
        });
        return;
    }
    const content = await ContentModel.find({
        userId: link.userId
    });
    const user = await UserModel.findOne({
        _id: link.userId
    });
    res.json({
        username: user?.username,
        content: content
    });
});
// Link preview metadata endpoint
app.get('/preview', async (req, res) => {
    try {
        const url = req.query.url || '';
        let target;
        try {
            target = new URL(url);
        }
        catch {
            res.status(400).json({ message: 'Invalid URL' });
            return;
        }
        if (target.protocol !== 'http:' && target.protocol !== 'https:') {
            res.status(400).json({ message: 'Unsupported protocol' });
            return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        let html = '';
        try {
            const resp = await undiciFetch(target.toString(), {
                signal: controller.signal,
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'accept-language': 'en-US,en;q=0.9',
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            html = await resp.text();
        }
        finally {
            clearTimeout(timeout);
        }
        const $ = loadHTML(html);
        const pick = (selectors) => {
            for (const [sel, attr = 'content'] of selectors) {
                const el = $(sel).attr(attr);
                if (el)
                    return el;
            }
            return '';
        };
        const title = pick([
            ['meta[property="og:title"]'],
            ['meta[name="twitter:title"]'],
            ['title', 'text']
        ]) || $('title').text() || '';
        const description = pick([
            ['meta[property="og:description"]'],
            ['meta[name="description"]'],
            ['meta[name="twitter:description"]']
        ]);
        const imageRaw = pick([
            ['meta[property="og:image:secure_url"]'],
            ['meta[property="og:image:url"]'],
            ['meta[property="og:image"]'],
            ['meta[name="twitter:image:src"]'],
            ['meta[name="twitter:image"]']
        ]);
        const siteName = pick([
            ['meta[property="og:site_name"]']
        ]) || target.hostname.replace(/^www\./, '');
        const resolveUrl = (raw) => {
            try {
                if (!raw)
                    return '';
                // Resolve relative to the full page URL (keeps path when needed)
                return new URL(raw, target).toString();
            }
            catch {
                return '';
            }
        };
        const image = resolveUrl(imageRaw);
        const favicon = `https://www.google.com/s2/favicons?domain=${target.hostname}&sz=64`;
        res.json({
            url: target.toString(),
            domain: target.hostname,
            title,
            description,
            image,
            siteName,
            favicon
        });
    }
    catch (e) {
        // Graceful fallback: still return minimal preview so UI can render something
        try {
            const failed = new URL(String(req.query.url || ''));
            const favicon = `https://www.google.com/s2/favicons?domain=${failed.hostname}&sz=64`;
            res.json({
                url: failed.toString(),
                domain: failed.hostname,
                title: failed.hostname.replace(/^www\./, ''),
                description: '',
                image: '',
                siteName: failed.hostname.replace(/^www\./, ''),
                favicon
            });
        }
        catch {
            res.status(500).json({ message: 'Failed to fetch preview', error: e.message });
        }
    }
});
const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
// Return current authenticated user's basic info (email, username)
app.get('/me', userMiddleware, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const user = await UserModel.findById(userId).select('email username');
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json({ email: user.email, username: user.username });
    }
    catch (e) {
        res.status(500).json({ message: 'Failed to fetch user info', error: e.message });
    }
});
//# sourceMappingURL=index.js.map