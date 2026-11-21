<?php
/** @var string $title */
/** @var string $content */
/** @var \Respina\Auth\AuthContext|null $auth */
/** @var string|null $csrf */
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($title) ?> · Cloud Panel</title>
    <link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="topbar">
    <a class="brand" href="/">Cloud Panel</a>
    <?php if (isset($auth) && $auth !== null && isset($csrf)): ?>
        <form method="post" action="/logout">
            <input type="hidden" name="_csrf" value="<?= e($csrf) ?>">
            <span class="muted"><?= e($auth->isStaff() ? 'Staff' : 'Customer') ?></span>
            <button type="submit" class="link">Sign out</button>
        </form>
    <?php endif; ?>
</header>
<main class="container">
<?= $content /* already escaped by the inner template */ ?>
</main>
</body>
</html>
