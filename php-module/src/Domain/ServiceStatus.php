<?php

declare(strict_types=1);

namespace Respina\Domain;

/**
 * Mirror of the Django state machine (backend/apps/cloud/transitions.py, the source of truth).
 *
 *   active ──suspend──▶ suspended
 *   suspended ──activate──▶ active
 *
 * Adding a status: see the recipe in docs/CONTRIBUTING.md (Django enum + map, CHECK migration,
 * and this enum).
 */
enum ServiceStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';

    /**
     * @return list<self>
     */
    public function allowedTargets(): array
    {
        return match ($this) {
            self::Active => [self::Suspended],
            self::Suspended => [self::Active],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTargets(), true);
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /**
     * The action that moves a service into this status, for buttons ("Suspend" / "Activate").
     */
    public function actionLabel(): string
    {
        return match ($this) {
            self::Active => 'Activate',
            self::Suspended => 'Suspend',
        };
    }
}
