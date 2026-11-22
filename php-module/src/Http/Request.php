<?php

declare(strict_types=1);

namespace Respina\Http;

/**
 * Immutable view of the incoming request.
 */
final class Request
{
    private const REQUEST_ID_PATTERN = '/^[A-Za-z0-9._-]{1,128}$/';

    /**
     * @param array<string, string> $headers lower-cased names
     * @param array<string, mixed>  $query
     * @param array<string, mixed>  $form
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $headers,
        public readonly array $query,
        public readonly array $form,
        public readonly string $body,
        public readonly string $requestId,
    ) {
    }

    public static function fromGlobals(): self
    {
        $headers = [];
        // getallheaders() works under Apache (where mod_php drops Authorization from $_SERVER)
        // and under the built-in server; $_SERVER covers other SAPIs.
        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $name => $value) {
                $headers[strtolower((string) $name)] = (string) $value;
            }
        }
        foreach ($_SERVER as $key => $value) {
            if (is_string($value) && str_starts_with((string) $key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr((string) $key, 5)))] ??= $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] ??= (string) $_SERVER['CONTENT_TYPE'];
        }
        $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);

        return new self(
            method: strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            path: is_string($path) && $path !== '' ? $path : '/',
            headers: $headers,
            query: $_GET,
            form: $_POST,
            body: (string) file_get_contents('php://input'),
            requestId: self::requestIdFrom($headers['x-request-id'] ?? ''),
        );
    }

    public static function requestIdFrom(string $incoming): string
    {
        return preg_match(self::REQUEST_ID_PATTERN, $incoming) === 1 ? $incoming : bin2hex(random_bytes(16));
    }

    public function header(string $name): string
    {
        return $this->headers[strtolower($name)] ?? '';
    }

    /**
     * JSON endpoints: the API and the container healthcheck. Everything else is HTML.
     */
    public function isApi(): bool
    {
        return $this->path === '/api' || str_starts_with($this->path, '/api/') || $this->path === '/healthz';
    }

    /**
     * Decoded JSON object body.
     *
     * @return array<string, mixed>
     */
    public function json(): array
    {
        if (!str_starts_with(strtolower($this->header('content-type')), 'application/json')) {
            throw new HttpException(415, 'unsupported_media_type', 'Send the body as application/json.');
        }
        $data = json_decode($this->body, true);
        if (!is_array($data) || array_is_list($data) && $data !== []) {
            throw new HttpException(400, 'parse_error', 'The body must be a JSON object.');
        }

        return $data;
    }

    public function formString(string $key): string
    {
        $value = $this->form[$key] ?? '';

        return is_string($value) ? $value : '';
    }
}
