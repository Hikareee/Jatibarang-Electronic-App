# Jatibarang Electronic App - React + Firebase

A full-stack accounting software built with React and Firebase.

## Features

- 🔐 **Authentication**: Email/password and Google OAuth login
- 📊 **Dashboard**: Modern dashboard with statistics and quick actions
- 🎨 **Dark Mode**: Toggle between light and dark themes
- 📱 **Responsive**: Works on desktop, tablet, and mobile devices
- 🔍 **Search**: Global search functionality
- 🌐 **Multi-language**: Language selector (ready for i18n)
- 📄 **Print**: Print functionality for reports

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool
- **Firebase** - Authentication & Database
- **React Router** - Navigation
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Icons** - Additional icons

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Firebase project (get your config from Firebase Console)

### Installation

1. Clone the repository and open the project folder:
```bash
git clone https://github.com/Hikareee/Jatibarang-Electronic-App.git
cd "Jatibarang-Electronic-App"
npm install
```

2. Configure Firebase:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use an existing one
   - Enable Authentication (Email/Password and Google)
   - Enable Firestore Database
   - Copy your Firebase config

3. Update Firebase configuration:
   - Open `src/firebase/config.js`
   - Replace the placeholder values with your Firebase config

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

### Point of Sale (POS)

After login as an approved user, open **`/pos`** (or **POS** in the sidebar) to sell tracked items:

1. Register products under **Produk** (SKU/barcode optional; enable **Lacak per serial** for electronics).
2. Receive stock under **Inventori → Gudang** and enter **one serial per line** per unit received.
3. On POS, choose the warehouse, scan or tap products, then scan each unit’s serial before checkout.

Direct link for counter staff: `{your-domain}/pos` (same app; map a subdomain to this path in Firebase Hosting/DNS when ready).

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Dashboard/      # Dashboard-specific components
│   └── Login/          # Login page components
├── contexts/           # React contexts (AuthContext)
├── firebase/           # Firebase configuration
├── pages/              # Page components
├── App.jsx             # Main app component with routing
└── main.jsx            # Entry point
```

## Firebase Setup

1. **Authentication**:
   - Enable Email/Password authentication
   - Enable Google Sign-In provider

2. **Firestore**:
   - Create a database in test mode (or set up security rules)
   - Collections will be created automatically as needed

3. **Storage** (optional):
   - Enable Firebase Storage if you need file uploads

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features to Implement

- [ ] Invoice management
- [ ] Customer management
- [ ] Product management
- [ ] Sales tracking
- [ ] Financial reports
- [ ] Settings page
- [ ] SSO authentication
- [ ] OTP authentication
- [ ] Multi-language support

## License

This is a clone project for educational purposes.

