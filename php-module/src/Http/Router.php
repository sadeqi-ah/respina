<?php

declare(strict_types=1);

namespace Respina\Http;

/**
 * Minimal router: "GET /customers/{id}" patterns, 404 for unknown paths, 405 with Allow for
 * known paths with the wrong method. Path parameters are raw strings; controllers validate them.
 */
final class Router
{
    /** @var list<array{method: string, regex: string, handler: callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = ['method' => $method, 'regex' => $regex, 'handler' => $handler];
    }

    public function dispatch(Request $request): Response
    {
        $allowed = [];
        foreach ($this->routes as $route) {
            if (preg_match($route['regex'], $request->path, $m) !== 1) {
                continue;
            }
            if ($route['method'] !== $request->method) {
                $allowed[] = $route['method'];
                continue;
            }
            $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);

            return ($route['handler'])($request, $params);
        }
        if ($allowed !== []) {
            throw new HttpException(405, 'method_not_allowed', 'Method not allowed.', [], [
                'Allow' => implode(', ', array_unique($allowed)),
            ]);
        }
        throw HttpException::notFound();
    }
}
