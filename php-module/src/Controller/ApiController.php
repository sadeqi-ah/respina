<?php

declare(strict_types=1);

namespace Respina\Controller;

use Respina\Auth\AuthContext;
use Respina\Auth\JwtVerifier;
use Respina\Http\HttpException;
use Respina\Http\Request;
use Respina\Http\Response;
use Respina\Presenter;
use Respina\Repository\CustomerRepository;
use Respina\Repository\ServiceRepository;
use Respina\Validation\Validator;

/**
 * JSON API (plan §3.6). Bearer JWT from Django; same rules and error envelope as Django.
 */
final class ApiController
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

    /**
     * @param array<string, string> $params
     */
    public function customer(Request $request, array $params): Response
    {
        $auth = $this->auth($request);
        $id = Validator::pathId($params['id']);
        $customer = ($this->customers)()->findVisible($id, $auth) ?? throw HttpException::notFound();
        $count = count(($this->services)()->listForCustomer($id, $auth));

        return Response::json(200, Presenter::customer($customer, $count));
    }

    /**
     * @param array<string, string> $params
     */
    public function services(Request $request, array $params): Response
    {
        $auth = $this->auth($request);
        $id = Validator::pathId($params['id']);
        ($this->customers)()->findVisible($id, $auth) ?? throw HttpException::notFound();
        $rows = ($this->services)()->listForCustomer($id, $auth);

        return Response::json(200, [
            'count' => count($rows),
            'results' => array_map([Presenter::class, 'service'], $rows),
        ]);
    }

    /**
     * @param array<string, string> $params
     */
    public function changeStatus(Request $request, array $params): Response
    {
        $auth = $this->auth($request);
        $id = Validator::pathId($params['id']);
        if (!$auth->isStaff()) {
            throw HttpException::forbidden();
        }
        $input = Validator::statusChange($request->json());
        $service = ($this->services)()->changeStatus($id, null, $input['status'], $input['reason'], $auth);

        return Response::json(200, Presenter::service($service));
    }

    private function auth(Request $request): AuthContext
    {
        $header = $request->header('authorization');
        if ($header === '') {
            throw HttpException::notAuthenticated();
        }
        if (preg_match('/^Bearer\s+(\S+)$/', $header, $m) !== 1) {
            throw HttpException::tokenInvalid();
        }

        return $this->verifier->verify($m[1]) ?? throw HttpException::tokenInvalid();
    }
}
