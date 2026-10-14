from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings


def load_pdf_files(data_path):
    """Load PDF documents from a file or directory."""
    path = Path(data_path)

    if path.is_file() and path.suffix.lower() == ".pdf":
        pdf_files = [path]
    elif path.is_dir():
        pdf_files = sorted(path.glob("*.pdf"))
    else:
        raise FileNotFoundError(
            f"PDF file or directory not found: {path}"
        )

    if not pdf_files:
        raise FileNotFoundError(
            f"No PDF files found at: {path}"
        )

    documents = []

    for pdf_file in pdf_files:
        loader = PyPDFLoader(str(pdf_file))
        documents.extend(loader.load())

    return documents


def text_split(extracted_data, chunk_size=500, chunk_overlap=20):
    """Split documents into overlapping text chunks."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive.")

    if chunk_overlap < 0 or chunk_overlap >= chunk_size:
        raise ValueError(
            "chunk_overlap must be non-negative and smaller "
            "than chunk_size."
        )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    return splitter.split_documents(extracted_data)


def download_hugging_face_embeddings():
    """Load the local sentence-transformer embedding model."""
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
