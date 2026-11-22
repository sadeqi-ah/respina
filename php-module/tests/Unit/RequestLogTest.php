<?php

declare(strict_types=1);

namespace Respina\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Respina\Http\Request;
use Respina\Http\RequestLog;

final class RequestLogTest extends TestCase
{
    private function request(): Request
    {
        return new Request(
            'POST',
            '/api/services/7/status',
            [
                'authorization' => 'Bearer jwt-secret-token',
                'cookie' => 'PHPSESSID=session-secret',
                'content-type' => 'application/json',
            ],
            ['q' => 'query-secret'],
            ['password' => 'form-secret'],
            '{"status":"suspended","password":"body-secret"}',
            'caller-id-123',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(string $line): array
    {
        self::assertStringNotContainsString("\n", $line);
        $data = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($data);

        return $data;
    }

    public function testHasExactlyTheDjangoFields(): void
    {
        $now = new \DateTimeImmutable('2026-11-23T10:00:00.123456+00:00');
        $data = $this->decode(RequestLog::line($this->request(), 409, 1_000_000_000, 1_042_900_000, $now));

        self::assertSame([
            'time' => '2026-11-23T10:00:00.123456+00:00',
            'level' => 'INFO',
            'logger' => 'php.request',
            'message' => 'request',
            'request_id' => 'caller-id-123',
            'method' => 'POST',
            'path' => '/api/services/7/status',
            'status' => 409,
            'duration_ms' => 42,
        ], $data);
    }

    public function testDurationIsNeverNegative(): void
    {
        $data = $this->decode(RequestLog::line($this->request(), 200, 5_000_000, 1_000_000));
        self::assertSame(0, $data['duration_ms']);

        $start = hrtime(true);
        $data = $this->decode(RequestLog::line($this->request(), 200, $start, hrtime(true)));
        self::assertIsInt($data['duration_ms']);
        self::assertGreaterThanOrEqual(0, $data['duration_ms']);
    }

    public function testNoSensitiveDataIsLogged(): void
    {
        $line = RequestLog::line($this->request(), 200, 0, 0);

        foreach (['jwt-secret-token', 'Bearer', 'session-secret', 'query-secret', 'form-secret', 'body-secret', 'authorization', 'cookie'] as $secret) {
            self::assertStringNotContainsStringIgnoringCase($secret, $line);
        }
    }
}
