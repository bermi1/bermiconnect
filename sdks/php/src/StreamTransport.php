<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect;

use BermiTechs\BermiConnect\Exception\ConnectionException;

/** Default transport using PHP streams (no ext-curl required). */
final class StreamTransport implements Transport
{
    public function send(string $method, string $url, array $headers, ?string $body, float $timeout): array
    {
        $lines = [];
        foreach ($headers as $k => $v) {
            $lines[] = "$k: $v";
        }
        $ctx = stream_context_create(['http' => [
            'method' => $method,
            'header' => implode("\r\n", $lines),
            'content' => $body ?? '',
            'timeout' => $timeout,
            'ignore_errors' => true,
        ]]);
        $resp = @file_get_contents($url, false, $ctx);
        /** @var list<string> $http_response_header */
        $raw = $http_response_header ?? [];
        if ($resp === false && !$raw) {
            $e = error_get_last();
            throw new ConnectionException($e['message'] ?? 'Network error', 'connection_error', 0);
        }
        $status = 0;
        $out = [];
        foreach ($raw as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                $status = (int) $m[1];
                $out = [];
            } elseif (str_contains($h, ':')) {
                [$k, $v] = explode(':', $h, 2);
                $out[strtolower(trim($k))] = trim($v);
            }
        }
        return ['status' => $status, 'headers' => $out, 'body' => (string) $resp];
    }
}
