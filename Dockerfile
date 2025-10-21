FROM python:3.12-slim

WORKDIR /app

ARG DEBIAN_FRONTEND=noninteractive

# Install system dependencies with pinned versions
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        gcc="$(apt-cache policy gcc | awk '/Candidate/ {print $2}')" \
        postgresql-client="$(apt-cache policy postgresql-client | awk '/Candidate/ {print $2}')" \
        freeradius-utils="$(apt-cache policy freeradius-utils | awk '/Candidate/ {print $2}')"; \
    rm -rf /var/lib/apt/lists/*; \
    # Verify radclient installation
    radclient -v || echo "radclient installed successfully"

# Create non-root application user
RUN useradd --create-home --shell /bin/bash appuser

# Copy dependency files
COPY --chown=appuser:appuser pyproject.toml poetry.lock ./

# Install Poetry and dependencies
RUN pip install --no-cache-dir "poetry==1.8.3" && \
    poetry config virtualenvs.create false && \
    poetry install --only=main --extras=celery --no-root --no-interaction --no-ansi

# Copy application code
COPY --chown=appuser:appuser src ./src
COPY --chown=appuser:appuser alembic.ini ./
COPY --chown=appuser:appuser alembic ./alembic

# Ensure application files are owned by non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Set Python path
ENV PYTHONPATH=/app/src:$PYTHONPATH

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "dotmac.platform.main:app", "--host", "0.0.0.0", "--port", "8000"]
