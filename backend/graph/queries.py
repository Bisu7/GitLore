from graph.connection import driver

def get_commits_by_file(repo_id: str, file_path: str):
    if not driver: return []
    with driver.session() as session:
        result = session.run(
            """
            MATCH (c:Commit {repo_id: $repo_id})-[:TOUCHES]->(f:File {path: $file_path, repo_id: $repo_id})
            RETURN c.sha as sha
            """,
            repo_id=repo_id, file_path=file_path
        )
        return [record["sha"] for record in result]

def get_author_contributions(repo_id: str, author_email: str):
    if not driver: return []
    with driver.session() as session:
        result = session.run(
            """
            MATCH (:Author {email: $email})-[:AUTHORED]->(c:Commit {repo_id: $repo_id})-[:TOUCHES]->(f:File)-[:BELONGS_TO]->(m:Module)
            RETURN m.name as module_name, COUNT(DISTINCT c) as commit_count
            ORDER BY commit_count DESC
            """,
            repo_id=repo_id, email=author_email
        )
        return [{"module_name": r["module_name"], "commit_count": r["commit_count"]} for r in result]

def get_related_commits(repo_id: str, sha: str, hops: int = 2):
    if not driver: return []
    max_rels = hops * 2
    with driver.session() as session:
        result = session.run(
            f"""
            MATCH (start:Commit {{sha: $sha, repo_id: $repo_id}})
            MATCH (start)-[:PARENT_OF|TOUCHES*1..{max_rels}]-(related:Commit)
            WHERE related.sha <> $sha AND related.repo_id = $repo_id
            RETURN DISTINCT related.sha as sha
            """,
            repo_id=repo_id, sha=sha
        )
        return [record["sha"] for record in result]

def get_module_activity(repo_id: str, module_name: str, from_date: str, to_date: str):
    if not driver: return []
    with driver.session() as session:
        result = session.run(
            """
            MATCH (c:Commit {repo_id: $repo_id})-[:TOUCHES]->(f:File)-[:BELONGS_TO]->(m:Module {name: $module_name, repo_id: $repo_id})
            WHERE c.timestamp >= $from_date AND c.timestamp <= $to_date
            RETURN DISTINCT c.sha as sha
            """,
            repo_id=repo_id, module_name=module_name, from_date=from_date, to_date=to_date
        )
        return [record["sha"] for record in result]
