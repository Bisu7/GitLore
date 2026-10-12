import json
from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from slack_sdk import WebClient
from apps.repos.models import Repo

def send_slack_drift_alert(repo_id, module_name, ai_explanation):
    # Retrieve tokens from settings or fallback to env vars
    token = getattr(settings, 'SLACK_BOT_TOKEN', '')
    if not token:
        import os
        token = os.environ.get('SLACK_BOT_TOKEN')
        
    channel = getattr(settings, 'SLACK_ALERT_CHANNEL', '#general')
    
    if not token:
        print("[Slack] No token found. Skipping drift alert.")
        return
        
    client = WebClient(token=token)
    
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"⚠️ Architecture drift detected in {module_name}"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ai_explanation
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View drift dashboard →"
                    },
                    "url": f"http://localhost:3000/repo/{repo_id}/drift",
                    "style": "primary"
                }
            ]
        }
    ]
    
    try:
        client.chat_postMessage(channel=channel, blocks=blocks, text=f"Drift in {module_name}")
    except Exception as e:
        print(f"Error sending slack message: {e}")


@api_view(['POST'])
@permission_classes([AllowAny])
def slack_webhook(request):
    data = request.POST
    
    if data.get('command') == '/timemachine':
        text = data.get('text', '')
        parts = text.split(' ', 1)
        
        if len(parts) < 2:
            return JsonResponse({
                "response_type": "ephemeral",
                "text": "Usage: /timemachine [repo-name] [question]"
            })
            
        repo_name = parts[0]
        question = parts[1]
        
        repo = Repo.objects.filter(full_name__icontains=repo_name).first()
        if not repo:
            return JsonResponse({
                "response_type": "ephemeral",
                "text": f"Repository '{repo_name}' not found."
            })
            
        from agents.query_planner import run_query_planner
        
        answer_chunks = []
        sources = []
        for event in run_query_planner(question, repo.id):
            if 'chunk' in event:
                answer_chunks.append(event['chunk'])
            if 'sources' in event:
                sources = event['sources']
                
        answer_text = "".join(answer_chunks)
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"Question: {question}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": answer_text
                }
            },
            {
                "type": "divider"
            }
        ]
        
        if sources:
            source_text = "*Sources:*\n"
            for src in sources:
                sha = src['sha'][:7]
                url = f"http://localhost:3000/repo/{repo.id}/commit/{src['sha']}"
                source_text += f"• <{url}|{sha}> - {src['message'][:40]}...\n"
                
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": source_text
                    }
                ]
            })
            
        return JsonResponse({
            "response_type": "in_channel",
            "blocks": blocks
        })

    return JsonResponse({"text": "Unknown command"})
