<?php

declare(strict_types=1);

namespace Respina\Http;

/**
 * Builds the one "request" log line written per request: the same JSON keys as Django's
 * JSONFormatter (time, level, logger, message, request_id, method, path, status, duration_ms), so
 * one X-Request-ID can be followed from the BFF to Django or PHP. Only the method and path are
 * taken from the request: never the query string, headers, cookies or body.
 */
final class RequestLog
{
    public const LOGGER = 'php.request';

    /**
     * @param int $startNs hrtime(true) taken when the request started
     * @param int $endNs   hrtime(true) taken when the response is ready
     */
    public static function line(Request $request, int $status, int $startNs, int $endNs, ?\DateTimeImmutable $now = null): string
    {
        $now ??= new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        return json_encode([
            'time' => $now->format('Y-m-d\TH:i:s.uP'),
            'level' => 'INFO',
            'logger' => self::LOGGER,
            'message' => 'request',
            'request_id' => $request->requestId,
            'method' => $request->method,
            'path' => $request->path,
            'status' => $status,
            'duration_ms' => intdiv(max(0, $endNs - $startNs), 1_000_000),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    /**
     * Straight to the process's stderr (what Docker collects). Not error_log(): under Apache it adds
     * its own prefix, which would break one-JSON-object-per-line.
     */
    public static function write(string $line): void
    {
        file_put_contents('php://stderr', $line . "\n");
    }
}
