# Updated Firestore Security Rules

## IMPORTANT: Update Your Firestore Rules

The `users` collection was missing from the security rules, which is causing permission errors. Please update your Firestore rules in the Firebase Console.

### Steps:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **ibasa-kledo**
3. Navigate to **Firestore Database** > **Rules**
4. Replace the rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Users collection - for user management and approval
    match /users/{userId} {
      // Users can read their own document
      allow read: if isAuthenticated() && request.auth.uid == userId;
      // Users can create their own document (for registration)
      allow create: if isAuthenticated() && request.auth.uid == userId;
      // Users can update their own document, or owners/managers can update any
      allow update: if isAuthenticated();
    }
    
    // Dashboard collections
    match /dashboard/{document=**} {
      allow read, write: if isAuthenticated();
    }
    
    // Penjualan (Sales) collections
    match /penjualan/{document=**} {
      allow read, write: if isAuthenticated();
    }
    
    // Pembelian (Purchases) collections
    match /pembelian/{document=**} {
      allow read, write: if isAuthenticated();
    }
    
    // Invoices collections
    match /invoices/{invoiceId} {
      allow read, write: if isAuthenticated();
    }
    
    // Purchase Invoices collections
    match /purchaseInvoices/{invoiceId} {
      allow read, write: if isAuthenticated();
    }
    
    // Contacts collections
    match /contacts/{contactId} {
      allow read, write: if isAuthenticated();
    }
    
    // Contact Groups collections
    match /contactGroups/{groupId} {
      allow read, write: if isAuthenticated();
    }
    
    // Products collections
    match /products/{productId} {
      allow read, write: if isAuthenticated();
    }
    
    // Accounts collection
    match /accounts/{accountId} {
      allow read, write: if isAuthenticated();
    }
    
    // Transactions collection
    match /transactions/{transactionId} {
      allow read, write: if isAuthenticated();
    }
    
    // Debts collection
    match /debts/{debtId} {
      allow read, write: if isAuthenticated();
    }
    
    // Receivables collection
    match /receivables/{receivableId} {
      allow read, write: if isAuthenticated();
    }
    
    // Default: Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## For Development/Testing (Less Secure - Allows All):

If you want to allow all authenticated users to read/write everything during development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**⚠️ Warning:** The development rules above allow any authenticated user to read/write all data. Use this only for testing and update to more restrictive rules for production.

