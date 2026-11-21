<?php

declare(strict_types=1);

namespace Respina;

use DateTimeImmutable;
use DateTimeZone;
use Respina\Domain\ServiceType;

/**
 * Turns DB rows into the same JSON shapes as the Django API (plan §3.4).
 */
final class Presenter
{
    /**
     * @param array<string, mixed> $c
     * @return array<string, mixed>
     */
    public static function customer(array $c, int $servicesCount): array
    {
        return [
            'id' => (int) $c['id'],
            'first_name' => $c['first_name'],
            'last_name' => $c['last_name'],
            'full_name' => $c['first_name'] . ' ' . $c['last_name'],
            'email' => $c['email'],
            'phone' => $c['phone'],
            'services_count' => $servicesCount,
            'created_at' => self::timestamp((string) $c['created_at']),
        ];
    }

    /**
     * @param array<string, mixed> $s
     * @return array<string, mixed>
     */
    public static function service(array $s): array
    {
        return [
            'id' => (int) $s['id'],
            'customer_id' => (int) $s['customer_id'],
            'name' => $s['name'],
            'service_type' => $s['service_type'],
            'service_type_display' => ServiceType::labelFor((string) $s['service_type']),
            'status' => $s['status'],
            'created_at' => self::timestamp((string) $s['created_at']),
            'updated_at' => self::timestamp((string) $s['updated_at']),
        ];
    }

    /**
     * ISO-8601 UTC with a Z suffix, like DRF.
     */
    public static function timestamp(string $pg): string
    {
        return (new DateTimeImmutable($pg))
            ->setTimezone(new DateTimeZone('UTC'))
            ->format('Y-m-d\TH:i:s.u\Z');
    }
}
