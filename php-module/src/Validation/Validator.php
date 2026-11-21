<?php

declare(strict_types=1);

namespace Respina\Validation;

use Respina\Domain\ServiceStatus;
use Respina\Http\HttpException;

/**
 * Boundary validation. Error details use the shared format: field → [{code, message}].
 */
final class Validator
{
    /** Positive id that fits in a signed 64-bit integer column (plan: ^[1-9][0-9]{0,17}$). */
    private const ID_PATTERN = '/^[1-9][0-9]{0,17}$/D';
    public const REASON_MAX = 500;

    /**
     * Path ids that don't validate are treated as "no such resource" (404), like Django's int
     * converter, so `1 OR 1=1` never reaches SQL.
     */
    public static function pathId(string $raw): int
    {
        if (preg_match(self::ID_PATTERN, $raw) !== 1) {
            throw HttpException::notFound();
        }

        return (int) $raw;
    }

    /**
     * @param array<string, mixed> $input
     * @return array{status: ServiceStatus, reason: string}
     */
    public static function statusChange(array $input): array
    {
        $errors = [];

        $rawStatus = $input['status'] ?? null;
        $status = null;
        if ($rawStatus === null || $rawStatus === '') {
            $errors['status'][] = ['code' => 'required', 'message' => 'This field is required.'];
        } elseif (!is_string($rawStatus) || ($status = ServiceStatus::tryFrom($rawStatus)) === null) {
            $errors['status'][] = [
                'code' => 'invalid_choice',
                'message' => sprintf('"%s" is not a valid choice.', is_scalar($rawStatus) ? $rawStatus : gettype($rawStatus)),
            ];
        }

        $reason = $input['reason'] ?? '';
        if (!is_string($reason)) {
            $errors['reason'][] = ['code' => 'invalid', 'message' => 'Not a valid string.'];
            $reason = '';
        } elseif (mb_strlen($reason) > self::REASON_MAX) {
            $errors['reason'][] = [
                'code' => 'max_length',
                'message' => sprintf('Ensure this field has no more than %d characters.', self::REASON_MAX),
            ];
        }

        if ($errors !== []) {
            throw HttpException::validation($errors);
        }

        return ['status' => $status, 'reason' => trim($reason)];
    }
}
