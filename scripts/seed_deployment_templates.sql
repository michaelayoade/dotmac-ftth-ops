-- Deployment Template Seeding Script
-- Creates production-ready deployment templates for multi-backend provisioning
-- Run with: psql -U dotmac_user -d dotmac -f scripts/seed_deployment_templates.sql

-- ============================================================================
-- Kubernetes Deployment Templates
-- ============================================================================

-- 1. Kubernetes - Starter Tier (Helm-based)
INSERT INTO deployment_templates (
    id,
    name,
    description,
    backend,
    template_version,
    configuration,
    cpu_cores,
    memory_gb,
    storage_gb,
    network_config,
    security_config,
    monitoring_config,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'kubernetes_starter_tier',
    'Kubernetes deployment for starter ISP customers. Includes basic resources, auto-scaling, and monitoring.',
    'kubernetes',
    '1.0.0',
    '{
        "helm_chart": "dotmac-isp/tenant",
        "chart_version": "1.0.0",
        "values": {
            "image": {
                "repository": "registry.dotmac.io/isp-tenant",
                "tag": "latest",
                "pullPolicy": "Always"
            },
            "replicaCount": 2,
            "service": {
                "type": "ClusterIP",
                "port": 8000
            },
            "ingress": {
                "enabled": true,
                "className": "nginx",
                "annotations": {
                    "cert-manager.io/cluster-issuer": "letsencrypt-prod",
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true"
                },
                "hosts": [
                    {
                        "host": "{{ tenant_subdomain }}.dotmac.io",
                        "paths": [{"path": "/", "pathType": "Prefix"}]
                    }
                ],
                "tls": [
                    {
                        "secretName": "{{ tenant_subdomain }}-tls",
                        "hosts": ["{{ tenant_subdomain }}.dotmac.io"]
                    }
                ]
            },
            "resources": {
                "limits": {
                    "cpu": "2000m",
                    "memory": "4Gi"
                },
                "requests": {
                    "cpu": "500m",
                    "memory": "1Gi"
                }
            },
            "autoscaling": {
                "enabled": true,
                "minReplicas": 2,
                "maxReplicas": 5,
                "targetCPUUtilizationPercentage": 70
            },
            "postgresql": {
                "enabled": true,
                "auth": {
                    "username": "tenant_user",
                    "database": "tenant_db"
                },
                "primary": {
                    "persistence": {
                        "size": "20Gi"
                    }
                }
            },
            "redis": {
                "enabled": true,
                "master": {
                    "persistence": {
                        "size": "5Gi"
                    }
                }
            },
            "env": {
                "DATABASE_URL": "postgresql://tenant_user:${DB_PASSWORD}@{{ tenant_id }}-postgresql:5432/tenant_db",
                "REDIS_URL": "redis://:${REDIS_PASSWORD}@{{ tenant_id }}-redis-master:6379/0",
                "TENANT_ID": "{{ tenant_id }}",
                "LICENSE_KEY": "{{ license_key }}",
                "ENVIRONMENT": "{{ environment }}"
            }
        }
    }'::jsonb,
    2.0,
    4,
    20,
    '{
        "load_balancer": "nginx-ingress",
        "dns_provider": "cloudflare",
        "cdn_enabled": false,
        "ddos_protection": "basic"
    }'::jsonb,
    '{
        "network_policies": true,
        "pod_security_standards": "restricted",
        "secrets_encryption": "sealed-secrets",
        "rbac_enabled": true,
        "service_mesh": false
    }'::jsonb,
    '{
        "prometheus": true,
        "grafana_dashboard": true,
        "alerts": {
            "cpu_threshold": 80,
            "memory_threshold": 85,
            "pod_restart_threshold": 3
        },
        "log_aggregation": "loki"
    }'::jsonb,
    true,
    NOW(),
    NOW()
);

-- 2. Kubernetes - Professional Tier (Enhanced resources)
INSERT INTO deployment_templates (
    id,
    name,
    description,
    backend,
    template_version,
    configuration,
    cpu_cores,
    memory_gb,
    storage_gb,
    network_config,
    security_config,
    monitoring_config,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'kubernetes_professional_tier',
    'Kubernetes deployment for professional ISP customers. Includes enhanced resources, HA, and advanced monitoring.',
    'kubernetes',
    '1.0.0',
    '{
        "helm_chart": "dotmac-isp/tenant",
        "chart_version": "1.0.0",
        "values": {
            "image": {
                "repository": "registry.dotmac.io/isp-tenant",
                "tag": "latest",
                "pullPolicy": "Always"
            },
            "replicaCount": 3,
            "service": {
                "type": "ClusterIP",
                "port": 8000
            },
            "ingress": {
                "enabled": true,
                "className": "nginx",
                "annotations": {
                    "cert-manager.io/cluster-issuer": "letsencrypt-prod",
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true",
                    "nginx.ingress.kubernetes.io/rate-limit": "100"
                }
            },
            "resources": {
                "limits": {
                    "cpu": "4000m",
                    "memory": "8Gi"
                },
                "requests": {
                    "cpu": "1000m",
                    "memory": "2Gi"
                }
            },
            "autoscaling": {
                "enabled": true,
                "minReplicas": 3,
                "maxReplicas": 10,
                "targetCPUUtilizationPercentage": 60
            },
            "postgresql": {
                "enabled": true,
                "architecture": "replication",
                "replication": {
                    "readReplicas": 2
                },
                "primary": {
                    "persistence": {
                        "size": "50Gi"
                    }
                }
            },
            "redis": {
                "enabled": true,
                "architecture": "replication",
                "replica": {
                    "replicaCount": 2
                },
                "master": {
                    "persistence": {
                        "size": "10Gi"
                    }
                }
            }
        }
    }'::jsonb,
    4.0,
    8,
    50,
    '{
        "load_balancer": "nginx-ingress",
        "dns_provider": "cloudflare",
        "cdn_enabled": true,
        "ddos_protection": "advanced",
        "rate_limiting": true
    }'::jsonb,
    '{
        "network_policies": true,
        "pod_security_standards": "restricted",
        "secrets_encryption": "sealed-secrets",
        "rbac_enabled": true,
        "service_mesh": "istio",
        "mtls_enabled": true
    }'::jsonb,
    '{
        "prometheus": true,
        "grafana_dashboard": true,
        "alerts": {
            "cpu_threshold": 70,
            "memory_threshold": 80,
            "pod_restart_threshold": 2
        },
        "log_aggregation": "loki",
        "tracing": "jaeger",
        "apm": true
    }'::jsonb,
    true,
    NOW(),
    NOW()
);

-- ============================================================================
-- Docker Compose Templates (Development/Staging)
-- ============================================================================

-- 3. Docker Compose - Development
INSERT INTO deployment_templates (
    id,
    name,
    description,
    backend,
    template_version,
    configuration,
    cpu_cores,
    memory_gb,
    storage_gb,
    network_config,
    security_config,
    monitoring_config,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'docker_compose_development',
    'Docker Compose deployment for development environments. Single-server setup with all services.',
    'docker_compose',
    '1.0.0',
    '{
        "compose_version": "3.8",
        "services": {
            "app": {
                "image": "registry.dotmac.io/isp-tenant:latest",
                "container_name": "tenant_{{ tenant_id }}_app",
                "restart": "unless-stopped",
                "ports": ["8000:8000"],
                "environment": {
                    "DATABASE_URL": "postgresql://tenant_user:${DB_PASSWORD}@postgres:5432/tenant_db",
                    "REDIS_URL": "redis://:${REDIS_PASSWORD}@redis:6379/0",
                    "TENANT_ID": "{{ tenant_id }}",
                    "LICENSE_KEY": "{{ license_key }}",
                    "ENVIRONMENT": "development"
                },
                "depends_on": ["postgres", "redis"],
                "volumes": [
                    "./data/app:/app/data",
                    "./logs:/app/logs"
                ],
                "networks": ["tenant_network"]
            },
            "postgres": {
                "image": "postgres:15-alpine",
                "container_name": "tenant_{{ tenant_id }}_postgres",
                "restart": "unless-stopped",
                "environment": {
                    "POSTGRES_USER": "tenant_user",
                    "POSTGRES_PASSWORD": "${DB_PASSWORD}",
                    "POSTGRES_DB": "tenant_db"
                },
                "volumes": ["postgres_data:/var/lib/postgresql/data"],
                "networks": ["tenant_network"]
            },
            "redis": {
                "image": "redis:7-alpine",
                "container_name": "tenant_{{ tenant_id }}_redis",
                "restart": "unless-stopped",
                "command": "redis-server --requirepass ${REDIS_PASSWORD}",
                "volumes": ["redis_data:/data"],
                "networks": ["tenant_network"]
            },
            "nginx": {
                "image": "nginx:alpine",
                "container_name": "tenant_{{ tenant_id }}_nginx",
                "restart": "unless-stopped",
                "ports": ["80:80", "443:443"],
                "volumes": [
                    "./nginx.conf:/etc/nginx/nginx.conf:ro",
                    "./ssl:/etc/nginx/ssl:ro"
                ],
                "depends_on": ["app"],
                "networks": ["tenant_network"]
            }
        },
        "volumes": {
            "postgres_data": {},
            "redis_data": {}
        },
        "networks": {
            "tenant_network": {
                "driver": "bridge"
            }
        }
    }'::jsonb,
    2.0,
    4,
    20,
    '{
        "reverse_proxy": "nginx",
        "ssl_enabled": true,
        "external_access": true
    }'::jsonb,
    '{
        "container_isolation": true,
        "secrets_management": "docker-secrets",
        "network_encryption": false
    }'::jsonb,
    '{
        "container_stats": true,
        "log_driver": "json-file",
        "log_rotation": true
    }'::jsonb,
    true,
    NOW(),
    NOW()
);

-- ============================================================================
-- AWX/Ansible Templates (Multi-Server Deployments)
-- ============================================================================

-- 4. AWX/Ansible - Multi-Server Production
INSERT INTO deployment_templates (
    id,
    name,
    description,
    backend,
    template_version,
    configuration,
    cpu_cores,
    memory_gb,
    storage_gb,
    network_config,
    security_config,
    monitoring_config,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'awx_ansible_production',
    'AWX/Ansible deployment for production multi-server setup. Automated server provisioning and configuration.',
    'awx_ansible',
    '1.0.0',
    '{
        "playbook": "deploy_tenant.yml",
        "inventory": {
            "all": {
                "vars": {
                    "ansible_user": "deploy",
                    "ansible_python_interpreter": "/usr/bin/python3",
                    "tenant_id": "{{ tenant_id }}",
                    "license_key": "{{ license_key }}",
                    "environment": "{{ environment }}"
                },
                "children": {
                    "app_servers": {
                        "hosts": "{{ app_server_ips }}"
                    },
                    "db_servers": {
                        "hosts": "{{ db_server_ips }}"
                    },
                    "cache_servers": {
                        "hosts": "{{ cache_server_ips }}"
                    },
                    "load_balancers": {
                        "hosts": "{{ lb_server_ips }}"
                    }
                }
            }
        },
        "extra_vars": {
            "app_version": "latest",
            "db_version": "15",
            "redis_version": "7",
            "nginx_version": "latest",
            "install_monitoring": true,
            "configure_firewall": true,
            "setup_ssl": true,
            "enable_backups": true
        },
        "roles": [
            "common",
            "security",
            "postgresql",
            "redis",
            "nginx",
            "app",
            "monitoring"
        ],
        "tasks": {
            "pre_tasks": [
                "Update system packages",
                "Configure firewall",
                "Setup users and permissions"
            ],
            "post_tasks": [
                "Verify service health",
                "Configure monitoring",
                "Setup backup jobs",
                "Send deployment notification"
            ]
        }
    }'::jsonb,
    8.0,
    16,
    100,
    '{
        "load_balancer": "nginx",
        "dns_provider": "cloudflare",
        "cdn_enabled": true,
        "private_network": true,
        "firewall": "ufw"
    }'::jsonb,
    '{
        "ssh_key_auth": true,
        "fail2ban": true,
        "automatic_updates": true,
        "intrusion_detection": true,
        "ssl_cert_management": "certbot"
    }'::jsonb,
    '{
        "prometheus": true,
        "grafana": true,
        "alertmanager": true,
        "node_exporter": true,
        "postgres_exporter": true,
        "redis_exporter": true
    }'::jsonb,
    true,
    NOW(),
    NOW()
);

-- ============================================================================
-- Terraform Templates (Cloud Infrastructure)
-- ============================================================================

-- 5. Terraform - AWS Multi-AZ
INSERT INTO deployment_templates (
    id,
    name,
    description,
    backend,
    template_version,
    configuration,
    cpu_cores,
    memory_gb,
    storage_gb,
    network_config,
    security_config,
    monitoring_config,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'terraform_aws_multi_az',
    'Terraform deployment for AWS multi-AZ setup. Includes VPC, ECS, RDS, ElastiCache, and ALB.',
    'terraform',
    '1.0.0',
    '{
        "provider": "aws",
        "region": "{{ region }}",
        "modules": {
            "vpc": {
                "source": "terraform-aws-modules/vpc/aws",
                "version": "5.0.0",
                "name": "tenant-{{ tenant_id }}-vpc",
                "cidr": "10.0.0.0/16",
                "azs": ["{{ region }}a", "{{ region }}b", "{{ region }}c"],
                "private_subnets": ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"],
                "public_subnets": ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"],
                "enable_nat_gateway": true,
                "single_nat_gateway": false,
                "enable_dns_hostnames": true,
                "enable_dns_support": true
            },
            "ecs_cluster": {
                "source": "terraform-aws-modules/ecs/aws",
                "version": "5.0.0",
                "cluster_name": "tenant-{{ tenant_id }}-cluster",
                "fargate_capacity_providers": {
                    "FARGATE": {
                        "default_capacity_provider_strategy": {
                            "weight": 50
                        }
                    },
                    "FARGATE_SPOT": {
                        "default_capacity_provider_strategy": {
                            "weight": 50
                        }
                    }
                }
            },
            "ecs_service": {
                "source": "terraform-aws-modules/ecs/aws//modules/service",
                "version": "5.0.0",
                "name": "tenant-{{ tenant_id }}-app",
                "cluster_arn": "module.ecs_cluster.arn",
                "cpu": 2048,
                "memory": 4096,
                "desired_count": 2,
                "container_definitions": {
                    "app": {
                        "image": "registry.dotmac.io/isp-tenant:latest",
                        "cpu": 2048,
                        "memory": 4096,
                        "essential": true,
                        "environment": [
                            {"name": "TENANT_ID", "value": "{{ tenant_id }}"},
                            {"name": "LICENSE_KEY", "value": "{{ license_key }}"},
                            {"name": "ENVIRONMENT", "value": "{{ environment }}"}
                        ],
                        "portMappings": [
                            {"containerPort": 8000, "protocol": "tcp"}
                        ]
                    }
                },
                "load_balancer": {
                    "service": {
                        "target_group_arn": "module.alb.target_group_arns[0]",
                        "container_name": "app",
                        "container_port": 8000
                    }
                }
            },
            "rds": {
                "source": "terraform-aws-modules/rds/aws",
                "version": "6.0.0",
                "identifier": "tenant-{{ tenant_id }}-db",
                "engine": "postgres",
                "engine_version": "15.4",
                "instance_class": "db.t3.medium",
                "allocated_storage": 50,
                "storage_encrypted": true,
                "multi_az": true,
                "db_name": "tenant_db",
                "username": "tenant_user",
                "backup_retention_period": 7,
                "backup_window": "03:00-04:00",
                "maintenance_window": "Mon:04:00-Mon:05:00"
            },
            "elasticache": {
                "source": "terraform-aws-modules/elasticache/aws",
                "version": "1.0.0",
                "cluster_id": "tenant-{{ tenant_id }}-redis",
                "engine": "redis",
                "node_type": "cache.t3.medium",
                "num_cache_nodes": 2,
                "automatic_failover_enabled": true,
                "multi_az_enabled": true
            },
            "alb": {
                "source": "terraform-aws-modules/alb/aws",
                "version": "8.0.0",
                "name": "tenant-{{ tenant_id }}-alb",
                "load_balancer_type": "application",
                "vpc_id": "module.vpc.vpc_id",
                "subnets": "module.vpc.public_subnets",
                "enable_deletion_protection": true,
                "target_groups": [
                    {
                        "name": "tenant-{{ tenant_id }}-tg",
                        "backend_protocol": "HTTP",
                        "backend_port": 8000,
                        "target_type": "ip",
                        "health_check": {
                            "enabled": true,
                            "path": "/health",
                            "interval": 30,
                            "timeout": 5,
                            "healthy_threshold": 2,
                            "unhealthy_threshold": 3
                        }
                    }
                ]
            }
        },
        "outputs": {
            "alb_dns_name": "module.alb.lb_dns_name",
            "rds_endpoint": "module.rds.db_instance_endpoint",
            "redis_endpoint": "module.elasticache.cache_nodes[0].address"
        }
    }'::jsonb,
    4.0,
    8,
    50,
    '{
        "vpc": true,
        "multi_az": true,
        "load_balancer": "alb",
        "cdn": "cloudfront",
        "dns": "route53"
    }'::jsonb,
    '{
        "security_groups": true,
        "encryption_at_rest": true,
        "encryption_in_transit": true,
        "iam_roles": true,
        "secrets_manager": true,
        "waf": true
    }'::jsonb,
    '{
        "cloudwatch": true,
        "cloudwatch_logs": true,
        "cloudwatch_alarms": true,
        "xray": true,
        "container_insights": true
    }'::jsonb,
    true,
    NOW(),
    NOW()
);

-- ============================================================================
-- Display Created Templates
-- ============================================================================

SELECT
    name,
    backend,
    template_version,
    cpu_cores || ' cores' as cpu,
    memory_gb || ' GB' as memory,
    storage_gb || ' GB' as storage,
    is_active
FROM deployment_templates
WHERE created_at >= NOW() - INTERVAL '1 minute'
ORDER BY backend, name;

-- Success message
\echo ''
\echo '✓ Deployment templates created successfully!'
\echo ''
\echo 'Templates created:'
\echo '  1. Kubernetes Starter Tier - 2 CPU, 4GB RAM, 20GB storage'
\echo '  2. Kubernetes Professional Tier - 4 CPU, 8GB RAM, 50GB storage'
\echo '  3. Docker Compose Development - 2 CPU, 4GB RAM, 20GB storage'
\echo '  4. AWX/Ansible Production - 8 CPU, 16GB RAM, 100GB storage'
\echo '  5. Terraform AWS Multi-AZ - 4 CPU, 8GB RAM, 50GB storage'
\echo ''
\echo 'Next steps:'
\echo '  1. Test template deployment: SELECT * FROM deployment_templates;'
\echo '  2. Use templates with provision_tenant() workflow method'
\echo '  3. Customize templates for your infrastructure setup'
\echo ''
