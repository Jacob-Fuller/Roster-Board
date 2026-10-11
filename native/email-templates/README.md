# Roster Board auth emails (Supabase)

Paste each file into Supabase → Authentication → Emails → Templates (Source view).
Subjects:
- Confirm sign up: Confirm your Roster Board account
- Reset password: Reset your Roster Board password
- Change email address: Confirm your new Roster Board email

SMTP (Authentication → Emails → SMTP Settings), sent through Zoho Mail (AU data centre):
- Sender email: contact@rosterboard.net (or a Zoho alias like no-reply@rosterboard.net)
- Sender name: Roster Board
- Host: smtppro.zoho.com.au   Port: 465
- Username: contact@rosterboard.net   Password: a Zoho app-specific password
DNS at Namecheap (Advanced DNS): SPF TXT @ (copy the exact value from Zoho Admin → Domains → rosterboard.net → Email Configuration → SPF), plus the DKIM TXT from Zoho Admin → Domains → rosterboard.net → Email Configuration → DKIM.
