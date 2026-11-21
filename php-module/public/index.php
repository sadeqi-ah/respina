<?php

declare(strict_types=1);

use Respina\Auth\DjangoAuthClient;
use Respina\Auth\JwtVerifier;
use Respina\Config;
use Respina\Controller\ApiController;
use Respina\Controller\AuthController;
use Respina\Controller\PageController;
use Respina\Database;
use Respina\Http\HttpException;
use Respina\Http\Request;
use Respina\Http\Response;
use Respina\Http\Router;
use Respina\Repository\CustomerRepository;
use Respina\Repository\ServiceRepository;
use Respina\Security\Session;
use Respina\View;

require __DIR__ . '/../vendor/autoload.php';

ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', 'php://stderr');

$request = Request::fromGlobals();

try {
    $config = Config::fromEnv(getenv());
    $verifier = JwtVerifier::fromFile($config->jwtPublicKeyPath);

    // Connect lazily: pages that fail auth or validation never open a DB connection.
    $pdo = null;
    $db = static function () use (&$pdo, $config): PDO {
        return $pdo ??= Database::connect($config);
    };
    $customers = static fn (): CustomerRepository => new CustomerRepository($db());
    $services = static fn (): ServiceRepository => new ServiceRepository($db());

    $pages = new PageController($verifier, $customers, $services);
    $api = new ApiController($verifier, $customers, $services);
    $authController = new AuthController(new DjangoAuthClient($config->djangoApiUrl), $verifier);

    $router = new Router();
    // JSON API: stateless, Bearer JWT. No session, so no CSRF surface.
    $router->add('GET', '/api/customers/{id}', $api->customer(...));
    $router->add('GET', '/api/customers/{id}/services', $api->services(...));
    $router->add('POST', '/api/services/{id}/status', $api->changeStatus(...));
    // HTML: session + CSRF.
    $router->add('GET', '/', $pages->home(...));
    $router->add('GET', '/login', $authController->showLogin(...));
    $router->add('POST', '/login', $authController->login(...));
    $router->add('POST', '/logout', $authController->logout(...));
    $router->add('GET', '/customers', $pages->lookup(...));
    $router->add('GET', '/customers/{id}', $pages->customer(...));
    $router->add('POST', '/customers/{id}/services/{serviceId}/status', $pages->changeStatus(...));

    if (!$request->isApi()) {
        Session::start($config->cookieSecure);
    }
    $response = $router->dispatch($request);
} catch (HttpException $e) {
    $response = $request->isApi()
        ? Response::error($e, $request->requestId)
        : Response::html($e->status, View::render('error', [
            'title' => 'Error',
            'status' => $e->status,
            'message' => $e->getMessage(),
            'requestId' => $request->requestId,
        ]));
} catch (PDOException $e) {
    // SQLSTATE class 08 = connection exception: the database is down, not a bug here.
    error_log(sprintf('[%s] database error %s: %s', $request->requestId, (string) $e->getCode(), $e->getMessage()));
    $isConnection = str_starts_with((string) $e->getCode(), '08') || str_contains($e->getMessage(), 'SQLSTATE[08');
    $error = $isConnection
        ? new HttpException(503, 'dependency_unavailable', 'The database is unavailable.')
        : new HttpException(500, 'internal_error', 'An unexpected error occurred.');
    $response = $request->isApi()
        ? Response::error($error, $request->requestId)
        : Response::html($error->status, View::render('error', [
            'title' => 'Error',
            'status' => $error->status,
            'message' => $error->getMessage(),
            'requestId' => $request->requestId,
        ]));
} catch (Throwable $e) {
    error_log(sprintf('[%s] %s: %s in %s:%d', $request->requestId, $e::class, $e->getMessage(), $e->getFile(), $e->getLine()));
    $internal = new HttpException(500, 'internal_error', 'An unexpected error occurred.');
    $response = $request->isApi()
        ? Response::error($internal, $request->requestId)
        : Response::html(500, View::render('error', [
            'title' => 'Error',
            'status' => 500,
            'message' => 'An unexpected error occurred.',
            'requestId' => $request->requestId,
        ]));
}

$response->send($request->requestId);
