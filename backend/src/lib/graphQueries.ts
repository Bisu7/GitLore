import { getNeo4jDriver } from './neo4j';

export const getCommitsByFile = async (repoId: string, filePath: string) => {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
        const result = await session.executeRead(async tx => 
            await tx.run(
                `MATCH (c:Commit {repoId: $repoId})-[:TOUCHES]->(f:File {repoId: $repoId, path: $filePath})
                 RETURN c
                 ORDER BY c.timestamp DESC`,
                { repoId, filePath }
            )
        );
        return result.records.map(record => record.get('c').properties);
    } finally {
        await session.close();
    }
};

export const getAuthorContributions = async (repoId: string, authorEmail: string) => {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
        const result = await session.executeRead(async tx =>
            await tx.run(
                `MATCH (a:Author {email: $authorEmail})-[:AUTHORED]->(c:Commit {repoId: $repoId})-[:TOUCHES]->(f:File)-[:BELONGS_TO]->(m:Module)
                 RETURN m.name AS module, count(DISTINCT c) AS commitCount`,
                { repoId, authorEmail }
            )
        );
        return result.records.map(record => ({
            module: record.get('module'),
            commitCount: record.get('commitCount').toNumber()
        }));
    } finally {
        await session.close();
    }
};

export const getRelatedCommits = async (repoId: string, sha: string, hops: number) => {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
        // We use string interpolation for hops as Cypher doesn't allow parameters for variable length relationship bounds
        const maxHops = Math.max(1, hops);
        const result = await session.executeRead(async tx =>
            await tx.run(
                `MATCH (start:Commit {repoId: $repoId, sha: $sha})
                 MATCH (start)-[:PARENT_OF|TOUCHES*1..${maxHops}]-(related:Commit)
                 WHERE related.repoId = $repoId AND start <> related
                 RETURN DISTINCT related`,
                { repoId, sha }
            )
        );
        return result.records.map(record => record.get('related').properties);
    } finally {
        await session.close();
    }
};

export const getModuleActivity = async (repoId: string, moduleName: string, fromDate: string, toDate: string) => {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
        const result = await session.executeRead(async tx =>
            await tx.run(
                `MATCH (m:Module {repoId: $repoId, name: $moduleName})<-[:BELONGS_TO]-(f:File)<-[:TOUCHES]-(c:Commit {repoId: $repoId})
                 WHERE c.timestamp >= $fromDate AND c.timestamp <= $toDate
                 RETURN DISTINCT c
                 ORDER BY c.timestamp DESC`,
                { repoId, moduleName, fromDate, toDate }
            )
        );
        return result.records.map(record => record.get('c').properties);
    } finally {
        await session.close();
    }
};

export const graphTraverse = async (repoId: string, startNodeType: string, startNodeProperty: string, startNodeValue: string, relationshipType: string, hops: number) => {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
        const maxHops = Math.max(1, hops);
        const nodeType = startNodeType.replace(/[^a-zA-Z0-9_]/g, '');
        const nodeProp = startNodeProperty.replace(/[^a-zA-Z0-9_]/g, '');
        const relType = relationshipType.replace(/[^a-zA-Z0-9_]/g, '');
        const result = await session.executeRead(async tx =>
            await tx.run(
                `MATCH (start:${nodeType} {repoId: $repoId, ${nodeProp}: $startNodeValue})
                 MATCH (start)-[:${relType}*1..${maxHops}]-(related)
                 WHERE related.repoId = $repoId AND start <> related
                 RETURN DISTINCT related`,
                { repoId, startNodeValue }
            )
        );
        return result.records.map(record => record.get('related').properties);
    } finally {
        await session.close();
    }
};

