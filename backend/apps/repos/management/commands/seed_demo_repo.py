from django.core.management.base import BaseCommand
from scripts.seed_demo_repo import seed_demo_repo


class Command(BaseCommand):
    help = 'Seeds public demo repo (vercel/next.js) with real commits, embeddings, and drift data'

    def handle(self, *args, **options):
        self.stdout.write("Running seed_demo_repo...")
        demo_repo = seed_demo_repo()
        self.stdout.write(self.style.SUCCESS(f"Successfully seeded demo repo: {demo_repo.full_name} (ID: {demo_repo.id})"))
