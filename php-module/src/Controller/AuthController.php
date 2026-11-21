<?php

declare(strict_types=1);

namespace Respina\Controller;

use Respina\Auth\DjangoAuthClient;
use Respina\Auth\JwtVerifier;
use Respina\Http\HttpException;
use Respina\Http\Request;
use Respina\Http\Response;
use Respina\Security\Csrf;
use Respina\Security\Session;
use Respina\View;
use RuntimeException;

final class AuthController
{
    /** Only same-site customer pages are valid post-login targets (no open redirect). */
    private const NEXT_PATTERN = '#^/customers/[1-9][0-9]{0,17}$#D';

    public function __construct(
        private readonly DjangoAuthClient $django,
        private readonly JwtVerifier $verifier,
    ) {
    }

    public function showLogin(Request $request): Response
    {
        return Response::html(200, View::render('login', [
            'title' => 'Sign in',
            'next' => self::safeNext($request->query['next'] ?? ''),
            'error' => null,
            'email' => '',
        ]));
    }

    public function login(Request $request): Response
    {
        Csrf::check($_SESSION, $request->formString(Csrf::FIELD));
        $email = trim($request->formString('email'));
        $password = $request->formString('password');
        $next = self::safeNext($request->formString('next'));

        $error = null;
        if ($email === '' || $password === '') {
            $error = 'Enter your email and password.';
        } else {
            try {
                $token = $this->django->login($email, $password, $request->requestId);
            } catch (RuntimeException $e) {
                if ($e->getCode() === 429) {
                    throw new HttpException(429, 'throttled', 'Too many attempts. Wait a minute and try again.');
                }
                throw new HttpException(503, 'dependency_unavailable', 'Sign-in is temporarily unavailable.');
            }
            if ($token === null || $this->verifier->verify($token) === null) {
                $error = 'Email or password is incorrect.';
            } else {
                Session::login($token);

                return Response::redirect($next !== '' ? $next : '/');
            }
        }

        return Response::html(401, View::render('login', [
            'title' => 'Sign in',
            'next' => $next,
            'error' => $error,
            'email' => $email,
        ]));
    }

    public function logout(Request $request): Response
    {
        Csrf::check($_SESSION, $request->formString(Csrf::FIELD));
        Session::logout();

        return Response::redirect('/login');
    }

    private static function safeNext(mixed $next): string
    {
        return is_string($next) && preg_match(self::NEXT_PATTERN, $next) === 1 ? $next : '';
    }
}
