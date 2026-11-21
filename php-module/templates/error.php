<?php
/** @var int $status */
/** @var string $message */
/** @var string $requestId */
?>
<section class="card narrow">
    <h1><?= e($status) ?></h1>
    <p><?= e($message) ?></p>
    <p class="muted">Request ID: <code><?= e($requestId) ?></code></p>
    <p><a href="/">Back to start</a></p>
</section>
