<?php

declare(strict_types=1);

namespace Respina;

use Respina\Security\Csrf;

/**
 * Renders templates/<name>.php inside templates/layout.php. Templates escape with e().
 */
final class View
{
    /**
     * @param array<string, mixed> $vars
     */
    public static function render(string $template, array $vars = []): string
    {
        // Every page gets the session's CSRF token, so no form (incl. sign-out) can miss it.
        if (session_status() === PHP_SESSION_ACTIVE) {
            $vars += ['csrf' => Csrf::token($_SESSION)];
        }
        $content = self::capture($template, $vars);

        return self::capture('layout', $vars + ['content' => $content]);
    }

    /**
     * @param array<string, mixed> $vars
     */
    private static function capture(string $template, array $vars): string
    {
        extract($vars, EXTR_SKIP);
        ob_start();
        require __DIR__ . '/../templates/' . $template . '.php';

        return (string) ob_get_clean();
    }
}
