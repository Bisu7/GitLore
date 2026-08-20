from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print('[Embedding] Loading all-MiniLM-L6-v2...')
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model


def embed_text(text: str) -> list[float]:
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()

def identify_pattern(text:str) -> str:
    words = text.split()
    wordCount = words.count()
    return wordCount
