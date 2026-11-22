<?php

declare(strict_types=1);

namespace Respina\Tests\Integration;

use PDO;
use PDOException;
use PHPUnit\Framework\TestCase;
use Respina\Auth\AuthContext;
use Respina\Config;
use Respina\Database;
use Respina\Domain\ServiceStatus;
use Respina\Http\HttpException;
use Respina\Repository\CustomerRepository;
use Respina\Repository\ServiceRepository;

/**
 * Runs against the real schema as the least-privilege `php_module` role. Fixture rows are
 * created and removed through a separate owner connection.
 *
 * Env: PHP_TEST_DB_DSN, PHP_TEST_DB_USER/PASSWORD (php_module), PHP_TEST_OWNER_USER/PASSWORD.
 */
final class RepositoryTest extends TestCase
{
    private PDO $owner;
    private PDO $module;
    private int $staffUserId;
    private int $customerA;
    private int $customerB;
    /** @var list<int> */
    private array $servicesA = [];
    private int $serviceB;

    protected function setUp(): void
    {
        $dsn = getenv('PHP_TEST_DB_DSN');
        if (!is_string($dsn) || $dsn === '') {
            self::markTestSkipped('PHP_TEST_DB_DSN not set');
        }
        $this->owner = Database::connect(new Config($dsn, (string) getenv('PHP_TEST_OWNER_USER'), (string) getenv('PHP_TEST_OWNER_PASSWORD'), '', '', false));
        $this->module = Database::connect(new Config($dsn, (string) getenv('PHP_TEST_DB_USER'), (string) getenv('PHP_TEST_DB_PASSWORD'), '', '', false));

        $tag = bin2hex(random_bytes(4));
        $this->staffUserId = $this->insert(
            "INSERT INTO accounts_user (password, is_superuser, email, role, is_active, is_staff, date_joined)
             VALUES ('!', false, :email, 'staff', true, false, now()) RETURNING id",
            ['email' => "php-test-staff-{$tag}@example.com"],
        );
        $this->customerA = $this->customer("a-{$tag}", '+98912' . random_int(1000000, 4999999));
        $this->customerB = $this->customer("b-{$tag}", '+98912' . random_int(5000000, 9999999));
        $this->servicesA = [$this->service($this->customerA, 'web-1'), $this->service($this->customerA, 'db-1')];
        $this->serviceB = $this->service($this->customerB, 'web-1');
    }

    protected function tearDown(): void
    {
        if (!isset($this->owner)) {
            return;
        }
        // Audit rows go with their services: ON DELETE CASCADE in the database (backend migration 0003).
        $this->owner->prepare('DELETE FROM services WHERE customer_id IN (:a, :b)')->execute(['a' => $this->customerA, 'b' => $this->customerB]);
        $this->owner->prepare('DELETE FROM customers WHERE id IN (:a, :b)')->execute(['a' => $this->customerA, 'b' => $this->customerB]);
        $this->owner->prepare('DELETE FROM accounts_user WHERE id = :id')->execute(['id' => $this->staffUserId]);
    }

    /**
     * @param array<string, mixed> $params
     */
    private function insert(string $sql, array $params): int
    {
        $stmt = $this->owner->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn();
    }

    private function customer(string $tag, string $phone): int
    {
        return $this->insert(
            "INSERT INTO customers (first_name, last_name, email, phone, created_at, updated_at)
             VALUES ('Test', :last, :email, :phone, now(), now()) RETURNING id",
            ['last' => $tag, 'email' => "php-test-{$tag}@example.com", 'phone' => $phone],
        );
    }

    private function service(int $customerId, string $name): int
    {
        return $this->insert(
            "INSERT INTO services (customer_id, name, service_type, status, created_at, updated_at)
             VALUES (:c, :n, 'vps', 'active', now(), now()) RETURNING id",
            ['c' => $customerId, 'n' => $name],
        );
    }

    private function staff(): AuthContext
    {
        return new AuthContext($this->staffUserId, AuthContext::ROLE_STAFF, null);
    }

    private function ownerOfA(): AuthContext
    {
        return new AuthContext($this->staffUserId, AuthContext::ROLE_CUSTOMER, $this->customerA);
    }

    // --- CustomerRepository::findVisible (owner-implemented) -----------------------------------

    public function testStaffSeesAnyCustomer(): void
    {
        $repo = new CustomerRepository($this->module);
        self::assertSame($this->customerA, $repo->findVisible($this->customerA, $this->staff())['id'] ?? null);
        self::assertSame($this->customerB, $repo->findVisible($this->customerB, $this->staff())['id'] ?? null);
    }

    public function testCustomerSeesOwnRecordWithExpectedShape(): void
    {
        $row = (new CustomerRepository($this->module))->findVisible($this->customerA, $this->ownerOfA());
        self::assertNotNull($row);
        self::assertSame(['id', 'first_name', 'last_name', 'email', 'phone', 'created_at'], array_keys($row));
        self::assertSame($this->customerA, $row['id']); // an int, not a numeric string
    }

    public function testCustomerCannotSeeAnotherCustomer(): void
    {
        self::assertNull((new CustomerRepository($this->module))->findVisible($this->customerB, $this->ownerOfA()));
    }

    public function testCustomerLoginWithoutCustomerRecordSeesNothing(): void
    {
        $orphan = new AuthContext($this->staffUserId, AuthContext::ROLE_CUSTOMER, null);
        self::assertNull((new CustomerRepository($this->module))->findVisible($this->customerA, $orphan));
    }

    public function testMissingCustomerIsNull(): void
    {
        self::assertNull((new CustomerRepository($this->module))->findVisible(999999999999, $this->staff()));
    }

    // --- ServiceRepository -----------------------------------------------------------------------

    public function testListIsScoped(): void
    {
        $repo = new ServiceRepository($this->module);
        self::assertCount(2, $repo->listForCustomer($this->customerA, $this->ownerOfA()));
        self::assertSame([], $repo->listForCustomer($this->customerB, $this->ownerOfA()));
        self::assertCount(1, $repo->listForCustomer($this->customerB, $this->staff()));
    }

    public function testStatusChangeRoundTripWritesAuditRows(): void
    {
        $repo = new ServiceRepository($this->module);
        $id = $this->servicesA[0];

        $suspended = $repo->changeStatus($id, $this->customerA, ServiceStatus::Suspended, 'unpaid', $this->staff());
        self::assertSame('suspended', $suspended['status']);
        $active = $repo->changeStatus($id, null, ServiceStatus::Active, '', $this->staff());
        self::assertSame('active', $active['status']);

        $logs = $this->owner->prepare(
            'SELECT from_status, to_status, source, changed_by_id, reason
             FROM service_status_logs WHERE service_id = :id ORDER BY id'
        );
        $logs->execute(['id' => $id]);
        self::assertSame([
            ['from_status' => 'active', 'to_status' => 'suspended', 'source' => 'php_module', 'changed_by_id' => $this->staffUserId, 'reason' => 'unpaid'],
            ['from_status' => 'suspended', 'to_status' => 'active', 'source' => 'php_module', 'changed_by_id' => $this->staffUserId, 'reason' => ''],
        ], $logs->fetchAll());
    }

    public function testSameStatusIs409AndWritesNothing(): void
    {
        try {
            (new ServiceRepository($this->module))->changeStatus($this->servicesA[0], null, ServiceStatus::Active, '', $this->staff());
            self::fail('allowed active → active');
        } catch (HttpException $e) {
            self::assertSame(409, $e->status);
            self::assertSame('invalid_status_transition', $e->errorCode);
        }
        self::assertSame(0, $this->logCount($this->servicesA[0]));
        self::assertFalse($this->module->inTransaction());
    }

    public function testServiceOfAnotherCustomerInUrlIs404(): void
    {
        $this->expectExceptionObject(HttpException::notFound());
        (new ServiceRepository($this->module))->changeStatus($this->serviceB, $this->customerA, ServiceStatus::Suspended, '', $this->staff());
    }

    public function testCustomerScopeHidesOtherServices(): void
    {
        $this->expectExceptionObject(HttpException::notFound());
        (new ServiceRepository($this->module))->changeStatus($this->serviceB, null, ServiceStatus::Suspended, '', $this->ownerOfA());
    }

    public function testStatusChangeBehindAHeldRowLockIs409ServiceBusy(): void
    {
        $id = $this->servicesA[0];
        // A second connection holds the row lock, as a concurrent status change would.
        $this->owner->beginTransaction();
        $this->owner->prepare('SELECT id FROM services WHERE id = :id FOR UPDATE')->execute(['id' => $id]);

        $started = microtime(true);
        try {
            (new ServiceRepository($this->module, '200ms', 'lock-test'))
                ->changeStatus($id, null, ServiceStatus::Suspended, '', $this->staff());
            self::fail('waited past the held lock');
        } catch (HttpException $e) {
            self::assertSame(409, $e->status);
            self::assertSame('service_busy', $e->errorCode);
        } finally {
            $this->owner->rollBack();
        }

        self::assertLessThan(2.0, microtime(true) - $started);
        self::assertFalse($this->module->inTransaction());
        self::assertSame(0, $this->logCount($id));
        // set_config(..., true) is SET LOCAL: nothing left on the connection afterwards.
        self::assertSame('0', $this->module->query('SHOW lock_timeout')->fetchColumn());
    }

    // --- the php_module role can do only what it needs -----------------------------------------

    /**
     * @return iterable<string, array{string}>
     */
    public static function forbiddenStatements(): iterable
    {
        yield 'delete services' => ['DELETE FROM services WHERE id = -1'];
        yield 'update customer' => ["UPDATE customers SET email = 'x' WHERE id = -1"];
        yield 'rename service' => ["UPDATE services SET name = 'x' WHERE id = -1"];
        yield 'read users' => ['SELECT password FROM accounts_user LIMIT 1'];
        yield 'read audit log' => ['SELECT * FROM service_status_logs LIMIT 1'];
        yield 'delete audit log' => ['DELETE FROM service_status_logs WHERE id = -1'];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('forbiddenStatements')]
    public function testDatabaseRoleBlocks(string $sql): void
    {
        $this->expectException(PDOException::class);
        $this->expectExceptionMessage('permission denied');
        $this->module->exec($sql);
    }

    private function logCount(int $serviceId): int
    {
        $stmt = $this->owner->prepare('SELECT count(*) FROM service_status_logs WHERE service_id = :id');
        $stmt->execute(['id' => $serviceId]);

        return (int) $stmt->fetchColumn();
    }
}
