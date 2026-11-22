<?php

declare(strict_types=1);

namespace Respina\Auth;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Throwable;

/**
 * Verifies Django-issued access tokens with the public key only (this module can't mint tokens).
 * The algorithm is pinned to RS256, which blocks `alg=none` and HS256 key-confusion attacks.
 */
final class JwtVerifier
{
    private readonly Key $key;

    public function __construct(string $publicKeyPem)
    {
        $this->key = new Key($publicKeyPem, 'RS256');
    }

    public static function fromFile(string $path): self
    {
        $pem = @file_get_contents($path);
        if ($pem === false || $pem === '') {
            throw new \RuntimeException("JWT public key not readable at {$path}");
        }

        return new self($pem);
    }

    /**
     * Returns the caller, or null for any invalid, expired, non-access or malformed token.
     */
    public function verify(string $token): ?AuthContext
    {
        try {
            $claims = (array) JWT::decode($token, $this->key); // checks signature, alg, exp, nbf
        } catch (Throwable) {
            return null;
        }

        // simplejwt signs refresh tokens with the same key; only access tokens authenticate.
        if (($claims['token_type'] ?? null) !== 'access') {
            return null;
        }
        $userId = $claims['user_id'] ?? null;
        $role = $claims['role'] ?? null;
        $customerId = $claims['customer_id'] ?? null;
        $userId = is_string($userId) && ctype_digit($userId) ? (int) $userId : $userId;

        if (!is_int($userId) || $userId <= 0) {
            return null;
        }
        if (!in_array($role, [AuthContext::ROLE_STAFF, AuthContext::ROLE_CUSTOMER], true)) {
            return null;
        }
        if ($customerId !== null && (!is_int($customerId) || $customerId <= 0)) {
            return null;
        }

        return new AuthContext($userId, $role, $customerId);
    }
}
