<?php
/** @var string $next */
/** @var string|null $error */
/** @var string $email */
/** @var string $csrf */
?>
<section class="card narrow">
    <h1>Sign in</h1>
    <?php if ($error !== null): ?>
        <p class="flash flash-error" role="alert"><?= e($error) ?></p>
    <?php endif; ?>
    <form method="post" action="/login" class="stack">
        <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">
        <input type="hidden" name="next" value="<?= e($next) ?>">
        <label>Email
            <input type="email" name="email" value="<?= e($email) ?>" autocomplete="username" required autofocus>
        </label>
        <label>Password
            <input type="password" name="password" autocomplete="current-password" required>
        </label>
        <button type="submit" class="primary">Sign in</button>
    </form>
</section>
