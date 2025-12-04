# ISP-specific targets (ops frontend/backend).

.PHONY: start-isp stop-isp restart-isp status-isp logs-isp clean-isp \
	dev-frontend build-isp build-freeradius post-deploy-isp docker-isp-up

start-isp:
	@./scripts/infra.sh isp start

stop-isp:
	@./scripts/infra.sh isp stop

restart-isp:
	@./scripts/infra.sh isp restart

status-isp:
	@./scripts/infra.sh isp status

logs-isp:
	@./scripts/infra.sh isp logs

clean-isp:
	@./scripts/infra.sh isp clean

dev-frontend:
	@echo "$(CYAN)Starting ISP frontend on http://localhost:3001$(NC)"
	@cd frontend && pnpm dev:isp

post-deploy-isp:
	@echo "$(CYAN)Running post-deployment setup for ISP backend...$(NC)"
	@./scripts/post-deploy.sh isp

build-isp:
	@echo "$(CYAN)Building ISP Docker images...$(NC)"
	@docker compose -f docker-compose.isp.yml build

build-freeradius:
	@echo "$(CYAN)Building FreeRADIUS image for Apple Silicon...$(NC)"
	@docker build --platform linux/amd64 -f Dockerfile.freeradius -t freeradius-postgresql:latest .

docker-isp-up:
	@docker compose -f docker-compose.isp.yml up -d isp-backend isp-frontend freeradius mongodb genieacs
