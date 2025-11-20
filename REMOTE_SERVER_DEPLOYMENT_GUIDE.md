# Remote Server Deployment Guide

This guide details the process for deploying the **DotMac ISP Operations Platform** to a remote Linux server (bare metal or VM) using Docker Compose.

## Prerequisites

*   **Server:** Ubuntu 22.04 LTS or Debian 12 (Recommended)
*   **Resources:** Minimum 4 vCPU, 8GB RAM, 50GB SSD
*   **Domain:** A valid domain name pointing to the server's IP address
*   **Access:** SSH access with sudo privileges

## 1. Server Preparation

Update the system and install necessary dependencies:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git make ufw
```

### Install Docker & Docker Compose

```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# Install Docker packages:
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation:
sudo docker run hello-world
```

### Configure Firewall (UFW)

Allow SSH, HTTP, and HTTPS traffic:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Application Deployment

### Clone the Repository

```bash
git clone https://github.com/dotmac/isp-ops-platform.git /opt/dotmac
cd /opt/dotmac
```

### Configure Environment Variables

Copy the example environment file and update it with your production secrets:

```bash
cp .env.example .env
nano .env
```

**Critical Settings to Update:**

*   `ENVIRONMENT=production`
*   `SECRET_KEY`: Generate a strong random string (e.g., `openssl rand -hex 32`)
*   `POSTGRES_PASSWORD`: Set a strong database password
*   `REDIS_PASSWORD`: Set a strong Redis password
*   `DOMAIN_NAME`: Your domain name (e.g., `ops.example.com`)
*   `BILLING__REQUIRE_PAYMENT_PLUGIN=true` (Enforce real payments)

### Build and Start Services

Use the provided Makefile or Docker Compose directly:

```bash
# Build images
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml build

# Start services in detached mode
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d
```

*Note: If `docker-compose.prod.yml` does not exist, create one that overrides the base configuration for production (e.g., removing exposed ports for internal services, setting restart policies).*

## 3. Database Setup

Run the initial database migrations:

```bash
# Run Alembic migrations
docker compose exec platform-backend alembic upgrade head

# (Optional) Seed initial data
docker compose exec platform-backend python scripts/seed_initial_data.py
```

## 4. SSL Configuration (Caddy/Nginx)

It is recommended to use a reverse proxy like Caddy or Nginx to handle SSL termination.

### Option A: Caddy (Automatic HTTPS)

1.  Install Caddy: `sudo apt install -y caddy`
2.  Configure `/etc/caddy/Caddyfile`:

```caddyfile
ops.example.com {
    reverse_proxy localhost:3000
}

api.ops.example.com {
    reverse_proxy localhost:8000
}
```

3.  Restart Caddy: `sudo systemctl restart caddy`

## 5. Maintenance & Monitoring

### View Logs

```bash
docker compose logs -f --tail=100
```

### Update Application

```bash
git pull origin main
docker compose build
docker compose up -d
docker compose exec platform-backend alembic upgrade head
```

### Backups

Set up a cron job to backup the PostgreSQL database:

```bash
# Daily backup at 3 AM
0 3 * * * docker compose exec -T postgres pg_dump -U dotmac dotmac > /var/backups/dotmac_$(date +\%F).sql
```

## Troubleshooting

*   **Database Connection Failed:** Check `DATABASE_URL` in `.env` and ensure the postgres container is healthy (`docker ps`).
*   **502 Bad Gateway:** Ensure the backend/frontend containers are running and listening on the expected ports. Check logs for startup errors.
