import Fastify from 'fastify';
import fastifyOAuth2 from '@fastify/oauth2';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { Queue } from 'bullmq';

declare module 'fastify' {
  interface FastifyInstance {
    githubOAuth2: import('@fastify/oauth2').OAuth2Namespace;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

dotenv.config();

const prisma = new PrismaClient();
const fastify = Fastify({ logger: true });

const repoSyncQueue = new Queue('repo-sync', {
  connection: {
    host: '127.0.0.1',
    port: 6379
  }
});

const authenticate = async (request: any, reply: any) => {
  try {
    const token = request.cookies.gitlore_token;
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const decoded = fastify.jwt.verify(token);
    request.user = decoded;
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
};

// Register Cookie
fastify.register(fastifyCookie);

// Register JWT
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || ''
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
  callbackUri: 'http://localhost:8080/auth/github/callback',
  scope: ['read:user', 'user:email']
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

fastify.get('/repos/available', { preHandler: authenticate }, async (request, reply) => {
  const userId = request.user.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.accessToken) {
    return reply.status(400).send({ error: 'Github access token not found' });
  }
  const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitLore-App'
    }
  });
  if (!response.ok) {
    return reply.status(500).send({ error: 'Failed to fetch repositoris from Github' });
  }
  const repos = await response.json();
  const mappedRepos = repos.map((repo: any) => ({
    githubRepoId: repo.id.toString(),
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    language: repo.language,
    stargazarsCount: repo.stargazars_count,
    defaultBranch: repo.default_branch,
  }));

  return reply.send(mappedRepos);
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
