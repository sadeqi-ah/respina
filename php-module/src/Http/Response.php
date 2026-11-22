<?php

declare(strict_types=1);

namespace Respina\Http;

final class Response
{
    /**
     * @param array<string, string> $headers
     */
    public function __construct(
        public readonly int $status,
        public readonly string $body,
        public readonly array $headers = [],
    ) {
    }

    /**
     * @param array<string, string> $headers
     */
    public static function json(int $status, mixed $data, array $headers = []): self
    {
        return new self(
            $status,
            json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store'] + $headers,
        );
    }

    public static function html(int $status, string $html): self
    {
        return new self($status, $html, ['Content-Type' => 'text/html; charset=utf-8', 'Cache-Control' => 'no-store']);
    }

    /**
     * 303 so a POST is always followed by a GET (Post/Redirect/Get).
     */
    public static function redirect(string $location): self
    {
        return new self(303, '', ['Location' => $location]);
    }

    /**
     * Error envelope (plan §3.4).
     */
    public static function error(HttpException $e, string $requestId): self
    {
        $error = ['code' => $e->errorCode, 'message' => $e->getMessage()];
        if ($e->details !== []) {
            $error['details'] = $e->details;
        }
        $error['request_id'] = $requestId;

        return self::json($e->status, ['error' => $error], $e->headers);
    }

    public function send(string $requestId): void
    {
        http_response_code($this->status);
        $security = [
            'X-Request-ID' => $requestId,
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'same-origin',
            'Content-Security-Policy' => "default-src 'none'; style-src 'self'; img-src 'self'; "
                . "form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        ];
        foreach ($this->headers + $security as $name => $value) {
            header($name . ': ' . $value);
        }
        echo $this->body;
    }
}
