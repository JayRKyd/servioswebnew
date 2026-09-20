const SITE_URL = (process.env.WEB_URL ?? 'https://servioswebnew.vercel.app').replace(/\/$/, '')

export const COMPANY_FOOTER = 'Servios Group Ltd · Registered in England & Wales · Company No. 16840842'
export const COMPANY_ADDRESS = 'Registered office: 167-169 Great Portland Street, London, W1W 5PF'

export interface EmailPerson {
  name: string
  avatarUrl?: string | null
  rating?: number | null
  ratingCount?: number | null
  /** e.g. "Plumbing · North London" or "Customer" */
  meta?: string
}
export interface EmailDetail { label: string; value: string }
export interface EmailCta { label: string; path: string }

export interface NotificationEmail {
  heading: string
  /** Optional one-line intro above the cards */
  body?: string
  /** The other party — photo, name, rating (Airbnb/TaskRabbit pattern) */
  person?: EmailPerson
  /** Small details card: service, date, time, location, price */
  details?: EmailDetail[]
  /** Longer free text (customer notes) rendered as a quoted block */
  note?: string
  /** Primary action */
  ctaLabel: string
  ctaPath: string
  /** Secondary links rendered beside/below the primary button */
  secondaryCtas?: EmailCta[]
  /** Inbox preview line — without it clients repeat the heading */
  preheader?: string
}

/** Format helpers shared by the notification emails. */
export function ukDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
export function ukTime(t: string | null | undefined): string {
  return t ? String(t).slice(0, 5) : ''
}
export function poundsFromCents(cents: number | null | undefined): string {
  return typeof cents === 'number' ? `£${(cents / 100).toFixed(2)}` : ''
}

function personCard(p: EmailPerson): string {
  const avatar = p.avatarUrl
    ? `<img src="${p.avatarUrl}" width="48" height="48" alt="" style="display:block;border:0;border-radius:24px;object-fit:cover;" />`
    : `<div style="width:48px;height:48px;border-radius:24px;background-color:#115e56;color:#ffffff;font-size:20px;font-weight:700;text-align:center;line-height:48px;">${p.name.charAt(0).toUpperCase()}</div>`
  const rating = p.rating && p.rating > 0
    ? `<span style="color:#b45309;font-weight:600;">★ ${Number(p.rating).toFixed(1)}</span>${p.ratingCount ? ` <span class="mut" style="color:#6b7280;">(${p.ratingCount} review${p.ratingCount !== 1 ? 's' : ''})</span>` : ''}`
    : ''
  const secondLine = [rating, p.meta ? `<span class="mut" style="color:#6b7280;">${p.meta}</span>` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')
  return `
        <tr>
          <td style="padding-bottom:20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="card" style="background-color:#f7f8f7;border-radius:12px;">
              <tr>
                <td style="padding:14px 16px;width:48px;vertical-align:middle;">${avatar}</td>
                <td style="padding:14px 16px 14px 0;vertical-align:middle;">
                  <p style="margin:0;font-size:15px;font-weight:700;" class="ink"><span style="color:#111827;">${p.name}</span></p>
                  ${secondLine ? `<p style="margin:3px 0 0;font-size:12.5px;">${secondLine}</p>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
}

function detailsCard(details: EmailDetail[]): string {
  const rows = details.map(d => `
                <tr>
                  <td style="padding:6px 16px;font-size:13px;color:#6b7280;white-space:nowrap;" class="mut">${d.label}</td>
                  <td style="padding:6px 16px;font-size:13px;font-weight:600;text-align:right;" class="ink"><span style="color:#111827;">${d.value}</span></td>
                </tr>`).join('')
  return `
        <tr>
          <td style="padding-bottom:20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="card" style="background-color:#f7f8f7;border-radius:12px;">
              <tr><td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table></td></tr>
            </table>
          </td>
        </tr>`
}

/** Branded transactional email — person card, details card, CTA row,
 *  dark-scheme-aware, Servios Group Ltd footer. No unsubscribe link on
 *  transactional mail. */
export function renderNotificationEmail(email: NotificationEmail): string {
  const { heading, body, person, details, note, ctaLabel, ctaPath, secondaryCtas, preheader } = email
  const ctaUrl = `${SITE_URL}${ctaPath}`
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}${'&nbsp;&zwnj;'.repeat(40)}</div>`
    : ''
  const secondary = (secondaryCtas ?? []).map(c =>
    `<a href="${SITE_URL}${c.path}" style="display:inline-block;color:#115e56;font-size:13.5px;font-weight:600;text-decoration:underline;text-underline-offset:2px;padding:14px 6px;" class="lnk">${c.label}</a>`
  ).join('<span style="color:#d1d5db;">&nbsp;&nbsp;</span>')

  return `<style>
  @media (prefers-color-scheme: dark) {
    .body-bg { background-color: #191b1a !important; }
    .card-bg { background-color: #232624 !important; }
    .card { background-color: #2c302e !important; }
    .ink, .ink span { color: #f3f4f3 !important; }
    .mut { color: #a7aeaa !important; }
    .lnk { color: #7cc5ad !important; }
  }
</style>
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="body-bg" style="background-color:#f4f5f4;padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" class="card-bg" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:16px;padding:36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td style="padding-bottom:28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;"><img src="${SITE_URL}/brand/servios-mark.png" width="33" height="32" alt="" style="display:block;border:0;" /></td>
                <td class="ink" style="padding-left:10px;font-size:19px;font-weight:600;letter-spacing:-0.03em;vertical-align:middle;"><span style="color:#171717;">servios</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="ink" style="font-size:21px;font-weight:700;letter-spacing:-0.02em;padding-bottom:${body ? '10' : '20'}px;"><span style="color:#111827;">${heading}</span></td>
        </tr>
        ${body ? `<tr><td class="mut" style="font-size:14.5px;line-height:1.6;color:#6b7280;padding-bottom:20px;">${body}</td></tr>` : ''}
        ${person ? personCard(person) : ''}
        ${details && details.length > 0 ? detailsCard(details) : ''}
        ${note ? `
        <tr>
          <td style="padding-bottom:20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-left:3px solid #115e56;">
              <tr><td class="mut" style="padding:4px 0 4px 14px;font-size:13px;line-height:1.6;color:#4b5563;font-style:italic;">${note}</td></tr>
            </table>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding-bottom:6px;">
            <a href="${ctaUrl}" style="display:inline-block;background-color:#115e56;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 30px;border-radius:12px;">${ctaLabel}</a>
          </td>
        </tr>
        ${secondary ? `<tr><td style="padding-bottom:6px;">${secondary}</td></tr>` : ''}
        <tr>
          <td class="mut" style="font-size:12.5px;line-height:1.6;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:20px;margin-top:8px;">
            Manage bookings, messages and quotes any time from your
            <a href="${SITE_URL}" class="lnk" style="color:#115e56;">Servios dashboard</a>.
            Need help? Visit the <a href="${SITE_URL}/help" class="lnk" style="color:#115e56;">Help Centre</a>
            or email <a href="mailto:support@servios.co.uk" class="lnk" style="color:#115e56;">support@servios.co.uk</a>.
          </td>
        </tr>
      </table>
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr>
          <td class="mut" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.7;color:#9ca3af;text-align:center;padding-top:22px;">
            ${COMPANY_FOOTER}<br>
            ${COMPANY_ADDRESS}<br>
            You received this email because you have a Servios account with activity on it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}
