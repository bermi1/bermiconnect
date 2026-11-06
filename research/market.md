# Bermi Connect: Market, Regulation and Opportunity Research

Prepared 5 November 2026 for Bermi Techs (Dar es Salaam). All prices and statistics carry the date of their source. **[Unverified]** marks claims that could not be confirmed against a primary or credible source. Vendor claims are labelled as vendor claims. This is research, not legal advice; confirm regulatory points with TCRA, the PDPC and a Tanzanian lawyer before launch.

---

## 1. Executive summary

1. **SMS is still the universal channel in Tanzania, but it has stopped growing.** TCRA counted about 117M mobile subscriptions and 55.05B SMS in Q2 2026, with SMS traffic down 0.05% quarter on quarter while data use rose 11.65% ([TanzaniaInvest/TCRA Q2 2026](https://tanzaniainvest.com/telecoms/telecom-subscriptions-q2-2026)). Smartphone penetration is only 44.74% and feature-phone penetration is 83.38% ([Daily News, Aug 2026](https://dailynews.co.tz/tanzanias-digital-rise-what-the-latest-tcra-report-tells-us)). A majority still cannot be reached by WhatsApp alone.
2. **The price war is settled. TZS 18 is competitive, not distinctive.** Public local prices run from TZS 13 to 25 per SMS: NextSMS TZS 13–16 (2021), Beem TZS 17–25 (2021), Flex TZS 17, HelloDuty TZS 19, Celcom about TZS 23, Sakura TZS 25 ([dev.to 2021](https://dev.to/alphaolomi/bulk-sms-provider-in-tanzania-1dj4), [Flex](https://pricing.flex.co.tz/), [HelloDuty](https://helloduty.com/country/tanzania), [Celcom](https://celcomafrica.com/bulk-sms-tanzania), [Sakura](https://billing.sakurahost.co.tz/knowledgebase/49/Understanding-SMS-Pricing-and-Credit-System-in-Tanzania.html)). Global CPaaS prices are 10 to 25 times higher; Twilio, for example, charges $0.4336 per segment ([Twilio](https://www.twilio.com/en-us/sms/pricing/tz)).
3. **Voice in Swahili is the clearest gap.** Africa's Talking lists voice for Tanzania ([AT help](https://help.africastalking.com/en/articles/11532624-countries-offering-voice-product)), and HelloDuty publishes voice at TZS 1.08 per second outbound ([HelloDuty](https://helloduty.com/country/tanzania)). We found no Tanzanian provider offering *Swahili AI voice* (results read aloud, IVR, AI agents) as a self-serve product.
4. **The Swahili speech stack is now good enough and cheap enough.** Usable options include Azure sw-TZ voices, Google sw-KE Chirp 3 HD, ElevenLabs v3, Fish Audio S2.1 Pro (claims 83 languages including Swahili), Soniox STT at about $0.12/hour, and an open CC-BY Swahili TTS (Msingi-AI). Details are in §7.
5. **Compliance is now enforced and is a selling point.** Since 16 June 2025, unregistered sender IDs have been blocked on Vodacom, Airtel, Yas/Tigo and Zantel ([Twilio guidelines](https://www.twilio.com/en-us/guidelines/tz/sms)). PDPC registration closed on 8 April 2026, full PDPA enforcement started 9 April 2026 ([The Chanzo](https://thechanzo.com/2026/03/27/data-protection-commission-issues-final-warning-ahead-of-april-enforcement-deadline/)), and on-site inspections began in late August 2026 ([The Citizen](https://thecitizen.co.tz/tanzania/news/national/data-protection-regulator-begins-compliance-crackdown-5574710)). Bermi must register itself and can sell "PDPA-ready messaging" to schools and SMEs.
6. **Tanzania has no national do-not-disturb (DND) registry.** Opt-out handling is the sender's own job. STOP/SIMAMA handling and proof-of-consent records are both a legal need and a differentiator ([Telerivet, Mar 2026](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa)).
7. **Schools are underserved on communication.** ShuleSoft, InfoTaaluma (253 schools, 200k parents, 2024), ShuleYetu and Schoolinsight include parent SMS, but none offers Swahili voice or a multi-channel parent graph ([ShuleSoft](https://www.shulesoft.co/modules), [ANB Post](https://anbpost.substack.com/p/200000-tanzanian-parents-now-track)). Today NECTA results reach families by web, notice boards and USSD *152*00# at about TZS 100 per request ([cvstudio, Sep 2026](https://www.cvstudio.io/necta-results-tanzania-how-to-check-csee-acsee)).
8. **Mobile money is the billing rail.** There are 87.05M active mobile-money accounts: M-Pesa 40.6%, Mixx by Yas 32.0%, Airtel Money 16.4% ([TanzaniaInvest Q2 2026](https://tanzaniainvest.com/telecoms/telecom-subscriptions-q2-2026)). Wallet top-up by mobile money, and "pay-per-reach" pricing, should be native.
9. **Partner identities need confirming.** "Textify" most likely means Textify Mobile Solutions Ltd (Nairobi), which claims SMPP, HTTP and USSD. Its Tanzanian coverage is **unverified**. "Sema Call" most likely means Sema (sema.co.tz, Dar es Salaam), which offers SMS, USSD and hosted voice. **"Siliana" could not be identified.** Fish Audio is confirmed and well documented (§8–9).
10. **Path to global.** Win Tanzania with Swahili-first, multi-channel communication. Then move to Kenya and Uganda, which share the Swahili/English corridor and fast-growing smartphone bases. Then sell "African-language voice + low-literacy reach" as a global API, following Fish Audio's playbook: open assets, a generous free tier and developer-first pricing (§10–11).

---

## 2. Competitor comparison

Prices are per SMS to Tanzanian numbers unless noted. "–" means not offered or not found.

| Provider | HQ / focus | SMS | WhatsApp | Voice / IVR | USSD | Email | OTP | TZ SMS price (date) | Notes and weaknesses |
|---|---|---|---|---|---|---|---|---|---|
| **Beem Africa** | Dar es Salaam; 20+ African markets, 55+ MNO links ([MEF](https://mobileecosystemforum.com/members/beem/)) | ✔ | ✔ (per reviewer, [Trustpilot](https://fr-be.trustpilot.com/review/beem.africa)) | Unverified | ✔ | – | ✔ | TZS 17–25 by volume (May 2021, [dev.to](https://dev.to/alphaolomi/bulk-sms-provider-in-tanzania-1dj4)); current price unverified | BeemAPI and the self-serve BeemEngage; also airtime, chatbots and payments. Trustpilot score 4.1 from 11 reviews; one Jan 2025 review reports over 80% rejection on one MNO and scripted support. Enterprise-oriented. |
| **NextSMS** | Tanzania, since 2016 ([SaaSBrowser](https://saasbrowser.com/hi/saas/63248/nextsms)) | ✔ | – | – | – | – | ✔ (via API) | TZS 13–16 by package (2021, [dev.to](https://dev.to/alphaolomi/bulk-sms-provider-in-tanzania-1dj4)) | Price leader. The 2021 review found documentation limited to API endpoints. SMS-only. |
| **Briq** (BRIQ Digital Ltd) | Dar es Salaam ([VC4A](https://vc4a.com/ventures/briq-digital-limited/)) | ✔ | ✔ | ✔ | – | – | ✔ | Not public | Positions itself as "communication infrastructure for Africa"; usage-based SMS, WhatsApp and voice, plus AI chatbots and workflows. The closest positional rival to Bermi. Stage and customers not public. |
| **Africa's Talking** | Nairobi; pan-African | ✔ | Not listed for TZ | ✔ listed for TZ ([AT](https://help.africastalking.com/en/articles/11532624-countries-offering-voice-product)) | ✔ | – | ✔ | TZS 20–22 (2021); current price page unreachable | Live in TZ for SMS, shortcodes, USSD, airtime and payments ([AT](https://help.africastalking.com/en/articles/2727792-which-countries-are-africa-s-talking-products-in)). Strong SDKs and docs. Dedicated shortcode takes about 3 months, costs $2,000 + $50 + TZS 1.6M to set up and about $3,000 + TZS 4.6M a year ([AT](https://help.africastalking.com/en/articles/4161210-2-way-sms-shortcode-in-tanzania)). Incoming shortcode SMS costs TZS 80–100 each. |
| **FastHub Solutions** | Dar es Salaam ([BTW Media, Aug 2025](https://btw.media/en/fasthub-simplifies-mobile-payments-and-messaging-in-tanzania)) | ✔ | ✔ | ✔ IVR, toll-free, outbound, call centre | ✔ | – | – | Not public | Holds TCRA and BoT certifications; mobile-money APIs. Enterprise and managed-service focus. Fasthub Notify app. |
| **Sema** (AIM Firms Ltd) | Dar es Salaam ([sema.co.tz](https://sema.co.tz/airtime-recharge/)) | ✔ | WhatsApp bot | Hosted cloud PBX ([Sema Voice](https://sema.co.tz/voice/)) | ✔ | ✔ bulk | – | Not public | Also RCS and airtime. Voice is unified communications/PBX rather than programmable IVR (as far as the public site shows). See §8. |
| **Bongo Live** | Dar es Salaam, since 2010/12 ([Clutch](https://clutch.co/profile/bongo-live)) | ✔ | – | – | VAS | – | – | Not public | Licensed mobile solutions provider; serves banking, insurance, government, education and FMCG. |
| **Notify Africa** | Dar es Salaam, 2024 ([G2](https://www.g2.com/sellers/notify-africa)) | ✔ | ✔ | – | – | – | – | Not public | Vendor claims: 5,000 msg/s, 98.5% delivery, AI chatbots, Swahili support. New entrant. |
| **egoSMS** | Uganda-based, TZ page ([egoSMS](https://egosms.co/tz/)) | ✔ | – | – | shortcodes | – | ✔ | Not shown | Targets schools, SACCOs, hospitals and churches; scheduling, CSV import. |
| **Sakura SMS** | Sakura Host, TZ ([Sakura](https://billing.sakurahost.co.tz/knowledgebase/49/Understanding-SMS-Pricing-and-Credit-System-in-Tanzania.html)) | ✔ | ✔ | – | – | – | – | TZS 25 indicative; 10–15% volume discounts | Credits never expire; refundable within 90 days. Sender ID approval in 3–10 business days ([Sakura](https://billing.sakurahost.co.tz/knowledgebase/45/Understanding-SMS-Sender-IDs-and-How-to-Request-One-in-Tanzania.html)). |
| **HelloDuty** | Pan-African ([HelloDuty, Jun 2026](https://helloduty.com/country/tanzania)) | ✔ two-way | ✔ | ✔ virtual numbers, IVR | ✔ | – | – | TZS 19 | Most transparent TZ price list: voice TZS 1.08/s out and 0.4/s in; USSD shared $110/month per telco; dedicated USSD $2,000 setup + $150/month per telco; two-way SMS setup TZS 198k. |
| **Flex** | TZ contact centre ([Flex](https://pricing.flex.co.tz/)) | ✔ | ✔ | ✔ inbound, local numbers | – | – | – | TZS 17 | CRM and contact centre priced per seat (from TZS 200k per user per month for WhatsApp). |
| **Celcom Africa** | Kenya; TZ routes ([Celcom](https://celcomafrica.com/bulk-sms-tanzania)) | ✔ | ✔ | – | – | – | ✔ | €0.0095 ≈ TZS 23 | Direct links to Vodacom, Airtel and Yas; sender IDs filed per operator. |
| **Termii** | Lagos | ✔ | ✔ | voice OTP | – | – | ✔ | Not found | TZ coverage **unverified**. One July 2026 review complains it took more than a week to get a sender ID and gave no refund ([Trustpilot](https://www.trustpilot.com/review/termii.com)). |
| **Hubtel** | Accra | ✔ | – | – | – | – | – | Ghana-local only; international via 42 Telecom ([Hubtel](https://explore.hubtel.com/?p=19)) | Not a TZ competitor. Its SMS-plus-payments bundle is a good model. |
| **Infobip** | Global; East Africa team ([Guardian, Jul 2025](https://ippmedia.co.tz/the-guardian/business/read/infobip-brings-voice-calling-to-whatsapp-business-users-2025-07-18-164650)) | ✔ | ✔ + WhatsApp calling | ✔ | – | ✔ | ✔ | ≈ $0.232 (Oct 2025, [sent.dm](https://www.sent.dm/en/resources/sms-pricing/tanzania-sms-pricing)) | Enterprise and bank-grade, but expensive and sales-led. |
| **Twilio** | Global | ✔ (no two-way in TZ) | ✔ | ✔ | – | ✔ | ✔ | $0.4336 per segment (Oct 2026, [Twilio](https://www.twilio.com/en-us/sms/pricing/tz)) | Pre-registration takes about 3 weeks domestic and 4 weeks international ([Twilio](https://www.twilio.com/en-us/guidelines/tz/sms)). |
| **Sinch / Plivo** | Global | ✔ | ✔ | ✔ | – | ✔ | ✔ | Sinch $0.255; Plivo $0.144 (Oct 2025, [sent.dm](https://www.sent.dm/en/resources/sms-pricing/tanzania-sms-pricing)) | Developer-grade but priced in USD. |
| **Selcom** | Dar es Salaam payments | – | – | – | – | – | – | – | Found no evidence of a public messaging product **[unverified]**. Payments aggregator: a partner, not a competitor. |
| **e-GA mGov** | Government | ✔ | – | – | ✔ | – | – | – | Government institutions send SMS through the e-GA gateway (an unofficial SDK exists: [GitHub](https://www.github.com/lykmapipo/tz-ega-sms)). Whether its use is mandatory **[unverified]**. Public bodies are a harder market. |

**Recurring customer complaints across the market:** slow sender ID approval; rejections or silent failures on one MNO (DLRs that show "delivered" on grey routes, a known risk flagged for Kenya by [Telerivet](https://www.telerivet.com/blog/kenya-sms-sender-id-compliance-safaricom)); scripted support; non-refundable credit; USD pricing; and no two-way SMS on standard A2P routes ([Twilio](https://www.twilio.com/en-us/guidelines/tz/sms)). JamiiForums searches returned no substantive complaint threads, so forum sentiment is **unverified**.

---

## 3. Regulation checklist: what Bermi must do before launch

| # | Requirement | Detail | Source |
|---|---|---|---|
| 1 | **Register sender IDs per network** | Every alphanumeric ID must be pre-registered. Since 16 June 2025, unregistered IDs are blocked on Vodacom, Airtel, Yas/Tigo and Zantel. Dynamic or unregistered IDs are not supported, and numeric or generic IDs (INFO, Verify, Notify) are rejected. IDs are 3–11 letters and digits. Airtel wants message content to reference the brand. Yas requires the sender name and the content template to be registered. Halotel and TTCL may overwrite IDs. Re-register for any rename or new use case. | [Twilio](https://www.twilio.com/en-us/guidelines/tz/sms), [Telerivet](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa), [sent.dm](https://sent.dm/en/resources/sms-compliance/tanzania-sms-guide) |
| 2 | **Build a sender ID KYC workflow** | Collect from each customer: BRELA certificate, TIN, a request letter on letterhead and the signatory's national ID. Approval takes 3–10 business days locally, or 2–4 weeks per other sources. Build the onboarding form, document storage and status tracking per MNO. | [Sakura](https://billing.sakurahost.co.tz/knowledgebase/45/Understanding-SMS-Sender-IDs-and-How-to-Request-One-in-Tanzania.html), [Telerivet](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa) |
| 3 | **Confirm TCRA licence status (Bermi and Textify)** | Bermi resells A2P SMS through an aggregator. Confirm whether Bermi needs its own TCRA Application Services licence or can operate under Textify's licence. TCRA has warned unlicensed online service providers. **[Unverified: no primary text found that names the licence class for SMS resellers. Ask TCRA and Textify in writing.]** | [Daily News on TCRA warnings](https://dailynews.co.tz/tcra-sounds-a-warning-to-unlicensed-online-service-providers/), [TCRA individual licence guidelines](https://www.tcra.go.tz/download/sw-1628847969-Guidelines%20for%20Application%20of%20Individual%20Licence.pdf) |
| 4 | **Register with the PDPC as controller and processor** | Every data controller or processor must register (Form No. 1, fee based on headcount, certificate valid 5 years). The final deadline was 8 April 2026; full enforcement started 9 April 2026; inspections began in late August 2026. Failing to register carries fines up to TZS 5bn for institutions. Bermi is the *processor* for customer contact lists and the *controller* for its own account data. | [Afriwise regs](https://www.afriwise.com/blog/tanzania-regulations-made-under-the-personal-data-protection-act-2022-23-june-2023), [The Chanzo](https://thechanzo.com/2026/03/27/data-protection-commission-issues-final-warning-ahead-of-april-enforcement-deadline/), [The Citizen](https://thecitizen.co.tz/tanzania/news/national/data-protection-regulator-begins-compliance-crackdown-5574710) |
| 5 | **Appoint a Data Protection Officer** | Required for controllers and processors. The DPO submits quarterly compliance reports to the PDPC. | [DLA Piper](https://www.dlapiperdataprotection.com/guide.pdf?c=TZ) |
| 6 | **Consent for marketing** | The PDPA requires explicit consent for direct or commercial marketing. Section 32 of the Electronic Transactions Act 2015 bars unsolicited commercial communication unless the recipient consented, the sender and purpose are identified, and an opt-out is offered. Applying s.32 to SMS is a reasonable reading but **unverified**. The product needs consent capture (source, timestamp), a promotional/transactional flag, and a sender-name prefix. | [DLA Piper](https://www.dlapiperdataprotection.com/guide.pdf?c=TZ), [FB Attorneys](https://fbattorneys.co.tz/unsolicited-advertising-emails/) |
| 7 | **Opt-out and suppression** | There is no national DND registry. Support STOP/SIMAMA and HELP/MSAADA, process within 24 hours, and check a suppression list before every send. Bermi's global STOP already does this. Two-way SMS is not supported on standard A2P, so provide a fallback opt-out (USSD, missed call or link) for one-way sender IDs. | [Telerivet](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa), [sent.dm](https://sent.dm/en/resources/sms-compliance/tanzania-sms-guide) |
| 8 | **Sending hours** | No statutory quiet hours were found. Best practice is 08:00–20:00 EAT, except urgent or transactional messages. Build quiet hours into campaign scheduling. | [sent.dm](https://sent.dm/en/resources/sms-compliance/tanzania-sms-guide) |
| 9 | **Content restrictions and moderation** | Gambling, adult content, unlicensed financial offers, crypto and unauthorised political content are restricted. During the 2025 election, TCRA required screening and prior approval of election content, plus record-keeping by aggregators. TCRA has recorded and monitored SMS across networks since October 2024 to fight fraud. Bermi needs content filters, an audit log and message retention. | [Daily News, Aug 2025](https://dailynews.co.tz/tcra-issues-bulk-sms-guidelines-during-election/), [Telerivet](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa) |
| 10 | **Cross-border data transfer** | Transferring personal data abroad needs a PDPC permit with contractual safeguards. This matters if contacts, voice audio or AI prompts go to foreign clouds (Fish Audio, Azure, Google, ElevenLabs). Host the primary database in Tanzania or obtain the permit; minimise PII in TTS/STT calls. | [Afriwise regs](https://www.afriwise.com/blog/tanzania-regulations-made-under-the-personal-data-protection-act-2022-23-june-2023), [DLA Piper](https://www.dlapiperdataprotection.com/guide.pdf?c=TZ) |
| 11 | **Breach notification** | Notify the PDPC promptly of any breach. No fixed deadline is stated. | [DLA Piper](https://www.dlapiperdataprotection.com/guide.pdf?c=TZ) |
| 12 | **USSD and shortcodes** | Assigned by TCRA under the Numbering and Electronic Address Regulations and integrated with each MNO. Dedicated shortcode: TCRA fee $2,000 + $50 application, $3,000 a year, about 3 months. Shared keyword shortcode: about TZS 198.5k setup + TZS 79.4k a month. USSD shared code: about $110 a month per telco; dedicated USSD: $2,000 setup + $150 a month per telco (aggregator prices). Start on shared codes. | [AT](https://help.africastalking.com/en/articles/4161210-2-way-sms-shortcode-in-tanzania), [HelloDuty](https://helloduty.com/country/tanzania), [TCRA numbering guidelines](https://tcra.go.tz/uploads/documents/en-1651054213-GUIDELINES%20FOR%20NUMBERING%20APPLICATION%20AND%20ASSIGNMENT%202022%20(1)%20(4).pdf) (PDF could not be loaded) |
| 13 | **Voice / IVR** | Outbound calling needs numbers and termination from a licensed operator or aggregator, using caller IDs registered to the customer. Specific TCRA rules for robocalls or IVR were **not found [unverified]**. Use the same consent and quiet-hours rules as SMS, and avoid caller ID spoofing. | [HelloDuty](https://helloduty.com/country/tanzania) |
| 14 | **WhatsApp** | WhatsApp is not regulated by TCRA, but Meta's policy requires opt-in and approved templates. Tanzania falls in Meta's "Rest of Africa" pricing band (§5). | [Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md) |
| 15 | **Taxes and receipts** | VAT on SMS resale and EFD receipts are standard TRA obligations **[not researched; confirm with an accountant]**. | – |

---

## 4. Channel reach: who you can reach on which channel

| Indicator (Tanzania) | Value | Date | Source |
|---|---|---|---|
| Population | 71.0M | Oct 2025 | [DataReportal](https://datareportal.com/reports/digital-2026-tanzania) |
| Mobile subscriptions (SIMs) | 116.85M (167% penetration) | Jun 2026 | [TanzaniaInvest/TCRA](https://tanzaniainvest.com/telecoms/telecom-subscriptions-q2-2026) |
| Operator share | Vodacom 33.0%, Yas 28.6%, Airtel 20.5%, Halotel 16.4%, TTCL 1.5% | Jun 2026 | same |
| Smartphones on network | 31.34M; 44.74% penetration | Jun 2026 | [Daily News](https://dailynews.co.tz/tanzanias-digital-rise-what-the-latest-tcra-report-tells-us) |
| Feature-phone penetration | 83.38% (TCRA basis differs from the smartphone figure) | Jun 2026 | same |
| 2G-only data subscriptions | 24.6M | Jun 2026 | [TanzaniaInvest](https://tanzaniainvest.com/telecoms/telecom-subscriptions-q2-2026) |
| Internet subscriptions | 62.79M (89.7%, counted as subscriptions). DataReportal estimates 20.6M unique internet *users* (29.1%). | Jun 2026 / late 2025 | [TanzaniaInvest](https://tanzaniainvest.com/telecoms/telecom-subscriptions-q2-2026), [DataReportal](https://datareportal.com/reports/digital-2026-tanzania) |
| Social media user identities | 7.95M (11.2%) | Oct 2025 | [DataReportal](https://datareportal.com/reports/digital-2026-tanzania) |
| WhatsApp users | No reliable 2026 Tanzanian figure found **[unverified]**. Facebook led and WhatsApp was second by TCRA measure in 2022. For comparison, Uganda had 11M WhatsApp subscriptions in June 2026. | 2022 / 2026 | [TanzaniaInvest 2022](https://www.tanzaniainvest.com/telecoms/social-media-network-ranking-q3-2022), [PC Tech (Uganda)](https://pctechmag.com/?p=95967) |
| SMS traffic | 55.05B per quarter, flat (−0.05%) | Q2 2026 | [TanzaniaInvest](https://tanzaniainvest.com/telecoms/telecom-subscriptions-q2-2026) |
| Voice traffic | 48.82B minutes, +7.44% | Q2 2026 | same |
| Mobile money accounts | 87.05M; M-Pesa 40.6%, Mixx 32.0%, Airtel Money 16.4%; 2.1B transactions per quarter | Jun 2026 | same |
| Adult literacy (15+) | 83.0% (men 86.8%, women 79.5%; Zanzibar 90.6%) | 2022 Census | [NBS](https://sensa.nbs.go.tz/publication/08.%20Key_Findings_Basic_Demographic_and_Socio-economic_%20Eng_%2012.06.2024%20Final.pdf) |
| Phone ownership by sex | Women 62%, men 71% | NBS, cited 2026 | [AllAfrica/Daily News](https://allafrica.com/stories/202605260259.html) |
| Coverage | 2G 98.66%, 3G 93.95%, 4G 94.39%, 5G 34.18% | Jun 2026 | [TanzaniaInvest](https://tanzaniainvest.com/telecoms/telecom-subscriptions-q2-2026) |

**What this means for channel choice**
- **SMS** reaches virtually every handset. It is the default for alerts, OTPs, fees and results.
- **Voice** reaches every handset *and* the roughly 17% of adults who cannot read (the inverse of 83% literacy; higher among women and in rural areas). Swahili voice is the inclusion channel.
- **USSD** gives interactive, session-based self-service on feature phones (e.g. "check results", "confirm attendance"). People already know it from NECTA's *152*00#.
- **WhatsApp** reaches the smartphone minority (about 45%) cheaply for rich media. Utility templates cost about $0.0046 each, against roughly $0.007 (TZS 18) for an SMS (§5).
- **Language.** Swahili is the national lingua franca. The census profile does not split literacy by language **[Swahili-vs-English literacy split unverified]**. Default to Swahili with English as an option, and handle code-switching (Sheng/Swanglish).

---

## 5. WhatsApp economics for Tanzania

- Since 1 July 2025, Meta charges per delivered template message. Service (free-form) replies inside the 24-hour window are free, and utility templates sent inside an open window are free ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md)).
- Tanzania (+255) is in the **Rest of Africa** band: marketing $0.0259, utility $0.0046, authentication $0.0046 per message. These are unchanged by the 1 October 2026 update ([Gallabox rate card](https://docs.gallabox.com/pricing-and-billing/whatsapp-pricing/rate-card.md); confirm against Meta's CSV).
- Some secondary sources say service messages became chargeable after 1,000 per month from 1 October 2026 ([Kanal](https://getkanal.com/blog/whatsapp-vs-sms-pricing-by-country.md)). Meta's own page does not describe this **[conflicting; verify]**.
- **Implication:** A WhatsApp utility message (about TZS 12 at roughly 2,600 TZS/USD **[FX assumption]**) is cheaper than an SMS (TZS 18), but only for smartphone users who have opted in. The best value is "WhatsApp first, SMS fallback, voice for non-readers".

---

## 6. School systems landscape

| System | What it does | Parent messaging | Source |
|---|---|---|---|
| **ShuleSoft** | Full school management system: academics, accounts, attendance, admission, a parent app, UCN payments | Report cards by WhatsApp, SMS or email; communication automation module | [ShuleSoft modules](https://www.shulesoft.co/modules) |
| **InfoTaaluma (Mzazi)** | Cloud management system backed by the Mastercard Foundation | Parent app plus SMS for basic phones. 253 schools, 12 regions, 200k+ parents (2024) | [ANB Post, Oct 2024](https://anbpost.substack.com/p/200000-tanzanian-parents-now-track) |
| **ShuleYetu** (Shule Yetu Innovations) | School management system targeting truancy and accountability (2025) | Not clear from the public article **[unverified]** | [The Citizen, May 2025](https://www.thecitizen.co.tz/tanzania/news/national/new-digital-innovation-to-tackle-truancy-and-enhances-school-accountability-in-tanzania-5046548), [shuleyetu.co.tz](https://www.shuleyetu.co.tz/) |
| **Schoolinsight** | Hosted SaaS for nursery to A-level | Advertises "free unlimited SMS" for results (2020) | [JamiiForums](https://www.jamiiforums.com/threads/school-management-system.1748550/) |
| **Shule Direct** | Learning content platform (not school management) | Student-facing app; not a parent messaging tool | [Shule Direct](https://apps.apple.com/us/app/shule-direct/id1323956808) |
| **Airtel Money / MNO fee collection** | School-fee digitisation partnerships | Payment confirmations | [The Citizen, Jun 2024](https://thecitizen.co.tz/tanzania/news/national/airtel-tanzania-partners-with-schools-to-digitize-school-fees-payment-4671570) |

**NECTA results** are published on necta.go.tz / matokeo.necta.go.tz (listed by centre), on school notice boards, and through USSD *152*00# at about TZS 100 per query, delivered as an SMS. A per-release SMS shortcode is sometimes announced. ACSEE results typically come in early July ([cvstudio, Sep 2026](https://www.cvstudio.io/necta-results-tanzania-how-to-check-csee-acsee)). Standard 4 and Form 2 results were due 10 January 2026 ([Mabumbe](https://mabumbe.com/blog/?p=18032)). Tanzania's government also plans Swahili LLM pilots in education and tax filing in late 2026 ([Pulse, May 2026](https://www.pulse.bot/govtech/news/tanzania-nears-launch-of-swahili-llm-to-power-government-services-a4cf8b42-cdd7-4258-bcce-e0be3b7b81c3/)).

**Gap:** The school systems hold the data but treat messaging as a bolt-on. Bermi should *integrate with* them through an API, a ShuleSoft/InfoTaaluma connector and a CSV results import, rather than compete. It can then add what they lack: Swahili voice calls reading each child's results aloud, a USSD parent menu, per-parent channel preference, delivery proof, and a fee-reminder-to-payment link.

---

## 7. Voice and AI options for Swahili

| Provider | Swahili TTS | Swahili STT | Voice agents | Price (public) | Notes |
|---|---|---|---|---|---|
| **Microsoft Azure Speech** | sw-TZ neural voices Rehema and Daudi ([json2video](https://json2video.com/ai-voices/azure/voices/sw-tz-rehemaneural/)) | sw-TZ and sw-KE listed. Fast transcription supports sw-KE only ([MS Learn](https://learn.microsoft.com/azure/ai-services/speech-service/language-support)). | Via your own stack | Neural TTS about $15 per 1M characters ([CloudPrice, Nov 2026](https://cloudprice.net/models/azure/speech/azure-tts)); STT price did not render | The only big cloud with a *Tanzanian* Swahili voice. Safe default. |
| **Google Cloud** | Chirp 3 HD sw-KE, likely GA ([Google](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)) | Supported **[locale detail unverified]** | Via your own stack | Standard/WaveNet $4, Neural2 $16, Chirp 3 HD $30 per 1M characters; free tier 1–4M ([Google](https://cloud.google.com/text-to-speech/pricing/?authuser=2)) | Kenyan accent only. |
| **ElevenLabs** | v3 only ([ElevenLabs](https://elevenlabs.io/docs/help-center/other/what-languages-do-you-support)) | Scribe: Swahili FLEURS WER 10.2% vs Gemini 9.8%, Whisper 39.5% ([ElevenLabs](https://elevenlabs.io/speech-to-text/swahili)) | ElevenAgents | Plan-based; per-minute agent price not found | v3 has higher latency than Flash. Flash v2.5 has no Swahili. |
| **Fish Audio** | S2.1 Pro claims 83 languages including Swahili ([PC Tech, Aug 2026](https://pctechmag.com/2026/08/how-voice-ai-is-helping-african-businesses-scale-content-and-customer-communication/)). Fish's own docs do not list languages ([Fish docs](https://docs.fish.audio/developer-guide/models-pricing/models-overview.md)) **[Swahili quality unverified: test it]**. | transcribe-1 / stream-1 at $0.36/hour | Through LiveKit, Retell and Telnyx partners | $15 per 1M UTF-8 bytes; s2.1-pro-free at $0 under fair use ([Fish pricing](https://docs.fish.audio/docs/models-pricing/pricing-and-rate-limits)) | See §8–9. |
| **Soniox** | – | Real-time Swahili with code-switching ([Soniox](https://soniox.com/platform/swahili)) | Turn detection for agents | About $0.10/hour async, $0.12/hour real-time | Cheapest real-time STT found. |
| **Meta MMS** | 1,100+ languages including Swahili | Yes | – | Free, but **CC BY-NC 4.0, non-commercial** ([InfoQ](https://www.infoq.com/news/2023/06/meta-mms-speech-ai/)) | Not usable commercially. |
| **Msingi-AI "Sauti" (Dia-1.6B fine-tune)** | Swahili single voice, handles code-switching; CER 0.011–0.06 | – | – | Open, CC-BY-4.0 (commercial use allowed) ([HF](https://huggingface.co/msingiai/dia)) | Short-form only; self-hostable fallback. |
| **Lelapa AI Vulavula** | – | STT with language ID; Swahili translation | – | 100 free calls per key; paid plans ([Lelapa](https://docs.lelapa.ai/overview/introduction)) | South African; strong on African languages. |
| **Retell / Vapi / LiveKit** | Uses third-party TTS | Uses third-party STT | Yes; Retell markets Swahili ([Retell](https://www.retellai.com/languages-ai/swahili-ai)) | Per minute (not checked) | Need a SIP trunk to TZ numbers (e.g. from AT, HelloDuty or Sema). |
| **Telephony to TZ handsets** | – | – | – | HelloDuty: TZS 1.08/s out (about TZS 65 per minute), 0.4/s in ([HelloDuty](https://helloduty.com/country/tanzania)) | Termination is the dominant cost, not the AI. |

**Cost sketch for a 45-second Swahili results call** (unverified estimate): about 600 characters of TTS costs ≈ $0.009 at Fish or Azure rates, plus 45 s × TZS 1.08 ≈ TZS 49 of airtime. **The telco minute is about 90% of the cost.** Cache audio per template, use short scripts, and negotiate per-second termination.

---

## 8. Bermi's current partners: Textify, Siliana, Sema Call, Fish Audio

### 8.1 Textify (SMS upstream)

- **Most likely identity:** Textify Mobile Solutions Ltd, Phoenix House, Nairobi; +254 792 322 220, info@textify.co.ke ([Textify about](https://textify.github.io/about-us.html)). It offers bulk SMS, shortcodes, USSD and 2FA. Its shortcode page says inbound can be delivered by **SMPP, Parlay X, or HTTP push/pull**, and claims 40,000 SMS/s throughput and Unicode support ([Textify shortcodes](https://textify.github.io/shortcodes.html)).
- **Not to be confused with:** texti.fi (Textifi, a Baltic SMS SaaS) ([Capterra](https://www.capterra.co.za/software/1028957/textifi)) or "SMS Textify", a Shopify app ([Shopify](https://apps.shopify.com/sms-textify?locale=es)).
- **Unverified:** Direct connections to Tanzanian MNOs, a Tanzanian entity or TCRA licence, TZ pricing, uptime SLA and the sender ID process. No public source ties Textify to Tanzania. **Confirm that Bermi's Textify is this company.**
- **What Bermi must ask Textify, in writing:**
  1. Legal entity, and the TCRA licence that covers A2P to Tanzania. Can Bermi resell under it, or does Bermi need its own licence?
  2. Routes: direct binds to Vodacom, Yas, Airtel, Halotel and TTCL, or via a hub? Named routes per network, and a written no-grey-route guarantee.
  3. Sender ID process per network: documents, SLA, who files, Yas template registration, and how long.
  4. SMPP details: version 3.4, TLS, host/port, system_id, system_type, number of binds, TPS per bind (the SPEC currently assumes 50), window size, enquire_link interval.
  5. DLRs: `registered_delivery` support, DLR latency, final status codes and the error-code map per MNO, plus message-ID format (hex or decimal) in `deliver_sm`.
  6. MO/inbound: is STOP or any reply delivered to Bermi on alphanumeric IDs (normally no in TZ)? A shared shortcode or long number for opt-outs?
  7. Encoding: UCS-2 and concatenation (UDH vs SAR) per network.
  8. Price per segment per network in TZS, volume tiers, whether failed or undelivered messages are refunded, and billing on submit vs delivery.
  9. Uptime SLA, maintenance windows, a status page, a 24/7 NOC contact, and failover.
  10. Data handling: where logs are stored (cross-border permit under the PDPA), retention, and a data processing agreement.
  11. HTTP API as a backup route, and whether USSD and voice termination are available.
- **Recommendation:** Keep the pluggable provider layer and add a second Tanzanian route (e.g. Beem, NextSMS or Celcom) for failover and price leverage.

### 8.2 "Siliana" (could not be identified)

Searches for Siliana, Silana, Sylana and Celiana found no communication or AI platform with that name. **Unverified.** Plausible candidates, depending on what the founder meant:
- **Sierra (sierra.ai):** an AI customer-experience agent platform across chat, voice, SMS and WhatsApp with outcome-based pricing, valued at about $15.8B in May 2026 ([Carly blog, Jul 2026](https://www.usecarly.com/blog/what-is-sierra-ai/); competitor source). It does not publish an API price list. It fits the description "global role model for AI communication".
- **SiliconFlow:** a model-hosting API that serves open TTS/STT models, including Fish Speech family models ([SiliconFlow](https://www.siliconflow.com/articles/the-cheapest-speech-to-text-models)).
- **Silero:** open-source STT/TTS models. No evidence of Swahili support was found.
- **Action:** Ask the founder for the URL or a contact.

### 8.3 "Sema Call" (probable: Sema, sema.co.tz)

- **Most likely identity:** Sema (© AIM Firms Ltd), Dar es Salaam; +255 222 775 990, info@sema.co.tz. It offers SMS, SMS/USSD shortcodes, RCS, a WhatsApp bot, sender IDs, bulk email, airtime (API and dashboard, all networks) and **Sema Voice**, a hosted, dedicated-instance cloud PBX with no upfront cost and scalable concurrent calls ([sema.co.tz](https://sema.co.tz/airtime-recharge/), [Sema Voice](https://sema.co.tz/voice/)).
- **Unverified:** a product named "Sema Call", a programmable outbound or IVR API, Swahili TTS or AI agents, and pricing. The public page describes PBX and unified communications, not a developer voice API.
- **Not to be confused with:** Sema API (sematech, a Kenyan translation API on NLLB-200, no voice yet) ([HF](https://www.huggingface.co/spaces/sematech/sema-api/blob/main/docs/README.md)).
- **Ask Sema:** SIP trunk or programmable call API (originate, play audio URL, DTMF capture, recording, callbacks), caller ID registration, per-second rates per network, concurrency, call-detail-record (CDR) webhooks, and whether it can terminate calls generated by a LiveKit/Retell agent over SIP.

### 8.4 Fish Audio (TTS, voice cloning, STT)

- **API:** REST plus real-time WebSocket streaming. S2-Pro claims 100 ms time-to-first-audio; S2.1-Pro claims better latency, with TTFA guarantees on the paid model ([Fish docs](https://docs.fish.audio/developer-guide/models-pricing/models-overview.md)). It clones a voice from about 15 seconds of audio and works across languages (vendor claim, [Fish blog](https://fish.audio/blog/top-tts-apis-developer-comparison-2026/)). Emotion tags are supported.
- **Pricing (Nov 2026):** s2.1-pro $15 per 1M UTF-8 bytes; s2.1-pro-free $0 (fair use, no guarantees); drama-3 $50 ($10 promo to 12 Nov 2026); STT $0.36/hour; voice design $0.01 per request. Concurrency is 5 below $100 prepaid, 15 at $100+, 50 at $1,000+ ([Fish pricing](https://docs.fish.audio/docs/models-pricing/pricing-and-rate-limits)). Swahili is Latin script, so about 1 byte per character, about $15 per 1M characters, the same as Azure.
- **Swahili:** Claimed within the 83 languages of S2.1 Pro ([PC Tech](https://pctechmag.com/2026/08/how-voice-ai-is-helping-african-businesses-scale-content-and-customer-communication/)). The official docs do not list it, and there is no independent evaluation. **Run a blind native-speaker test against Azure Rehema/Daudi before committing.**
- **Licensing:** Paid plans include commercial rights; the free plan is non-commercial ([Smallest.ai, competitor](https://smallest.ai/blog/fish-audio-pricing-plans-api-billing-commercial-use-in-2026)). Open Fish Speech weights are research/non-commercial; commercial self-hosting needs a written licence ([Sacra](https://sacra.com/chat/h/7e3c3d5b-2b84-4e53-b0f9-6322443ff42f/)). Voice cloning requires the speaker's consent: get signed releases from any teacher or headteacher whose voice is cloned.
- **Telephony fit:** Telnyx already exposes Fish Audio inside calls ([Telnyx](https://developers.telnyx.com/docs/voice/tts/providers/fishaudio.md)), and LiveKit and Retell are partners ([Fish blog](https://fish.audio/blog/fish-audio-52m-seed-funding/)).
- **Uses for Bermi:**
  1. **Results read aloud.** Template plus per-student variables go to Fish TTS (cached per template segment), and the audio file is played on a Sema/AT outbound call. SMS goes as a fallback.
  2. **IVR prompts** in a cloned "school voice" or brand voice, in Swahili and English.
  3. **Voice agents.** Fish or Soniox STT, an LLM, then Fish TTS over LiveKit, with a SIP trunk to Tanzanian numbers.
  4. **Voice notes on WhatsApp.**

### 8.5 How the stack fits together

```
                ┌──────────── Bermi Connect API / Dashboard / AI layer ─────────────┐
                │  audience graph (language, channel pref, literacy flag, consent)  │
                └───┬──────────────┬───────────────────┬────────────────┬───────────┘
                    │SMS/OTP       │Voice/IVR          │WhatsApp        │USSD
                    ▼              ▼                   ▼                ▼
             Textify (SMPP)   Fish Audio TTS/STT   Meta Cloud API   aggregator shared code
             + 2nd TZ route   (Azure fallback)     (direct or BSP)  (Sema / AT / HelloDuty)
                    │              │ audio
                    │              ▼
                    │        Sema voice / SIP trunk ──► Tanzanian handsets
                    ▼
             Vodacom · Yas · Airtel · Halotel · TTCL
     "Siliana": role unknown (agent orchestration if it is Sierra-like; model hosting if SiliconFlow)
```

---

## 9. Role model: how Fish Audio went global

| Theme | What happened | Source |
|---|---|---|
| **Origin and founders** | Started as a hobby project. Co-founder and chief scientist Shijia Liao (ex-NVIDIA) trained early models on one RTX 4090 at home. CEO Rissa Cao previously worked on voice AI at Amazon Alexa and Meta. Mountain View HQ. Incorporated July 2025 (Sacra lists a 2024 founding). | [Fish blog, Jul 2026](https://fish.audio/blog/fish-audio-52m-seed-funding/), [Sacra](https://sacra.com/c/fish-audio) |
| **Open-source and open-model strategy** | The open Fish Speech repo has 31–32.5k GitHub stars and works as the top of the funnel. Developers self-host, then move to the paid API for reliability, newer models and commercial rights. Three models are open; the flagship S2.1 Pro is API-only. Openness is "a distribution mechanism, not an absolute commitment". The weights are non-commercial. | [Sacra](https://sacra.com/chat/h/7e3c3d5b-2b84-4e53-b0f9-6322443ff42f/), [Remio](https://www.remio.ai/post/fish-audio-raises-52m-to-challenge-voice-ais-closed-giants) |
| **Developer-first API and tiers** | Pay-as-you-go with no minimums. $15 per 1M bytes, STT $0.36/hour. Concurrency unlocks with prepaid balance rather than sales calls. Enterprise adds on-prem, zero data retention and HIPAA configurations. | [Fish pricing](https://docs.fish.audio/docs/models-pricing/pricing-and-rate-limits), [Fish blog](https://fish.audio/blog/fish-audio-52m-seed-funding/) |
| **Free tier and voice-library network effect** | Free plan (about 7–8k credits a month); a free s2.1-pro model; the S2.1 Pro API was free for a launch period. 2M+ community voice models: every user-created voice makes the library more useful to the next user. | [Sacra](https://sacra.com/c/fish-audio), [Fish blog](https://fish.audio/blog/fish-audio-52m-seed-funding/) |
| **Creator marketing** | YouTube tutorials, social demos, and a 20% affiliate commission for up to 12 months. Early users were indie developers, game designers and creators. Anime and celebrity-style voices drove virality (with IP and likeness risk). | [Sacra](https://sacra.com/c/fish-audio), [Remio](https://www.remio.ai/post/fish-audio-raises-52m-to-challenge-voice-ais-closed-giants), [AllVoiceLab](https://www.allvoicelab.com/blog/fishing-for-voices-with-fish-audio-from-trump-ai-voice-to-lebron-ai-voice) |
| **Funding and growth** | $52M seed in July 2026 (Coreline Ventures, Capital Today, HF0 and others); its first institutional round. ARR of $5M (Oct 2025), about $10M (Mar 2026) and $21M (Jul 2026); 8M+ users; team of 22 (about $955k ARR per employee). Enterprise reached $6M+ ARR before there was a sales team and is now said to be about two-thirds of revenue. All figures are company-reported, not audited. | [Fish blog](https://fish.audio/blog/fish-audio-52m-seed-funding/), [Sacra](https://sacra.com/c/fish-audio), [ARR Club](https://www.arr.club/fish-audio/fish-audio-reaches-500000000-arr-2025-10) |
| **Markets won first** | Accented English, Mandarin, Japanese, Korean and Spanish; CJK mixed with English. Creator and gaming communities first, then B2B: HeyGen, Sanas, Retell, LiveKit, Telnyx and OpenArt. | [Fish blog](https://fish.audio/blog/fish-audio-52m-seed-funding/), [Sacra](https://sacra.com/c/fish-audio) |
| **What it did that incumbents did not** | ElevenLabs (about $500M ARR) scaled with closed, premium hosted products. Fish competed on open weights, a much lower API price (claimed about 70% below ElevenLabs, a vendor claim), a community voice marketplace, cross-lingual cloning from 15 seconds of audio, and fine-grained emotion control. It became infrastructure inside other platforms rather than only a destination app. | [Remio](https://www.remio.ai/post/fish-audio-raises-52m-to-challenge-voice-ais-closed-giants), [Fish blog](https://fish.audio/blog/top-tts-apis-developer-comparison-2026/) |

**Lessons for Bermi Connect**
1. **Open something real.** Publish an open Swahili/East-African communication toolkit: GSM-7/UCS-2 segment counter, Swahili SMS templates, a STOP/SIMAMA keyword list, a TCRA sender-ID checklist, SDKs, and perhaps an open Swahili TTS voice fine-tuned on top of Msingi-AI's CC-BY model. Developers find Bermi through it.
2. **Self-serve beats sales.** Instant signup, a free trial wallet (e.g. 50 SMS plus 5 voice minutes), mobile-money top-up, limits that unlock with prepaid balance, and a public price page in TZS. That price page alone beats Beem, Briq and FastHub, which do not publish prices.
3. **Build a library network effect.** Community templates such as "results SMS", "fee reminder" and "harusi (wedding) invitation", plus Swahili voice prompts and IVR flows that customers share and fork. Every school that uses a template improves it for the next.
4. **Creator and community marketing.** Swahili YouTube and TikTok tutorials, ambassador teachers, and a 20% referral share for resellers and developers. Use the DIT, Imbeju and YTC networks.
5. **Free promo model for launches.** For example, "NECTA results voice calls free for the first 1,000 parents per school".
6. **Become infrastructure inside others.** Connectors for ShuleSoft, InfoTaaluma, Odoo, QuickBooks and Selcom, so Bermi sits *inside* the platforms customers already use.
7. **Let enterprise follow product.** Banks and insurers arrive once the developer base proves reliability. Add a DPA, SLA, in-country data hosting and audit logs early.
8. **Avoid Fish's risk areas.** Require consent for cloned voices and block impersonation of public figures from day one.

---

## 10. Path to global

### 10.1 Target customers in Tanzania (beyond schools)

| Segment | Already buys bulk SMS/voice? | From whom (evidence) | Bermi's angle |
|---|---|---|---|
| Banks and microfinance | Yes: OTP, alerts, marketing | Bongo Live lists banking ([Clutch](https://clutch.co/profile/bongo-live)); Infobip targets enterprise ([Guardian](https://ippmedia.co.tz/the-guardian/business/read/infobip-brings-voice-calling-to-whatsapp-business-users-2025-07-18-164650)); specific bank contracts **unverified** | Swahili voice OTP and fraud callbacks; PDPA tooling. CRDB Foundation contact via Imbeju. |
| Fintechs and SACCOs | Yes: OTP, repayment reminders | egoSMS targets SACCOs ([egoSMS](https://egosms.co/tz/)); FastHub has BoT certification ([BTW](https://btw.media/en/fasthub-simplifies-mobile-payments-and-messaging-in-tanzania)) | Developer API, OTP fallback chain (SMS → voice → WhatsApp) |
| Telcos' enterprise customers | Yes, via MNO bulk products (e.g. Halotel bulk SMS team [Ajiriwa](https://www.ajiriwa.net/job-amp/bulk-sms-product-executive-product-specialist-6a79a96418352)) | MNO enterprise desks | Multi-network single API; MNOs as wholesale partners |
| Insurers | Yes | Bongo Live lists insurance | Renewal reminders and claim-status IVR |
| Hospitals and health | Yes: reminders, results (e.g. CDC-supported SMS for HIV results [CDC](https://www.cdc.gov/global-hiv-tb/php/success-stories/hiv-results-in-tanzania.html)) | Various; egoSMS markets to hospitals | Voice reminders for low-literacy patients; links to Afya AI |
| Government agencies | Yes, through the e-GA gateway ([GitHub](https://www.github.com/lykmapipo/tz-ega-sms)) | e-GA | Harder market; target LGAs and regulators for voice and USSD |
| NGOs and donor programmes | Yes: surveys, mHealth (Healthy Baby SMS reached 1M registrations [HIT](https://hitconsultant.net/2015/10/13/tanzanias-healthy-baby-sms-service-records-1m-mhealth-registrations)) | Telerivet, AT and others | Voice/IVR surveys in Swahili; USSD forms |
| Retail and e-commerce | Yes: promotions | Most local providers | WhatsApp catalogue plus SMS fallback; Soma Bags-type clients |
| Logistics and transport | Likely: delivery OTP | **Unverified** | Delivery notifications and voice confirmation |
| Media | Yes: shortcode voting and premium SMS | AT shortcodes | Shared shortcodes and voting |
| Religious organisations | Yes | egoSMS targets churches; PDPC lists religious organisations as data controllers ([The Chanzo](https://thechanzo.com/2026/03/27/data-protection-commission-issues-final-warning-ahead-of-april-enforcement-deadline/)) | Voice sermons and announcements to members who cannot read |
| Schools and universities | Yes | ShuleSoft, InfoTaaluma, Schoolinsight | Beachhead (§6) |

### 10.2 Market sequence (with data)

| Stage | Market | Why | Data | Regulatory hurdles |
|---|---|---|---|---|
| 1 | **Tanzania** (2026–27) | Home market; Swahili; 117M SIMs; 83% feature-phone penetration | §4 | §3 checklist |
| 2 | **Kenya** | Swahili and English; largest A2P and developer market in the region | 87.99M SIMs, 52.26M smartphones, 27.42M feature phones, 14.12B SMS per quarter (Jun 2026) ([TechTrends KE](https://techtrendske.co.ke/2026/09/19/kenya-mobile-market-88-million-sim-smartphones/)) | Sender IDs only through a CA-licensed content service provider; Safaricom reviews on Mondays and Thursdays; separate promotional and transactional IDs; promotional sends 08:00–18:00 only, with DND filtering; Data Protection Act 2019 with 72-hour breach notice ([Telerivet](https://www.telerivet.com/blog/kenya-sms-sender-id-compliance-safaricom)) |
| 3 | **Uganda** | Swahili is an official language; WhatsApp at 11M and TikTok at 11.4M subscriptions | 49M subscriptions, 20.5M smartphones (Q2 2026) ([PC Tech](https://pctechmag.com/?p=95967)); 24.7M feature and 13.3M basic phones (Mar 2026) ([Charmar](https://charmarnews.com/?p=23573)) | Sender IDs per MNO (about 2 weeks; about UGX 250k a month per ID); DPPA registration renewed annually; first criminal conviction July 2025 ([Telerivet](https://www.telerivet.com/blog/uganda-sms-compliance-ucc-dppa)) |
| 4 | **Rwanda, DRC (east), Burundi** | Rwanda is a regional hub; eastern DRC and Burundi speak Swahili | Rwanda statistics not retrieved **[unverified]** | Rwanda: sender IDs via MTN/Airtel (about 3 weeks), no shortcodes, Law 058/2021 (fines up to 1% of turnover) ([Telerivet](https://www.telerivet.com/blog/rwanda-sms-compliance-rura-sender-id-law-058)) |
| 5 | **Wider Africa** (Nigeria, Ghana, Ethiopia, South Africa) | Large markets; low-literacy voice need; local-language voice (Hausa, Yoruba, Amharic, Zulu all claimed by Fish S2.1) | GSMA puts sub-Saharan mobile internet penetration at only 27%, with 751M unique subscribers forecast by 2030 ([GSMA SSA 2024](https://www.gsma.com/mobileeconomy/report/sub-saharan-africa-2024/)) | Per-country sender ID rules, licences and data-protection laws; Nigeria has an NCC DND (2442) ([Telerivet](https://www.telerivet.com/blog/sending-sms-in-tanzania-tcra-sender-id-registration-the-pdpa-and-what-operators-need-to-knowtanzania-sms-compliance-tcra-sender-id-pdpa)) |
| 6 | **Global developer API** | Sell "reach anyone, in their language, on any phone" to global apps entering Africa, and to diaspora and NGOs | Twilio charges $0.43 per TZ SMS vs a local ≈ $0.007, a huge arbitrage for local routes | Wholesale agreements; KYC and anti-fraud (SMS pumping); GDPR for EU customers |

### 10.3 What has to be true to compete with Twilio, Infobip and Africa's Talking

1. **Direct or near-direct routes with honest DLRs** in every country served, plus at least two routes per country.
2. **Developer experience at Twilio level:** docs, SDKs (already in the repo), webhooks, status page, sandbox and per-message logs.
3. **Compliance as a product:** sender ID filing automation per MNO and per country, consent ledger, DPA, data-residency options.
4. **99.9%+ uptime** with failover and a 24/7 NOC.
5. **Pricing in local currency through mobile money**, plus USD cards for global customers.
6. **A moat incumbents cannot copy quickly:** African-language voice quality, a low-literacy reach layer, and per-recipient channel intelligence.
7. **Capital and partnerships:** MNO wholesale, voice SIP termination, and a WhatsApp BSP or tech-provider status with Meta.

### 10.4 Where Bermi can be unique worldwide

- **African-language voice communication as an API**: Swahili first, then Hausa, Yoruba, Amharic and Zulu.
- **A "reach-anyone" router**: picks WhatsApp, SMS, voice or USSD per recipient, based on a learned profile (handset type, literacy flag, language, response history). This is the "Learn → Understand → Connect" positioning made concrete.
- **Feature-phone and low-literacy reach**: audio results, IVR forms, USSD menus.
- **Mobile-money-native billing and actions**: top-up by M-Pesa, Mixx or Airtel Money, plus "pay now" links or USSD push inside messages (fees, premiums).
- **Built-in compliance packs per African country.**

### 10.5 Business model

| Layer | Pricing |
|---|---|
| Usage | SMS per segment (TZS 18 now; tiers down to about TZS 14 at volume); voice per second; WhatsApp at Meta's cost plus a margin; USSD per session |
| Platform | Monthly plans for campaigns, multi-user access, sender ID management and integrations (e.g. TZS 25k–250k) |
| AI premium | Swahili TTS minutes, voice agents per minute, smart routing, translation and personalisation ("Bermi Intelligence") |
| Compliance and enterprise | DPA, SLA, dedicated routes, in-country hosting, audit exports |
| Vertical bundles | "Bermi Shule" (results voice, fee reminders, USSD parent menu) priced per student per term |

### 10.6 Staged roadmap

1. **Q4 2026–Q2 2027: Tanzania leader.** Sender ID automation, PDPC registration, second SMS route, WhatsApp, Swahili voice results calls, a shared USSD code, school system connectors, a public TZS price page, a free tier and the open toolkit.
2. **H2 2027: Smart routing and AI.** Per-recipient channel learning, Swahili voice agents, and verticals for banks, health and NGOs.
3. **2028: East Africa.** Kenya through a CA-licensed CSP partner, then Uganda and Rwanda; a compliance pack per country.
4. **2029+: Africa, then a global API.** Add African languages; sell to global developers and platforms (as Fish did with HeyGen and Retell).

---

## 11. Ten biggest opportunities (ranked)

| Rank | Opportunity | Evidence |
|---|---|---|
| 1 | **Swahili voice broadcast and IVR** (results read aloud, reminders, surveys), self-serve | 83% feature-phone penetration and about 17% adult illiteracy (§4). No self-serve Swahili AI voice product found among TZ providers (§2). Voice traffic is growing 7.44% while SMS is flat ([TanzaniaInvest](https://tanzaniainvest.com/telecoms/telecom-subscriptions-q2-2026)). Usable Swahili TTS exists (§7). |
| 2 | **Schools vertical: "Bermi Shule"** with system integrations | School systems treat messaging as a bolt-on (§6). NECTA's USSD channel shows parents will pay about TZS 100 per query ([cvstudio](https://www.cvstudio.io/necta-results-tanzania-how-to-check-csee-acsee)). InfoTaaluma alone reaches 200k parents. |
| 3 | **Compliance-as-a-product** (sender ID automation, consent ledger, PDPA pack) | Unregistered IDs blocked since June 2025; PDPA enforcement since April 2026; inspections since August 2026 (§3). Slow sender ID approval is a recurring complaint ([Trustpilot](https://www.trustpilot.com/review/termii.com)). |
| 4 | **Smart channel routing** (WhatsApp → SMS → voice → USSD per recipient) | WhatsApp utility at $0.0046 vs SMS at about $0.007; 45% smartphone penetration (§4–5). |
| 5 | **Transparent self-serve pricing and mobile-money top-up** | Beem, Briq, FastHub, Sema and Bongo Live do not publish prices; Twilio costs 25 times more (§2). 87M mobile-money accounts. |
| 6 | **Reliable delivery with honest DLRs and multi-route failover** | Customer complaints about 80%+ rejection on one MNO ([Trustpilot](https://fr-be.trustpilot.com/review/beem.africa)); grey-route risk ([Telerivet](https://www.telerivet.com/blog/kenya-sms-sender-id-compliance-safaricom)). |
| 7 | **Swahili voice agents for SMEs, banks and health** (inbound calls handled in Swahili) | Soniox real-time Swahili STT at $0.12/hour; Fish and Azure TTS; LiveKit and Retell partnerships (§7). Briq and Notify Africa offer chatbots, not voice agents (§2). |
| 8 | **USSD self-service for opt-out, forms and results** | Two-way SMS is not supported on A2P; a shared USSD code costs about $110 a month per telco ([HelloDuty](https://helloduty.com/country/tanzania)). |
| 9 | **Vertical packs for religious organisations, NGOs and health** | These sectors are named as data controllers and as SMS buyers (§10.1); they serve low-literacy, Swahili-first audiences. |
| 10 | **Open toolkit and community templates (the Fish Audio playbook)** | Fish Audio reached $21M ARR and 8M users in year one, funnelled through open models (31k+ stars) and a community library of 2M voices (§9). |

---

### Open questions to resolve

- Exact identity and TCRA licence status of Textify; whether Bermi needs its own licence.
- What "Siliana" is.
- Whether "Sema Call" is sema.co.tz's voice product, and whether it has a programmable API.
- Fish Audio Swahili quality versus Azure sw-TZ, from a native-speaker blind test.
- Current (2026) Beem, NextSMS and Africa's Talking TZ price pages (the 2021 figures may be stale).
- Whether Meta's 1 October 2026 service-message charge applies.
- Tanzanian WhatsApp user count, and the Swahili vs English literacy split.
