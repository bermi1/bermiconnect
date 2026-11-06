<?php
declare(strict_types=1);

// Offline test runner (no PHPUnit needed): php tests/run.php
spl_autoload_register(function (string $cls): void {
    $map = ['BermiTechs\\BermiConnect\\Tests\\' => __DIR__ . '/', 'BermiTechs\\BermiConnect\\' => __DIR__ . '/../src/'];
    foreach ($map as $prefix => $dir) {
        if (str_starts_with($cls, $prefix)) {
            $f = $dir . str_replace('\\', '/', substr($cls, strlen($prefix))) . '.php';
            if (is_file($f)) { require $f; return; }
        }
    }
});

use BermiTechs\BermiConnect\BermiConnect;
use BermiTechs\BermiConnect\Webhooks;
use BermiTechs\BermiConnect\Exception;
use BermiTechs\BermiConnect\Tests\MockTransport;

$failures = 0; $passed = 0;
function check(string $name, callable $fn): void {
    global $failures, $passed;
    try { $fn(); $passed++; echo "ok - $name\n"; }
    catch (\Throwable $e) { $failures++; echo "FAIL - $name: {$e->getMessage()} ({$e->getFile()}:{$e->getLine()})\n"; }
}
function eq($a, $b, string $msg = ''): void { if ($a !== $b) throw new \Exception("$msg expected " . var_export($b, true) . ' got ' . var_export($a, true)); }

$base = 'http://mock.local/v1';

check('sms.send', function () use ($base) {
    $t = new MockTransport();
    $t->queue[] = ['status' => 202, 'body' => ['data' => ['batch_id' => 'b1', 'messages' => [], 'total_cost_tzs' => 25]]];
    $bc = new BermiConnect('bc_test_abc', ['base_url' => $base, 'transport' => $t]);
    $r = $bc->sms->send(['to' => '0712345678', 'message' => 'Habari', 'schedule_at' => new DateTimeImmutable('2026-12-01T06:00:00+00:00')]);
    eq($r['batch_id'], 'b1');
    eq($t->calls[0]['url'], "$base/sms/send");
    eq($t->calls[0]['headers']['Authorization'], 'Bearer bc_test_abc');
    eq(json_decode($t->calls[0]['body'], true)['schedule_at'], '2026-12-01T06:00:00+00:00');
    eq($bc->testMode, true);
});

check('sms.get / sms.list', function () use ($base) {
    $t = new MockTransport();
    $t->queue[] = ['status' => 200, 'body' => ['data' => ['id' => 'm1', 'status' => 'delivered']]];
    $t->queue[] = ['status' => 200, 'body' => ['data' => [['id' => 'm1']], 'meta' => ['page' => 1, 'per_page' => 50, 'total' => 1]]];
    $bc = new BermiConnect('bc_live_x', ['base_url' => $base, 'transport' => $t]);
    eq($bc->sms->get('m1')['status'], 'delivered');
    eq($bc->sms->list(['status' => 'delivered', 'campaign_id' => null])['meta']['total'], 1);
    eq($t->calls[1]['url'], "$base/sms?status=delivered");
});

check('otp send/verify', function () use ($base) {
    $t = new MockTransport();
    $t->queue[] = ['status' => 200, 'body' => ['data' => ['otp_id' => 'o1', 'expires_at' => 'x']]];
    $t->queue[] = ['status' => 200, 'body' => ['data' => ['verified' => true]]];
    $bc = new BermiConnect('bc_live_x', ['base_url' => $base, 'transport' => $t]);
    eq($bc->otp->send(['phone' => '0712345678'])['otp_id'], 'o1');
    eq($bc->otp->verify('o1', '123456'), true);
});

check('balance.get', function () use ($base) {
    $t = new MockTransport();
    $t->queue[] = ['status' => 200, 'body' => ['data' => ['balance_tzs' => 500, 'price_per_sms_tzs' => 25]]];
    $bc = new BermiConnect('bc_live_x', ['base_url' => $base, 'transport' => $t]);
    eq($bc->balance->get()['price_per_sms_tzs'], 25);
});

check('typed errors', function () use ($base) {
    $cases = [[402, 'insufficient_balance', Exception\InsufficientBalanceException::class],
              [422, 'sender_not_approved', Exception\SenderNotApprovedException::class],
              [401, 'unauthorized', Exception\AuthenticationException::class],
              [429, 'rate_limited', Exception\RateLimitException::class]];
    foreach ($cases as [$status, $code, $cls]) {
        $t = new MockTransport();
        $t->queue[] = ['status' => $status, 'headers' => ['retry-after' => '3'], 'body' => ['error' => ['code' => $code, 'message' => 'nope']]];
        $bc = new BermiConnect('bc_live_x', ['base_url' => $base, 'transport' => $t]);
        try { $bc->sms->send(['to' => '0712345678', 'message' => 'x']); throw new \Exception("no throw for $code"); }
        catch (Exception\BermiException $e) {
            eq(get_class($e), $cls); eq($e->errorCode, $code); eq($e->status, $status);
            if ($e instanceof Exception\RateLimitException) eq($e->retryAfter, 3);
        }
        eq(count($t->calls), 1, 'POST must not retry');
    }
});

check('GET retries after 429', function () use ($base) {
    $t = new MockTransport();
    $t->queue[] = ['status' => 429, 'headers' => ['retry-after' => '0'], 'body' => ['error' => ['code' => 'rate_limited', 'message' => 'slow']]];
    $t->queue[] = ['status' => 200, 'body' => ['data' => ['balance_tzs' => 1, 'price_per_sms_tzs' => 25]]];
    $bc = new BermiConnect('bc_live_x', ['base_url' => $base, 'transport' => $t]);
    eq($bc->balance->get()['balance_tzs'], 1);
    eq(count($t->calls), 2);
});

check('webhook signature', function () {
    $secret = 'whsec_test_123';
    $body = '{"event":"message.delivered","data":{"id":"m1"}}';
    $sig = 'sha256=' . hash_hmac('sha256', $body, $secret);
    eq(Webhooks::verifySignature($body, $sig, $secret), true);
    eq(Webhooks::verifySignature($body . ' ', $sig, $secret), false);
    eq(Webhooks::verifySignature($body, $sig, 'wrong'), false);
    eq(Webhooks::verifySignature($body, null, $secret), false);
});

check('normalizePhone', function () {
    foreach (['0712345678', '712345678', '255712345678', '+255712345678', '+255 712 345 678'] as $v) {
        eq(BermiConnect::normalizePhone($v), '+255712345678', $v);
    }
    eq(BermiConnect::normalizePhone('0712'), null);
});

echo "\n$passed passed, $failures failed\n";
exit($failures ? 1 : 0);
