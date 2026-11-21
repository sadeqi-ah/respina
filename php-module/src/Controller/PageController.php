<?php

declare(strict_types=1);

namespace Respina\Controller;

use Respina\Auth\AuthContext;
use Respina\Auth\JwtVerifier;
use Respina\Domain\ServiceStatus;
use Respina\Http\HttpException;
use Respina\Http\Request;
use Respina\Http\Response;
use Respina\Repository\CustomerRepository;
use Respina\Repository\ServiceRepository;
use Respina\Security\Csrf;
use Respina\Security\Session;
use Respina\Validation\Validator;
use Respina\View;

/**
 * HTML pages. Auth comes from the access token in the PHP session.
 */
final class PageController
{
    /**
     * @param \Closure(): CustomerRepository $customers
     * @param \Closure(): ServiceRepository  $services
     */
    public function __construct(
        private readonly JwtVerifier $verifier,
        private readonly \Closure $customers,
        private readonly \Closure $services,
    ) {
    }

    public function home(Request $request): Response
    {
        $auth = $this->auth();
        if ($auth === null) {
            return Response::redirect('/login');
        }
        if (!$auth->isStaff()) {
            if ($auth->customerId === null) {
                throw new HttpException(404, 'not_found', 'Your login is not linked to a customer record.');
            }

            return Response::redirect('/customers/' . $auth->customerId);
        }

        return Response::html(200, View::render('home', ['title' => 'Customers', 'auth' => $auth]));
    }

    /** GET /customers?id=N: the staff lookup form on the home page. */
    public function lookup(Request $request): Response
    {
        $raw = $request->query['id'] ?? '';

        return Response::redirect('/customers/' . Validator::pathId(is_string($raw) ? trim($raw) : ''));
    }

    /**
     * @param array<string, string> $params
     */
    public function customer(Request $request, array $params): Response
    {
        $auth = $this->auth();
        if ($auth === null) {
            return Response::redirect('/login?next=' . rawurlencode($request->path));
        }
        $id = Validator::pathId($params['id']);
        $customer = ($this->customers)()->findVisible($id, $auth) ?? throw HttpException::notFound();
        $services = ($this->services)()->listForCustomer($id, $auth);

        return Response::html(200, View::render('customer', [
            'title' => $customer['first_name'] . ' ' . $customer['last_name'],
            'auth' => $auth,
            'customer' => $customer,
            'services' => $services,
            'flash' => Session::takeFlash(),
        ]));
    }

    /**
     * @param array<string, string> $params
     */
    public function changeStatus(Request $request, array $params): Response
    {
        $auth = $this->auth();
        if ($auth === null) {
            return Response::redirect('/login');
        }
        Csrf::check($_SESSION, $request->formString(Csrf::FIELD));
        $customerId = Validator::pathId($params['id']);
        $serviceId = Validator::pathId($params['serviceId']);
        if (!$auth->isStaff()) {
            throw HttpException::forbidden();
        }
        $back = Response::redirect('/customers/' . $customerId);

        try {
            $input = Validator::statusChange($request->form);
            $service = ($this->services)()->changeStatus($serviceId, $customerId, $input['status'], $input['reason'], $auth);
        } catch (HttpException $e) {
            if ($e->status === 404) {
                throw $e;
            }
            Session::flash('error', $e->getMessage());

            return $back;
        }

        $status = ServiceStatus::from((string) $service['status']);
        Session::flash('success', sprintf('%s is now %s.', $service['name'], strtolower($status->label())));

        return $back;
    }

    private function auth(): ?AuthContext
    {
        $token = Session::accessToken();

        return $token === null ? null : $this->verifier->verify($token);
    }
}
