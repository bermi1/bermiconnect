# Bermi Connect: Field Research and Workflow Design

*Field agent, 5 Nov 2026. Covers how Tanzanian organisations communicate today and which workflows Bermi Connect must support. The flagship scenario is schools sending Excel results to parents. Facts carry inline source links. Anything not sourced is marked **[assumption]**, meaning reasoned judgement or common practice that should be checked with real customers.*

Companion file: `research/sample-results-form2.csv`. It is a realistic, messy Form 2 result sheet with 25 students, 9 subjects and mixed phone formats.

---

## 0. Ground truth: the Tanzanian context in numbers

| Fact | Figure | Source |
|---|---|---|
| Active telecom subscriptions | 99.3 M (Sep 2025), up from 92.7 M (Jun 2025) | [The Citizen, Nov 2025](https://thecitizen.co.tz/tanzania/news/national/men-lead-tanzania-s-telecom-race-as-sector-posts-strong-growth-5257782); [Guardian/IPP, Oct 2025](https://ippmedia.co.tz/the-guardian/news/local-news/read/telecom-subscriptions-hit-927m-internet-penetration-rate-at-79pc-2025-10-09-145226) |
| Mobile money accounts | 68.1 M (Jun 2025) | [Guardian/IPP](https://ippmedia.co.tz/the-guardian/news/local-news/read/telecom-subscriptions-hit-927m-internet-penetration-rate-at-79pc-2025-10-09-145226) |
| Smartphone penetration | 37% (Jun 2025). About 63% of users are still on feature phones, so **SMS, voice and USSD stay the baseline.** | same |
| Adult literacy | 83% (2022 census), so roughly 1 in 6 adults cannot read an SMS | [Daily News, Feb 2024](https://dailynews.co.tz/illiteracy-rate-among-adults-up-by-6-3pc-bunge-told/) |
| Schools | About 5,926 secondary and 19,733 primary schools, with about 3.1 M and 11.4 M learners (TAMISEMI 2023) | cited in [ANB Post](https://anbpost.substack.com/p/200000-tanzanian-parents-now-track) |
| School SMS precedent | InfoTaaluma reaches 200k+ parents across 253 schools by app **or SMS for basic phones**. Shule Yetu is in 230 private schools. | [ANB Post](https://anbpost.substack.com/p/200000-tanzanian-parents-now-track); [The Citizen](https://www.thecitizen.co.tz/tanzania/news/national/new-digital-innovation-to-tackle-truancy-and-enhances-school-accountability-in-tanzania-5046548) |
| SACCOS | 981 licensed, about 1.9 M members, TZS 1.69 trn in assets (end 2025) | [Daily News, Oct 2026](https://dailynews.co.tz/?p=165929) |
| Competitor pricing (2021) | Beem TZS 25 down to 17 by volume; NextSMS TZS 16 down to 13; Africa's Talking TZS 22 down to 20 | [dev.to survey, 2021](https://dev.to/alphaolomi/bulk-sms-provider-in-tanzania-1dj4) |
| Two-way shortcodes | Shared keyword: TZS 198.5k setup plus 79.4k/month. Dedicated TCRA code: about USD 2,000 + 3,000/yr plus operator fees, 2 weeks to 3 months. Inbound charged at TZS 100–80 per message. | [Africa's Talking help](https://help.africastalking.com/en/articles/4161210-2-way-sms-shortcode-in-tanzania) |
| Sender IDs | Registered **per operator** (Vodacom, Yas, Airtel, Halotel), about 2–4 weeks. Generic names are rejected. Airtel requires the brand in the content; Yas registers content templates. TCRA monitors SMS traffic on all networks (Oct 2024). | [Telerivet, TZ compliance](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa) |
| Data protection | PDPA 2022 in force since 1 May 2023 and the PDPC operational since Apr 2024. Promotional SMS needs explicit opt-in. There is **no national DND registry**, so senders must run their own suppression lists. | same |
| Cross-border data | A transfer abroad needs a PDPC **permit** (PDP Regulations GN 449C/2023, reg. 20), even to "adequate" countries | [Afriwise](https://www.afriwise.com/blog/legal-and-compliance-requirements-for-cross-border-personal-data-transfers-under-tanzanias-personal-data-protection-framework) |
| Political content | TCRA election guidelines (Aug 2025): bulk SMS must be screened, political content pre-approved, and **records kept** for verification | [Daily News](https://dailynews.co.tz/tcra-issues-bulk-sms-guidelines-during-election/) |
| SMS reminders work | Automated ART appointment SMS in 5 regions gave **92.6% vs 56.8%** retention. Changing phone numbers was the main problem. | [Boresha Afya / GDHF 2019](https://gdhf2019.dryfta.com/component/dryfta/abstract/public/197/effectiveness-of-automated-text-messaging-in-improving-retention-of-hiv-patients-in-tanzania) |
| Keyword opt-in works | Wazazi Nipendeni: free Swahili SMS. Users opt in by keyword ("MTOTO") and answer profiling questions. About 125k sign-ups, 7k per week. | [CDC Foundation](https://www.cdcfoundation.org/node/1093); [Compass](https://www.thecompassforsbc.org/project-examples/wazazi-nipendeni-text-messaging) |
| WhatsApp cost model | Per-message pricing since 1 Jul 2025. Utility templates are **free inside the 24-hour window**. Tanzania is billed at "Rest of Africa" rates. | [Meta docs](https://developers.facebook.com/docs/whatsapp/pricing) |

---

## 1. Flagship scenario: from an Excel result sheet to every parent

### 1.1 What the result sheets look like

**Secondary schools (Form 1–4, O-level).** The national CSEE uses five grades with points and best-seven divisions:

| Grade | A | B | C | D | F |
|---|---|---|---|---|---|
| Points | 1 | 2 | 3 | 4 | 5 |
| Marks (commonly used bands) | 75–100 | 65–74 | 45–64 | 30–44 | 0–29 |

- **Division** is the sum of points for the **best 7 subjects**: I = 7–17, II = 18–21, III = 22–25, IV = 26–33, 0 = 34–35 ([ExcelForum thread with the same rules](https://www.excelforum.com/excel-formulas-and-functions/953367-calculate-points-and-divisions.html); the thread does not name Tanzania; that these are the current NECTA O-level ranges is an **[assumption]** to confirm against the NECTA poster below).
- **Mark bands:** the official NECTA poster (`necta.go.tz/files/bango viwango Division.pdf`) was not reachable from here. Treat the bands above as an **[assumption]** to confirm against that poster.
- **Older scale:** sheets still exist with the 2013-era 7-grade scale (A, B+, B, C, D, E, F; points 1–7; Div I = 7–17 … IV = 32–46, 0 = 47–49) ([TETEA CSEE 2013](https://maktaba.tetea.org/exam-results/CSEE2013/olevel.html)).
- **Design rule:** never hard-code one scale. Let the school pick "NECTA current", "NECTA 2013" or "custom", and **prefer the grade/division columns the school already computed**.

**Primary schools (Std 1–7).** Primary uses A–E. A pass at PSLE requires grades A–C ([Guardian 2025](https://ippmedia.co.tz/the-guardian/news/local-news/read/std-vii-exam-overall-pass-rate-hits-818-pc-2025-11-06-103034)).
- Per-subject bands are often A 41–50, B 31–40, C 21–30, D 11–20, E 0–10 on a 50-mark paper, and many schools mark out of 100 internally **[assumption]**.
- Subjects are usually Kiswahili, English, Hisabati, Sayansi na Teknolojia, Maarifa ya Jamii / Uraia na Maadili, and sometimes Dini.

**Typical internal (term or monthly) sheet layout [assumption, based on common teacher templates].**

- **Row 1–2:** a title, often merged across columns: `SHULE YA SEKONDARI …`, then `MATOKEO YA MTIHANI WA MUHULA WA KWANZA 2026 – KIDATO CHA PILI 'B'`.
- **Row 3:** blank, or the class teacher's name.
- **Row 4:** headers. Sometimes there are two header rows: a merged "MASOMO / SUBJECTS" band above the subject codes, or each subject split into `ALAMA | DARAJA` (mark and grade) sub-columns.
- **Identity columns:** `S/N`, `ADM NO` / `NAMBA YA USAJILI` / `CNO`, `JINA LA MWANAFUNZI` (sometimes split into JINA LA KWANZA / LA KATI / LA UKOO), `JINSIA` / `SEX`.
- **Subject columns:** `CIV HIST GEO KISW ENGL PHY CHEM BIO B/MATH`, optionally `COMM`, `B/KEEPING`, `LIT`, `AGRIC`.
- **Summary columns:** `JUMLA` (total), `WASTANI` (average), `DARAJA` / `GRADE`, `POINTS` / `ALAMA`, `DIV` / `DIVISION` / `DARAJA LA UFAULU`, `NAFASI` / `POSITION` (often "15/25" or just "15").
- **Phone columns:** `NAMBA YA MZAZI` / `SIMU YA MZAZI` / `PARENT PHONE` / `MAWASILIANO`, plus sometimes `NAMBA YA MZAZI 2` / `MLEZI` (guardian).
- **Layout:** one workbook per term, **one sheet per stream** (F2A, F2B, F2C) or per form, plus sometimes a `SUMMARY` / `UCHAMBUZI` sheet with grade counts per subject and a `MASTER`/`WAZAZI` sheet that holds the phones.

### 1.2 Messy realities the importer must handle

All examples below appear in the sample CSV.

| Reality | Example | Required handling |
|---|---|---|
| Title rows above the header | 3 rows before `S/N, ADM NO…` | Header detection: score each of the first 15 rows by its count of non-empty text cells and its matches against a header dictionary, then pick the best. The user can override with a click. |
| Merged or two-tier headers | `MASOMO` spanning subjects; `ENGL` over `ALAMA, DARAJA` | Fill merged cells across their range and combine tiers into names like `ENGL.ALAMA`. |
| Several sheets | F2A, F2B, F2C, SUMMARY | List every sheet with its row count. Pre-tick sheets whose header matches the first; untick SUMMARY/UCHAMBUZI (rows that are grade counts, not students). |
| Phones on another sheet | `WAZAZI` sheet: ADM NO → phone | "Look up phone from another sheet or file" by ADM NO (fall back to fuzzy name). |
| Phone as a number | `712345601` (leading 0 lost) | Accept 9-digit 6/7xx numbers. (`normalizePhone` already does this.) |
| Scientific notation | `7.12346E+08` | **Cannot be recovered**: the digits are gone. Flag it as "number damaged by Excel, re-type it". Read raw cell values from .xlsx (not a CSV export), because the true value is often still stored. |
| Spaces, dashes, + | `0655-123-404`, `+255 683 111 203`, `255 715 667 412` | Already handled. |
| Two numbers in one cell | `0754 889 423 / 0784 889 424` | Split on `/ , ; au na &`. The first is primary and the second is the alternate. |
| Two phone columns | `NAMBA YA MZAZI`, `NAMBA YA MZAZI 2` | Map as primary and secondary. Policy choice: send to both, or primary with secondary as fallback. |
| Missing or text placeholders | blank, `Hana simu`, `-`, `N/A`, `hakuna` | Mark "no phone". Include the student in a "print slip" list. |
| Too short / invalid | `07123456` | Mark invalid and show the row for inline editing. |
| Same parent, several children | Siblings across streams | Group by phone. Offer "one message per child" (default) or a combined family message. |
| Absent subjects | `ABS`, `X`, `-`, `INC` | Render as "ABS" (or "HAKUFANYA" in Swahili). Exclude from the average if the sheet does. |
| Name casing | `Rehema Hamisi Said` vs `JUMA ALLY MRISHO` | Normalise for display ("Juma"). Use the first and last name only to save characters. |
| Formulas | `=AVERAGE(E5:M5)` | Read cached values. Warn if a formula cell has no cached value (file saved by a non-Excel tool). |
| Swahili and English headers | `JINA LA MWANAFUNZI`, `NAMBA YA MZAZI`, `WASTANI`, `NAFASI` | Bilingual synonym dictionary (§1.4). |
| Excel autocorrect characters | `–` en dash, `“ ”` smart quotes | These force **UCS-2 (70 characters per segment)** and can **double or triple cost**. Auto-replace with GSM equivalents (`-`, `"`) and say so in the preview. Measured: a 39-character line with `–` and `“”` became UCS-2. |

### 1.3 The "Results sender" flow, step by step

**Step 1: Upload.** Drag in `.xlsx`, `.xls` or `.csv` (also from a phone: WhatsApp → Files → upload).
- Parse in the browser with SheetJS so nothing is stored before the user confirms, or parse server-side; either way, keep the raw cell values.
- Show: "Found 3 sheets: F2A (27 students), F2B (25), SUMMARY (skipped)".

**Step 2: Detect the header and data rows.** Auto-detect as in §1.2 and show a highlighted grid: "Header row 4, students rows 5–29."
- Stop at the first fully blank row or at footer rows ("WASTANI WA DARASA", "Imesainiwa na…").
- One-click fix: "This is the header row".

**Step 3: Map columns, auto-detected and confirmed.** The table shows column → role → 3 sample values → confidence.
- **Roles:** `student_name` (or first/middle/last), `adm_no`, `class/stream` (taken from the sheet name if missing), `sex`, `subject` (multiple; code and label editable, e.g. "B/MATH" → "BMAT" / "HES"), `total`, `average`, `grade`, `points`, `division`, `position`, `class_size` (computed if absent), `parent_phone`, `parent_phone_2`, `parent_name`, `ignore`.
- Detect a subject column as one whose header matches the subject dictionary, or whose values are mostly 0–100 numbers / ABS.
- If grade, points or division are missing, offer to **compute** them with the chosen scale and show which values are computed.
- Save the mapping as a **"school profile"** so next term's upload maps itself.

**Step 4: Clean the phones.** Summary: "23 valid · 1 damaged by Excel · 1 too short · 1 'Hana simu' · 1 cell with 2 numbers (split)".
- Inline-editable rows; "fix later" or "add from contacts".
- Cross-check against existing contacts by ADM NO and say "the number differs from last term" (a number-change signal).

**Step 5: Choose a template.** Presets:
- **Grades only**, 1 SMS (fits 9 subjects).
- **Marks + summary**, usually 2 SMS.
- **Summary only** (average, division, position) + "collect the report card".
- **Invite to meeting**: low performers get a different message (conditional block: `{{#if division in [IV,0]}}…{{/if}}`).

Options:
- Language: Swahili, English, or **per parent** (from contact preference).
- Subjects: "compact subject list" token `{{subjects}}`, plus per-subject `{{ENGL}}`, `{{ENGL.grade}}`.
- Sender ID and signature.
- Toggles: hide position (some schools avoid ranking), and **include class size** ("15/25").

**Step 6: Preview each student.** A scrollable list of real rendered messages.
- Each shows its character count, encoding, segments and TZS cost.
- Header totals: `25 students · 23 sendable · 30 SMS segments · TZS 540 · 2 parents with 2 numbers (+2 SMS)`.
- Over-160 messages are highlighted with a one-click "shorten": switch subjects to grades only, drop the school name, use short codes.
- Search by name. "Send a test to my phone".

**Step 7: Missing or invalid phones.** Choose: skip; send to the alternate number; or produce a **printable slip PDF** (one slip per student for the pupil to take home).
- Optionally flag these for **"voice call later"** or **"ask the class teacher to collect the number"**: generate a short WhatsApp/SMS to the class teacher listing the students with missing numbers.

**Step 8: Send.**
- Check balance, reserving the exact cost; if it is short, offer a mobile-money top-up inline.
- Send now or schedule (e.g. Friday 18:00, when parents are home). Throttle per operator.
- Create a `campaign` with `source=results_upload` and keep the per-row payload.

**Step 9: Per-student delivery report.**
- Table columns: Student | Parent number | Status (delivered / pending / failed / no phone) | Time | Replies.
- Filter by stream. Export to Excel **in the same shape as the original sheet with a STATUS column appended**, which secretaries love **[assumption]**.

**Step 10: Resend failures.**
- Retry failed numbers after 2 hours.
- Fall back to `parent_phone_2`.
- Fall back to **voice** (future): a robocall reads the result in Swahili.
- Mark "unreachable" and add to the slip print list.
- Learn: two consecutive failures on a number → "number possibly changed" badge.

**Step 11: Replies (two-way).** Parents reply "ASANTE", "Nitakuja", "Kwa nini Hisabati F?", "NDIYO".
- AI classifies each reply as thanks / confirm attendance / question / complaint / wrong number / STOP.
- Questions go to the class teacher's inbox; "wrong number" clears the phone and alerts the school.

**Voice for parents who cannot read (planned).** A TTS or pre-recorded Swahili template:

> "Habari, huu ni ujumbe kutoka Shule ya Sekondari Mwangaza. Matokeo ya Juma Mrisho, kidato cha pili: wastani alama arobaini na tano, daraja la tatu, nafasi ya kumi na tano kati ya ishirini na tano. Bonyeza moja kusikia tena, mbili kuongea na mwalimu."

- Numbers must be spoken in Swahili number words, a TTS requirement.
- Voice is triggered per contact by `literacy=voice` or after an SMS goes unacknowledged.

### 1.4 Column-detection dictionary (seed)

| Role | Synonyms (case and punctuation-insensitive) |
|---|---|
| student_name | jina la mwanafunzi, jina, majina, jina kamili, name, student name, full name, names of students |
| first/middle/last | jina la kwanza, jina la kati, jina la ukoo / la mwisho, first name, surname |
| adm_no | adm no, admission, namba ya usajili, reg no, cno, index no, namba ya mtihani |
| sex | jinsia, sex, gender, me/ke |
| total | jumla, total, jumla ya alama, tot |
| average | wastani, average, avg, mean, % |
| grade | daraja, grade, gred |
| points | points, pointi, alama za daraja, pts |
| division | div, division, daraja la ufaulu, dv |
| position | nafasi, position, pos, rank, cheo |
| parent_phone | namba ya mzazi, simu ya mzazi, namba ya simu, simu, mawasiliano, parent phone, phone, tel, contact, mzazi/mlezi |
| parent_name | jina la mzazi, mzazi, mlezi, parent, guardian |

Subject codes (secondary): CIV/URAIA, HIST/HISTORIA, GEO/JIOGRAFIA, KISW/KISWAHILI, ENGL/ENG, PHY/FIZIKIA, CHEM/KEMIA, BIO/BAIOLOJIA, B/MATH/HISABATI/HES, COMM, BK, LIT, AGRIC, CS, FN.
Primary: KIS, ENG, HIS (Hisabati), SAY (Sayansi), M/JAMII, URAIA, DINI.

### 1.5 Fitting nine subjects into 160 characters

GSM-7 allows 160 characters in a single SMS. "SUBJ G, " costs 7–8 characters, so 9 subjects ≈ 70 characters, leaving about 85 for name, class and summary. **A grades-only message fits in 1 SMS; marks usually need 2.** Compression rules, in order:

1. Use grades not marks.
2. Use 3–4 letter codes.
3. Use first and last name only.
4. Drop the year and the word "Term".
5. Write `15/25` instead of "Position 15 out of 25".
6. Use a short signature ("-MWANGAZA SS"; the sender ID already identifies the school).
7. Run-length grouping as a last resort: `A: GEO,CHEM; B: ENGL; C: CIV,HIST…`.

### 1.6 Sample messages (segments counted with the GSM-7/UCS-2 rules in SPEC.md)

1. **English, grades only: 155 chars, GSM-7, 1 SMS = TZS 18**
   > MWANGAZA SS F2B Term 1 2026: JUMA ALLY MRISHO - CIV D, HIST C, GEO D, KISW D, ENGL C, PHY D, CHEM C, BIO D, BMAT C. Avg 45.4 C, Pts 24, Div III, Pos 15/25.

2. **Swahili, marks + congratulations: 182 chars, GSM-7, 2 SMS = TZS 36**
   > Mzazi wa HALIMA YUSUPH (F2B): Matokeo Muhula 1: URAI 95, HIST 93, JIO 94, KISW 94, ENG 83, FIZ 69, KEM 73, BIO 70, HES 85. Wastani 84.0 (A), Div I, Nafasi 1/25. Hongera! -MWANGAZA SS

3. **Swahili, summary + meeting invite with a two-way reply: 188 chars, GSM-7, 2 SMS = TZS 36**
   > Mzazi wa HAMISI RAMADHANI (F2B): Wastani 46.1 (C), Div III, Nafasi 19/25. Hakufanya mtihani wa PHY. Tafadhali fika shuleni Ijumaa 14/11 saa 3 asubuhi. Jibu NDIYO kuthibitisha. -MWANGAZA SS

**Cost of one stream (sample sheet):**
- 23 sendable parents × 1 SMS = TZS 414 with template 1; ×2 = TZS 828 with template 2.
- Plus 3 second numbers.

**Cost of a whole school:**
- 600 students × 3 terms × 2 SMS × TZS 18 ≈ **TZS 65k a year for results**: cheap compared with printing and the parent-trust value.

### 1.7 The sample sheet

File: `research/sample-results-form2.csv`.
- **Layout:** 2 merged-style title rows and a blank row, then the header in row 4. Columns: Swahili headers, 9 O-level subjects, totals, average, grade, points, best-7 division, position, two phone columns.
- **Planted problems:**
  - phones in 8 formats
  - `7.12346E+08`
  - `07123456` (too short)
  - `Hana simu`
  - blank primary with only a secondary number
  - two numbers in one cell
  - mixed-case names
  - two `ABS` marks
- **Grading:** marks are graded with the current A–F bands (§1.1). Division uses best-7 points with ABS = F.

---

## 2. Sector workflows

Each entry lists who sends, the data they have and its form, an example message, what today's tools lack, and the channel shift.

### 2.1 Schools: fee reminders (bursar)

- **Data:** the bursar's Excel (ADM NO, name, class, fee due, paid, balance, sometimes a GePG control number or bank reference) or a ShuleSoft/Excel export.
  - Fees are paid via bank / M-Pesa / Airtel / GePG (e.g. [Airtel–schools](https://thecitizen.co.tz/tanzania/news/national/airtel-tanzania-partners-with-schools-to-digitize-school-fees-payment-4671570), [Exim Smart Shule](https://dailynews.co.tz/?p=58426)).
- **Flow:** the same importer, with mapping roles `fee_due`, `paid`, `balance`, `control_no`, `due_date`.
  - Rules: skip balance ≤ 0; tiered tone (friendly at 30 days, firm at 60); schedule a sequence (D-7, D0, D+7).
  - **Re-upload the updated sheet → auto-cancel reminders to parents who have paid.**
- **Message (163 chars → 2 SMS):**
  > Mzazi wa JUMA ALLY: Ada iliyobaki Muhula 1 ni TZS 350,000 (umelipa 450,000 kati ya 800,000). Lipa kwa Control No. 991234567890 kabla ya 30/11. Asante. -MWANGAZA SS

  Trimming "Asante." gets it to 1 SMS, and the preview should suggest that.
- **Missing today:** sequences that stop on payment; formatting numbers with thousands separators; payment-confirmation SMS triggered by a payment webhook; per-family totals.
- **Channel shift:** replies like "Nitalipa tarehe 15" become promises-to-pay captured by AI. WhatsApp can carry a PDF statement.

### 2.2 Schools: attendance and absence alerts

- **Sender:** class teacher or discipline master, by 09:30 daily.
- **Data:** a paper register **[assumption]**, so the real input is a **mobile "tap absentees" screen** on the class list, not an upload.
- **Message (108 chars, 1 SMS):**
  > Mzazi wa ASHA SALIM: Asha hakufika shuleni leo 05/11/2026. Kama unajua sababu, jibu ujumbe huu. -MWANGAZA SS
- **Missing today:** a 30-second daily flow; reply capture ("Ni mgonjwa" = sick → excused); a weekly digest to the head teacher; a three-absences escalation.
- **Channel:** voice works for illiterate parents; two-way replies are the key value.

Other school workflows: meeting notices with RSVP (`Jibu 1 nitakuja`), closing/opening dates, emergency closure (sent to every group), boarding pick-up times.

### 2.3 Private businesses and shops

**How numbers get collected ("store the numbers").** This is the real bottleneck **[assumption, from typical duka practice]**: today, numbers live in the owner's phone contacts, a notebook, or M-Pesa SMS history.

| Method | How it works | Notes |
|---|---|---|
| QR at the counter | Opens a 3-field form (name, phone, consent tick). Optional reward: "5% off next visit". | Records consent with timestamp and source, as the PDPA requires ([Telerivet](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa)) |
| Keyword SMS | "Tuma DUKA kwenda 15xxx" on a shared shortcode (Wazazi Nipendeni model) | |
| Missed-call / USSD | A USSD menu, later | |
| Receipt / POS capture | Phone typed at checkout and pushed via API from the POS or an EFD-linked system | |
| Import from phone contacts | Android contact export (.vcf) or a contact picker in the mobile web app | The owner must confirm these contacts agreed. Default them to "transactional only" until they opt in. |
| Mobile money CSV | Lipa Namba statements contain payer numbers | **[assumption]** check operator T&Cs |

**Top workflows:**
1. **Promotions:** segmented by last purchase or area, with STOP handling; Swahili. Sample: `Ofa! Sabuni zote -20% leo hadi Jumamosi. Karibu DUKA LA MAMA ZAWADI, Kariakoo. STOP kujiondoa`.
2. **Order and delivery updates:** via API or "quick send from the order list".
3. **Debt reminders** for customers on credit ("deni").

- **Missing today:** consent capture and proof; segmentation; coupon codes with redemption tracking; a mobile-first UI.
- **Channel shift:** WhatsApp for catalogues and order chat (free service window); AI to draft promos in Swahili.

### 2.4 SACCOs and microfinance

- **Data:** a loan register in Excel, or a core system (e.g. a SACCO MIS) export: member no, name, phone, loan amount, instalment, due date, arrears, savings balance.
- **Workflows:**
  1. **Repayment reminders** at D-3, D0 and D+3 (arrears).
     > Habari Mama Neema, mkopo wako wa TZS 500,000: rejesho la wiki hii TZS 52,000 linadaiwa Ijumaa 07/11. Lipa M-Pesa Lipa Namba 123456. Salio: 312,000. -UMOJA SACCOS

     161 characters → 2 SMS. Dropping "Habari " gives 1 SMS; the preview should auto-suggest.
  2. Meeting / AGM notices with RSVP.
  3. Savings-deposit confirmations via API.
- **Missing today:** confidentiality (shared phones mean balances can be seen by others → option to hide amounts and say "piga simu" instead); guarantor notifications; promise-to-pay capture from replies.

### 2.5 Clinics and health

- **Data:** appointment books (paper or Excel, sometimes CTC2/HMIS); patient ID and phone.
- **Workflows:**
  1. **Appointment reminders** at D-3 and D0. The proven effect is 92.6% vs 56.8% ART retention ([Boresha Afya](https://gdhf2019.dryfta.com/component/dryfta/abstract/public/197/effectiveness-of-automated-text-messaging-in-improving-retention-of-hiv-patients-in-tanzania)).
     > Kumbusho: Una miadi kliniki ya Afya Bora Jumatatu 10/11 saa 2:00 asubuhi. Jibu 1 kuthibitisha, 2 kubadilisha tarehe. -AFYA BORA

     127 characters, 1 SMS.
  2. Results ready, refill reminders, and maternal / child vaccination schedules (Wazazi Nipendeni-style timed series).
- **Must have:** **neutral wording** (never the diagnosis: a phone may be shared); consent; and **update the number at every visit**, the main failure point in the Boresha study.
- **Channel shift:** voice for low literacy; two-way rescheduling; AI triage of replies.

### 2.6 Churches, mosques, NGOs and community groups

- **Data:** member registers (notebook or Excel), sometimes by jumuiya / zone; WhatsApp groups (capped at 1,024 members per group, and admins export manually **[assumption]**).
- **Workflows:**
  1. **Weekly announcements and event reminders** (ibada, harusi, msiba): urgent and time-sensitive.
  2. **Contribution / pledge (ahadi, zaka, michango) reminders** with balances from the treasurer's sheet.
- **Missing today:** cheap broadcast to elderly members (voice); a sub-group per zone; replies for RSVP / pledges.

### 2.7 Transport and logistics

- **Data:** waybills in a system or Excel (sender / recipient phone, tracking no, branch).
- **Workflows:**
  1. **Parcel arrived / ready for pickup with an OTP code** (recipient-side proof).
  2. Bus ticket confirmation and departure reminders, with delay / cancellation broadcasts to a manifest.
- **Missing:** API events for status changes; pickup-code verification; replies for "send to another branch".

### 2.8 Government and local councils

- **Data:** taxpayer / ratepayer registers, CHF/NHIF member lists, voter / mtaa registers, health campaign lists.
- **Workflows:**
  1. **Notices and deadlines:** property tax, business licence renewal, clean-up days, vaccination campaigns, all with GePG control numbers.
  2. **Ward / mtaa-level emergency alerts** (floods).
- **Needs:** audit logs, content approval workflow, record keeping (cf. [TCRA election guidelines](https://dailynews.co.tz/tcra-issues-bulk-sms-guidelines-during-election/)), data in Tanzania, and voice broadcast in Swahili.

### 2.9 Extended sectors (founder scope update)

Channel key: SMS = 1-way or 2-way text; V = voice/IVR; WA = WhatsApp; U = USSD.

| Sector | 2 highest-value use cases | Data they hold | Best channel | Compliance / special needs |
|---|---|---|---|---|
| **Banks** | (1) OTP and transaction alerts (debit/credit), real-time via API. (2) Loan due / arrears reminders and card-expiry notices. | Core-banking customer records, CIF, KYC phone, transaction events | SMS for OTP and alerts (must work on any phone); WA for statements; V for fraud-verification callbacks | Banking-grade delivery: priority route, <10s OTP, per-operator failover, DLR per part, 99.9%+ uptime, audit trail, PDPA, Bank of Tanzania outsourcing review **[assumption: BoT requires due diligence for outsourced services; verify the current BoT guidelines]**, data in-country, no PII in logs, masked account numbers |
| **Fintechs and mobile money agents** | (1) OTP / login / KYC verification. (2) Agent float alerts, commission statements, customer transaction receipts. | User DB via API, agent network lists | SMS (OTP); U for agent self-service; WA for app-user support | OTP fraud controls (rate limits, SIM-swap check **[assumption: operator API availability]**), signed webhooks, test keys (exist) |
| **Insurers** (incl. NHIF) | (1) Premium due / policy-lapse reminders. (2) Claim status updates and policy issuance confirmation with policy no. | Policy admin system: policyholder, phone, premium schedule, claim status | SMS + WA (policy PDF); V for low-literacy micro-insurance | PDPA (health data is **sensitive**: no diagnosis in messages), consent, audit |
| **Hospitals and pharmacies** | (1) Appointment / refill reminders with 1/2 replies. (2) Lab results ready / prescription ready for pickup, plus queue-number SMS. | HMIS / EMR, appointment book, dispensing records | SMS two-way; V in Swahili; WA for larger hospitals | Sensitive health data: neutral wording, minimum data, consent at registration, update the number every visit |
| **Government agencies** (TRA, NHIF, councils) | (1) Deadline / payment notices with GePG control numbers (TRA filing dates, licence renewals, property tax). (2) Public alerts and campaign broadcasts by ward. | Taxpayer / member registers, NIDA-linked phones, council registers | SMS (reach); V for alerts; U for self-service lookups | Data residency, approval workflows (maker-checker), full audit, record retention, invoice / LPO billing (no prepaid), procurement documentation |
| **Telecom enterprise customers** (corporate accounts, MVNOs, resellers) | (1) Reseller / white-label: their own customers send through their branded sub-accounts. (2) A2P traffic hubbing as a backup route. | Their customer lists, API traffic | SMPP / HTTP API | SMPP server for clients **(we only have an SMPP client)**, per-client TPS, CDR reports, reconciliation, wholesale rates |
| **Logistics and courier** | (1) Parcel status + pickup OTP. (2) Driver / rider dispatch and ETA to the recipient. | Waybills, tracking IDs, branch lists | SMS (recipient may have a basic phone); WA for photo proof of delivery | Proof of delivery logs; API events |
| **Real estate** | (1) Rent due reminders + receipts to tenants. (2) New-listing alerts to leads segmented by area and budget. | Tenant ledgers in Excel, lead lists from Instagram / brokers | SMS for rent; WA for listings with photos | Marketing consent (PDPA) for leads; transactional for tenants |
| **Hotels and tourism** | (1) Booking confirmation, pre-arrival info, guest feedback survey. (2) Staff / guide shift alerts and supplier coordination. | PMS / booking.com exports, guest phones (often foreign, +44/+49 etc.) | WA (international guests), SMS fallback | International numbers (`normalizePhone` accepts them, but pricing differs), English / German / French templates |
| **Media and radio** | (1) **Audience voting / polls and competitions by SMS keyword** ("tuma A kwenda 15xxx"), with live tallies on air. (2) Listener call-back and contributor alerts. | Inbound MSISDNs only | 2-way SMS on a shortcode; V (missed-call voting) | Shortcode rental ([AT costs](https://help.africastalking.com/en/articles/4161210-2-way-sms-shortcode-in-tanzania)); premium-rate needs a TCRA content licence **[assumption]**; TCRA content rules ([Online Content Regs, cited here](https://dailynews.co.tz/tcra-issues-bulk-sms-guidelines-during-election/)); dedupe one vote per number; real-time dashboard |
| **Agricultural co-operatives (AMCOS)** | (1) **Farmer price alerts** (crop prices, auction dates, input availability) by **Swahili voice** for low-literacy farmers. (2) Payment-to-farmer notices after an auction (kg × price = amount) and extension tips. | Member registers (often paper), weigh-in / auction records in Excel | V first (Swahili IVR, recorded voice), SMS second, U for price lookups | Recorded Swahili prompts (voice in Swahili for farmers is a known gap; cf. [Mozilla Common Voice Kiswahili](https://www.mozillafoundation.org/en/blog/talk-swahili-to-me-voice-enabled-apps-changing-the-game-for-farmers-and-local-communities/)); shared phones; low-cost voice |
| **Religious organisations** | (1) Announcements + bereavement / event alerts. (2) Pledge and contribution reminders with balances and receipts. | Member registers by jumuiya / zone | SMS + V (elderly); WA for media | Consent; religious data is **sensitive** under PDPA: do not leak membership lists |
| **Events** (concerts, conferences, weddings, sendoffs) | (1) Ticket / invitation with QR or code + check-in verification (OTP-like). (2) Day-of logistics and contribution (michango) reminders for wedding committees. | Ticket sales / guest lists in Excel or WA chats | SMS for the code; WA for e-cards with images | Code uniqueness and verification API; short-lived campaigns, so pay as you go |

### 2.10 Enterprise requirements

Status is checked against SPEC.md, the backend README and migrations: ✅ exists, 🟡 partial, ❌ missing.

| Requirement | Why Tanzanian enterprises ask for it | Status today |
|---|---|---|
| SLA (uptime, OTP latency, DLR timeliness) with status page and credits | Banks, fintechs and government tenders require written SLAs **[assumption]** | ❌ No SLA, no status page. `/health` exists. |
| Redundant routes / failover | A single SMPP bind, and Textify only (README: "Run exactly one worker"), is a single point of failure | ❌ The provider layer is pluggable, but there is no second route or failover |
| Sub-accounts for branches / schools / departments with balance allocation and roll-up reporting | Bank branches, school chains, NGO country programmes, council departments | ❌ Flat `account_id`; no parent/child |
| Role permissions (maker-checker, approver, sender, viewer, finance, developer) | Governments and banks need two-person approval for broadcasts | 🟡 Roles owner/admin/member only |
| Audit logs (who uploaded, edited, approved, sent; IP; immutable; exportable) | TCRA record keeping; PDPA accountability; bank audit | ❌ No audit table |
| Dedicated sender IDs with **per-operator** registration tracking and documents | Operators register separately ([Telerivet](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa)) | 🟡 A single `status` per sender ID; needs per-operator status, document upload, template registration (Yas) |
| API rate and throughput guarantees (per-key TPS, priority queues for OTP) | OTP must not wait behind a 50k campaign | 🟡 Fixed 100 req/min per key and global 50 TPS; no priority lane, no per-customer TPS |
| Postpaid / credit invoicing, LPO, TRA EFD/VFD receipts, monthly statements | Government and corporates pay by invoice on 30–60 day terms **[assumption]** | ❌ Prepaid wallet only; payment gateway is a TODO |
| Data residency in Tanzania + PDPC registration + cross-border permit | PDPA regulation 20 permit for transfers ([Afriwise](https://www.afriwise.com/blog/legal-and-compliance-requirements-for-cross-border-personal-data-transfers-under-tanzanias-personal-data-protection-framework)) | ❌ Unspecified; depends on hosting |
| Consent ledger and suppression lists (source, timestamp, purpose, per sender) | PDPA explicit opt-in for marketing | 🟡 Global STOP/ACHA opt-out only; no consent records or purpose |
| Two-way: shortcodes, keywords, inbox, auto-replies | Polls, RSVPs, promise-to-pay, support | 🟡 Inbound stored and webhook fires; no shortcode, keyword routing or inbox UI |
| SSO / 2FA for dashboard users | Bank IT security policies | ❌ |
| SMPP server for client connections; wholesale / reseller white-label | Telcos, aggregators, large senders | ❌ |
| Retention controls and PII masking in logs and exports | PDPA minimisation | ❌ |
| Per-department reporting, cost centres, monthly usage reports by email | Finance teams | 🟡 Stats exist; no cost centres |
| Message templates pre-approved (content registration) | Yas template registration; maker-checker | 🟡 Templates exist; no approval state |

---

## 3. What is missing in Tanzanian communication channels today

1. **Two-way by default.** Most bulk SMS is one-way from an alphanumeric sender ID, so parents cannot reply. Shortcodes are expensive (above). Bermi should offer a **shared reply number / keyword** included in the base price.
2. **Language.** Swahili-first templates, Swahili number formatting, and Swahili TTS for voice. Many tools are English-first **[assumption]**.
3. **Illiterate recipients.** About 17% of adults cannot read ([census 2022](https://dailynews.co.tz/illiteracy-rate-among-adults-up-by-6-3pc-bunge-told/)), so voice fallback is essential.
4. **Shared phones.** One phone often serves a family, so messages need privacy-aware wording (no balances or diagnoses) and the child's name in every message.
5. **Number changes.** SIMs churn and are recycled; the Boresha study flagged changing numbers. Detect them with consecutive failures, "wrong number" replies, and number differences between uploads.
6. **Multiple numbers per person.** People carry two SIMs on different operators **[assumption]**, so contacts need multiple numbers with priority, and fallback should route through the same operator.
7. **Cost control.** UCS-2 surprises from smart quotes and emoji, and 2-segment messages, inflate cost. Needs a live preview, auto-shortening and caps per campaign.
8. **Proof of delivery.** Schools and banks want per-recipient proof ("the parent received it"). The DLR exists, but exportable, auditable reports are the product.
9. **Consent and opt-out.** There is no national DND list, so each sender must keep consent records.
10. **Excel-first workflows.** Organisations live in spreadsheets, so the importer is the product.
11. **Timing.** Sending at the wrong time (school hours, late night) is wasteful. Learn each contact's best time.
12. **Connectivity of the sender.** Secretaries upload from phones over slow data, so the importer needs a small payload and a mobile UI.

---

## 4. The "Learn → Understand → Connect" model

### 4.1 Learn: what to store per contact

Contact profile fields, with how each is learned:

- `numbers[]` with priority, operator (from prefix or HLR), status (`valid / failing / changed`), last delivery.
- `preferred_channel`: SMS / voice / WhatsApp / USSD. Learned from WhatsApp opt-in, voice-call answers, or SMS non-response.
- `language`: sw / en. Inferred from the language of replies, or set by the school.
- `literacy_pref`: text / voice. Set when a parent asks for voice, replies "sijui kusoma", or never responds to SMS but answers calls.
- `best_time`: from the hour of delivered-and-replied messages.
- `response_history`: replies, sentiment, time-to-reply, promises kept.
- `relationships`: parent ↔ students (multiple), member ↔ group.
- `consent[]`: purpose, source (QR / keyword / import / form), timestamp, sender.
- `sensitivity`: shared phone, so use neutral content.

### 4.2 Understand: how the platform interprets

- **AI reply classification** (Swahili + English, sheng tolerant). Labels: confirm, decline, question, complaint, promise-to-pay (with date extraction), wrong-number, STOP, thanks. Each routes to an inbox or an automation.
- **Segmentation:** by learned attributes (non-readers, unresponsive, late payers, top performers' parents).
- **Data quality scoring** of each upload (missing phones %, damaged numbers), with a trend per school.
- **Anomaly detection:** sudden DLR failure on one operator; a number receiving messages from many unrelated accounts (shared or recycled).
- **Campaign insight:** "61% of F2 parents delivered within 1 minute; 4 asked about mathematics; 3 numbers likely changed."

### 4.3 Connect: how it acts

- **Channel routing per contact:** WhatsApp if opted in (cheaper or free inside 24 hours, [Meta](https://developers.facebook.com/docs/whatsapp/pricing)), otherwise SMS, then voice if no acknowledgement or the contact prefers voice, then USSD pull for self-service (e.g. "*xxx# → matokeo").
- **Fallback chains** with cost caps: "try SMS; if not delivered in 2 hours, try number 2; if still not, voice; if not, print slip".
- **Send-time optimisation** per contact.
- **Conversation threads** that bring replies back to the right staff member (class teacher, loan officer).
- **Closed loop to the source:** export the status back into the original Excel shape; re-upload to update (paid / not paid).

---

## 5. Recommended build order

1. **Results / Excel importer**, generic enough for fees, loans and rent:
   - header detection, multi-sheet, mapping profiles, phone cleaning
   - preview with cost, GSM sanitiser
   - per-row report and export
2. **Two-way inbox** with keyword / reply routing and AI classification (Swahili).
3. **Fallback chains + voice (Swahili TTS / recorded)**.
4. **Consent ledger + QR / keyword capture.**
5. **Enterprise:**
   - sub-accounts, roles / maker-checker, audit logs
   - postpaid invoicing
   - priority OTP lane and second route
   - per-operator sender-ID tracking
   - Tanzania hosting
6. **WhatsApp, then USSD.**
