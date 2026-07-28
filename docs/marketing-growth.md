# Phase 5 marketing and growth

Administrators use `/portal/promotions.html` to manage workshops, events, consultations, and seasonal campaigns without editing code. Published items appear on `/campaigns.html`; each also has a focused page at `/campaign.html?campaign=the-item-slug`.

## Campaign links

Example:

`https://tomotinakids.com/campaign.html?campaign=family-guidance&utm_source=google&utm_medium=cpc&utm_campaign=gurugram_consultation`

For Meta, use `utm_source=meta` and `utm_medium=paid_social`. Supported first-touch fields include UTMs, `gclid`, `gbraid`, `wbraid`, and `fbclid`. Enquiries also record the conversion page and campaign slug.

## Measurement

Events include `page_view`, `promotion_view`, `enquiry_cta_click`, `phone_click`, `whatsapp_click`, `directions_click`, and `enquiry_submitted`. Never add family details or enquiry text to analytics events.

Google and Meta IDs are intentionally blank in `assets/js/analytics-config.js`. Provider scripts load only after a visitor allows analytics.

## Release order

1. Review the pull request and Cloudflare preview.
2. Apply `supabase/migrations/20260728194339_marketing_promotions.sql`.
3. Run Supabase security and performance advisors.
4. Merge the website branch.
5. Create a draft promotion, preview it, then publish it.

Public pages keep useful fallback content if Supabase is unavailable.
