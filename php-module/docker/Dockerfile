# syntax=docker/dockerfile:1

# ---- base: Apache + PHP 8.3 with pdo_pgsql ---------------------------------------------------
FROM php:8.3-apache AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && apt-get purge -y --auto-remove libpq-dev \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# ---- dev: tooling image for composer / phpunit / phpstan (source is bind-mounted) ------------
FROM base AS dev
RUN apt-get update && apt-get install -y --no-install-recommends unzip git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
