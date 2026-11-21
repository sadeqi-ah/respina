<?php

declare(strict_types=1);

namespace Respina;

use PDO;

/**
 * PDO factory. Real server-side prepared statements (no emulation), exceptions on error.
 */
final class Database
{
    public static function connect(Config $config): PDO
    {
        return new PDO($config->dbDsn, $config->dbUser, $config->dbPassword, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_STRINGIFY_FETCHES => false,
            PDO::ATTR_TIMEOUT => 3,
        ]);
    }
}
