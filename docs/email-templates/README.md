# Supabase auth email templates

Branded replacements for the stock Supabase auth emails. Each file maps to one
template in **Supabase Dashboard → Authentication → Emails → Templates** — open
the matching tab, paste the file's HTML into the body field, and set the subject
line from the comment at the top of the file.

| File                  | Supabase template     | Suggested subject                  |
| --------------------- | --------------------- | ---------------------------------- |
| `confirm-signup.html` | Confirm signup        | Confirm your email address         |
| `reset-password.html` | Reset password        | Reset your Servios password        |
| `magic-link.html`     | Magic link            | Your Servios sign-in link          |
| `change-email.html`   | Change email address  | Confirm your new email address     |
| `invite-user.html`    | Invite user           | You've been invited to Servios     |

## Still pending (blocked on the custom domain)

- **Custom SMTP** — until Resend SMTP is configured (Authentication → Emails →
  SMTP Settings: host `smtp.resend.com`, port `465`, username `resend`,
  password = Resend API key), these templates go out through Supabase's
  built-in mailer: ~2 emails/hour, authorised addresses only, sent from
  `noreply@mail.app.supabase.io`. Flip SMTP over as soon as the client's
  domain is verified in Resend.
- **Logo** — the templates use a text wordmark for now. When the brand logo is
  hosted on the production domain, replace the wordmark table (marked with a
  `TODO` comment in each file) with an `<img>` pointing at the hosted asset.
  Email clients need an absolute URL; base64-embedded images get stripped by
  Gmail.

## Also required in the dashboard (fixes dead confirmation links)

**Authentication → URL Configuration**:

- Site URL: `https://servioswebnew.vercel.app` (swap for the custom domain later)
- Redirect URLs — add:
  - `https://servioswebnew.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

Without the redirect allowlist, Supabase ignores the app's `emailRedirectTo`
and dumps users on the homepage with a raw `?code=` parameter (the middleware
has a safety net for that, but the allowlist is the proper fix).
