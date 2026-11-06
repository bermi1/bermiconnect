<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect;

/**
 * Minimal HTTP transport. Implement this to plug in Guzzle, a PSR-18 client, or a test double.
 */
interface Transport
{
    /**
     * @param array<string,string> $headers
     * @return array{status:int, headers:array<string,string>, body:string}
     */
    public function send(string $method, string $url, array $headers, ?string $body, float $timeout): array;
}
