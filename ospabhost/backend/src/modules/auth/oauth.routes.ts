import { Router, Request, Response } from 'express';
import passport from './passport.config';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://ospab.host';

interface AuthenticatedUser {
  id: number;
  email: string;
  username: string;
}

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=auth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as AuthenticatedUser;
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.redirect(`${FRONTEND_URL}/login?token=${token}`);
  }
);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=auth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as AuthenticatedUser;
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.redirect(`${FRONTEND_URL}/login?token=${token}`);
  }
);

// Yandex OAuth
router.get('/yandex', passport.authenticate('yandex'));

router.get(
  '/yandex/callback',
  passport.authenticate('yandex', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=auth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as AuthenticatedUser;
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.redirect(`${FRONTEND_URL}/login?token=${token}`);
  }
);

export default router;
