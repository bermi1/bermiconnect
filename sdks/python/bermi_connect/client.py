"""Bermi Connect HTTP client built on urllib (no third-party dependencies)."""
import hashlib
import hmac
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Union

from . import errors

VERSION = "1.0.0"
DEFAULT_BASE_URL = "https://api.bermiconnect.co.tz/v1"


def _iso(v: Union[str, datetime, None]) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def _clean(d: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


class _Http:
    def __init__(self, api_key: str, base_url: str, timeout: float, max_retries: int):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries

    def request(self, method: str, path: str, body: Any = None, query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = self.base_url + path
        if query:
            q = {k: v for k, v in query.items() if v is not None and v != ""}
            if q:
                url += "?" + urllib.parse.urlencode(q)
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "User-Agent": f"bermi-connect-python/{VERSION}",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"

        retries = self.max_retries if method == "GET" else 0
        attempt = 0
        while True:
            req = urllib.request.Request(url, data=data, method=method, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    raw = resp.read()
                    return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as e:
                raw = e.read()
                status = e.code
                retry_after = e.headers.get("Retry-After") if e.headers else None
                if (status == 429 or status >= 500) and attempt < retries:
                    time.sleep(float(retry_after) if retry_after and retry_after.replace(".", "", 1).isdigit()
                               else min(0.25 * 2 ** attempt, 4))
                    attempt += 1
                    continue
                raise self._error(status, raw, retry_after)
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                if attempt < retries:
                    time.sleep(min(0.25 * 2 ** attempt, 4))
                    attempt += 1
                    continue
                raise errors.ConnectionError(str(getattr(e, "reason", e)), "connection_error", 0)

    @staticmethod
    def _error(status: int, raw: bytes, retry_after: Optional[str]) -> errors.BermiError:
        try:
            payload = json.loads(raw) if raw else {}
        except ValueError:
            payload = {}
        err = payload.get("error") or {}
        code = err.get("code") or ("rate_limited" if status == 429 else "api_error")
        message = err.get("message") or f"HTTP {status}"
        details = err.get("details")
        cls = errors.BY_CODE.get(code) or errors.BY_STATUS.get(status) or errors.ApiError
        if cls is errors.RateLimitError:
            ra = float(retry_after) if retry_after and retry_after.replace(".", "", 1).isdigit() else None
            return errors.RateLimitError(message, code, status, details, ra)
        return cls(message, code, status, details)


class _Sms:
    def __init__(self, http: _Http):
        self._http = http

    def send(self, to: Union[str, Sequence[str]], message: str, sender_id: Optional[str] = None,
             reference: Optional[str] = None, schedule_at: Union[str, datetime, None] = None) -> Dict[str, Any]:
        """Send to one number or up to 1000. Returns {batch_id, messages, total_cost_tzs}."""
        if not isinstance(to, str):
            to = list(to)
        body = _clean({"to": to, "message": message, "sender_id": sender_id,
                       "reference": reference, "schedule_at": _iso(schedule_at)})
        return self._http.request("POST", "/sms/send", body)["data"]

    def get(self, message_id: str) -> Dict[str, Any]:
        return self._http.request("GET", "/sms/" + urllib.parse.quote(message_id, safe=""))["data"]

    def list(self, status: Optional[str] = None, from_: Union[str, datetime, None] = None,
             to: Union[str, datetime, None] = None, campaign_id: Optional[str] = None,
             page: Optional[int] = None, per_page: Optional[int] = None) -> Dict[str, Any]:
        """Returns {"data": [...messages], "meta": {page, per_page, total}}."""
        r = self._http.request("GET", "/sms", query={
            "status": status, "from": _iso(from_), "to": _iso(to), "campaign_id": campaign_id,
            "page": page, "per_page": per_page})
        return {"data": r.get("data", []), "meta": r.get("meta")}


class _Otp:
    def __init__(self, http: _Http):
        self._http = http

    def send(self, phone: str, sender_id: Optional[str] = None, length: Optional[int] = None,
             expires_in: Optional[int] = None, template: Optional[str] = None) -> Dict[str, Any]:
        body = _clean({"phone": phone, "sender_id": sender_id, "length": length,
                       "expires_in": expires_in, "template": template})
        return self._http.request("POST", "/otp/send", body)["data"]

    def verify(self, otp_id: str, code: str) -> bool:
        return bool(self._http.request("POST", "/otp/verify", {"otp_id": otp_id, "code": str(code)})["data"]["verified"])


class _Balance:
    def __init__(self, http: _Http):
        self._http = http

    def get(self) -> Dict[str, Any]:
        return self._http.request("GET", "/balance")["data"]


def verify_signature(raw_body: Union[bytes, str], signature_header: Optional[str], secret: str) -> bool:
    """Check `X-Bermi-Signature: sha256=<hex>` against the RAW request body (bytes as received)."""
    if not signature_header or not secret:
        return False
    if isinstance(raw_body, str):
        raw_body = raw_body.encode("utf-8")
    provided = re.sub(r"^sha256=", "", signature_header.strip(), flags=re.I).lower()
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(provided, expected)


class _Webhooks:
    verify_signature = staticmethod(verify_signature)
    verifySignature = staticmethod(verify_signature)


class BermiConnect:
    """
    client = BermiConnect("bc_live_...")
    client.sms.send(to="0712345678", message="Habari!")
    """

    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL, timeout: float = 30.0, max_retries: int = 2):
        if not api_key:
            raise ValueError("api_key is required")
        self._http = _Http(api_key, base_url, timeout, max_retries)
        self.test_mode = api_key.startswith("bc_test_")
        self.sms = _Sms(self._http)
        self.otp = _Otp(self._http)
        self.balance = _Balance(self._http)
        self.webhooks = _Webhooks()


# ---------------------------------------------------------------- helpers

def normalize_phone(value: str, default_country: str = "255") -> Optional[str]:
    """Normalise 07xx / 06xx / 7xx / 2557xx / +2557xx to E.164. Returns None if invalid."""
    s = re.sub(r"[\s\-().]", "", str(value).strip())
    if s.startswith("00"):
        s = "+" + s[2:]
    if s.startswith("+"):
        return s if re.fullmatch(r"\+[1-9]\d{7,14}", s) else None
    if not s.isdigit():
        return None
    if s.startswith(default_country) and len(s) == len(default_country) + 9:
        return "+" + s
    if s.startswith("0") and len(s) == 10:
        return "+" + default_country + s[1:]
    if re.fullmatch(r"[67]\d{8}", s):
        return "+" + default_country + s
    return None


_GSM7 = set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")
_GSM7_EXT = set("^{}\\[~]|€\f")


def count_segments(text: str) -> Dict[str, Any]:
    """Return {"encoding", "segments", "length"} using the same rules the API bills with."""
    septets = 0
    for ch in text:
        if ch in _GSM7:
            septets += 1
        elif ch in _GSM7_EXT:
            septets += 2
        else:
            units = len(text.encode("utf-16-le")) // 2
            return {"encoding": "UCS2", "length": units, "segments": 1 if units <= 70 else -(-units // 67)}
    segs = 0 if septets == 0 else (1 if septets <= 160 else -(-septets // 153))
    return {"encoding": "GSM7", "length": septets, "segments": segs}
