<?php
declare(strict_types=1);

namespace BermiTechs\BermiConnect\Resource;

use BermiTechs\BermiConnect\BermiConnect;

final class Sms
{
    public function __construct(private readonly BermiConnect $client) {}

    /**
     * @param array{to:string|list<string>, message:string, sender_id?:string, reference?:string, schedule_at?:string|\DateTimeInterface} $params
     * @return array{batch_id:string, messages:list<array<string,mixed>>, total_cost_tzs:float|int}
     */
    public function send(array $params): array
    {
        if (isset($params['schedule_at']) && $params['schedule_at'] instanceof \DateTimeInterface) {
            $params['schedule_at'] = $params['schedule_at']->format(\DateTimeInterface::ATOM);
        }
        return $this->client->request('POST', '/sms/send', array_filter($params, static fn($v) => $v !== null))['data'];
    }

    /** @return array<string,mixed> */
    public function get(string $id): array
    {
        return $this->client->request('GET', '/sms/' . rawurlencode($id))['data'];
    }

    /**
     * @param array{status?:string, from?:string, to?:string, campaign_id?:string, page?:int, per_page?:int} $filters
     * @return array{data:list<array<string,mixed>>, meta:array{page:int,per_page:int,total:int}|null}
     */
    public function list(array $filters = []): array
    {
        $r = $this->client->request('GET', '/sms', null, $filters);
        return ['data' => $r['data'] ?? [], 'meta' => $r['meta'] ?? null];
    }
}
