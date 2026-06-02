# OAuth Setup Guide — Google & Microsoft

Everything here is one-time dashboard work. No code changes needed after this.

**Your Supabase callback URL** (used in both providers):
```
https://ivhpmgrucihnwugauxve.supabase.co/auth/v1/callback
```

---

## 1. Google

### 1.1 Create the OAuth app in Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one) — name it anything, e.g. `bolao-copa-2026`
3. In the left sidebar → **APIs & Services** → **OAuth consent screen**
   - User type: **External**
   - Fill in App name (`Bolão da Copa 2026`), User support email, Developer contact email
   - Scopes: click **Add or Remove Scopes** → add `email` and `profile` (both under Google Account)
   - Test users: add your own email so you can test before the app is published
   - Save and continue through all steps
4. In the left sidebar → **APIs & Services** → **Credentials**
   - Click **+ Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Bolão Copa 2026 Web`
   - Under **Authorized redirect URIs** → **+ Add URI**:
     ```
     https://ivhpmgrucihnwugauxve.supabase.co/auth/v1/callback
     ```
   - Click **Create**
5. Copy the **Client ID** and **Client Secret** shown in the dialog

### 1.2 Add credentials to Supabase Cloud

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project
2. **Authentication** → **Providers** → **Google**
3. Toggle **Enable Google provider** → ON
4. Paste **Client ID** and **Client Secret**
5. Save

---

## 2. Microsoft (Azure)

### 2.1 Register the app in Azure

1. Go to [portal.azure.com](https://portal.azure.com) — sign in with any Microsoft account
2. Search for **Microsoft Entra ID** (formerly Azure Active Directory) → open it
3. Left sidebar → **App registrations** → **+ New registration**
   - Name: `Bolão Copa 2026`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
     *(this covers both @outlook.com/@hotmail.com and work/school accounts)*
   - Redirect URI:
     - Platform: **Web**
     - URI:
       ```
       https://ivhpmgrucihnwugauxve.supabase.co/auth/v1/callback
       ```
   - Click **Register**
4. On the app overview page, copy the **Application (client) ID** — this is your Client ID

### 2.2 Create a client secret

1. In the left sidebar → **Certificates & secrets** → **Client secrets** tab
2. Click **+ New client secret**
   - Description: `Supabase`
   - Expires: **24 months** (longest option; you'll rotate it before it expires)
3. Click **Add** — **copy the Value immediately** (it is only shown once)

### 2.3 Add credentials to Supabase Cloud

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project
2. **Authentication** → **Providers** → **Azure**
3. Toggle **Enable Azure provider** → ON
4. Paste **Application (client) ID** into **Client ID**
5. Paste the secret **Value** into **Secret**
6. Save

---

## 3. Supabase URL Configuration

This tells Supabase which redirect URLs are trusted after sign-in.

1. **Authentication** → **URL Configuration**
2. **Site URL**: set to your production domain once deployed (e.g. `https://bolao.vercel.app`)
3. **Redirect URLs** — add all of these:
   ```
   http://localhost:3000/**
   http://127.0.0.1:3000/**
   https://<your-vercel-domain>/**
   ```
   The `**` wildcard covers any path (including `/pt-BR/auth/callback`, `/en/auth/callback`, etc.)

---

## 4. Verify it works

1. Run `npm run dev` locally
2. Open `http://localhost:3000` — you should be redirected to the sign-in page
3. Click **Continuar com Google** — completes OAuth → lands on `/fixtures`
4. Sign out, click **Continuar com Microsoft** — same result
5. Check Supabase dashboard → **Authentication** → **Users** — both sign-ins should appear

---

## 5. Environment variables (local dev only)

If you want to test OAuth locally with `supabase start` (not the cloud project),
add these to `.env.local`:

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<your-google-client-id>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<your-google-secret>
SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID=<your-azure-client-id>
SUPABASE_AUTH_EXTERNAL_AZURE_SECRET=<your-azure-secret>
```

For local dev with `supabase start`, also add `http://127.0.0.1:54321/auth/v1/callback`
as an authorized redirect URI in both the Google Cloud Console and Azure portal.

> **Note:** Since the app points to the hosted Supabase project (`ivhpmgrucihnwugauxve`)
> in `.env.local`, the local env vars above are only needed if you switch to
> `supabase start` for fully local development. For now, just completing steps 1–4 above
> is sufficient to test against the cloud project.
