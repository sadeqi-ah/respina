<?php

declare(strict_types=1);

namespace Respina\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Respina\Domain\ServiceStatus;
use Respina\Http\HttpException;
use Respina\Validation\Validator;

final class ValidatorTest extends TestCase
{
    public function testPathIdAcceptsPositiveIntegers(): void
    {
        self::assertSame(125, Validator::pathId('125'));
        self::assertSame(999999999999999999, Validator::pathId('999999999999999999'));
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function badIds(): iterable
    {
        yield 'sql injection' => ['1 OR 1=1'];
        yield 'quote injection' => ["1'; DROP TABLE services; --"];
        yield 'empty' => [''];
        yield 'zero' => ['0'];
        yield 'negative' => ['-1'];
        yield 'leading zero' => ['0125'];
        yield 'float' => ['1.5'];
        yield 'exponent' => ['1e3'];
        yield 'space' => [' 125'];
        yield 'trailing newline' => ["125\n"];
        yield 'too long' => ['1234567890123456789'];
    }

    #[DataProvider('badIds')]
    public function testPathIdRejectsEverythingElseAsNotFound(string $raw): void
    {
        try {
            Validator::pathId($raw);
            self::fail("accepted {$raw}");
        } catch (HttpException $e) {
            self::assertSame(404, $e->status);
            self::assertSame('not_found', $e->errorCode);
        }
    }

    public function testStatusChangeAcceptsValidInput(): void
    {
        $out = Validator::statusChange(['status' => 'suspended', 'reason' => '  unpaid  ']);
        self::assertSame(ServiceStatus::Suspended, $out['status']);
        self::assertSame('unpaid', $out['reason']);
        self::assertSame('', Validator::statusChange(['status' => 'active'])['reason']);
    }

    /**
     * @return iterable<string, array{array<string, mixed>, string, string}>
     */
    public static function badStatusChanges(): iterable
    {
        yield 'missing status' => [[], 'status', 'required'];
        yield 'empty status' => [['status' => ''], 'status', 'required'];
        yield 'unknown status' => [['status' => 'deleted'], 'status', 'invalid_choice'];
        yield 'status not a string' => [['status' => ['active']], 'status', 'invalid_choice'];
        yield 'uppercase status' => [['status' => 'ACTIVE'], 'status', 'invalid_choice'];
        yield 'reason too long' => [['status' => 'active', 'reason' => str_repeat('x', 501)], 'reason', 'max_length'];
        yield 'reason not a string' => [['status' => 'active', 'reason' => 5], 'reason', 'invalid'];
    }

    /**
     * @param array<string, mixed> $input
     */
    #[DataProvider('badStatusChanges')]
    public function testStatusChangeErrors(array $input, string $field, string $code): void
    {
        try {
            Validator::statusChange($input);
            self::fail('accepted invalid input');
        } catch (HttpException $e) {
            self::assertSame(400, $e->status);
            self::assertSame('validation_error', $e->errorCode);
            self::assertSame($code, $e->details[$field][0]['code']);
        }
    }

    public function testReasonLengthCountsCharactersNotBytes(): void
    {
        $persian = str_repeat('ب', 500); // 1000 bytes in UTF-8
        self::assertSame($persian, Validator::statusChange(['status' => 'active', 'reason' => $persian])['reason']);
    }
}
