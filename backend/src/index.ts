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

declare module '@fastify/jwt' {
  interface FastifyJWT {
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
    return reply.status(401).send({ error: 'Unauthorized' });
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
    stargazersCount: repo.stargazers_count,
    defaultBranch: repo.default_branch,
  }));

  return reply.send(mappedRepos);
});

fastify.get('/repos/connected', { preHandler: authenticate }, async (request, reply) => {
  const userId = request.user.id;
  const repos = await prisma.repo.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
  return reply.send(repos);
});

fastify.post('/repos/connect', { preHandler: authenticate }, async (request, reply) => {
  const { githubRepoId, fullName, defaultBranch } = request.body as {
    githubRepoId: string;
    fullName: string;
    defaultBranch: string;
  };
  const newRepo = await prisma.repo.upsert({
    where: { githubRepoId },
    update: {
      fullName,
      defaultBranch,
    },
    create: {
      userId: request.user.id,
      githubRepoId,
      fullName,
      defaultBranch,
    },
  });

  // Only trigger sync if it's new or still pending
  if (newRepo.ingestionStatus === 'pending') {
    await repoSyncQueue.add('sync', {
      repoId: newRepo.id,
    });
  }

  return {
    success: true,
    repo: newRepo,
  };
});


import './workers/repoSync.worker';
import './workers/embedCommits.worker';

fastify.get('/repos/:repoId/status', { preHandler: authenticate }, async (request, reply) => {
  const { repoId } = request.params as { repoId: string };
  
  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
    select: { 
      ingestionStatus: true, 
      ingestionProgress: true,
      fullName: true,
      commits: {
        orderBy: { timestamp: 'desc' },
        take: 3,
        select: {
          sha: true,
          message: true,
          authorName: true,
          timestamp: true
        }
      }
    }
  });

  if (!repo) {
    return reply.status(404).send({ error: 'Repo not found' });
  }

  return repo;
});

import { embedText } from './utils/embedding';

fastify.post('/search', { preHandler: authenticate }, async (request, reply) => {
  const { repoId, query, limit = 10 } = request.body as { repoId: string; query: string; limit?: number };
  
  if (!repoId || !query) {
    return reply.status(400).send({ error: 'Missing repoId or query' });
  }

  // Verify access
  const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: request.user.id } });
  if (!repo) return reply.status(403).send({ error: 'Unauthorized' });

  // Embed the query
  const queryVector = await embedText(query);
  const vectorString = `[${queryVector.join(',')}]`;

  // Semantic search query
  const chunks: any[] = await prisma.$queryRaw`
    SELECT ec."id", ec."commitId", ec."content", ec."metadata",
           (ec."embedding" <=> ${vectorString}::vector) as distance
    FROM "EmbeddingChunk" ec
    WHERE ec."repoId" = ${repoId}
    ORDER BY distance ASC
    LIMIT ${Number(limit)}
  `;

  // Hydrate chunks with commit data
  const commitIds = [...new Set(chunks.map(c => c.commitId))].filter(Boolean) as string[];
  const commits = await prisma.commit.findMany({
    where: { id: { in: commitIds } },
    include: {
      prs: true,
      ticketRefs: true
    }
  });
  
  const commitMap = new Map(commits.map(c => [c.id, c]));
  
  const results = chunks.map(chunk => ({
    id: chunk.id,
    content: chunk.content,
    distance: chunk.distance,
    metadata: chunk.metadata,
    commit: chunk.commitId ? commitMap.get(chunk.commitId) : null
  }));

  return { results };
});

import { GoogleGenAI } from '@google/genai';

fastify.get('/commits/:sha', { preHandler: authenticate }, async (request, reply) => {
  const { sha } = request.params as { sha: string };
  const repoId = (request.query as any).repoId;

  const commit = await prisma.commit.findFirst({
    where: { sha, repoId },
    include: { prs: { include: { comments: true } }, files: true }
  });

  if (!commit) return reply.status(404).send({ error: 'Commit not found' });
  return commit;
});

fastify.post('/commits/:sha/explain', { preHandler: authenticate }, async (request, reply) => {
  const { sha } = request.params as { sha: string };
  const { repoId } = request.body as { repoId: string };

  const commit = await prisma.commit.findFirst({
    where: { sha, repoId },
    include: { prs: { include: { comments: true } }, files: true }
  });

  if (!commit) return reply.status(404).send({ error: 'Commit not found' });

  const prompt = `You are a senior developer reviewing a commit. Please explain this commit clearly and concisely.
  
Commit Message: ${commit.message}
Author: ${commit.authorName}

Files Changed:
${commit.files.map(f => `- ${f.filePath}`).join('\n')}

Pull Requests Context:
${commit.prs.map(pr => `PR Title: ${pr.title}\nBody: ${pr.body}`).join('\n\n')}
`;

  reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        reply.raw.write(chunk.text);
      }
    }
  } catch (e: any) {
    reply.raw.write(`\n\n[Error generating explanation: ${e.message}]`);
  } finally {
    reply.raw.end();
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
