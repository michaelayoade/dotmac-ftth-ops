# AWX Configuration File
# This file is mounted into the AWX containers at /etc/tower/settings.py

import os

# Database Configuration
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DATABASE_NAME', 'awx'),
        'USER': os.getenv('DATABASE_USER', 'dotmac_user'),
        'PASSWORD': os.getenv('DATABASE_PASSWORD', 'change-me-in-production'),
        'HOST': os.getenv('DATABASE_HOST', 'postgres'),
        'PORT': os.getenv('DATABASE_PORT', '5432'),
        'ATOMIC_REQUESTS': True,
        'CONN_MAX_AGE': 0,
    }
}

# Redis/Broker Configuration
BROKER_URL = 'redis://{}:{}'.format(
    os.getenv('REDIS_HOST', 'redis'),
    os.getenv('REDIS_PORT', '6379')
)

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(os.getenv('REDIS_HOST', 'redis'), int(os.getenv('REDIS_PORT', '6379')))],
        },
    },
}

# Security
SECRET_KEY = os.getenv('SECRET_KEY', 'changeme_awx_secret_key_here')
ALLOWED_HOSTS = ['*']

# Admin credentials
AWX_ADMIN_USER = os.getenv('AWX_ADMIN_USER', 'admin')
AWX_ADMIN_PASSWORD = os.getenv('AWX_ADMIN_PASSWORD', 'changeme_awx_admin')

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': '/var/log/awx/awx.log',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
}

# Job execution
AWX_PROOT_ENABLED = False
AWX_ISOLATION_SHOW_PATHS = ['/var/lib/awx/projects']

# Session Configuration
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Debug (set to False in production)
DEBUG = False
