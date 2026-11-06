# bermitechs/bermi-connect (PHP)

Official PHP SDK for the [Bermi Connect](https://docs.bermiconnect.co.tz) bulk SMS API. PHP 8.1+, PSR-4,
no required extensions beyond `json` (uses PHP streams; plug in your own `Transport` for Guzzle/PSR-18).

```bash
composer require bermitechs/bermi-connect
```

## Usage

```php
use BermiTechs\BermiConnect\BermiConnect;
use BermiTechs\BermiConnect\Exception\InsufficientBalanceException;

$bc = new BermiConnect(getenv('BERMI_API_KEY'));
// new BermiConnect($key, ['base_url' => ..., 'timeout' => 30, 'max_retries' => 2, 'transport' => $custom]);

$result = $bc->sms->send([
    'to' => ['0712345678', '+255754000111'],
    'message' => 'Habari! Mkutano wa wazazi ni Jumamosi saa 3 asubuhi.',
    'sender_id' => 'KIBASILA',
    'reference' => 'meeting-2026-11',
    // 'schedule_at' => new DateTimeImmutable('2026-11-20 07:00', new DateTimeZone('Africa/Dar_es_Salaam')),
]);

$msg  = $bc->sms->get($result['messages'][0]['id']);
$page = $bc->sms->list(['status' => 'failed', 'page' => 1]);

$otp = $bc->otp->send(['phone' => '0712345678']);
$ok  = $bc->otp->verify($otp['otp_id'], $_POST['code']);

$bal = $bc->balance->get();
```

### Errors

All exceptions extend `BermiTechs\BermiConnect\Exception\BermiException` (`->errorCode`, `->status`, `->details`):
`ValidationException`, `AuthenticationException`, `InsufficientBalanceException`, `ForbiddenException`,
`NotFoundException`, `ConflictException`, `SenderNotApprovedException`, `RateLimitException` (`->retryAfter`),
`ApiException`, `ConnectionException`.

### Webhooks

```php
use BermiTechs\BermiConnect\Webhooks;

$raw = file_get_contents('php://input');
if (!Webhooks::verifySignature($raw, $_SERVER['HTTP_X_BERMI_SIGNATURE'] ?? null, getenv('BERMI_WEBHOOK_SECRET'))) {
    http_response_code(401); exit;
}
$event = json_decode($raw, true);
http_response_code(200);
```

## Tests

```bash
composer test   # or: php tests/run.php  (offline, uses MockTransport)
```
