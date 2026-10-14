
import pytest

import app as medibot


@pytest.fixture
def client():
    """Provide a Flask test client for each test."""
    medibot.app.config.update(TESTING=True)

    with medibot.app.test_client() as test_client:
        yield test_client


# --------------------------------------------------
# Homepage tests
# --------------------------------------------------

def test_homepage_returns_success(client):
    response = client.get("/")

    assert response.status_code == 200
    assert b"Medibot" in response.data


# --------------------------------------------------
# Application liveness and RAG readiness tests
# --------------------------------------------------

def test_health_reports_application_liveness(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", None)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {
        "status": "ok",
    }


def test_readiness_reports_uninitialized_rag(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", None)

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.get_json() == {
        "status": "unavailable",
        "rag_initialized": False,
    }


def test_readiness_reports_initialized_rag(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.get_json() == {
        "status": "ready",
        "rag_initialized": True,
    }


def test_oversized_request_returns_json_error(client):
    response = client.post(
        "/chat",
        data=b"x" * (11 * 1024 * 1024 + 1),
        content_type="application/octet-stream",
    )

    assert response.status_code == 413
    assert response.is_json
    assert "too large" in response.get_json()["error"].lower()


# --------------------------------------------------
# Chat input validation tests
# --------------------------------------------------

def test_chat_rejects_empty_question(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    response = client.post(
        "/chat",
        json={"question": "   "},
    )

    assert response.status_code == 400
    assert "error" in response.get_json()


def test_chat_rejects_invalid_json_shape(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    response = client.post(
        "/chat",
        json=["not", "an", "object"],
    )

    assert response.status_code == 400
    assert "error" in response.get_json()


def test_chat_rejects_question_over_limit(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    response = client.post(
        "/chat",
        json={"question": "a" * 2001},
    )

    assert response.status_code == 400
    assert "2000 characters" in response.get_json()["error"]


def test_chat_reports_unavailable_rag(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", None)

    response = client.post(
        "/chat",
        json={"question": "What is acromegaly?"},
    )

    assert response.status_code == 503
    assert "error" in response.get_json()


# --------------------------------------------------
# Chat response tests
# --------------------------------------------------

def test_chat_returns_answer_and_sources(client, monkeypatch):
    class FakeDocument:
        page_content = (
            "Acromegaly is associated with excess growth hormone."
        )
        metadata = {
            "source": "Medical_book.pdf",
            "page": 10,
            "page_label": "11",
        }

    class FakeRAGChain:
        def invoke(self, payload):
            assert payload["input"] == "What is acromegaly?"

            return {
                "answer": (
                    "Acromegaly involves excess growth hormone."
                ),
                "context": [FakeDocument()],
            }

    monkeypatch.setattr(medibot, "rag_chain", FakeRAGChain())

    response = client.post(
        "/chat",
        json={"question": "What is acromegaly?"},
    )

    assert response.status_code == 200

    result = response.get_json()

    assert result["answer"]
    assert len(result["sources"]) == 1
    assert result["sources"][0]["source"] == "Medical_book.pdf"
    assert result["sources"][0]["page"] == 10
    assert result["disclaimer"]


# --------------------------------------------------
# Request ID tests
# --------------------------------------------------

def test_response_contains_request_id(client):
    response = client.get("/health")

    request_id = response.headers.get("X-Request-ID")

    assert request_id is not None
    assert len(request_id) == 36
    assert response.headers.get("X-Request-ID") == request_id


def test_each_request_gets_a_unique_request_id(client):
    first_response = client.get("/health")
    second_response = client.get("/health")

    first_id = first_response.headers.get("X-Request-ID")
    second_id = second_response.headers.get("X-Request-ID")

    assert first_id is not None
    assert second_id is not None
    assert first_id != second_id
from io import BytesIO
from types import SimpleNamespace


def test_analyze_paper_rejects_missing_file(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    response = client.post("/analyze-paper")

    assert response.status_code == 400
    assert "PDF" in response.get_json()["error"]


def test_analyze_paper_rejects_non_pdf(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    response = client.post(
        "/analyze-paper",
        data={"paper": (BytesIO(b"not a PDF"), "notes.txt")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert "PDF" in response.get_json()["error"]


def test_analyze_paper_rejects_invalid_pdf_signature(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    response = client.post(
        "/analyze-paper",
        data={"paper": (BytesIO(b"this is not a PDF"), "study.pdf")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert "valid PDF" in response.get_json()["error"]


def test_analyze_paper_rejects_more_than_20_pages(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    class FakePage:
        def extract_text(self):
            return "Research text " * 20

    class FakeReader:
        is_encrypted = False
        pages = [FakePage() for _ in range(21)]

        def __init__(self, stream):
            pass

    monkeypatch.setattr(medibot, "PdfReader", FakeReader)

    response = client.post(
        "/analyze-paper",
        data={"paper": (BytesIO(b"%PDF-fake"), "study.pdf")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert "20 pages" in response.get_json()["error"]


def test_analyze_paper_returns_structured_summary(client, monkeypatch):
    monkeypatch.setattr(medibot, "rag_chain", object())

    class FakePage:
        def extract_text(self):
            return "A medical research study investigates a defined research question. " * 5

    class FakeReader:
        is_encrypted = False
        pages = [FakePage()]

        def __init__(self, stream):
            pass

    class FakeModel:
        def __init__(self, **kwargs):
            pass

        def invoke(self, prompt):
            assert "Research question and objective" in prompt
            return SimpleNamespace(
                content="Research question: Example. Limitations: Requires verification."
            )

    monkeypatch.setattr(medibot, "PdfReader", FakeReader)
    monkeypatch.setattr(medibot, "ChatOllama", FakeModel)

    response = client.post(
        "/analyze-paper",
        data={"paper": (BytesIO(b"%PDF-fake"), "study.pdf")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    result = response.get_json()
    assert result["filename"] == "study.pdf"
    assert result["pages_analyzed"] == 1
    assert "Research question" in result["summary"]
    assert result["disclaimer"]
