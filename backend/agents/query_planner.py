import os
import json
from typing import Generator
from django.db import connection
from django.conf import settings
from apps.repos.models import Commit
from lib.embedding import embed_text
from lib.graph_queries import graph_traverse, get_module_activity
import google.generativeai as genai

genai.configure(api_key=settings.GEMINI_API_KEY)

_TOOLS = [
    genai.protos.Tool(function_declarations=[
        genai.protos.FunctionDeclaration(
            name='vector_search',
            description='Performs semantic search to find commits related to a natural language query.',
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    'query': genai.protos.Schema(type=genai.protos.Type.STRING, description='Natural language query'),
                    'repoId': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'limit': genai.protos.Schema(type=genai.protos.Type.INTEGER, description='Max results, default 5'),
                },
                required=['query', 'repoId'],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name='graph_traverse',
            description='Runs a Neo4j graph traversal to find related nodes.',
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    'repoId': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'startNodeType': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'startNodeProperty': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'startNodeValue': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'relationshipType': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'hops': genai.protos.Schema(type=genai.protos.Type.INTEGER),
                },
                required=['repoId', 'startNodeType', 'startNodeProperty', 'startNodeValue', 'relationshipType'],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name='filter_by_date',
            description='Filters a list of commit objects by date range.',
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    'commits': genai.protos.Schema(type=genai.protos.Type.ARRAY, items=genai.protos.Schema(type=genai.protos.Type.OBJECT)),
                    'fromDate': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'toDate': genai.protos.Schema(type=genai.protos.Type.STRING),
                },
                required=['commits', 'fromDate', 'toDate'],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name='get_module_timeline',
            description='Gets commit activity for a specific module within a date range.',
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    'repoId': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'moduleName': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'fromDate': genai.protos.Schema(type=genai.protos.Type.STRING),
                    'toDate': genai.protos.Schema(type=genai.protos.Type.STRING),
                },
                required=['repoId', 'moduleName', 'fromDate', 'toDate'],
            ),
        ),
    ])
]

_SYSTEM_INSTRUCTION = (
    'You are an expert codebase history investigator. You have access to tools that query '
    'a Neo4j knowledge graph and a pgvector semantic search engine. '
    'When asked a complex question, break it down: '
    '1. Use vector_search to find relevant commits. '
    '2. Use graph_traverse or get_module_timeline for deeper analysis. '
    '3. Synthesize a comprehensive answer, citing commit SHAs.'
)


def _execute_vector_search(args: dict) -> list:
    query = args.get('query', '')
    repo_id = args.get('repoId', '')
    limit = int(args.get('limit', 5))

    vector = embed_text(query)
    vector_str = '[' + ','.join(str(v) for v in vector) + ']'

    with connection.cursor() as cur:
        cur.execute(
            """SELECT ec."commitId", (ec."embedding" <=> %s::vector) AS distance
               FROM "EmbeddingChunk" ec WHERE ec."repoId" = %s
               ORDER BY distance ASC LIMIT %s""",
            [vector_str, repo_id, limit],
        )
        rows = cur.fetchall()

    commit_ids = list({r[0] for r in rows if r[0]})
    commits = list(Commit.objects.filter(id__in=commit_ids).values('sha', 'message', 'timestamp', 'author_name'))
    return [{'sha': c['sha'], 'message': c['message'], 'timestamp': str(c['timestamp']), 'authorName': c['author_name']} for c in commits]


def _execute_filter_by_date(args: dict) -> list:
    from datetime import datetime
    commits = args.get('commits', [])
    from_dt = datetime.fromisoformat(args['fromDate'])
    to_dt = datetime.fromisoformat(args['toDate'])
    return [c for c in commits if from_dt <= datetime.fromisoformat(c.get('timestamp', '1970-01-01')) <= to_dt]


def run_query_planner(user_query: str, repo_id: str) -> Generator[dict, None, None]:
    """Generator that yields SSE-compatible dicts: {chunk: str} or {done: True}."""
    model = genai.GenerativeModel(
        model_name='gemini-2.5-pro',
        system_instruction=_SYSTEM_INSTRUCTION,
        tools=_TOOLS,
    )
    chat = model.start_chat(enable_automatic_function_calling=False)
    message = f'User Query: {user_query}\nRepository ID: {repo_id}'

    while True:
        response = chat.send_message(message, stream=False)
        candidate = response.candidates[0]

        # Check for function calls
        function_calls = [
            part.function_call for part in candidate.content.parts
            if hasattr(part, 'function_call') and part.function_call.name
        ]

        if not function_calls:
            # Final text response - stream it
            for part in candidate.content.parts:
                if hasattr(part, 'text') and part.text:
                    yield {'chunk': part.text}
            break

        # Execute each tool call
        function_responses = []
        for fc in function_calls:
            args = dict(fc.args)
            name = fc.name
            print(f'[QueryPlanner] Executing {name} with {args}')
            try:
                if name == 'vector_search':
                    result = _execute_vector_search(args)
                elif name == 'graph_traverse':
                    result = graph_traverse(
                        args['repoId'], args['startNodeType'], args['startNodeProperty'],
                        args['startNodeValue'], args['relationshipType'], int(args.get('hops', 1))
                    )
                elif name == 'filter_by_date':
                    result = _execute_filter_by_date(args)
                elif name == 'get_module_timeline':
                    result = get_module_activity(
                        args['repoId'], args['moduleName'], args['fromDate'], args['toDate']
                    )
                else:
                    result = {'error': f'Unknown function: {name}'}
            except Exception as e:
                result = {'error': str(e)}

            function_responses.append(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=name,
                        response={'result': json.dumps(result, default=str)},
                    )
                )
            )

        # Feed results back to model
        message = function_responses

    yield {'done': True}
