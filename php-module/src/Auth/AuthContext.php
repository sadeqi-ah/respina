<?php

declare(strict_types=1);

namespace Respina\Auth;

/**
 * Who is calling, from verified JWT claims. Repositories scope every query with this.
 */
final class AuthContext
{
    public const ROLE_STAFF = 'staff';
    public const ROLE_CUSTOMER = 'customer';

    public function __construct(
        public readonly int $userId,
        public readonly string $role,
        public readonly ?int $customerId,
    ) {
    }

    public function isStaff(): bool
    {
        return $this->role === self::ROLE_STAFF;
    }
}
