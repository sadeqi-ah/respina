<?php

declare(strict_types=1);

/**
 * Escape for HTML text and attribute context. Every template output goes through this.
 */
function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
