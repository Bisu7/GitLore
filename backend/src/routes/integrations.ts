import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getNeo4jDriver } from '../lib/neo4j';

const prisma = new PrismaClient();

// ─── Auth Middleware ──────────────────────────────────────────────────────────

const authenticate = async (request: any, reply: any) => {
    try {
        const token = request.cookies.gitlore_token;
        if (!token) return reply.status(401).send({ error: 'Unauthorized' });
        const decoded = request.server.jwt.verify(token);
        request.user = decoded;
    } catch {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively extract plain text from Jira's Atlassian Document Format (ADF) */
function adfToText(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) {
        return node.content.map(adfToText).join(' ');
    }
    return '';
}

/** Enrich a (:Ticket) node in Neo4j with full details */
async function syncTicketToNeo4j(ticket: any) {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
        await session.executeWrite(async (tx) =>
            await tx.run(
                `MERGE (t:Ticket {repoId: $repoId, externalId: $externalId, source: $source})
                 SET t.title = $title,
                     t.description = $description,
                     t.status = $status,
                     t.assignee = $assignee,
                     t.url = $url`,
                {
                    repoId: ticket.repoId,
                    externalId: ticket.externalId,
                    source: ticket.source,
                    title: ticket.title,
                    description: ticket.description ?? '',
                    status: ticket.status ?? '',
                    assignee: ticket.assignee ?? '',
                    url: ticket.url ?? '',
                }
            )
        );
    } finally {
        await session.close();
    }
}

/** Sync Jira tickets into Postgres + Neo4j */
async function syncJiraTickets(repoId: string, integration: any) {
    // 1. Get all unique Jira ticket refs for this repo
    const ticketRefs = await prisma.ticketRef.findMany({
        where: { commit: { repoId }, source: 'JIRA' },
    });

    const uniqueIds = [...new Set(ticketRefs.map((t) => t.externalId))];
    console.log(`[Jira Sync] Found ${uniqueIds.length} unique ticket refs`);

    for (const issueKey of uniqueIds) {
        try {
            const res = await fetch(
                `https://api.atlassian.com/ex/jira/${integration.cloudId}/rest/api/3/issue/${issueKey}`,
                {
                    headers: {
                        Authorization: `Bearer ${integration.accessToken}`,
                        Accept: 'application/json',
                    },
                }
            );

            if (!res.ok) {
                console.warn(`[Jira Sync] Failed to fetch ${issueKey}: ${res.status}`);
                continue;
            }

            const data: any = await res.json();
            const fields = data.fields;

            const ticket = await prisma.ticket.upsert({
                where: {
                    repoId_externalId_source: {
                        repoId,
                        externalId: issueKey,
                        source: 'JIRA',
                    },
                },
                update: {
                    title: fields.summary,
                    description: adfToText(fields.description),
                    status: fields.status?.name ?? null,
                    assignee: fields.assignee?.displayName ?? null,
                    reporter: fields.reporter?.displayName ?? null,
                    url: `${integration.siteUrl}/browse/${issueKey}`,
                },
                create: {
                    repoId,
                    externalId: issueKey,
                    source: 'JIRA',
                    title: fields.summary,
                    description: adfToText(fields.description),
                    status: fields.status?.name ?? null,
                    assignee: fields.assignee?.displayName ?? null,
                    reporter: fields.reporter?.displayName ?? null,
                    url: `${integration.siteUrl}/browse/${issueKey}`,
                },
            });

            await syncTicketToNeo4j(ticket);
            console.log(`[Jira Sync] Synced ${issueKey}`);
        } catch (err) {
            console.error(`[Jira Sync] Error on ${issueKey}:`, err);
        }
    }

    console.log(`[Jira Sync] Complete for repo ${repoId}`);
}

/** Sync Linear tickets into Postgres + Neo4j */
async function syncLinearTickets(repoId: string, integration: any) {
    const ticketRefs = await prisma.ticketRef.findMany({
        where: { commit: { repoId }, source: 'LINEAR' },
    });

    const uniqueIds = [...new Set(ticketRefs.map((t) => t.externalId))];
    console.log(`[Linear Sync] Found ${uniqueIds.length} unique ticket refs`);

    for (const issueId of uniqueIds) {
        try {
            const query = `
                query {
                    issue(id: "${issueId}") {
                        id
                        title
                        description
                        state { name }
                        assignee { name }
                        creator { name }
                        url
                    }
                }
            `;

            const res = await fetch('https://api.linear.app/graphql', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${integration.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            if (!res.ok) {
                console.warn(`[Linear Sync] Failed to fetch ${issueId}: ${res.status}`);
                continue;
            }

            const json: any = await res.json();
            const issue = json.data?.issue;
            if (!issue) {
                console.warn(`[Linear Sync] No issue found for id ${issueId}`);
                continue;
            }

            const ticket = await prisma.ticket.upsert({
                where: {
                    repoId_externalId_source: {
                        repoId,
                        externalId: issueId,
                        source: 'LINEAR',
                    },
                },
                update: {
                    title: issue.title,
                    description: issue.description ?? null,
                    status: issue.state?.name ?? null,
                    assignee: issue.assignee?.name ?? null,
                    reporter: issue.creator?.name ?? null,
                    url: issue.url,
                },
                create: {
                    repoId,
                    externalId: issueId,
                    source: 'LINEAR',
                    title: issue.title,
                    description: issue.description ?? null,
                    status: issue.state?.name ?? null,
                    assignee: issue.assignee?.name ?? null,
                    reporter: issue.creator?.name ?? null,
                    url: issue.url,
                },
            });

            await syncTicketToNeo4j(ticket);
            console.log(`[Linear Sync] Synced ${issueId}`);
        } catch (err) {
            console.error(`[Linear Sync] Error on ${issueId}:`, err);
        }
    }

    console.log(`[Linear Sync] Complete for repo ${repoId}`);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export default async function integrationRoutes(fastify: FastifyInstance) {

    // ── Jira Connect ────────────────────────────────────────────────────────────
    fastify.get(
        '/integrations/jira/connect',
        { preHandler: authenticate },
        async (request: any, reply) => {
            const { repoId } = request.query as { repoId: string };

            if (!repoId) {
                return reply.status(400).send({ error: 'repoId is required' });
            }

            const state = Buffer.from(
                JSON.stringify({ repoId, userId: request.user.id })
            ).toString('base64');

            const params = new URLSearchParams({
                audience: 'api.atlassian.com',
                client_id: process.env.JIRA_CLIENT_ID!,
                scope: 'read:jira-work read:jira-user offline_access',
                redirect_uri: process.env.JIRA_REDIRECT_URI!,
                state,
                response_type: 'code',
                prompt: 'consent',
            });

            const url = `https://auth.atlassian.com/authorize?${params.toString()}`;
            return reply.send({ url });
        }
    );

    // ── Jira Callback ───────────────────────────────────────────────────────────
    fastify.get('/integrations/jira/callback', async (request: any, reply) => {
        const { code, state } = request.query as { code: string; state: string };

        if (!code || !state) {
            return reply.status(400).send({ error: 'Missing code or state' });
        }

        const { repoId, userId } = JSON.parse(
            Buffer.from(state, 'base64').toString('utf8')
        );

        // 1. Exchange code for tokens
        const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: process.env.JIRA_CLIENT_ID,
                client_secret: process.env.JIRA_CLIENT_SECRET,
                code,
                redirect_uri: process.env.JIRA_REDIRECT_URI,
            }),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            console.error('[Jira Callback] Token exchange failed:', err);
            return reply.status(500).send({ error: 'Jira token exchange failed' });
        }

        const { access_token, refresh_token } = (await tokenRes.json()) as any;

        // 2. Get Cloud ID
        const sitesRes = await fetch(
            'https://api.atlassian.com/oauth/token/accessible-resources',
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        const sites: any[] = await sitesRes.json();
        if (!sites.length) {
            return reply.status(400).send({ error: 'No Atlassian sites found' });
        }

        const cloudId = sites[0].id;
        const siteUrl = sites[0].url;

        // 3. Save integration to Postgres
        const integration = await prisma.integration.upsert({
            where: { userId_repoId_provider: { userId, repoId, provider: 'JIRA' } },
            update: { accessToken: access_token, refreshToken: refresh_token, cloudId, siteUrl },
            create: {
                userId,
                repoId,
                provider: 'JIRA',
                accessToken: access_token,
                refreshToken: refresh_token ?? null,
                cloudId,
                siteUrl,
            },
        });

        // 4. Sync tickets in background
        syncJiraTickets(repoId, integration).catch((err) =>
            console.error('[Jira Sync] Background sync failed:', err)
        );

        // 5. Redirect to frontend settings page
        return reply.redirect(
            `${process.env.FRONTEND_URL}/repo/${repoId}/settings`
        );
    });

    // ── Linear Connect ──────────────────────────────────────────────────────────
    fastify.get(
        '/integrations/linear/connect',
        { preHandler: authenticate },
        async (request: any, reply) => {
            const { repoId } = request.query as { repoId: string };

            if (!repoId) {
                return reply.status(400).send({ error: 'repoId is required' });
            }

            const state = Buffer.from(
                JSON.stringify({ repoId, userId: request.user.id })
            ).toString('base64');

            const params = new URLSearchParams({
                client_id: process.env.LINEAR_CLIENT_ID!,
                redirect_uri: process.env.LINEAR_REDIRECT_URI!,
                response_type: 'code',
                scope: 'read',
                state,
            });

            const url = `https://linear.app/oauth/authorize?${params.toString()}`;
            return reply.send({ url });
        }
    );

    // ── Linear Callback ─────────────────────────────────────────────────────────
    fastify.get('/integrations/linear/callback', async (request: any, reply) => {
        const { code, state } = request.query as { code: string; state: string };

        if (!code || !state) {
            return reply.status(400).send({ error: 'Missing code or state' });
        }

        const { repoId, userId } = JSON.parse(
            Buffer.from(state, 'base64').toString('utf8')
        );

        // 1. Exchange code for token
        const body = new URLSearchParams({
            client_id: process.env.LINEAR_CLIENT_ID!,
            client_secret: process.env.LINEAR_CLIENT_SECRET!,
            redirect_uri: process.env.LINEAR_REDIRECT_URI!,
            code,
            grant_type: 'authorization_code',
        });

        const tokenRes = await fetch('https://api.linear.app/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            console.error('[Linear Callback] Token exchange failed:', err);
            return reply.status(500).send({ error: 'Linear token exchange failed' });
        }

        const { access_token } = (await tokenRes.json()) as any;

        // 2. Save integration to Postgres
        const integration = await prisma.integration.upsert({
            where: { userId_repoId_provider: { userId, repoId, provider: 'LINEAR' } },
            update: { accessToken: access_token },
            create: {
                userId,
                repoId,
                provider: 'LINEAR',
                accessToken: access_token,
            },
        });

        // 3. Sync tickets in background
        syncLinearTickets(repoId, integration).catch((err) =>
            console.error('[Linear Sync] Background sync failed:', err)
        );

        // 4. Redirect to frontend settings page
        return reply.redirect(
            `${process.env.FRONTEND_URL}/repo/${repoId}/settings`
        );
    });

    // ── Status Endpoints (for the frontend settings page) ───────────────────────

    fastify.get(
        '/repos/:repoId/integrations',
        { preHandler: authenticate },
        async (request: any, reply) => {
            const { repoId } = request.params as { repoId: string };

            const integrations = await prisma.integration.findMany({
                where: { repoId, userId: request.user.id },
                select: { provider: true, createdAt: true, siteUrl: true },
            });

            return reply.send(integrations);
        }
    );

    fastify.get(
        '/repos/:repoId/tickets/count',
        { preHandler: authenticate },
        async (request: any, reply) => {
            const { repoId } = request.params as { repoId: string };

            const counts = await prisma.ticket.groupBy({
                by: ['source'],
                where: { repoId },
                _count: { id: true },
            });

            return reply.send(
                counts.map((c) => ({ source: c.source, count: c._count.id }))
            );
        }
    );
}