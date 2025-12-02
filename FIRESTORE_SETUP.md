# Firestore Database Setup Guide

This document describes the Firestore database structure needed for the dashboard.

## Collection Structure

```
dashboard/
├── giro/
│   ├── (document) - Contains: { saldoKledo: number, saldoBank: number }
│   └── chartData/
│       ├── (documents) - Each with: { month: string, value: number, order: number }
│
├── expenses/
│   └── items/
│       ├── (documents) - Each with: { name: string, value: number }
│
├── cashFlow/
│   └── chartData/
│       ├── (documents) - Each with: { month: string, net: number, in: number, out: number, order: number }
│
├── profitLoss/
│   ├── (document) - Contains: { labaBersihTahunIni: number }
│   └── chartData/
│       ├── (documents) - Each with: { month: string, labaKotor: number, labaBersih: number, order: number }
│
├── summaryBoxes/
│   └── items/
│       ├── (documents) - Each with: { title: string, value1: number, value2: number, account: string, order: number }
│
├── debtReceivables/
│   ├── (document) - Contains: { jumlahHutang: number, totalHutang: number, jumlahPiutang: number, totalPiutang: number }
│   └── chartData/
│       ├── (documents) - Each with: { month: string, piutang: number, hutang: number, net: number, order: number }
│
└── customerBills/
    ├── (document) - Contains: { menungguPembayaran: number, totalMenunggu: number, jatuhTempo: number, totalJatuhTempo: number }
    └── chartData/
        ├── (documents) - Each with: { period: string, amount: number, order: number }
```

## Sample Data

### 1. GIRO Document
```json
{
  "saldoKledo": 47557068,
  "saldoBank": 11020910
}
```

### 2. GIRO Chart Data (subcollection)
```json
[
  { "month": "Jul", "value": 30000000, "order": 1 },
  { "month": "Agt", "value": 35000000, "order": 2 },
  { "month": "Sep", "value": 40000000, "order": 3 },
  { "month": "Okt", "value": 42000000, "order": 4 },
  { "month": "Nov", "value": 45000000, "order": 5 },
  { "month": "Des", "value": 47557068, "order": 6 }
]
```

### 3. Expenses Items (subcollection)
```json
[
  { "name": "Komunikasi - Penjualan", "value": 4186200 },
  { "name": "Komisi & Fee", "value": 3403400 },
  { "name": "Perjalanan Dinas - Penjualan", "value": 2946100 },
  { "name": "Iklan & Promosi", "value": 2470000 },
  { "name": "Bensin, Tol dan Parkir - Penjualan", "value": 1160000 }
]
```

### 4. Cash Flow Chart Data (subcollection)
```json
[
  { "month": "Jul", "net": 0, "in": 0, "out": 0, "order": 1 },
  { "month": "Agt", "net": 0, "in": 0, "out": 0, "order": 2 },
  { "month": "Sep", "net": 0, "in": 0, "out": 0, "order": 3 },
  { "month": "Okt", "net": 0, "in": 0, "out": 0, "order": 4 },
  { "month": "Nov", "net": 0, "in": 0, "out": 0, "order": 5 },
  { "month": "Des", "net": 0, "in": 0, "out": 0, "order": 6 }
]
```

### 5. Profit & Loss Document
```json
{
  "labaBersihTahunIni": 32761134
}
```

### 6. Profit & Loss Chart Data (subcollection)
```json
[
  { "month": "Jul", "labaKotor": 0, "labaBersih": 0, "order": 1 },
  { "month": "Agt", "labaKotor": 0, "labaBersih": 0, "order": 2 },
  { "month": "Sep", "labaKotor": 5000000, "labaBersih": 0, "order": 3 },
  { "month": "Okt", "labaKotor": 35000000, "labaBersih": 20000000, "order": 4 },
  { "month": "Nov", "labaKotor": 28000000, "labaBersih": 20000000, "order": 5 },
  { "month": "Des", "labaKotor": 0, "labaBersih": 0, "order": 6 }
]
```

### 7. Summary Boxes Items (subcollection)
```json
[
  { "title": "Rekening Bank", "value1": 0, "value2": 0, "account": "1-10002", "order": 1 },
  { "title": "Giro", "value1": 0, "value2": 0, "account": "1-10003", "order": 2 },
  { "title": "Piutang Usaha", "value1": 0, "value2": 0, "account": "1-10100", "order": 3 }
]
```

### 8. Debt & Receivables Document
```json
{
  "jumlahHutang": 42,
  "totalHutang": 27597173,
  "jumlahPiutang": 28,
  "totalPiutang": 49414584
}
```

### 9. Debt & Receivables Chart Data (subcollection)
```json
[
  { "month": "Jul", "piutang": 0, "hutang": 0, "net": 0, "order": 1 },
  { "month": "Agt", "piutang": 0, "hutang": 0, "net": 0, "order": 2 },
  { "month": "Sep", "piutang": 20000000, "hutang": -10000000, "net": 10000000, "order": 3 },
  { "month": "Okt", "piutang": 35000000, "hutang": -20000000, "net": 15000000, "order": 4 },
  { "month": "Nov", "piutang": 30000000, "hutang": -15000000, "net": 15000000, "order": 5 },
  { "month": "Des", "piutang": 0, "hutang": 0, "net": 0, "order": 6 }
]
```

### 10. Customer Bills Document
```json
{
  "menungguPembayaran": 28,
  "totalMenunggu": 49414584,
  "jatuhTempo": 26,
  "totalJatuhTempo": 46164584
}
```

### 11. Customer Bills Chart Data (subcollection)
```json
[
  { "period": "<1 months", "amount": 26000000, "order": 1 },
  { "period": "1 months", "amount": 20000000, "order": 2 },
  { "period": "2 months", "amount": 0, "order": 3 },
  { "period": "3 months", "amount": 0, "order": 4 },
  { "period": "Older", "amount": 0, "order": 5 }
]
```

## Setup Instructions

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project "ibasa-keuangan"
3. Navigate to Firestore Database
4. Create the collections and documents as described above
5. Make sure to set up Firestore security rules to allow authenticated users to read data

## Security Rules Example

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /dashboard/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

## Notes

- The `order` field is used to sort the data correctly
- All numeric values should be stored as numbers (not strings)
- The dashboard will fall back to default data if Firestore data is not available
- Make sure users are authenticated before accessing the dashboard

