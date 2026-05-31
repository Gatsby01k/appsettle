# INRSettle

Stablecoin Settlement Infrastructure for India Payment Flows.

INRSettle is an institutional website and product foundation for an India-focused treasury and settlement infrastructure company. It is intentionally positioned as settlement infrastructure, not a retail exchange, crypto trading venue, or web3 application.

## Positioning

**Core category:** Stablecoin Settlement Infrastructure  
**Initial corridor:** INR ↔ USDT  
**Audience:** PSPs, merchants, payment operators, and institutional treasury teams

## Site Structure

- `index.html` — homepage
- `infrastructure.html` — infrastructure overview
- `api.html` — API product page
- `use-cases.html` — PSP, merchant, and payment operator use cases
- `security.html` — security controls
- `compliance.html` — compliance positioning
- `risk.html` — risk disclosure
- `status.html` — status placeholder
- `contact.html` — access request form
- `docs/` — API, integration, webhooks, reconciliation docs
- `legal/` — privacy, terms, compliance legal pages

## Deployment

This project is static and deploys directly to Netlify.

```bash
# no build step required
netlify deploy --prod
```

The access request form uses Netlify Forms via `contact.html`.

## Brand Rules

Use:

- settlement infrastructure
- treasury rails
- payment operations
- corridor liquidity
- reconciliation
- programmable settlement

Avoid:

- exchange
- crypto platform
- DeFi
- web3 solution
- decentralized future
- blockchain economy

## Production Notes

Before using in a regulated production setting:

1. Replace placeholder legal content with counsel-reviewed policies.
2. Connect CRM or secure lead routing for access requests.
3. Add backend API and authentication for dashboard functionality.
4. Connect status page provider.
5. Finalize KYB, AML, and risk operating procedures.
