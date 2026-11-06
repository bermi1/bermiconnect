# bermi_connect (Python)

Official Python SDK for the [Bermi Connect](https://docs.bermiconnect.co.tz) bulk SMS API.
No dependencies: built on `urllib` from the standard library. Python 3.8+.

```bash
pip install bermi_connect
```

## Usage

```python
import os
from bermi_connect import BermiConnect, InsufficientBalanceError

bc = BermiConnect(os.environ["BERMI_API_KEY"])
# BermiConnect(api_key, base_url="https://api.bermiconnect.co.tz/v1", timeout=30.0, max_retries=2)

result = bc.sms.send(
    to=["0712345678", "+255754000111"],          # one string or a list of up to 1000
    message="Habari! Mkutano wa wazazi ni Jumamosi saa 3 asubuhi.",
    sender_id="KIBASILA",
    reference="meeting-2026-11",
    # schedule_at=datetime(2026, 11, 20, 7, 0, tzinfo=ZoneInfo("Africa/Dar_es_Salaam")),
)
print(result["batch_id"], result["total_cost_tzs"])

msg = bc.sms.get(result["messages"][0]["id"])
page = bc.sms.list(status="failed", page=1, per_page=50)   # {"data": [...], "meta": {...}}

otp = bc.otp.send(phone="0712345678", template="Your Duka code is {{code}}")
ok = bc.otp.verify(otp["otp_id"], "482913")                 # bool

bal = bc.balance.get()   # {"balance_tzs": ..., "price_per_sms_tzs": 18}
```

### Errors

All errors subclass `bermi_connect.BermiError` and carry `.code`, `.status`, `.details`:
`ValidationError` (400), `AuthenticationError` (401), `InsufficientBalanceError` (402), `ForbiddenError` (403),
`NotFoundError` (404), `ConflictError` (409), `SenderNotApprovedError` (422), `RateLimitError` (429, `.retry_after`),
`ApiError` (other), `ConnectionError` (network).

GET requests retry on 429 / 5xx; POSTs never retry.

### Webhooks (Flask)

```python
from flask import Flask, request, abort
from bermi_connect import verify_signature

@app.post("/hooks/bermi")
def hook():
    if not verify_signature(request.get_data(), request.headers.get("X-Bermi-Signature"), SECRET):
        abort(401)
    event = request.get_json()
    return "", 200
```

### Helpers

`normalize_phone("0712 345 678")` returns `"+255712345678"`; `count_segments(text)` returns `{"encoding", "segments", "length"}`.

## Tests

```bash
python -m unittest discover -s tests -v   # runs against a local mock HTTP server, fully offline
```
