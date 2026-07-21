import re
from lib.neo4j_client import get_driver


def get_commits_by_file(repo_id: str, file_path: str) -> list:
    driver = get_driver()
    with driver.session() as session:
        result = session.execute_read(
            lambda tx: tx.run(
                'MATCH (c:Commit {repoId:$r})-[:TOUCHES]->(f:File {repoId:$r, path:$p}) RETURN c ORDER BY c.timestamp DESC',
                r=repo_id, p=file_path,
            ).data()
        )
    return [r['c'] for r in result]


def get_author_contributions(repo_id: str, author_email: str) -> list:
    driver = get_driver()
    with driver.session() as session:
        result = session.execute_read(
            lambda tx: tx.run(
                '''MATCH (a:Author {email:$e})-[:AUTHORED]->(c:Commit {repoId:$r})-[:TOUCHES]->(f:File)-[:BELONGS_TO]->(m:Module)
                   RETURN m.name AS module, count(DISTINCT c) AS commitCount''',
                r=repo_id, e=author_email,
            ).data()
        )
    return result


def get_related_commits(repo_id: str, sha: str, hops: int = 2) -> list:
    max_hops = max(1, hops)
    driver = get_driver()
    with driver.session() as session:
        result = session.execute_read(
            lambda tx: tx.run(
                f'''MATCH (start:Commit {{repoId:$r, sha:$s}})
                    MATCH (start)-[:PARENT_OF|TOUCHES*1..{max_hops}]-(related:Commit)
                    WHERE related.repoId = $r AND start <> related
                    RETURN DISTINCT related''',
                r=repo_id, s=sha,
            ).data()
        )
    return [r['related'] for r in result]


def get_module_activity(repo_id: str, module_name: str, from_date: str, to_date: str) -> list:
    driver = get_driver()
    with driver.session() as session:
        result = session.execute_read(
            lambda tx: tx.run(
                '''MATCH (m:Module {repoId:$r, name:$mn})<-[:BELONGS_TO]-(f:File)<-[:TOUCHES]-(c:Commit {repoId:$r})
                   WHERE c.timestamp >= $fd AND c.timestamp <= $td
                   RETURN DISTINCT c ORDER BY c.timestamp DESC''',
                r=repo_id, mn=module_name, fd=from_date, td=to_date,
            ).data()
        )
    return [r['c'] for r in result]


def graph_traverse(repo_id: str, start_node_type: str, start_node_property: str,
                   start_node_value: str, relationship_type: str, hops: int = 1) -> list:
    max_hops = max(1, hops)
    # Sanitize dynamic parts
    node_type = re.sub(r'[^a-zA-Z0-9_]', '', start_node_type)
    node_prop = re.sub(r'[^a-zA-Z0-9_]', '', start_node_property)
    rel_type = re.sub(r'[^a-zA-Z0-9_]', '', relationship_type)

    driver = get_driver()
    with driver.session() as session:
        result = session.execute_read(
            lambda tx: tx.run(
                f'''MATCH (start:{node_type} {{repoId:$r, {node_prop}:$v}})
                    MATCH (start)-[:{rel_type}*1..{max_hops}]-(related)
                    WHERE related.repoId = $r AND start <> related
                    RETURN DISTINCT related''',
                r=repo_id, v=start_node_value,
            ).data()
        )
    return [r['related'] for r in result]
