<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect;

use BermiTechs\BermiConnect\Exception\BermiException;
use BermiTechs\BermiConnect\Exception\ConnectionException;

/**
 * $bc = new BermiConnect('bc_live_...');
 * $bc->sms->send(['to' => '0712345678', 'message' => 'Habari!']);
 */
final class BermiConnect
{
    public const VERSION = '1.0.0';
    public const DEFAULT_BASE_URL = 'https://api.bermiconnect.co.tz/v1';

    public readonly Resource\Sms $sms;
    public readonly Resource\Otp $otp;
    public readonly Resource\Balance $balance;
    public readonly Webhooks $webhooks;
    public readonly bool $testMode;

    private string $baseUrl;
    private Transport $transport;

    /**
     * @param array{base_url?:string, timeout?:float, max_retries?:int, transport?:Transport} $options
     */
    public function __construct(private readonly string $apiKey, array $options = [])
    {
        if ($apiKey === '') {
            throw new \InvalidArgumentException('apiKey is required');
        }
        $this->baseUrl = rtrim($options['base_url'] ?? self::DEFAULT_BASE_URL, '/');
        $this->transport = $options['transport'] ?? new StreamTransport();
        $this->timeout = (float) ($options['timeout'] ?? 30.0);
        $this->maxRetries = (int) ($options['max_retries'] ?? 2);
        $this->testMode = str_starts_with($apiKey, 'bc_test_');
        $this->sms = new Resource\Sms($this);
        $this->otp = new Resource\Otp($this);
        $this->balance = new Resource\Balance($this);
        $this->webhooks = new Webhooks();
    }

    private float $timeout;
    private int $maxRetries;

    /**
     * @param array<string,mixed>|null $body
     * @param array<string,mixed> $query
     * @return array<string,mixed> decoded envelope {data, meta?}
     */
    public function request(string $method, string $path, ?array $body = null, array $query = []): array
    {
        $query = array_filter($query, static fn($v) => $v !== null && $v !== '');
        $url = $this->baseUrl . $path . ($query ? '?' . http_build_query($query) : '');
        $headers = [
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Accept' => 'application/json',
            'User-Agent' => 'bermi-connect-php/' . self::VERSION,
        ];
        $payload = null;
        if ($body !== null) {
            $headers['Content-Type'] = 'application/json';
            $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
        $retries = $method === 'GET' ? $this->maxRetries : 0;
        for ($attempt = 0; ; $attempt++) {
            try {
                $res = $this->transport->send($method, $url, $headers, $payload, $this->timeout);
            } catch (ConnectionException $e) {
                if ($attempt < $retries) {
                    usleep((int) min(250_000 * 2 ** $attempt, 4_000_000));
                    continue;
                }
                throw $e;
            }
            $json = $res['body'] !== '' ? json_decode($res['body'], true) : [];
            if ($res['status'] >= 200 && $res['status'] < 300) {
                return is_array($json) ? $json : [];
            }
            $ra = isset($res['headers']['retry-after']) ? (int) $res['headers']['retry-after'] : null;
            if (($res['status'] === 429 || $res['status'] >= 500) && $attempt < $retries) {
                usleep($ra !== null ? $ra * 1_000_000 : (int) min(250_000 * 2 ** $attempt, 4_000_000));
                continue;
            }
            throw BermiException::fromResponse($res['status'], is_array($json) ? $json : null, $ra);
        }
    }

    /** Normalise 07xx / 06xx / 7xx / 2557xx / +2557xx to E.164, or null if invalid. */
    public static function normalizePhone(string $value, string $defaultCountry = '255'): ?string
    {
        $s = (string) preg_replace('/[\s\-().]/', '', trim($value));
        if (str_starts_with($s, '00')) {
            $s = '+' . substr($s, 2);
        }
        if (str_starts_with($s, '+')) {
            return preg_match('/^\+[1-9]\d{7,14}$/', $s) ? $s : null;
        }
        if (!ctype_digit($s)) {
            return null;
        }
        if (str_starts_with($s, $defaultCountry) && strlen($s) === strlen($defaultCountry) + 9) {
            return '+' . $s;
        }
        if ($s[0] === '0' && strlen($s) === 10) {
            return '+' . $defaultCountry . substr($s, 1);
        }
        if (preg_match('/^[67]\d{8}$/', $s)) {
            return '+' . $defaultCountry . $s;
        }
        return null;
    }
}
