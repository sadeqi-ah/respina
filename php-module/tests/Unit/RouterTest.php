<?php

declare(strict_types=1);

namespace Respina\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Respina\Http\HttpException;
use Respina\Http\Request;
use Respina\Http\Response;
use Respina\Http\Router;

final class RouterTest extends TestCase
{
    private function request(string $method, string $path): Request
    {
        return new Request($method, $path, [], [], [], '', 'test-id');
    }

    private function router(): Router
    {
        $router = new Router();
        $router->add('GET', '/customers/{id}', static fn (Request $r, array $p): Response => Response::json(200, $p));
        $router->add('POST', '/customers/{id}/services/{serviceId}/status', static fn (Request $r, array $p): Response => Response::json(200, $p));

        return $router;
    }

    public function testMatchesAndPassesNamedParams(): void
    {
        $response = $this->router()->dispatch($this->request('POST', '/customers/12/services/125/status'));
        self::assertSame('{"id":"12","serviceId":"125"}', $response->body);
    }

    public function testUnknownPathIs404(): void
    {
        try {
            $this->router()->dispatch($this->request('GET', '/customers/12/extra'));
            self::fail('matched');
        } catch (HttpException $e) {
            self::assertSame(404, $e->status);
        }
    }

    public function testWrongMethodIs405WithAllow(): void
    {
        try {
            $this->router()->dispatch($this->request('DELETE', '/customers/12'));
            self::fail('matched');
        } catch (HttpException $e) {
            self::assertSame(405, $e->status);
            self::assertSame('method_not_allowed', $e->errorCode);
            self::assertSame(['Allow' => 'GET'], $e->headers);
        }
    }

    public function testParamsNeverSpanSlashes(): void
    {
        $this->expectException(HttpException::class);
        $this->router()->dispatch($this->request('GET', '/customers/1/../2'));
    }

    public function testRequestIdValidation(): void
    {
        self::assertSame('abc-1.2_3', Request::requestIdFrom('abc-1.2_3'));
        self::assertMatchesRegularExpression('/^[0-9a-f]{32}$/', Request::requestIdFrom("bad\nid"));
    }
}
