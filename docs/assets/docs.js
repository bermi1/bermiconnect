/* Bermi Connect docs — behaviour: code samples, tabs, copy, composer, try-it, nav. No dependencies. */
(function () {
  "use strict";

  var BASE = "https://api.bermiconnect.co.tz/v1";
  var KEY = "bc_test_xxxxxxxxxxxxxxxx";
  var LANGS = [
    ["curl", "cURL"],
    ["js", "JavaScript"],
    ["python", "Python"],
    ["php", "PHP"],
  ];

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  // ------------------------------------------------------------ sample builders
  function j(o, ind) { return JSON.stringify(o, null, ind == null ? 2 : ind); }
  function pyLit(v, ind) {
    ind = ind || "";
    if (v === null) return "None";
    if (v === true) return "True";
    if (v === false) return "False";
    if (Array.isArray(v)) return "[" + v.map(function (x) { return pyLit(x, ind); }).join(", ") + "]";
    if (typeof v === "object") {
      var inner = ind + "    ";
      return "{\n" + Object.keys(v).map(function (k) { return inner + JSON.stringify(k) + ": " + pyLit(v[k], inner); }).join(",\n") + ",\n" + ind + "}";
    }
    return JSON.stringify(v);
  }
  function phpLit(v, ind) {
    ind = ind || "";
    if (v === null) return "null";
    if (typeof v === "boolean") return String(v);
    if (typeof v === "string") return "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
    if (typeof v === "number") return String(v);
    if (Array.isArray(v)) return "[" + v.map(function (x) { return phpLit(x, ind); }).join(", ") + "]";
    var inner = ind + "    ";
    return "[\n" + Object.keys(v).map(function (k) { return inner + "'" + k + "' => " + phpLit(v[k], inner); }).join(",\n") + ",\n" + ind + "]";
  }
  function pyKw(o, ind) {
    return Object.keys(o).map(function (k) { return ind + k + "=" + pyLit(o[k], ind) + ","; }).join("\n");
  }

  /** Generic raw-HTTP samples (used where there is no SDK helper). */
  function raw(method, path, body) {
    var hasBody = body !== undefined;
    var curl = "curl -X " + method + " " + BASE + path + " \\\n  -H \"Authorization: Bearer $BERMI_API_KEY\"" +
      (hasBody ? " \\\n  -H \"Content-Type: application/json\" \\\n  -d '" + j(body).replace(/'/g, "'\\''") + "'" : "");
    var js = "const res = await fetch(\"" + BASE + path + "\", {\n  method: \"" + method + "\",\n  headers: {\n    Authorization: `Bearer ${process.env.BERMI_API_KEY}`," +
      (hasBody ? "\n    \"Content-Type\": \"application/json\"," : "") + "\n  }," +
      (hasBody ? "\n  body: JSON.stringify(" + j(body).replace(/\n/g, "\n  ") + ")," : "") +
      "\n});\nconst { data, error } = await res.json();";
    var py = "import json, os, urllib.request\n\nreq = urllib.request.Request(\n    \"" + BASE + path + "\",\n    method=\"" + method + "\",\n" +
      (hasBody ? "    data=json.dumps(" + pyLit(body, "    ") + ").encode(),\n" : "") +
      "    headers={\"Authorization\": f\"Bearer {os.environ['BERMI_API_KEY']}\"" + (hasBody ? ", \"Content-Type\": \"application/json\"" : "") + "},\n)\nwith urllib.request.urlopen(req) as res:\n    data = json.load(res)[\"data\"]";
    var php = "$ch = curl_init('" + BASE + path + "');\ncurl_setopt_array($ch, [\n    CURLOPT_CUSTOMREQUEST => '" + method + "',\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_HTTPHEADER => [\n        'Authorization: Bearer ' . getenv('BERMI_API_KEY'),\n" +
      (hasBody ? "        'Content-Type: application/json',\n    ],\n    CURLOPT_POSTFIELDS => json_encode(" + phpLit(body, "    ") + "),\n" : "    ],\n") +
      "]);\n$data = json_decode(curl_exec($ch), true)['data'];";
    return { curl: curl, js: js, python: py, php: php };
  }

  var JS_INIT = "import { BermiConnect } from \"bermi-connect\";\n\nconst bc = new BermiConnect({ apiKey: process.env.BERMI_API_KEY });\n\n";
  var PY_INIT = "import os\nfrom bermi_connect import BermiConnect\n\nbc = BermiConnect(os.environ[\"BERMI_API_KEY\"])\n\n";
  var PHP_INIT = "<?php\nuse BermiTechs\\BermiConnect\\BermiConnect;\n\n$bc = new BermiConnect(getenv('BERMI_API_KEY'));\n\n";

  function sdkSend(body) {
    var r = raw("POST", "/sms/send", body);
    var jsArgs = j(body).replace(/"([a-z_]+)":/g, "$1:");
    r.js = JS_INIT + "const result = await bc.sms.send(" + jsArgs + ");\nconsole.log(result.batch_id, result.total_cost_tzs);";
    r.python = PY_INIT + "result = bc.sms.send(\n" + pyKw(body, "    ") + "\n)\nprint(result[\"batch_id\"], result[\"total_cost_tzs\"])";
    r.php = PHP_INIT + "$result = $bc->sms->send(" + phpLit(body) + ");\necho $result['batch_id'];";
    return r;
  }

  var SAMPLES = {
    "quick-send": sdkSend({ to: "0712345678", message: "Karibu Bermi Connect!" }),
    "sms-send": sdkSend({ to: "0712345678", message: "Habari! Mkutano wa wazazi ni Jumamosi saa 3 asubuhi.", sender_id: "KIBASILA", reference: "meeting-2026-11" }),
    "sms-bulk": sdkSend({ to: ["0712345678", "+255754000111", "255688123456"], message: "Fee reminder: term 3 fees are due on 30 Nov.", sender_id: "KIBASILA" }),
    "sms-schedule": sdkSend({ to: "0712345678", message: "Exam results are now available on the portal.", schedule_at: "2026-11-20T07:00:00+03:00" }),
    "sms-get": (function () {
      var r = raw("GET", "/sms/0b9a3c2e-1d4f-4e8a-b0c1-7f6e5d4c3b2a");
      r.js = JS_INIT + "const msg = await bc.sms.get(\"0b9a3c2e-1d4f-4e8a-b0c1-7f6e5d4c3b2a\");\nconsole.log(msg.status); // queued | sent | delivered | failed | rejected";
      r.python = PY_INIT + "msg = bc.sms.get(\"0b9a3c2e-1d4f-4e8a-b0c1-7f6e5d4c3b2a\")\nprint(msg[\"status\"])";
      r.php = PHP_INIT + "$msg = $bc->sms->get('0b9a3c2e-1d4f-4e8a-b0c1-7f6e5d4c3b2a');\necho $msg['status'];";
      return r;
    })(),
    "sms-list": (function () {
      var r = raw("GET", "/sms?status=failed&from=2026-11-01&page=1&per_page=50");
      r.js = JS_INIT + "const { data, meta } = await bc.sms.list({ status: \"failed\", from: \"2026-11-01\", per_page: 50 });\nconsole.log(`${meta.total} failed messages`);";
      r.python = PY_INIT + "page = bc.sms.list(status=\"failed\", from_=\"2026-11-01\", per_page=50)\nprint(page[\"meta\"][\"total\"])";
      r.php = PHP_INIT + "$page = $bc->sms->list(['status' => 'failed', 'from' => '2026-11-01', 'per_page' => 50]);\necho $page['meta']['total'];";
      return r;
    })(),
    "otp-send": (function () {
      var body = { phone: "0712345678", length: 6, expires_in: 300, template: "Your Duka code is {{code}}. It expires in 5 minutes." };
      var r = raw("POST", "/otp/send", body);
      r.js = JS_INIT + "const { otp_id, expires_at } = await bc.otp.send(" + j(body).replace(/"([a-z_]+)":/g, "$1:") + ");\n// store otp_id in the user's session";
      r.python = PY_INIT + "otp = bc.otp.send(\n" + pyKw(body, "    ") + "\n)\nsession[\"otp_id\"] = otp[\"otp_id\"]";
      r.php = PHP_INIT + "$otp = $bc->otp->send(" + phpLit(body) + ");\n$_SESSION['otp_id'] = $otp['otp_id'];";
      return r;
    })(),
    "otp-verify": (function () {
      var body = { otp_id: "9d2f0c1a-8b7e-4c6d-a5f4-3e2d1c0b9a87", code: "482913" };
      var r = raw("POST", "/otp/verify", body);
      r.js = JS_INIT + "const verified = await bc.otp.verify(otpId, codeFromUser);\nif (!verified) throw new Error(\"Wrong or expired code\");";
      r.python = PY_INIT + "if not bc.otp.verify(session[\"otp_id\"], code_from_user):\n    raise ValueError(\"Wrong or expired code\")";
      r.php = PHP_INIT + "if (!$bc->otp->verify($_SESSION['otp_id'], $_POST['code'])) {\n    http_response_code(400); exit('Wrong or expired code');\n}";
      return r;
    })(),
    "balance": (function () {
      var r = raw("GET", "/balance");
      r.js = JS_INIT + "const { balance_tzs, price_per_sms_tzs } = await bc.balance.get();\nconsole.log(`~${Math.floor(balance_tzs / price_per_sms_tzs)} SMS left`);";
      r.python = PY_INIT + "b = bc.balance.get()\nprint(b[\"balance_tzs\"] // b[\"price_per_sms_tzs\"], \"SMS left\")";
      r.php = PHP_INIT + "$b = $bc->balance->get();\necho intdiv((int) $b['balance_tzs'], (int) $b['price_per_sms_tzs']) . ' SMS left';";
      return r;
    })(),
    "webhook-create": raw("POST", "/webhooks", { url: "https://example.co.tz/hooks/bermi", events: ["message.delivered", "message.failed", "message.inbound"] }),
    "campaign-create": raw("POST", "/campaigns", { name: "Term 3 fee reminder", sender_id: "KIBASILA", body: "Habari {{first_name}}, ada ya {{student}} inadaiwa kabla ya 30 Nov.", group_ids: ["3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"], scheduled_at: "2026-11-20T07:00:00+03:00" }),
    "campaign-send": raw("POST", "/campaigns/{id}/send"),
    "webhook-verify": {
      curl: "# Compute the expected signature for a saved payload file\nSECRET=whsec_xxx\nprintf '%s' \"$(cat payload.json)\" \\\n  | openssl dgst -sha256 -hmac \"$SECRET\" -hex \\\n  | sed 's/^.* /sha256=/'",
      js: "import express from \"express\";\nimport crypto from \"node:crypto\";\n\nconst app = express();\n\n// Use the RAW body. Re-serialising parsed JSON changes bytes and breaks the signature.\napp.post(\"/hooks/bermi\", express.raw({ type: \"application/json\" }), (req, res) => {\n  const header = req.get(\"X-Bermi-Signature\") || \"\";\n  const expected = \"sha256=\" + crypto\n    .createHmac(\"sha256\", process.env.BERMI_WEBHOOK_SECRET)\n    .update(req.body)\n    .digest(\"hex\");\n\n  const ok = header.length === expected.length &&\n    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));\n  if (!ok) return res.sendStatus(401);\n\n  const { event, data } = JSON.parse(req.body.toString(\"utf8\"));\n  if (event === \"message.delivered\") markDelivered(data.id, data.reference);\n  res.sendStatus(200); // respond fast; do heavy work in a queue\n});\n\n// Or with the SDK:\n// import { BermiConnect } from \"bermi-connect\";\n// await BermiConnect.verifySignature(req.body, header, secret);",
      python: "import hashlib, hmac, os\nfrom flask import Flask, request, abort\n\napp = Flask(__name__)\nSECRET = os.environ[\"BERMI_WEBHOOK_SECRET\"].encode()\n\n@app.post(\"/hooks/bermi\")\ndef bermi_hook():\n    raw = request.get_data()  # bytes exactly as received\n    expected = \"sha256=\" + hmac.new(SECRET, raw, hashlib.sha256).hexdigest()\n    if not hmac.compare_digest(expected, request.headers.get(\"X-Bermi-Signature\", \"\")):\n        abort(401)\n    event = request.get_json()\n    if event[\"event\"] == \"message.failed\":\n        notify_ops(event[\"data\"])\n    return \"\", 200\n\n# Or with the SDK:\n# from bermi_connect import verify_signature\n# verify_signature(raw, request.headers.get(\"X-Bermi-Signature\"), SECRET)",
      php: "<?php\n$raw = file_get_contents('php://input');\n$header = $_SERVER['HTTP_X_BERMI_SIGNATURE'] ?? '';\n$expected = 'sha256=' . hash_hmac('sha256', $raw, getenv('BERMI_WEBHOOK_SECRET'));\n\nif (!hash_equals($expected, $header)) {\n    http_response_code(401);\n    exit;\n}\n\n$event = json_decode($raw, true);\nif ($event['event'] === 'message.inbound' && strtoupper(trim($event['data']['body'])) === 'STOP') {\n    // already opted out by Bermi Connect; mirror it in your CRM\n}\nhttp_response_code(200);\n\n// Or with the SDK:\n// BermiTechs\\BermiConnect\\Webhooks::verifySignature($raw, $header, $secret);",
    },
    "install": {
      curl: "# No install needed. Every example uses:\nexport BERMI_API_KEY=bc_test_xxxxxxxxxxxxxxxx",
      js: "npm install bermi-connect",
      python: "pip install bermi_connect",
      php: "composer require bermitechs/bermi-connect",
    },
  };

  // ------------------------------------------------------------ highlighting (tiny, safe)
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function highlight(src, lang) {
    var out = "", i = 0, n = src.length;
    var commentRe = lang === "python" || lang === "curl" ? /^#[^\n]*/ : /^\/\/[^\n]*/;
    var kw = {
      js: /^(?:const|let|await|async|import|from|return|if|throw|new|export|function)\b/,
      python: /^(?:import|from|def|return|if|not|raise|with|as|print)\b/,
      php: /^(?:use|new|echo|if|exit|return|function)\b/,
      curl: /^(?:curl|export|printf|openssl|sed)\b/,
    }[lang];
    while (i < n) {
      var rest = src.slice(i), m;
      if ((m = rest.match(commentRe)) && (i === 0 || /[\s(]/.test(src[i - 1]))) { out += "<span class=\"c\">" + esc(m[0]) + "</span>"; i += m[0].length; continue; }
      if ((m = rest.match(/^("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/))) { out += "<span class=\"s\">" + esc(m[0]) + "</span>"; i += m[0].length; continue; }
      if ((i === 0 || !/[\w$]/.test(src[i - 1])) && kw && (m = rest.match(kw))) { out += "<span class=\"k\">" + m[0] + "</span>"; i += m[0].length; continue; }
      out += esc(src[i]); i++;
    }
    return out;
  }

  // ------------------------------------------------------------ code blocks
  var preferred = store.get("bc-lang") || "curl";
  var uid = 0;
  function renderCode(el) {
    var key = el.getAttribute("data-sample");
    var sample = SAMPLES[key];
    if (!sample) return;
    uid++;
    var tabs = document.createElement("div");
    tabs.className = "code-tabs";
    tabs.setAttribute("role", "tablist");
    var panes = [];
    LANGS.forEach(function (l, idx) {
      if (!sample[l[0]]) return;
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.textContent = l[1];
      b.id = "t" + uid + "-" + l[0]; b.setAttribute("aria-controls", "p" + uid + "-" + l[0]);
      b.dataset.lang = l[0];
      tabs.appendChild(b);
      var pre = document.createElement("pre");
      pre.id = "p" + uid + "-" + l[0]; pre.setAttribute("role", "tabpanel"); pre.setAttribute("aria-labelledby", b.id); pre.tabIndex = 0;
      pre.dataset.lang = l[0];
      var code = document.createElement("code");
      code.innerHTML = highlight(sample[l[0]], l[0]);
      pre.appendChild(code);
      panes.push(pre);
    });
    var copy = document.createElement("button");
    copy.type = "button"; copy.className = "copy-btn"; copy.textContent = "Copy";
    tabs.appendChild(copy);
    el.classList.add("code");
    el.appendChild(tabs);
    panes.forEach(function (p) { el.appendChild(p); });

    copy.addEventListener("click", function () {
      var active = el.querySelector("pre:not([hidden])");
      var text = active ? sample[active.dataset.lang] : "";
      var done = function () { copy.textContent = "Copied"; copy.classList.add("done"); setTimeout(function () { copy.textContent = "Copy"; copy.classList.remove("done"); }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
      function fallback() {
        var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { copy.textContent = "Press Ctrl+C"; }
        document.body.removeChild(ta);
      }
    });
    tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button[role=tab]");
      if (!b) return;
      preferred = b.dataset.lang; store.set("bc-lang", preferred);
      document.querySelectorAll(".code[data-sample]").forEach(function (blk) { select(blk, preferred); });
    });
    tabs.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var list = Array.prototype.slice.call(tabs.querySelectorAll("button[role=tab]"));
      var i = list.indexOf(document.activeElement); if (i < 0) return;
      var next = list[(i + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length];
      next.focus(); next.click();
    });
    select(el, preferred);
  }
  function select(el, lang) {
    var tabs = el.querySelectorAll("button[role=tab]");
    var has = el.querySelector("button[data-lang=\"" + lang + "\"]");
    if (!has) lang = tabs[0] && tabs[0].dataset.lang;
    tabs.forEach(function (t) { var on = t.dataset.lang === lang; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; });
    el.querySelectorAll("pre[role=tabpanel]").forEach(function (p) { p.hidden = p.dataset.lang !== lang; });
  }

  // Static JSON blocks (responses) — highlight + copy.
  function renderStatic(el) {
    var src = el.textContent.replace(/^\n/, "");
    var title = el.getAttribute("data-title") || "Response";
    el.textContent = "";
    el.classList.add("code");
    var bar = document.createElement("div"); bar.className = "code-tabs";
    var t = document.createElement("span"); t.className = "code-title"; t.textContent = title; bar.appendChild(t);
    var copy = document.createElement("button"); copy.type = "button"; copy.className = "copy-btn"; copy.textContent = "Copy"; bar.appendChild(copy);
    var pre = document.createElement("pre"); pre.tabIndex = 0; var code = document.createElement("code");
    code.innerHTML = highlight(src, el.getAttribute("data-lang") || "js"); pre.appendChild(code);
    el.appendChild(bar); el.appendChild(pre);
    copy.addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(src).then(function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy"; }, 1600); });
    });
  }

  // ------------------------------------------------------------ segment math (mirrors backend billing)
  var GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  var EXT = "^{}\\[~]|€\f";
  function segments(text) {
    var sept = 0, bad = null;
    for (var ch of text) {
      if (GSM.indexOf(ch) >= 0) sept += 1;
      else if (EXT.indexOf(ch) >= 0) sept += 2;
      else { bad = ch; break; }
    }
    if (bad === null) {
      var s = sept === 0 ? 0 : sept <= 160 ? 1 : Math.ceil(sept / 153);
      var cap = s <= 1 ? 160 : s * 153;
      return { enc: "GSM7", len: sept, seg: s, cap: cap, per: s <= 1 ? 160 : 153 };
    }
    var u = text.length, s2 = u <= 70 ? 1 : Math.ceil(u / 67);
    return { enc: "UCS2", len: u, seg: s2, cap: s2 <= 1 ? 70 : s2 * 67, per: s2 <= 1 ? 70 : 67, culprit: bad };
  }

  function composer() {
    var ta = document.getElementById("composer-input");
    if (!ta) return;
    var bubble = document.getElementById("composer-bubble");
    var segEl = document.getElementById("composer-segs");
    var encEl = document.getElementById("composer-enc");
    var lenEl = document.getElementById("composer-len");
    var costEl = document.getElementById("composer-cost");
    var segCount = document.getElementById("composer-segcount");
    var note = document.getElementById("composer-note");
    var price = Number(ta.getAttribute("data-price") || 18);
    function update() {
      var text = ta.value;
      var r = segments(text);
      bubble.textContent = text || "Your message preview appears here.";
      encEl.textContent = r.enc === "GSM7" ? "GSM-7" : "UCS-2";
      encEl.classList.toggle("ucs2", r.enc === "UCS2");
      lenEl.textContent = r.len + " / " + r.cap;
      segCount.textContent = r.seg;
      costEl.innerHTML = "TZS " + (r.seg * price).toLocaleString("en-US") + "<small>per recipient</small>";
      segEl.innerHTML = "";
      var shown = Math.max(1, Math.min(r.seg, 8));
      for (var i = 0; i < shown; i++) {
        var b = document.createElement("i");
        if (i === shown - 1 && r.seg > 0) {
          var used = r.len - (r.seg - 1) * r.per;
          var fill = Math.max(4, Math.min(100, Math.round(used / r.per * 100)));
          if (fill < 100) { b.className = "partial"; b.style.setProperty("--fill", fill + "%"); }
        }
        if (r.seg === 0) { b.className = "partial"; b.style.setProperty("--fill", "0%"); }
        if (r.enc === "UCS2") b.classList.add("over");
        segEl.appendChild(b);
      }
      if (r.enc === "UCS2") note.textContent = "“" + r.culprit + "” is outside the GSM-7 alphabet, so the whole message switches to UCS-2 (70 characters per SMS).";
      else if (r.seg > 1) note.textContent = "Long messages are split into " + r.seg + " parts of 153 characters and joined on the phone.";
      else note.textContent = "";
    }
    ta.addEventListener("input", update);
    document.querySelectorAll("[data-composer-preset]").forEach(function (b) {
      b.addEventListener("click", function () { ta.value = b.getAttribute("data-composer-preset"); update(); ta.focus(); });
    });
    update();
  }

  // ------------------------------------------------------------ try it
  var TRY = {
    "sms-send": { method: "POST", path: "/sms/send", body: { to: "0712345678", message: "Habari kutoka Bermi Connect!" } },
    "sms-bulk": { method: "POST", path: "/sms/send", body: { to: ["0712345678", "0754000111"], message: "Fee reminder: term 3 fees are due on 30 Nov." } },
    "sms-schedule": { method: "POST", path: "/sms/send", body: { to: "0712345678", message: "Reminder: parents meeting tomorrow 9am.", schedule_at: new Date(Date.now() + 36e5).toISOString() } },
    "sms-get": { method: "GET", path: "/sms/{id}" },
    "sms-list": { method: "GET", path: "/sms?per_page=10" },
    "otp-send": { method: "POST", path: "/otp/send", body: { phone: "0712345678" } },
    "otp-verify": { method: "POST", path: "/otp/verify", body: { otp_id: "", code: "" } },
    "balance": { method: "GET", path: "/balance" },
  };
  function tryPanel() {
    var panel = document.getElementById("try-panel");
    if (!panel) return;
    var scrim = document.getElementById("scrim");
    var f = {
      base: document.getElementById("try-base"), key: document.getElementById("try-key"),
      method: document.getElementById("try-method"), path: document.getElementById("try-path"),
      body: document.getElementById("try-body"), out: document.getElementById("try-out"),
      status: document.getElementById("try-status"), send: document.getElementById("try-send"),
      remember: document.getElementById("try-remember"),
    };
    f.base.value = store.get("bc-base") || "http://localhost:4000/v1";
    var savedKey = null; try { savedKey = window.sessionStorage.getItem("bc-key"); } catch (e) { /* ignore */ }
    if (savedKey) { f.key.value = savedKey; f.remember.checked = true; }
    var lastFocus = null;
    function open(id) {
      var t = TRY[id] || TRY["sms-send"];
      f.method.value = t.method; f.path.value = t.path;
      f.body.value = t.body ? j(t.body) : "";
      f.body.parentElement.hidden = t.method === "GET";
      lastFocus = document.activeElement;
      panel.classList.add("open"); scrim.classList.add("show"); panel.setAttribute("aria-hidden", "false");
      (f.key.value ? f.send : f.key).focus();
    }
    function close() {
      panel.classList.remove("open"); scrim.classList.remove("show"); panel.setAttribute("aria-hidden", "true");
      if (lastFocus) lastFocus.focus();
    }
    document.querySelectorAll("[data-try]").forEach(function (b) { b.addEventListener("click", function () { open(b.getAttribute("data-try")); }); });
    document.getElementById("try-close").addEventListener("click", close);
    scrim.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("open")) close(); });
    f.method.addEventListener("change", function () { f.body.parentElement.hidden = f.method.value === "GET"; });
    f.send.addEventListener("click", function () {
      var base = f.base.value.trim().replace(/\/+$/, "");
      var key = f.key.value.trim();
      store.set("bc-base", base);
      try { if (f.remember.checked) window.sessionStorage.setItem("bc-key", key); else window.sessionStorage.removeItem("bc-key"); } catch (e) { /* ignore */ }
      if (!key) { f.status.className = "status err"; f.status.textContent = "Add an API key first. Use a bc_test_ key to avoid charges."; f.key.focus(); return; }
      if (/\{id\}/.test(f.path.value)) { f.status.className = "status err"; f.status.textContent = "Replace {id} in the path with a message id."; f.path.focus(); return; }
      var init = { method: f.method.value, headers: { Authorization: "Bearer " + key, Accept: "application/json" } };
      if (f.method.value !== "GET" && f.body.value.trim()) {
        try { JSON.parse(f.body.value); } catch (e) { f.status.className = "status err"; f.status.textContent = "Body is not valid JSON: " + e.message; return; }
        init.headers["Content-Type"] = "application/json"; init.body = f.body.value;
      }
      f.status.className = "status"; f.status.textContent = "Sending…"; f.out.textContent = "";
      f.send.disabled = true;
      var t0 = performance.now();
      fetch(base + f.path.value, init).then(function (res) {
        return res.text().then(function (txt) {
          var ms = Math.round(performance.now() - t0);
          f.status.className = "status " + (res.ok ? "ok" : "err");
          f.status.textContent = res.status + " " + (res.statusText || "") + " · " + ms + " ms";
          var pretty = txt; try { pretty = j(JSON.parse(txt)); } catch (e) { /* not json */ }
          f.out.innerHTML = highlight(pretty || "(empty body)", "js");
          var parsed = null; try { parsed = JSON.parse(txt); } catch (e) { /* ignore */ }
          if (parsed && parsed.data && parsed.data.otp_id) TRY["otp-verify"].body.otp_id = parsed.data.otp_id;
          if (parsed && parsed.data && parsed.data.messages && parsed.data.messages[0]) TRY["sms-get"].path = "/sms/" + parsed.data.messages[0].id;
        });
      }).catch(function (err) {
        f.status.className = "status err";
        f.status.textContent = "Request failed: " + err.message + ". Check the base URL and that the API allows CORS from this page.";
      }).finally(function () { f.send.disabled = false; });
    });
  }

  // ------------------------------------------------------------ nav: scrollspy, search, mobile, theme
  function nav() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".sidebar a[href^='#']"));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && map[en.target.id]) {
            links.forEach(function (l) { l.classList.remove("active"); l.removeAttribute("aria-current"); });
            map[en.target.id].classList.add("active"); map[en.target.id].setAttribute("aria-current", "true");
          }
        });
      }, { rootMargin: "-70px 0px -70% 0px" });
      Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
    }
    var search = document.querySelector(".sidebar .search");
    if (search) search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      links.forEach(function (a) { a.parentElement.hidden = q && a.textContent.toLowerCase().indexOf(q) < 0; });
      document.querySelectorAll(".sidebar h4").forEach(function (h) {
        var ul = h.nextElementSibling; var any = ul && ul.querySelector("li:not([hidden])");
        h.hidden = !any;
      });
    });
    var sb = document.querySelector(".sidebar");
    var toggle = document.querySelector(".menu-toggle");
    if (toggle && sb) {
      toggle.addEventListener("click", function () { var o = sb.classList.toggle("open"); toggle.setAttribute("aria-expanded", o); });
      sb.addEventListener("click", function (e) { if (e.target.closest("a")) { sb.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); } });
    }
    var th = document.getElementById("theme-toggle");
    var saved = store.get("bc-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    if (th) th.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next); store.set("bc-theme", next);
    });
    document.querySelectorAll(".content h2[id], .content h3[id], .content section[id] > h2").forEach(function (h) {
      var id = h.id || h.parentElement.id; if (!id || h.querySelector(".anchor")) return;
      var a = document.createElement("a"); a.className = "anchor"; a.href = "#" + id; a.textContent = "#"; a.setAttribute("aria-label", "Link to this section");
      h.appendChild(a);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-sample]").forEach(renderCode);
    document.querySelectorAll("[data-static]").forEach(renderStatic);
    composer();
    tryPanel();
    nav();
  });

  window.BermiDocs = { segments: segments, SAMPLES: SAMPLES };
})();
