<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect\Tests;

use BermiTechs\BermiConnect\Transport;

final class MockTransport implements Transport
{
    /** @var list<array{method:string,url:string,headers:array<string,string>,body:?string}> */
    public array $calls = [];
    /** @var list<array{status:int,headers?:array<string,string>,body:mixed}> */
    public array $queue = [];

    public function send(string $method, string $url, array $headers, ?string $body, float $timeout): array
    {
        $this->calls[] = compact('method', 'url', 'headers', 'body');
        $r = array_shift($this->queue) ?? ['status' => 500, 'body' => ['error' => ['code' => 'api_error', 'message' => 'empty queue']]];
        return ['status' => $r['status'], 'headers' => $r['headers'] ?? [], 'body' => json_encode($r['body'])];
    }
}
