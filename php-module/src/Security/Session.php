<?php

declare(strict_types=1);

namespace Respina\Security;

/**
 * Hardened PHP session: HttpOnly, SameSite=Lax, Secure via env, strict mode, new id on login.
 */
final class Session
{
    private const TOKEN_KEY = 'access_token';
    private const FLASH_KEY = 'flash';

    public static function start(bool $secure): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_name('respina_php');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    /**
     * Call right after a successful login: a fresh session id defeats session fixation.
     */
    public static function login(string $accessToken): void
    {
        session_regenerate_id(true);
        $_SESSION = [self::TOKEN_KEY => $accessToken];
    }

    public static function accessToken(): ?string
    {
        $token = $_SESSION[self::TOKEN_KEY] ?? null;

        return is_string($token) ? $token : null;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        $params = session_get_cookie_params();
        setcookie(session_name() ?: 'respina_php', '', [
            'expires' => time() - 3600,
            'path' => $params['path'],
            'secure' => $params['secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_destroy();
    }

    public static function flash(string $type, string $message): void
    {
        $_SESSION[self::FLASH_KEY] = ['type' => $type, 'message' => $message];
    }

    /**
     * @return array{type: string, message: string}|null
     */
    public static function takeFlash(): ?array
    {
        $flash = $_SESSION[self::FLASH_KEY] ?? null;
        unset($_SESSION[self::FLASH_KEY]);

        return is_array($flash) ? $flash : null;
    }
}
