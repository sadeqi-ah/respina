<?php

declare(strict_types=1);

namespace Respina\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Respina\Http\HttpException;
use Respina\Http\Request;

final class RequestTest extends TestCase
{
    private function post(string $body, string $contentType = 'application/json'): Request
    {
        return new Request('POST', '/api/services/1/status', ['content-type' => $contentType], [], [], $body, 'id');
    }

    public function testJsonObjectIsDecoded(): void
    {
        self::assertSame(['status' => 'active'], $this->post('{"status":"active"}')->json());
        self::assertSame(['status' => 'active'], $this->post('{"status":"active"}', 'application/json; charset=utf-8')->json());
    }

    public function testWrongContentTypeIs415(): void
    {
        $this->expectExceptionObject(new HttpException(415, 'unsupported_media_type', 'Send the body as application/json.'));
        $this->post('status=active', 'application/x-www-form-urlencoded')->json();
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function badBodies(): iterable
    {
        yield 'invalid json' => ['{status:'];
        yield 'list' => ['["active"]'];
        yield 'scalar' => ['"active"'];
        yield 'empty' => [''];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('badBodies')]
    public function testNonObjectBodyIs400(string $body): void
    {
        try {
            $this->post($body)->json();
            self::fail('accepted');
        } catch (HttpException $e) {
            self::assertSame(400, $e->status);
        }
    }

    public function testJsonEndpoints(): void
    {
        foreach (['/api/customers/1' => true, '/healthz' => true, '/api' => true, '/apis' => false, '/customers/1' => false] as $path => $api) {
            self::assertSame($api, (new Request('GET', $path, [], [], [], '', 'id'))->isApi(), $path);
        }
    }
}
