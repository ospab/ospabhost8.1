import dotenv from 'dotenv';
dotenv.config();

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github';
import { Strategy as YandexStrategy } from 'passport-yandex';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 'https://api.ospab.host/api/auth';

interface OAuthProfile {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string }>;
  provider: string;
}

// Функция для создания или получения пользователя
async function findOrCreateUser(profile: OAuthProfile) {
  const email = profile.emails?.[0]?.value;
  if (!email) {
    throw new Error('Email не предоставлен провайдером');
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username: profile.displayName || email.split('@')[0],
        email,
        password: '', // OAuth пользователи не имеют пароля
      },
    });
  }

  return user;
}

// Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${OAUTH_CALLBACK_URL}/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateUser(profile as OAuthProfile);
          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

// GitHub OAuth
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${OAUTH_CALLBACK_URL}/github/callback`,
        scope: ['user:email'],
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          // GitHub может вернуть emails в массиве или не вернуть вообще
          // Нужно запросить emails отдельно через API если они не пришли
          let email = profile.emails?.[0]?.value;
          
          // Если email не пришёл, используем username@users.noreply.github.com
          if (!email && profile.username) {
            email = `${profile.username}@users.noreply.github.com`;
          }
          
          if (!email) {
            throw new Error('Email не предоставлен GitHub. Убедитесь, что ваш email публичный в настройках GitHub.');
          }

          const oauthProfile: OAuthProfile = {
            id: profile.id,
            displayName: profile.displayName || profile.username,
            emails: [{ value: email }],
            provider: 'github'
          };

          const user = await findOrCreateUser(oauthProfile);
          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

// Yandex OAuth
if (process.env.YANDEX_CLIENT_ID && process.env.YANDEX_CLIENT_SECRET) {
  passport.use(
    new YandexStrategy(
      {
        clientID: process.env.YANDEX_CLIENT_ID,
        clientSecret: process.env.YANDEX_CLIENT_SECRET,
        callbackURL: `${OAUTH_CALLBACK_URL}/yandex/callback`,
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          const user = await findOrCreateUser(profile as OAuthProfile);
          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}


passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
