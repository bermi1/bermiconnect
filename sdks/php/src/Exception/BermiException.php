<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect\Exception;

class BermiException extends \RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'api_error',
        public readonly int $status = 0,
        public readonly mixed $details = null,
    ) {
        parent::__construct($message, $status);
    }

    private const BY_CODE = [
        'validation_error' => ValidationException::class,
        'unauthorized' => AuthenticationException::class,
        'insufficient_balance' => InsufficientBalanceException::class,
        'forbidden' => ForbiddenException::class,
        'not_found' => NotFoundException::class,
        'conflict' => ConflictException::class,
        'sender_not_approved' => SenderNotApprovedException::class,
        'rate_limited' => RateLimitException::class,
    ];
    private const BY_STATUS = [
        400 => ValidationException::class, 401 => AuthenticationException::class,
        402 => InsufficientBalanceException::class, 403 => ForbiddenException::class,
        404 => NotFoundException::class, 409 => ConflictException::class,
        422 => SenderNotApprovedException::class, 429 => RateLimitException::class,
    ];

    /** @param array<string,mixed>|null $payload */
    public static function fromResponse(int $status, ?array $payload, ?int $retryAfter = null): self
    {
        $err = $payload['error'] ?? [];
        $code = $err['code'] ?? ($status === 429 ? 'rate_limited' : 'api_error');
        $msg = $err['message'] ?? "HTTP $status";
        $cls = self::BY_CODE[$code] ?? self::BY_STATUS[$status] ?? ApiException::class;
        if ($cls === RateLimitException::class) {
            return new RateLimitException($msg, $code, $status, $err['details'] ?? null, $retryAfter);
        }
        return new $cls($msg, $code, $status, $err['details'] ?? null);
    }
}
