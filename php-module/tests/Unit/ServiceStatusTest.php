<?php

declare(strict_types=1);

namespace Respina\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Respina\Domain\ServiceStatus;

/**
 * Must stay in sync with backend/apps/cloud/transitions.py.
 */
final class ServiceStatusTest extends TestCase
{
    public function testTransitionsMirrorDjango(): void
    {
        self::assertTrue(ServiceStatus::Active->canTransitionTo(ServiceStatus::Suspended));
        self::assertTrue(ServiceStatus::Suspended->canTransitionTo(ServiceStatus::Active));
        self::assertFalse(ServiceStatus::Active->canTransitionTo(ServiceStatus::Active));
        self::assertFalse(ServiceStatus::Suspended->canTransitionTo(ServiceStatus::Suspended));
    }

    public function testValuesMatchDatabaseCheckConstraint(): void
    {
        self::assertSame(['active', 'suspended'], array_map(static fn (ServiceStatus $s): string => $s->value, ServiceStatus::cases()));
    }

    public function testActionLabels(): void
    {
        self::assertSame('Suspend', ServiceStatus::Suspended->actionLabel());
        self::assertSame('Activate', ServiceStatus::Active->actionLabel());
    }
}
