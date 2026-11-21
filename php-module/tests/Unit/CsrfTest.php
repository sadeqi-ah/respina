<?php

declare(strict_types=1);

namespace Respina\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Respina\Http\HttpException;
use Respina\Security\Csrf;

final class CsrfTest extends TestCase
{
    public function testTokenIsStablePerSessionAndRandom(): void
    {
        $session = [];
        $token = Csrf::token($session);
        self::assertSame($token, Csrf::token($session));
        self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $token);

        $other = [];
        self::assertNotSame($token, Csrf::token($other));
    }

    public function testMatchingTokenPasses(): void
    {
        $session = [];
        Csrf::check($session + ['csrf_token' => Csrf::token($session)], Csrf::token($session));
        $this->addToAssertionCount(1);
    }

    /**
     * @return iterable<string, array{array<string, mixed>, string}>
     */
    public static function failures(): iterable
    {
        yield 'no session token' => [[], 'abc'];
        yield 'empty submission' => [['csrf_token' => 'abc'], ''];
        yield 'wrong token' => [['csrf_token' => str_repeat('a', 64)], str_repeat('b', 64)];
        yield 'prefix only' => [['csrf_token' => str_repeat('a', 64)], 'aaaa'];
    }

    /**
     * @param array<string, mixed> $session
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('failures')]
    public function testMismatchIs403(array $session, string $submitted): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Your form expired');
        Csrf::check($session, $submitted);
    }
}
