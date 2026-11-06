<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect\Resource;

use BermiTechs\BermiConnect\BermiConnect;

final class Balance
{
    public function __construct(private readonly BermiConnect $client) {}

    /** @return array{balance_tzs:float|int, price_per_sms_tzs:float|int} */
    public function get(): array
    {
        return $this->client->request('GET', '/balance')['data'];
    }
}
