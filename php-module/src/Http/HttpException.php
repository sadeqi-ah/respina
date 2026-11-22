<?php

declare(strict_types=1);

namespace Respina\Http;

use RuntimeException;

/**
 * An error with a status and a stable code (plan §3.4). Rendered as the JSON envelope on /api
 * routes and as the HTML error page elsewhere.
 */
final class HttpException extends RuntimeException
{
    private const BEARER = ['WWW-Authenticate' => 'Bearer realm="api"'];

    /**
     * @param array<string, list<array{code: string, message: string}>> $details
     * @param array<string, string> $headers
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
        public readonly array $headers = [],
    ) {
        parent::__construct($message);
    }

    public static function notFound(): self
    {
        return new self(404, 'not_found', 'Not found.');
    }

    public static function forbidden(): self
    {
        return new self(403, 'permission_denied', 'You do not have permission to perform this action.');
    }

    public static function notAuthenticated(): self
    {
        return new self(401, 'not_authenticated', 'Authentication credentials were not provided.', [], self::BEARER);
    }

    public static function tokenInvalid(): self
    {
        return new self(401, 'token_invalid', 'The token is invalid or expired.', [], self::BEARER);
    }

    public static function serviceBusy(): self
    {
        return new self(409, 'service_busy', 'The service is being changed by another request. Try again.');
    }

    /**
     * @param array<string, list<array{code: string, message: string}>> $details
     */
    public static function validation(array $details): self
    {
        return new self(400, 'validation_error', 'Invalid input.', $details);
    }
}
