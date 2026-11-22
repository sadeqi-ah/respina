<?php

declare(strict_types=1);

namespace Respina\Auth;

use RuntimeException;

/**
 * Logs a user in through Django's token endpoint (server-side; the password never touches the
 * database here). Django stays the only place that checks passwords and issues tokens.
 */
final class DjangoAuthClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly float $timeoutSeconds = 5.0,
    ) {
    }

    /**
     * Returns the access token, null for wrong credentials, or throws if Django is unavailable.
     */
    public function login(string $email, string $password, string $requestId): ?string
    {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nAccept: application/json\r\nX-Request-ID: {$requestId}\r\n",
            'content' => json_encode(['email' => $email, 'password' => $password], JSON_THROW_ON_ERROR),
            'timeout' => $this->timeoutSeconds,
            'ignore_errors' => true, // read 4xx bodies instead of failing
            'follow_location' => 0,
        ]]);

        $body = @file_get_contents($this->baseUrl . '/api/v1/auth/token/', false, $context);
        // PHP 8.3 fills this magic variable after file_get_contents(); it stays unset when the
        // connection fails, which PHPStan can't know.
        /** @phpstan-ignore nullCoalesce.variable */
        $status = self::statusFrom($http_response_header ?? []);

        if ($body === false || $status === 0) {
            throw new RuntimeException('Django auth endpoint unreachable');
        }
        if ($status === 401 || $status === 400) {
            return null;
        }
        if ($status === 429) {
            throw new RuntimeException('Too many login attempts', 429);
        }
        $data = json_decode($body, true);
        if ($status !== 200 || !is_array($data) || !is_string($data['access'] ?? null)) {
            throw new RuntimeException("Unexpected response from Django auth endpoint (HTTP {$status})");
        }

        return $data['access'];
    }

    /**
     * @param list<string> $headers
     */
    private static function statusFrom(array $headers): int
    {
        $first = $headers[0] ?? '';

        return preg_match('#^HTTP/\S+\s+(\d{3})#', $first, $m) === 1 ? (int) $m[1] : 0;
    }
}
