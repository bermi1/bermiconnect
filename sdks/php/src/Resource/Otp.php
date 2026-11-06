<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect\Resource;

use BermiTechs\BermiConnect\BermiConnect;

final class Otp
{
    public function __construct(private readonly BermiConnect $client) {}

    /**
     * @param array{phone:string, sender_id?:string, length?:int, expires_in?:int, template?:string} $params
     * @return array{otp_id:string, expires_at:string}
     */
    public function send(array $params): array
    {
        return $this->client->request('POST', '/otp/send', $params)['data'];
    }

    public function verify(string $otpId, string $code): bool
    {
        return (bool) ($this->client->request('POST', '/otp/verify', ['otp_id' => $otpId, 'code' => $code])['data']['verified'] ?? false);
    }
}
