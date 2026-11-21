<?php

declare(strict_types=1);

namespace Respina\Domain;

/**
 * Mirror of Django's ServiceType choices (labels match `service_type_display`).
 */
enum ServiceType: string
{
    case CloudServer = 'cloud_server';
    case Vps = 'vps';
    case DedicatedServer = 'dedicated_server';
    case ObjectStorage = 'object_storage';
    case ManagedDatabase = 'managed_database';

    public static function labelFor(string $value): string
    {
        return match (self::tryFrom($value)) {
            self::CloudServer => 'Cloud Server',
            self::Vps => 'VPS',
            self::DedicatedServer => 'Dedicated Server',
            self::ObjectStorage => 'Object Storage',
            self::ManagedDatabase => 'Managed Database',
            null => $value,
        };
    }
}
