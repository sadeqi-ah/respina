<?php

declare(strict_types=1);

namespace Respina\Tests\Unit;

use Firebase\JWT\JWT;
use PHPUnit\Framework\TestCase;
use Respina\Auth\AuthContext;
use Respina\Auth\JwtVerifier;

final class JwtVerifierTest extends TestCase
{
    private static string $privateKey;
    private static string $publicKey;

    public static function setUpBeforeClass(): void
    {
        [self::$privateKey, self::$publicKey] = self::keyPair();
    }

    /**
     * @return array{string, string}
     */
    private static function keyPair(): array
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        self::assertNotFalse($key);
        openssl_pkey_export($key, $private);
        $details = openssl_pkey_get_details($key);
        self::assertIsArray($details);

        return [(string) $private, (string) $details['key']];
    }

    /**
     * Claims as Django/simplejwt issues them.
     *
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private static function claims(array $overrides = []): array
    {
        return $overrides + [
            'token_type' => 'access',
            'exp' => time() + 300,
            'iat' => time(),
            'jti' => 'abc',
            'user_id' => 7,
            'role' => 'customer',
            'customer_id' => 12,
        ];
    }

    private function verifier(): JwtVerifier
    {
        return new JwtVerifier(self::$publicKey);
    }

    public function testValidAccessTokenGivesContext(): void
    {
        $auth = $this->verifier()->verify(JWT::encode(self::claims(), self::$privateKey, 'RS256'));

        self::assertEquals(new AuthContext(7, 'customer', 12), $auth);
    }

    public function testStaffTokenWithNullCustomerId(): void
    {
        $token = JWT::encode(self::claims(['role' => 'staff', 'customer_id' => null]), self::$privateKey, 'RS256');
        $auth = $this->verifier()->verify($token);

        self::assertNotNull($auth);
        self::assertTrue($auth->isStaff());
        self::assertNull($auth->customerId);
    }

    public function testSimplejwtStringUserIdIsAccepted(): void
    {
        // simplejwt ≥5.4 can emit user_id as a string.
        $auth = $this->verifier()->verify(JWT::encode(self::claims(['user_id' => '7']), self::$privateKey, 'RS256'));
        self::assertSame(7, $auth?->userId);
    }

    public function testExpiredTokenIsRejected(): void
    {
        $token = JWT::encode(self::claims(['exp' => time() - 10]), self::$privateKey, 'RS256');
        self::assertNull($this->verifier()->verify($token));
    }

    public function testRefreshTokenIsRejected(): void
    {
        $token = JWT::encode(self::claims(['token_type' => 'refresh']), self::$privateKey, 'RS256');
        self::assertNull($this->verifier()->verify($token));
    }

    public function testTokenFromAnotherKeyIsRejected(): void
    {
        [$otherPrivate] = self::keyPair();
        self::assertNull($this->verifier()->verify(JWT::encode(self::claims(), $otherPrivate, 'RS256')));
    }

    public function testHs256KeyConfusionIsRejected(): void
    {
        // Classic attack: sign with HS256 using the *public* key as the HMAC secret.
        $token = JWT::encode(self::claims(['role' => 'staff']), self::$publicKey, 'HS256');
        self::assertNull($this->verifier()->verify($token));
    }

    public function testAlgNoneIsRejected(): void
    {
        $b64 = static fn (string $s): string => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
        $token = $b64('{"alg":"none","typ":"JWT"}') . '.' . $b64((string) json_encode(self::claims(['role' => 'staff']))) . '.';
        self::assertNull($this->verifier()->verify($token));
    }

    public function testTamperedPayloadIsRejected(): void
    {
        [$header, , $signature] = explode('.', JWT::encode(self::claims(), self::$privateKey, 'RS256'));
        $forged = rtrim(strtr(base64_encode((string) json_encode(self::claims(['role' => 'staff']))), '+/', '-_'), '=');
        self::assertNull($this->verifier()->verify("{$header}.{$forged}.{$signature}"));
    }

    /**
     * @return iterable<string, array{array<string, mixed>}>
     */
    public static function badClaims(): iterable
    {
        yield 'unknown role' => [['role' => 'admin']];
        yield 'missing role' => [['role' => null]];
        yield 'missing user' => [['user_id' => null]];
        yield 'negative customer' => [['customer_id' => -1]];
        yield 'customer id as text' => [['customer_id' => '12 OR 1=1']];
    }

    /**
     * @param array<string, mixed> $override
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('badClaims')]
    public function testMalformedClaimsAreRejected(array $override): void
    {
        $claims = array_filter(self::claims($override), static fn ($v): bool => $v !== null);
        self::assertNull($this->verifier()->verify(JWT::encode($claims, self::$privateKey, 'RS256')));
    }

    public function testGarbageIsRejected(): void
    {
        self::assertNull($this->verifier()->verify('not.a.jwt'));
        self::assertNull($this->verifier()->verify(''));
    }
}
