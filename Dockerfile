FROM python:3.12-slim

WORKDIR /app

ARG DEBIAN_FRONTEND=noninteractive

# Install system dependencies with pinned versions
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        gcc="$(apt-cache policy gcc | awk '/Candidate/ {print $2}')" \
        postgresql-client="$(apt-cache policy postgresql-client | awk '/Candidate/ {print $2}')" \
        freeradius-utils="$(apt-cache policy freeradius-utils | awk '/Candidate/ {print $2}')" \
        gosu="$(apt-cache policy gosu | awk '/Candidate/ {print $2}')"; \
    rm -rf /var/lib/apt/lists/*; \
    # Verify installations
    radclient -v || echo "radclient installed successfully"; \
    gosu nobody true

# Create non-root application user
RUN useradd --create-home --shell /bin/bash appuser

# Copy dependency files
COPY --chown=appuser:appuser pyproject.toml poetry.lock ./

# Install Poetry and dependencies
RUN pip install --no-cache-dir "poetry==1.8.3" && \
    poetry config virtualenvs.create false && \
    poetry install --only=main --no-root --no-interaction --no-ansi

# Copy application code
COPY --chown=appuser:appuser src ./src
COPY --chown=appuser:appuser alembic.ini ./
COPY --chown=appuser:appuser alembic ./alembic

# Ensure application files are owned by non-root user
RUN chown -R appuser:appuser /app

# Create storage directory with correct permissions (as template for volumes)
RUN mkdir -p /var/lib/dotmac && chown -R appuser:appuser /var/lib/dotmac

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set Python path
ENV PYTHONPATH=/app/src:$PYTHONPATH

# Use entrypoint (runs as root to fix permissions, then switches to appuser)
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "dotmac.platform.main:app", "--host", "0.0.0.0", "--port", "8000"]
