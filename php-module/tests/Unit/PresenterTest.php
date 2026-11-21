<?php

declare(strict_types=1);

namespace Respina\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Respina\Presenter;

final class PresenterTest extends TestCase
{
    public function testTimestampsMatchDrfFormat(): void
    {
        self::assertSame('2026-11-21T10:00:00.123456Z', Presenter::timestamp('2026-11-21 13:30:00.123456+03:30'));
        self::assertSame('2026-11-21T10:00:00.000000Z', Presenter::timestamp('2026-11-21 10:00:00+00'));
    }

    public function testServiceShapeMatchesDjango(): void
    {
        $out = Presenter::service([
            'id' => 125, 'customer_id' => 12, 'name' => 'web-prod-1', 'service_type' => 'cloud_server',
            'status' => 'active', 'created_at' => '2026-11-21 10:00:00+00', 'updated_at' => '2026-11-21 10:00:00+00',
        ]);
        self::assertSame(
            ['id', 'customer_id', 'name', 'service_type', 'service_type_display', 'status', 'created_at', 'updated_at'],
            array_keys($out),
        );
        self::assertSame('Cloud Server', $out['service_type_display']);
    }

    public function testCustomerFullName(): void
    {
        $out = Presenter::customer([
            'id' => 12, 'first_name' => 'Ali', 'last_name' => 'Rezaei', 'email' => 'ali@example.com',
            'phone' => '+989121234567', 'created_at' => '2026-11-21 10:00:00+00',
        ], 3);
        self::assertSame('Ali Rezaei', $out['full_name']);
        self::assertSame(3, $out['services_count']);
    }

    public function testEscapingHelperNeutralisesHtml(): void
    {
        self::assertSame('&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt;', e("<script>alert('x')</script>"));
        self::assertSame('&quot; onmouseover=&quot;x', e('" onmouseover="x'));
    }
}
