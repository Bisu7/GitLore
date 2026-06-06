-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "EmbeddingChunk" ADD COLUMN     "embedding" vector(384);
