<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect\Exception;

class RateLimitException extends BermiException
{
    public function __construct(
        string $message,
        string $errorCode = 'rate_limited',
        int $status = 429,
        mixed $details = null,
        public readonly ?int $retryAfter = null,
    ) {
        parent::__construct($message, $errorCode, $status, $details);
    }
}
