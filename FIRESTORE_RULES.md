# Firestore Security Rules

To fix the "Missing or insufficient permissions" error, you need to update your Firestore security rules in the Firebase Console.

## Steps to Update Firestore Rules:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **ibasa-keuangan**
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
    
    // Users collection - for user management and approval
    match /users/{userId} {
      // Users can read their own document
      allow read: if isAuthenticated() && (request.auth.uid == userId || 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approved == true);
      // Users can create their own document (for registration)
      allow create: if isAuthenticated() && request.auth.uid == userId;
      // Only approved users (owners/managers) can update user documents
      allow update: if isAuthenticated() && (
        request.auth.uid == userId || 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['owner', 'manager', 'admin']
      );
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

## For Development/Testing (Less Secure):

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

## Required Collections:

Make sure these collections exist in your Firestore:
- `dashboard/` - Dashboard data
- `penjualan/` - Sales data
- `pembelian/` - Purchase data
- `invoices/` - Sales invoices
- `purchaseInvoices/` - Purchase invoices
- `contacts/` - Contacts
- `contactGroups/` - Contact groups
- `products/` - Products

