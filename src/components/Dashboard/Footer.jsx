import { 
  FaGooglePlay, 
  FaAppStore 
} from 'react-icons/fa'

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* App Store Links */}
        <div className="flex items-center gap-4">
          <a
            href="https://play.google.com/store/apps/details?id=com.ibasa.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <FaGooglePlay className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Google Play</span>
          </a>
          <a
            href="https://apps.apple.com/id/app/ibasa/id1586502518"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <FaAppStore className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            <span className="text-sm text-gray-600 dark:text-gray-400">App Store</span>
          </a>
        </div>

        {/* Copyright */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          © 2025{' '}
          <a
            href="https://ibasa.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            IBASA Software v3.0.51
          </a>
          {' '}All rights reserved
        </div>
      </div>
    </footer>
  )
}

