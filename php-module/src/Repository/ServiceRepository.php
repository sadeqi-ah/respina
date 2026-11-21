<?php

declare(strict_types=1);

namespace Respina\Repository;

use PDO;
use Respina\Auth\AuthContext;
use Respina\Domain\ServiceStatus;
use Respina\Http\HttpException;
use Throwable;

/**
 * Services, always scoped by the caller. Runs as the `php_module` role: SELECT on customers and
 * services, UPDATE (status, updated_at) on services, INSERT on service_status_logs. Nothing else.
 */
final class ServiceRepository
{
    private const COLUMNS = 's.id, s.customer_id, s.name, s.service_type, s.status, s.created_at, s.updated_at';
    private const VISIBLE = '(:is_staff OR s.customer_id = :own_customer_id)';

    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listForCustomer(int $customerId, AuthContext $auth): array
    {
        $stmt = $this->db->prepare(
            'SELECT ' . self::COLUMNS . ' FROM services s
             WHERE s.customer_id = :customer_id AND ' . self::VISIBLE . '
             ORDER BY s.created_at DESC, s.id DESC'
        );
        $stmt->bindValue(':customer_id', $customerId, PDO::PARAM_INT);
        $this->bindScope($stmt, $auth);
        $stmt->execute();

        /** @var list<array<string, mixed>> */
        return $stmt->fetchAll();
    }

    /**
     * Mirror of Django's change_service_status: lock the row, check the state machine, update,
     * write exactly one audit row, all in one transaction.
     *
     * @param int|null $customerId when set (HTML route), the service must belong to this customer
     * @return array<string, mixed> the updated service
     */
    public function changeStatus(
        int $serviceId,
        ?int $customerId,
        ServiceStatus $target,
        string $reason,
        AuthContext $auth,
    ): array {
        $this->db->beginTransaction();
        try {
            // FOR UPDATE OF s: lock only the service row (php_module may UPDATE services only).
            $stmt = $this->db->prepare(
                'SELECT s.status FROM services s
                 WHERE s.id = :id AND ' . self::VISIBLE . '
                   AND (CAST(:customer_id AS bigint) IS NULL OR s.customer_id = :customer_id_match)
                 FOR UPDATE OF s'
            );
            $stmt->bindValue(':id', $serviceId, PDO::PARAM_INT);
            $stmt->bindValue(':customer_id', $customerId, $customerId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $stmt->bindValue(':customer_id_match', $customerId, $customerId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $this->bindScope($stmt, $auth);
            $stmt->execute();
            $current = $stmt->fetchColumn();
            if ($current === false) {
                throw HttpException::notFound();
            }

            $from = ServiceStatus::tryFrom((string) $current);
            if ($from === null || !$from->canTransitionTo($target)) {
                throw new HttpException(
                    409,
                    'invalid_status_transition',
                    sprintf('Cannot change status from %s to %s.', $current, $target->value),
                );
            }

            $update = $this->db->prepare('UPDATE services SET status = :status, updated_at = now() WHERE id = :id');
            $update->bindValue(':status', $target->value);
            $update->bindValue(':id', $serviceId, PDO::PARAM_INT);
            $update->execute();

            $log = $this->db->prepare(
                "INSERT INTO service_status_logs (service_id, from_status, to_status, changed_by_id, source, reason)
                 VALUES (:service_id, :from_status, :to_status, :changed_by_id, 'php_module', :reason)"
            );
            $log->bindValue(':service_id', $serviceId, PDO::PARAM_INT);
            $log->bindValue(':from_status', $from->value);
            $log->bindValue(':to_status', $target->value);
            $log->bindValue(':changed_by_id', $auth->userId, PDO::PARAM_INT);
            $log->bindValue(':reason', $reason);
            $log->execute();

            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return $this->find($serviceId);
    }

    /**
     * @return array<string, mixed>
     */
    private function find(int $serviceId): array
    {
        $stmt = $this->db->prepare('SELECT ' . self::COLUMNS . ' FROM services s WHERE s.id = :id');
        $stmt->bindValue(':id', $serviceId, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch();
        if (!is_array($row)) {
            throw HttpException::notFound();
        }

        return $row;
    }

    private function bindScope(\PDOStatement $stmt, AuthContext $auth): void
    {
        $stmt->bindValue(':is_staff', $auth->isStaff(), PDO::PARAM_BOOL);
        $stmt->bindValue(
            ':own_customer_id',
            $auth->customerId,
            $auth->customerId === null ? PDO::PARAM_NULL : PDO::PARAM_INT,
        );
    }
}
