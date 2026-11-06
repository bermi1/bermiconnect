<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect;

final class Webhooks
{
    /**
     * Verify `X-Bermi-Signature: sha256=<hex>` against the RAW body
     * (use file_get_contents('php://input'), not a re-encoded array).
     */
    public static function verifySignature(string $rawBody, ?string $signatureHeader, string $secret): bool
    {
        if ($signatureHeader === null || $signatureHeader === '' || $secret === '') {
            return false;
        }
        $provided = strtolower((string) preg_replace('/^sha256=/i', '', trim($signatureHeader)));
        $expected = hash_hmac('sha256', $rawBody, $secret);
        return hash_equals($expected, $provided);
    }
}
