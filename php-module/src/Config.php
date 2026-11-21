<?php

declare(strict_types=1);

namespace Respina;

use RuntimeException;

/**
 * Configuration from environment variables only (no secrets in the repository).
 */
final class Config
{
    public function __construct(
        public readonly string $dbDsn,
        public readonly string $dbUser,
        public readonly string $dbPassword,
        public readonly string $jwtPublicKeyPath,
        public readonly string $djangoApiUrl,
        public readonly bool $cookieSecure,
    ) {
    }

    /**
     * @param array<string, string> $env
     */
    public static function fromEnv(array $env): self
    {
        $required = ['PHP_DB_DSN', 'PHP_DB_USER', 'PHP_DB_PASSWORD', 'JWT_PUBLIC_KEY_PATH_PHP', 'DJANGO_API_URL_PHP'];
        $missing = array_filter($required, static fn (string $k): bool => ($env[$k] ?? '') === '');
        if ($missing !== []) {
            throw new RuntimeException('Missing environment variables: ' . implode(', ', $missing));
        }

        return new self(
            dbDsn: $env['PHP_DB_DSN'],
            dbUser: $env['PHP_DB_USER'],
            dbPassword: $env['PHP_DB_PASSWORD'],
            jwtPublicKeyPath: $env['JWT_PUBLIC_KEY_PATH_PHP'],
            djangoApiUrl: rtrim($env['DJANGO_API_URL_PHP'], '/'),
            cookieSecure: filter_var($env['COOKIE_SECURE'] ?? 'false', FILTER_VALIDATE_BOOL),
        );
    }
}
