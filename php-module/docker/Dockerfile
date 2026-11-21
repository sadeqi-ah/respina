# syntax=docker/dockerfile:1

# ---- base: Apache + PHP 8.3 with pdo_pgsql ---------------------------------------------------
FROM php:8.3-apache AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql opcache \
    && apt-get purge -y --auto-remove libpq-dev \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

# ---- dev: tooling image for composer / phpunit / phpstan (source is bind-mounted) ------------
FROM base AS dev
RUN apt-get update && apt-get install -y --no-install-recommends unzip git \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app

# ---- vendor: production dependencies only (composer never reaches the prod image) -----------
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader
COPY src/ src/
RUN composer dump-autoload --no-dev --classmap-authoritative

# ---- prod: Apache serving public/ ------------------------------------------------------------
FROM base AS prod
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && a2enmod headers \
    && a2dissite 000-default
COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-app.ini"
COPY docker/vhost.conf /etc/apache2/sites-available/app.conf
RUN a2ensite app

WORKDIR /var/www/app
COPY --from=vendor /app/vendor vendor/
COPY src/ src/
COPY public/ public/
COPY templates/ templates/

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["php", "-r", "exit(@file_get_contents('http://127.0.0.1/healthz') === false ? 1 : 0);"]
