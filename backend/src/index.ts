import Fastify from 'fastify';
import fastifyOAuth2 from '@fastify/oauth2';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const fastify = Fastify({ logger: true });

// Register Cookie
fastify.register(fastifyCookie);

// Register JWT
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'super_secret_jwt_key_please_change'
});

// Register GitHub OAuth2
fastify.register(fastifyOAuth2, {
  name: 'githubOAuth2',
  credentials: {
    client: {
      id: process.env.GITHUB_CLIENT_ID || '',
      secret: process.env.GITHUB_CLIENT_SECRET || ''
    },
    auth: fastifyOAuth2.GITHUB_CONFIGURATION
  },
  startRedirectPath: '/auth/github',
  callbackUri: 'http://localhost:8080/auth/github/callback'
});

// Callback Route
fastify.get('/auth/github/callback', async function (request, reply) {
  try {
    const { token } = await this.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

    // Fetch user details from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'User-Agent': 'GitLore-App'
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user from GitHub');
    }

    const githubUser: any = await userResponse.json();

    // Fetch emails to get the primary email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'User-Agent': 'GitLore-App'
      }
    });
    
    let primaryEmail = githubUser.email;
    if (!primaryEmail && emailResponse.ok) {
      const emails: any = await emailResponse.json();
      primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email;
    }

    // Upsert User in DB
    const user = await prisma.user.upsert({
      where: { githubId: githubUser.id.toString() },
      update: {
        name: githubUser.name || githubUser.login,
        email: primaryEmail,
        avatarUrl: githubUser.avatar_url,
        accessToken: token.access_token,
      },
      create: {
        githubId: githubUser.id.toString(),
        name: githubUser.name || githubUser.login,
        email: primaryEmail,
        avatarUrl: githubUser.avatar_url,
        accessToken: token.access_token,
      }
    });

    // Sign JWT
    const jwtToken = fastify.jwt.sign({ id: user.id, email: user.email });

    // Set cookie and redirect to frontend
    reply
      .setCookie('gitlore_token', jwtToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      })
      .redirect(process.env.FRONTEND_URL || 'http://localhost:3000/dashboard');
  } catch (err) {
    request.log.error(err);
    reply.status(500).send('Authentication failed');
  }
});

// Start Server
const start = async () => {
  try {
    await fastify.listen({ port: 8080, host: '0.0.0.0' });
    console.log('Server is running on http://localhost:8080');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
