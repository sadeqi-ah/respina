<?php
use Respina\Domain\ServiceStatus;
use Respina\Domain\ServiceType;

/** @var \Respina\Auth\AuthContext $auth */
/** @var array<string, mixed> $customer */
/** @var list<array<string, mixed>> $services */
/** @var array{type: string, message: string}|null $flash */
/** @var string $csrf */
?>
<?php if ($flash !== null): ?>
    <p class="flash flash-<?= e($flash['type']) ?>" role="status"><?= e($flash['message']) ?></p>
<?php endif; ?>

<section class="card">
    <h1><?= e($customer['first_name'] . ' ' . $customer['last_name']) ?></h1>
    <dl class="facts">
        <div><dt>Customer ID</dt><dd><?= e($customer['id']) ?></dd></div>
        <div><dt>Email</dt><dd><?= e($customer['email']) ?></dd></div>
        <div><dt>Phone</dt><dd dir="ltr"><?= e($customer['phone']) ?></dd></div>
        <div><dt>Services</dt><dd><?= e(count($services)) ?></dd></div>
    </dl>
</section>

<section class="card">
    <h2>Services</h2>
    <?php if ($services === []): ?>
        <p class="muted">This customer has no services yet.</p>
    <?php else: ?>
        <div class="table-wrap">
            <table>
                <thead>
                <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <?php if ($auth->isStaff()): ?><th scope="col">Action</th><?php endif; ?>
                </tr>
                </thead>
                <tbody>
                <?php foreach ($services as $service):
                    $status = ServiceStatus::tryFrom((string) $service['status']);
                    ?>
                    <tr>
                        <td data-label="Name"><?= e($service['name']) ?></td>
                        <td data-label="Type"><?= e(ServiceType::labelFor((string) $service['service_type'])) ?></td>
                        <td data-label="Status">
                            <span class="badge badge-<?= e($service['status']) ?>"><?= e($status?->label() ?? $service['status']) ?></span>
                        </td>
                        <?php if ($auth->isStaff()): ?>
                            <td data-label="Action">
                                <?php foreach ($status?->allowedTargets() ?? [] as $target): ?>
                                    <form method="post" class="inline"
                                          action="/customers/<?= e($customer['id']) ?>/services/<?= e($service['id']) ?>/status">
                                        <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">
                                        <input type="hidden" name="status" value="<?= e($target->value) ?>">
                                        <input type="text" name="reason" maxlength="500" placeholder="Reason (optional)"
                                               aria-label="Reason for <?= e(strtolower($target->actionLabel())) ?>">
                                        <button type="submit" class="<?= $target === ServiceStatus::Suspended ? 'danger' : 'primary' ?>">
                                            <?= e($target->actionLabel()) ?>
                                        </button>
                                    </form>
                                <?php endforeach; ?>
                            </td>
                        <?php endif; ?>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</section>
