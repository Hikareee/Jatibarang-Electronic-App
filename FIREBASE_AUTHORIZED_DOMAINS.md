# Firebase Authorized Domains Setup

## How to Add Authorized Domain to Firebase

To add `https://ibasa-finance-web-app.vercel.app` as an authorized domain for Firebase Authentication, follow these steps:

### Steps:

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project: **ibasa-kledo**

2. **Navigate to Authentication Settings**
   - Click on **Authentication** in the left sidebar
   - Click on the **Settings** tab (gear icon)
   - Scroll down to **Authorized domains**

3. **Add the Domain**
   - Click **Add domain** button
   - Enter: `ibasa-finance-web-app.vercel.app`
   - Click **Add**

4. **Verify**
   - The domain should now appear in the list of authorized domains
   - Firebase automatically includes:
     - `localhost` (for local development)
     - `ibasa-kledo.firebaseapp.com` (your Firebase project domain)
     - `ibasa-kledo.web.app` (your Firebase hosting domain)

### Important Notes:

- **No code changes needed**: Authorized domains are managed entirely in the Firebase Console
- **HTTPS required**: Production domains must use HTTPS
- **Wildcard domains**: You can add the base domain `ibasa-finance-web-app.vercel.app` and it will work for all subdomains
- **Immediate effect**: Changes take effect immediately after adding

### Current Authorized Domains (should include):

- `localhost` (automatic)
- `ibasa-kledo.firebaseapp.com` (automatic)
- `ibasa-kledo.web.app` (automatic)
- `ibasa-finance-web-app.vercel.app` (to be added)

### Troubleshooting:

If authentication still doesn't work after adding the domain:
1. Clear browser cache and cookies
2. Wait a few minutes for changes to propagate
3. Check that the domain matches exactly (no trailing slashes)
4. Verify HTTPS is enabled on your Vercel deployment

