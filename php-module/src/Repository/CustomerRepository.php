<?php

declare(strict_types=1);

namespace Respina\Repository;

use PDO;
use Respina\Auth\AuthContext;

final class CustomerRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * The customer with this id, if `$auth` may see it (plan §3.3); otherwise null → 404.
     *
     * Staff see every customer. A customer sees only the record whose id equals their JWT
     * `customer_id`. Scoping happens in SQL, so a hidden customer and a missing one look the same.
     *
     * @return array{id: int, first_name: string, last_name: string, email: string, phone: string, created_at: string}|null
     */
    public function findVisible(int $id, AuthContext $auth): ?array
    {
        // Scope in SQL: a hidden customer and a missing one both yield no row. A customer login
        // with no customer record binds NULL, and `c.id = NULL` is never true.
        $stmt = $this->db->prepare(
            'SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at
             FROM customers c
             WHERE c.id = :id AND (:is_staff OR c.id = :own_customer_id)'
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':is_staff', $auth->isStaff(), PDO::PARAM_BOOL);
        $stmt->bindValue(
            ':own_customer_id',
            $auth->customerId,
            $auth->customerId === null ? PDO::PARAM_NULL : PDO::PARAM_INT,
        );
        $stmt->execute();

        $row = $stmt->fetch();

        /** @var array{id: int, first_name: string, last_name: string, email: string, phone: string, created_at: string}|null */
        return $row === false ? null : $row;
    }
}
