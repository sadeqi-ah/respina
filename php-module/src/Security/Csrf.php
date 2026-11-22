<?php

declare(strict_types=1);

namespace Respina\Security;

use Respina\Http\HttpException;

/**
 * Synchronizer-token CSRF protection: one random token per session, compared in constant time.
 */
final class Csrf
{
    public const FIELD = '_csrf';
    private const KEY = 'csrf_token';

    /**
     * @param array<string, mixed> $session
     */
    public static function token(array &$session): string
    {
        if (!is_string($session[self::KEY] ?? null)) {
            $session[self::KEY] = bin2hex(random_bytes(32));
        }

        return $session[self::KEY];
    }

    /**
     * @param array<string, mixed> $session
     */
    public static function check(array $session, string $submitted): void
    {
        $expected = $session[self::KEY] ?? null;
        if (!is_string($expected) || $submitted === '' || !hash_equals($expected, $submitted)) {
            throw new HttpException(403, 'csrf_failed', 'Your form expired. Reload the page and try again.');
        }
    }
}
