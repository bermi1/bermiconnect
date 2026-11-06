# Bermi Connect: Evaluation and Decision Plan

*Evaluator, 5 Nov 2026. Inputs: `research/market.md`, `research/fields.md`, `research/sample-results-form2.csv`, `SPEC.md`, `backend/README.md`, `backend/migrations/001_init.sql`, `frontend/src/pages/*`. The founder has paused building this round, so §4 is a short build list with no acceptance criteria, and the marketing brief is dropped. Where this document disagrees with the reports, it says so and explains why.*

**Evidence grades used throughout**
- **P (primary):** the regulator, the vendor's own page or price list, a census, or a study abstract.
- **S (secondary):** press or a third-party blog reporting a primary source.
- **U (unverified):** an assumption, absence of evidence, or a single anecdote.

---

## 1. Evidence evaluation

### 1.1 Major claims, graded

| # | Claim | Report | Grade | Verdict |
|---|---|---|---|---|
| 1 | 116.85M SIMs; SMS flat (−0.05% QoQ); voice +7.44% (Q2 2026) | market | **S** (TanzaniaInvest reporting TCRA) | Trust. This is the newest figure. "SMS is flat" holds, but SMS is still 55B a quarter, so it is not dying. |
| 2 | Smartphone penetration 44.74% (Jun 2026) vs 37% (Jun 2025) | market vs fields | **S** both | **Use 44.74%.** It is a year newer and the two figures do not conflict (+8 points in a year is plausible). fields.md's "≈63% are on feature phones" is a bad inference: penetration is per population and feature-phone penetration is 83% on a different basis, so the two do not add to 100. Say "fewer than half have a smartphone". |
| 3 | 99.3M subscriptions (Sep 2025) vs 116.85M (Jun 2026); mobile money 68.1M vs 87.05M | fields vs market | **S** | Different dates, not a contradiction. Use the 2026 figures. |
| 4 | Adult literacy 83% (≈1 in 6 cannot read) | both | **P** (NBS 2022 census) in market; fields cites the same figure via press | Trust, but it measures literacy in *any* language. Nobody has measured whether people can read *an SMS in Swahili*. The voice case leans on this number harder than it can bear. |
| 5 | Local price band TZS 13–25; TZS 18 is "competitive, not distinctive" | market | Mixed: **P** for Flex 17, HelloDuty 19, Celcom ≈23, Sakura 25; **stale S (2021)** for NextSMS 13–16, Beem 17–25, AT 20–22 | Conclusion holds: price is not a moat. The cheapest rivals' 2021 prices may have fallen further, so do not market "cheapest". |
| 6 | Twilio $0.4336/segment to TZ | market | **P** | Trust. The arbitrage behind the "global API" idea is real. |
| 7 | Unregistered sender IDs blocked since 16 Jun 2025; registration is per operator | both | **S** (Twilio guidelines, Telerivet) | Trust. It is consistent across independent sources. |
| 8 | Sender ID approval takes 3–10 business days, or 2–4 weeks | market / fields | **S/vendor** | Contradictory. Tell customers **2–4 weeks**, the conservative figure. |
| 9 | PDPC registration deadline 8 Apr 2026; enforcement from 9 Apr; inspections from late Aug 2026; fines up to TZS 5bn | market | **S** (The Chanzo, The Citizen) | Trust. **It applies to Bermi today.** It is not a future launch item. |
| 10 | A cross-border data transfer needs a PDPC permit (reg. 20) | both | **S** (Afriwise legal blog) | Trust as the direction of the law; confirm with a lawyer. It covers *hosting*, not only AI calls (see §6). |
| 11 | No national DND registry | both | **S** (Telerivet) | Trust. |
| 12 | Two-way SMS is not supported on standard A2P alphanumeric IDs in TZ | market | **S** (Twilio guidelines) | Trust. **This is the most under-weighted fact in both reports** (see §1.3). |
| 13 | Shortcodes: dedicated ≈ $2k + $3k/yr, about 3 months; shared keyword ≈ TZS 198.5k + 79.4k/month; inbound TZS 80–100 per message | both | **P (vendor: AT, HelloDuty)** | Trust as aggregator prices. "2 weeks to 3 months" (fields) vs "about 3 months" (market): plan on 3 months. |
| 14 | Voice termination TZS 1.08/s out (≈TZS 49 for a 45-second call) | market | **P (one vendor, HelloDuty)** | One data point only. A results call costs **about 3× an SMS**. |
| 15 | "No Tanzanian provider offers self-serve Swahili AI voice" | market | **U (absence of evidence)** | Weak. Briq sells voice and AI, FastHub sells IVR, HelloDuty sells IVR, and Retell markets Swahili agents. The gap may be narrower than claimed, so treat it as a hypothesis. |
| 16 | Fish Audio S2.1 Pro supports Swahili | market | **U** (one press article; Fish's own docs do not list Swahili) | Unproven. No plan may assume Fish is the Swahili voice. |
| 17 | Fish Audio $21M ARR, 8M users, $52M seed | market | **S, company-reported** | Directionally fine for strategy lessons; do not cite as audited. The founding date conflicts (2024 vs Jul 2025) and does not matter. |
| 18 | Textify is the Nairobi company Textify Mobile Solutions; TZ routes unverified | market | **U** | **Red flag.** The identified "company site" is a `github.io` page claiming 40,000 SMS/s. Bermi's only live route may be unverifiable. See §6. |
| 19 | Sema has hosted PBX, not a programmable voice API | market | **P (Sema site), U for the API** | Assume there is **no** programmable outbound/IVR API until Sema shows docs. |
| 20 | School systems (ShuleSoft, InfoTaaluma) treat messaging as a bolt-on; InfoTaaluma has 200k parents and 253 schools | both | **S** (ANB Post, 2024; vendor site) | Usable. "None has Swahili voice" is **U**. |
| 21 | NECTA results by USSD *152*00# at ≈TZS 100 | market | **S** (cvstudio blog) | Plausible. It proves parents will pay a little per query, not that schools will pay for voice. |
| 22 | O-level grade bands A 75 / B 65 / C 45 / D 30 / F, division ranges I–0 | fields | **U** (an ExcelForum thread that does not name Tanzania; the NECTA poster could not be reached) | **Do not hard-code.** The importer must prefer the school's computed columns, and computing grades must be opt-in with a named scale. |
| 23 | Sheet layout (title rows, one sheet per stream, a WAZAZI phone sheet, ALAMA/DARAJA sub-columns) | fields | **U [assumption]** | Plausible but untested. Ten real school files are needed before building multi-tier header logic. |
| 24 | Smart quotes and en dashes force UCS-2 and double the cost | fields | **P (measured against SPEC rules)** | Trust. A cheap, real win. |
| 25 | Sample message lengths and segments (155→1, 182→2, 188→2, 163→2, 161→2, 127→1, 108→1) | fields | **Verified** by recount here | All correct. |
| 26 | SMS reminders lift ART retention to 92.6% from 56.8%; number changes were the main failure | fields | **P (conference abstract, 2019)** | Trust for health. It is the best evidence in either report for **number-change detection**. |
| 27 | Keyword opt-in works (Wazazi Nipendeni, 125k sign-ups) | fields | **S** | Trust, but it was free-to-user, donor-funded and on a shortcode. |
| 28 | WhatsApp utility template $0.0046 (≈TZS 12) vs SMS TZS 18 | both | **P (Meta), FX assumption** | Trust. It saves money only for opted-in smartphone users, and the Oct 2026 service-message charge is **contradictory (U)**. |
| 29 | Enterprise gaps (no audit, sub-accounts, SLA, second route) | fields | **Verified against the code** | Correct. Also missing: STOP does not include **SIMAMA**, the word the founder uses (`messages.ts:292` has ACHA/SITISHA only). |
| 30 | Bank, insurer and logistics demand and segment table | market §10.1 | Mostly **U** (lists of who *could* buy) | Use it for targeting, not for sizing. |

### 1.2 Contradictions and how to resolve them

1. **Smartphone share, 37% vs 44.7%.** Use 44.7% (Jun 2026), and never claim "63% feature-phone only".
2. **Recovering numbers in scientific notation.** fields.md says "cannot be recovered" and also "read raw .xlsx values". The founder's brief says "recover". **Resolution:** recover *only* when an .xlsx cell is numeric and stores the full 9- or 12-digit value. If the cell is text or comes from CSV (as `7.12346E+08` in the sample does), **flag it and never guess.** A guess such as 712346000 would send a child's results to a stranger. That is a PDPA breach, not a bug.
3. **Ranking voice first (market) vs importer then inbox then voice (fields).** **Fields is right.** Voice has the highest dependency risk (no confirmed termination partner, unproven Swahili TTS) and costs about 3× an SMS. The importer has none of that risk.
4. **"Offer a shared reply number in the base price" (fields) vs "two-way not supported on A2P; inbound TZS 80–100" (market).** At TZS 18 out and up to TZS 100 in, bundling replies into the base price loses money on every reply. Price replies separately, or cap them.
5. **Sender ID SLA: 3–10 days vs 2–4 weeks.** Promise 2–4 weeks.
6. **fields.md's "23 valid" phone summary for the sample.** A recount gives **21 clean primary numbers + 2 rows rescued from the secondary column** (row 8 has a blank primary; row 10 has `7.12346E+08`) = **23 sendable**. Two are unsendable: row 6 `07123456` (too short) and row 14 `Hana simu`. Row 23 splits into a primary and an alternate. Use these numbers as the test oracle.
7. **A trap in the sample sheet that neither report mentions.** I recomputed the sheet: totals, averages, grades, best-7 points and divisions are all internally consistent, but **NAFASI (position) ranks by JUMLA (total), not by WASTANI (average).** Seven rows would differ if ranked by average, because rows with ABS average over 8 subjects (e.g. Hamisi, average 46.1, sits at position 19 of 25 by total). **Rule:** never recompute a position that the school supplied. If position is computed, rank by total by default and make that choice visible.

### 1.3 Recommendations resting on weak evidence

- **"Two-way inbox with AI reply sorting"** assumes replies reach Bermi at all. On alphanumeric sender IDs in Tanzania they normally do not (Twilio). Textify's MO behaviour is unknown. Until a reply path exists (shared shortcode, long number, or Textify confirming MO), the inbox only sees replies in the mock SMSC. **The landing page already sells this** ("Nimelipa → Paid").
- **Voice as the #1 opportunity** rests on a U claim (no competitor does it), a U claim (Fish speaks Swahili), one price point, and a partner (Sema) that seems to sell PBX, not an API.
- **The global STOP opt-out across all accounts** (SPEC; `messages.ts`) is legally wrong in the other direction. Consent belongs to each controller (each school or business). A STOP sent to school A should not silence a bank's OTPs. Move to per-account, per-sender suppression.
- **Contacts are unique per (account, phone).** One parent with two children in the sheet collapses into one contact, and the second row overwrites the first child's `fields`. Results data must live per *upload row* (per message), not on the contact. Neither report caught this.
- **Mark bands, divisions and sheet layouts** are assumptions (see claims 22–23). Collect ten real files from the Imbeju and DIT networks before building multi-tier header logic.
- **Bank and BoT outsourcing requirements** are assumptions. Do not chase banks before an SLA and a second route exist.

---

## 2. Scored opportunities

Scale 1–5, higher is better on every column. "Effort" is inverse: 5 = easiest to build. "Dependency" is inverse: 5 = no licence or partner needed.

| # | Bet | Pain | Unique | Revenue | Effort (inv) | Dependency (inv) | Global | **Total /30** |
|---|---|---|---|---|---|---|---|---|
| 1 | **Excel Smart Sender**, universal (results, fees, loans, rent, pledges), with per-row proof report | 5 | 4 | 4 | 4 | 5 | 4 | **26** |
| 2 | **Number collection + consent capture** (QR/link opt-in form, import attestation, consent ledger, per-account suppression) | 4 | 4 | 3 | 5 | 5 | 5 | **26** |
| 3 | **Contact "learn" profile** (numbers[] with status, number-change detection, language, channel and voice preference, reply history) | 4 | 5 | 3 | 4 | 5 | 5 | **26** |
| 4 | **Compliance-as-product** (per-operator sender-ID KYC tracking, audit log, PDPA pack, quiet hours) | 4 | 3 | 3 | 3 | 4 | 5 | **22** |
| 5 | **Open toolkit / developer community**, the Fish playbook (segment counter, GSM sanitiser, Swahili templates, STOP/SIMAMA list, SDKs, public TZS price page) | 2 | 4 | 2 | 4 | 5 | 5 | **22** |
| 6 | Sub-accounts and enterprise (roles, maker-checker, cost centres, postpaid) | 3 | 2 | 4 | 3 | 5 | 4 | **21** |
| 7 | Fallback chains (number 2 now; channel fallback later; printed-slip list) | 4 | 3 | 3 | 3 | 3 | 4 | **20** |
| 8 | Two-way inbox + reply classification (rules now, LLM later) | 4 | 3 | 3 | 3 | 2 | 4 | **19** |
| 9 | Swahili voice broadcast / IVR (results read aloud) | 4 | 4 | 4 | 2 | 1 | 4 | **19** |
| 10 | AI message writer / shortener (Swahili, fits one SMS) | 3 | 3 | 2 | 4 | 3 | 4 | **19** |
| 11 | Second SMS route + failover | 4 | 1 | 3 | 3 | 2 | 3 | **16** |
| 12 | WhatsApp utility channel | 3 | 1 | 3 | 3 | 2 | 4 | **16** |
| 13 | School-system integrations marketplace (ShuleSoft, InfoTaaluma) | 3 | 3 | 3 | 2 | 2 | 2 | **15** |
| 14 | Reseller SMPP server / white-label | 2 | 2 | 3 | 2 | 3 | 3 | **15** |
| 15 | USSD menus + shortcode keyword polls (media voting) | 3 | 2 | 2 | 2 | 1 | 2 | **12** |

**Ranked top 5:** (1) Excel Smart Sender, (2) Consent + number collection, (3) Contact learn profile, (4) Compliance-as-product, (5) Open toolkit. Ties are broken by customer pain, then by dependency.

**How to read the table:**
- **Voice (#9) is the strategic bet but scores mid-table** because its dependency score is 1. Do not build it. *De-risk* it in parallel: a blind native-speaker test of Fish against Azure sw-TZ, plus written termination quotes from Sema, Africa's Talking and HelloDuty. Voice moves to the top once both come back positive.
- **The second route (#11) scores low as a "bet" but is table stakes.** It is a commercial task for the founder, not an engineering bet. Without it there is no enterprise and no OTP SLA.
- **The inbox (#8) is gated by a reply path,** not by code.

---

## 3. Positioning

**Sentence:** *Bermi Connect turns the spreadsheet you already have into proof that every person was reached, in their language and on the phone they actually own.*

**Three pillars, each grounded in the evidence:**

1. **Spreadsheet-native.** Organisations live in Excel (fields §3.10). Global CPaaS tools assume a clean contact list and an API. Bermi accepts the messy sheet, with title rows, Swahili headers and damaged numbers, and returns it with a STATUS column. Nobody in the competitor table sells this.
2. **Learns every recipient.** Each upload, delivery receipt and reply updates a per-person profile: which numbers work, whether a number has changed (the main failure in the Boresha study), language, preferred channel, and voice preference for people who cannot read. Routing uses this profile. Voice slots in here when it is ready.
3. **Proof and consent by default.** Per-row delivery proof, a consent ledger, per-sender suppression and an audit trail. Tanzania began PDPA inspections in Aug 2026, and Kenya, Uganda and Rwanda have the same shape of law, so this travels.

**"Learn → Understand → Connect" as product mechanics:**
- **Learn:**
  - Every upload is matched to existing contacts by ADM NO or member number. A number that differs from last term raises a `number_changed` signal.
  - Two consecutive failures mark a number `failing`.
  - Every opt-in records its source, purpose and timestamp.
- **Understand:**
  - Each upload gets a data-quality score: "23 sendable · 1 damaged by Excel · 1 too short · 1 no phone".
  - The cost preview catches UCS-2 surprises before they are billed.
  - Replies are classified: STOP/SIMAMA, paid/nimelipa, question, wrong number, thanks.
  - Each campaign ends with a one-line insight: "4 parents asked about Hisabati; 3 numbers likely changed."
- **Connect:**
  - Each contact gets a route: primary number → alternate number → (voice when live) → printed-slip list.
  - The loop closes when the status goes back into the original sheet's shape.

---

## 4. What we would build first (no building this round)

When building resumes, in this order:

1. **Excel Smart Sender**:
   - .xlsx/.csv upload, sheet and header detection, and bilingual auto-mapping (fields §1.4 dictionary)
   - phone cleaning that never guesses scientific-notation numbers
   - GSM sanitiser and per-row preview with segments and cost
   - sending as a campaign
   - per-row report exported in the original sheet's shape
   - Per-row data is stored on an upload-row table, not on contacts, to handle siblings. Tested against `research/sample-results-form2.csv`, using §1.2 items 6–7 as the oracle.
2. **Contact learn profile** fields: numbers with status, `number_changed`, language, preferred channel, voice preference, consent status and source, reply history.
3. **Consent basics:** a hosted QR/link opt-in form, an attestation step on import, a consent ledger, and suppression **per account** instead of global. Add SIMAMA to the STOP words.
4. **Rule-based reply classifier** and an inbox UI over the existing `inbound_messages`, behind a classifier interface so an LLM can be added later. Label it honestly as dependent on a reply path.
5. **Voice "coming soon":** fields in the data model and a UI placeholder only. No fake calls.
6. **Landing honesty pass.** The live hero currently animates a WhatsApp "Read", a voice call "Answered" and an AI "Nimelipa → Paid", none of which exist. Label everything as **Live** (SMS, OTP, API, webhooks, wallet, CSV import) or **Coming soon** (voice, WhatsApp, USSD, email, AI).

**Not first, and why:**
- Voice calls: no partner or Swahili quality proof.
- WhatsApp: needs Meta BSP or tech-provider status.
- USSD and shortcodes: monthly fees per telco, plus TCRA.
- SMPP server and reseller: likely needs Bermi's own licence.
- Integrations marketplace: needs partners' APIs.
- LLM features: PDPC cross-border permit.
- Multi-tier header parsing: wait for ten real files.

---

## 5. Global roadmap

| Stage | Scope | Gate to enter the next stage (all must be true) |
|---|---|---|
| **0. Make it legal and real (now–Q1 2027)** | Tanzania; SMS live | Textify identity, routes and licence confirmed in writing. Bermi's PDPC registration certificate in hand. TCRA position documented. A second TZ route signed. A reply path (shared shortcode or long number) live. |
| **1. Tanzania leader (2027)** | Schools, then fees, SACCOs, clinics, churches. Same importer, new templates. Voice once de-risked. | **50 paying organisations in at least 4 sectors**, with schools under 60% of revenue. At least 95% DLR-confirmed delivery on every MNO for 3 months. Voice validated (native-speaker test passed; termination below TZS 1.2/s). Self-serve onboarding to first send in under 10 minutes. |
| **2. East Africa (2028)** | Kenya through a CA-licensed CSP partner, then Uganda and Rwanda. A compliance pack per country (Kenya promotional hours 08–18 and DND; Uganda annual DPPA; Rwanda Law 058). | Kenya: 10 paying organisations on a partner route. Per-country sender-ID and consent workflows shipped. Data hosting compliant in each country. |
| **3. Africa (2029)** | Nigeria (NCC DND 2442), Ghana, Ethiopia, South Africa. Local-language voice (Hausa, Yoruba, Amharic, Zulu, after per-language tests). | Two routes per country. A 24/7 NOC. An SLA with 99.9% uptime. At least 30% of revenue from outside Tanzania. |
| **4. Global API** | "Reach anyone in their language on any phone" sold to global apps, NGOs and diaspora platforms entering Africa. Bermi becomes infrastructure inside other platforms. | SMS-pumping and KYC fraud controls. GDPR DPA. USD card billing. A developer community that brings in users without paid acquisition. |

**Fish Audio lessons, applied (and one rejected):**
- **Open something real early.** Open-source the GSM-7/UCS-2 sanitiser and segment counter, the bilingual column dictionary, the STOP/SIMAMA keyword list and the TCRA sender-ID checklist. They are cheap to give away and they bring developers in. An open Swahili TTS fine-tune (on Msingi-AI's CC-BY model) comes later.
- **Self-serve before sales.** Publish TZS prices (Beem, Briq and FastHub do not), keep the free signup credit, and unlock limits with prepaid balance.
- **A library network effect.** Community templates and column-mapping profiles ("NECTA results", "SACCO rejesho", "ahadi"). Every mapping a school saves improves auto-detection for the next school.
- **Become infrastructure inside others,** but only after Stage 1 traction. Integration partners will not engage before it.
- **Rejected:** creator virality around celebrity voices. Messages from a school or a bank need trust, not novelty. Require consent for any cloned voice from day one.

---

## 6. Open questions and risks

### 6.1 The five most urgent (the founder must answer these before any further build)

1. **Who exactly is Textify, and does it legally and technically reach all 5 Tanzanian MNOs?** The only match found is a Nairobi firm with a `github.io` site and no evidence of Tanzanian routes. Get in writing:
   - the legal entity and TCRA licence
   - direct binds or a hub, per network
   - a no-grey-route guarantee
   - price per network
   - whether failed messages are refunded
   - DLR codes
   - **whether MO (replies, STOP) reaches Bermi on alphanumeric IDs**

   If any answer is weak, Bermi's only live route is the company's single point of failure.
2. **Is Bermi Techs registered with the PDPC, and where is the database hosted?** The deadline passed on 8 Apr 2026 and inspections started in Aug 2026. Fines go up to TZS 5bn for institutions. If production runs on a foreign cloud, Bermi needs a cross-border permit *now*, not only when AI arrives. A DPO must be appointed.
3. **Does Bermi need its own TCRA licence to resell A2P SMS (and later voice and USSD)?** No primary text was found. Ask TCRA in writing. This also decides whether the SMPP reseller and Stage 2 are viable.
4. **How will replies reach Bermi?** Options: a shared shortcode (≈TZS 198.5k setup + 79.4k/month, inbound TZS 80–100 each), a long number, or Textify MO. Without one, STOP compliance, the inbox, "nimelipa" and the reply-path half of "Understand" do not work in production. Decide the reply price before marketing it.
5. **Is voice viable?**
   - Does Sema have a *programmable* outbound and IVR API (originate, play URL, DTMF, CDR webhooks), or only PBX? If not, which terminator: Africa's Talking, HelloDuty or a SIP trunk?
   - Does Fish Audio's Swahili pass a blind native-speaker test against Azure sw-TZ Rehema/Daudi, including number words?
   - The voice promise on the landing page depends on both.

### 6.2 Other open questions and risks

- **"Siliana" is unidentified.** Candidates are Sierra (agent platform), SiliconFlow (model hosting) or Silero. Ask the founder for the URL. Do not mention it publicly.
- **NECTA grade bands and division ranges are unconfirmed.** Get the official `bango viwango Division` poster, or confirm with three heads of school. Until then, use only the grades the school supplies.
- **Real school files:** collect ten (Imbeju and DIT networks) to validate the header, multi-sheet and WAZAZI-sheet assumptions.
- **Honesty risk on the live landing page.** It shows features that do not exist (WhatsApp read receipts, answered voice calls, AI reply sorting, email). In a market where TCRA monitors traffic and customers complain of scripted claims, this is a reputational and possibly consumer-protection risk.
- **Global STOP across accounts and the sibling-overwrite issue** (§1.3): wrong in law and in data.
- **Single worker and single SMPP bind:** no failover, and no OTP priority lane.
- **Competitor prices are 2021 data:** recheck Beem, NextSMS and Africa's Talking before publishing a price comparison.
- **WhatsApp:** whether Meta's Oct 2026 service-message charge applies is unresolved, and BSP or tech-provider status is needed.
- **VAT on resale and TRA EFD receipts:** not researched. Ask an accountant before invoicing any enterprise.
- **Direct rival:** Briq is the closest ("communication infrastructure for Africa" with SMS, WhatsApp, voice and AI). Its stage is unknown. Watch it.
- **Concentration risk:** if schools are most of the revenue, results seasons (Jan, Jul, term ends) make income lumpy. Fees, SACCO and clinic reminders are monthly and smooth it out.

---

## 7. Global gaps: the five biggest communication pain points the reports support

The reports are Tanzania-centric. "Global" support is mostly East African, plus the CPaaS price data. Grades are stated honestly.

| # | Pain point (for organisations) | Evidence in the reports | Strength |
|---|---|---|---|
| 1 | **Compliance is fragmented and now enforced:** per-operator sender IDs, per-country data-protection law, consent and DND rules differ in every market | TZ: sender-ID blocking (Jun 2025), PDPA inspections (Aug 2026). KE: CSP-only IDs, promotional hours, DND. UG: annual DPPA, first conviction Jul 2025. RW: Law 058. NG: NCC DND. Twilio pre-registration takes 3–4 weeks. | **Strong (S, multiple independent sources across 5 countries)** |
| 2 | **Global CPaaS is priced out of reach for local senders:** a 10–60× gap between global and local routes | Twilio $0.4336 (P), Sinch $0.255, Plivo $0.144, Infobip ≈$0.232 vs local ≈$0.007 | **Strong (P/S)** |
| 3 | **Large audiences cannot be reached by text or apps alone:** fewer than half have smartphones, about 17% of adults cannot read, and phones are shared | TZ smartphones 44.7% (S), literacy 83% (P), women's phone ownership 62% (S). GSMA puts sub-Saharan mobile internet at 27% (S). Uganda and Kenya feature-phone bases (S). | **Medium**: strong for TZ and SSA, absent for the rest of the world |
| 4 | **Nobody can prove a message was received:** grey routes with fake DLRs, single-route failures, and number churn that silently breaks lists | Number churn as the main failure in Boresha Afya (P). Grey-route DLR risk (S, Telerivet KE). 80% rejection on one MNO (U, one Trustpilot review). | **Medium–weak**: churn is well evidenced; DLR fraud is anecdotal |
| 5 | **Organisational data lives in spreadsheets, but tools assume clean contact lists and APIs** | Sheet realities in fields §1.2 (mostly [assumption]). Recurring CSV import and Excel workflows across every sector table. The sample file shows the failure modes concretely. | **Weak (U)**: it is the core bet and the least evidenced. **Validate with ten real files and five non-school organisations before claiming it globally.** |

**Implication:** the strongest global wedge by evidence is #1 plus #2 (compliance-ready local reach at local prices). The most distinctive is #3 plus #5 (spreadsheet-native, every-phone reach). Bermi should lead with the distinctive pair and use the well-evidenced pair as proof.
