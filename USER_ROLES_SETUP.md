# User Roles Setup

To enable the approval workflow for purchase orders, you need to set up user roles in Firestore.

## Setting Up User Roles

1. Go to Firebase Console > Firestore Database
2. Create a collection called `users` (if it doesn't exist)
3. For each user, create a document with their Firebase Auth UID as the document ID
4. Add a `role` field with one of these values:
   - `owner` - Can approve/decline purchase orders
   - `manager` - Can approve/decline purchase orders
   - `admin` - Can approve/decline purchase orders
   - `employee` - Can create draft purchase orders (default)

## Example User Document Structure

```
Collection: users
Document ID: {firebaseAuthUID}
Fields:
  - role: "owner" | "manager" | "admin" | "employee"
  - email: "user@example.com"
  - name: "User Name"
  - createdAt: "2025-01-06T..."
```

## Workflow

1. **Employee creates purchase order** → Status: `draft`
2. **Owner/Manager/Admin views order** → Can see "Setujui" and "Tolak" buttons
3. **If approved** → Status: `approved`, account balance updated
4. **If declined** → Status: `declined`, reason stored
5. **After approval** → Delivery status can be updated (0%, 25%, 50%, 75%, 100%)

## Notes

- Draft purchase orders do NOT affect account balances
- Only approved purchase orders update account balances
- Declined orders remain in the system but don't affect finances
- Delivery tracking only shows approved orders

