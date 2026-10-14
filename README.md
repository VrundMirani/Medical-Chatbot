# Medibot — Medical Information Assistant

Medibot is an educational medical-information chatbot that combines retrieval-augmented generation (RAG), a medical reference library, semantic search, and a locally running language model.

It is designed to help users explore medical concepts and understand medical research papers. It is not a diagnostic system and does not replace qualified healthcare professionals.

## Features

- **Medical Q&A:** Ask questions about medical concepts using a medical reference collection.
- **Evidence Explorer:** Inspect retrieved source excerpts and available source/page information.
- **Research Paper Analyzer:** Upload a text-based medical research PDF and receive a structured educational summary.
- **Research limitations:** The analyzer highlights study methodology, findings, potential bias, and what the supplied paper does not establish.
- **Conversation tools:** Copy answers, export conversations as text, clear history, and retain conversation history in browser storage.
- **Source-grounded RAG:** Retrieve relevant reference passages using semantic embeddings and a Pinecone vector index.
- **Local language model:** Generate answers with Ollama, reducing reliance on paid LLM APIs.
- **Health endpoints:** Check application liveness and readiness.
- **Automated tests:** Validate core routes, request handling, and research analyzer behavior.

## Technology Stack

- Python
- Flask
- LangChain
- Pinecone vector database
- Hugging Face sentence-transformer embeddings
- Ollama with `llama3.2:3b`
- PyPDF
- HTML, CSS, and JavaScript
- pytest

## Architecture

1. The user submits a medical question through the web interface.
2. The Flask backend validates the request.
3. The retrieval pipeline searches the existing Pinecone index using semantic embeddings.
4. Retrieved medical-reference passages are supplied to the language model.
5. The application returns the answer and available source information.
6. The Research Lab separately extracts text from an uploaded PDF and asks the local model to create a structured educational summary.

## Prerequisites

- Windows, macOS, or Linux
- Python 3.12 (the project has been tested with Python 3.12.7)
- Conda or another Python environment manager
- Ollama installed and running
- A Pinecone account and access to the existing `medical-chatbot` index
- The required environment variables

## Local Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Medical-Chatbot
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual repository URL.

### 2. Create and activate the environment

```bash
conda create -n medibot python=3.12 -y
conda activate medibot
```

If the `medibot` environment already exists, activate it instead of creating it again.

### 3. Install dependencies

```bash
python -m pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```dotenv
PINECONE_API_KEY=your_pinecone_api_key
```

Use your own credentials. Never commit `.env` or publish API keys.

The application expects an existing Pinecone index named `medical-chatbot`. Its dimension must match the configured embedding model (384 dimensions for `sentence-transformers/all-MiniLM-L6-v2`).

### 5. Install and start Ollama

Install Ollama from its official website: https://ollama.com/

Pull the configured model:

```bash
ollama pull llama3.2:3b
```

Ensure the Ollama service is running before starting the application.

### 6. Start Medibot

From the project root, run:

```bash
python app.py
```

Open the local application at:

http://127.0.0.1:5000/

## Application Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /` | Web interface |
| `GET /health` | Application liveness |
| `GET /ready` | Readiness status |
| `POST /chat` | Medical question and answer |
| `POST /analyze-paper` | Analyze an uploaded research PDF |

The chat and analyzer require the relevant backend components to be initialized and available.

## Research Paper Analyzer

The initial implementation accepts PDFs with selectable text, up to 10 MB and 20 pages. It extracts text and asks the local Ollama model to organize the paper into sections covering:

- Research question and objective
- Study design and methodology
- Population and sample size, when reported
- Main findings
- Limitations and potential bias
- What the paper does not establish
- Questions for further investigation

Scanned PDFs requiring OCR are not supported in this version. The model can misinterpret papers, so always verify the generated summary against the original publication.

## Run Tests

Run the automated test suite:

```bash
python -m pytest tests/test_app.py -v
```

Check Python syntax:

```bash
python -m py_compile app.py
```

If Node.js is installed, check frontend JavaScript syntax:

```bash
node --check static/script.js
```

## Medical Safety and Limitations

- Medibot is an educational project, not a medical device or diagnostic service.
- Generated content may be inaccurate, incomplete, or outdated.
- Retrieved excerpts do not guarantee that an answer is correct or comprehensive.
- Do not use generated responses as a substitute for professional medical assessment or treatment.
- For a medical emergency, contact local emergency services immediately.
- Do not upload identifiable patient records or confidential documents.
- The research analyzer currently does not perform OCR or independently verify scientific claims.
- Local language-model inference does not mean every part of the system is offline: Pinecone retrieval requires network access.
- This repository has not been independently audited or validated for clinical use or production deployment.

## Privacy and Configuration

Keep `.env`, credentials, logs, local backups, and private datasets out of version control. Review `.gitignore` and `git status` before every upload.

The browser conversation history is stored in local browser storage. Avoid using the application on shared devices for sensitive conversations.

## Roadmap

Potential future improvements include:

- More comprehensive evaluation of answer faithfulness and source relevance
- Improved medical source ranking and evidence-quality indicators
- Multilingual question answering
- Medical knowledge-graph exploration
- Better research-paper comparison and citation verification
- Authentication, access control, deployment hardening, and privacy review
- Broader automated tests and performance monitoring

## License

See the `LICENSE` file included in this repository.
