# INRSettle Operations Notes

## Operating Model

INRSettle should be operated as a business-only infrastructure product for verified PSPs, merchants, payment operators, and treasury teams.

## Client Onboarding

Recommended onboarding sequence:

1. Access request submitted.
2. Business profile reviewed.
3. KYB documentation collected.
4. Corridor and use case assessed.
5. Settlement limits and workflows approved.
6. API/dashboard access provisioned.
7. Test settlement lifecycle completed.
8. Production access enabled.

## Settlement Lifecycle

1. Settlement requested.
2. Treasury quote generated.
3. Client confirms execution.
4. Liquidity route allocated.
5. INR/USDT legs processed.
6. Settlement marked complete.
7. Reconciliation report generated.

## Support Model

Recommended channels:

- Dedicated business support email
- Incident escalation contact
- Treasury operations channel
- Status page

## Security Requirements

For the production application layer, implement:

- MFA
- RBAC
- audit logs
- signed webhooks
- API key rotation
- encrypted data storage
- client-level permissions
- IP allowlisting for API clients

## Compliance Requirements

Before full launch, obtain qualified legal review for:

- India payment exposure
- stablecoin settlement workflows
- AML monitoring obligations
- KYB documentation requirements
- counterparty screening
- sanctions controls
- travel rule applicability where relevant

## Website Maintenance

When adding new pages:

1. Add the page link to navigation or footer.
2. Add the URL to `sitemap.xml`.
3. Ensure no `.svg` references are introduced unless the asset exists.
4. Keep copy institutional and infrastructure-first.
