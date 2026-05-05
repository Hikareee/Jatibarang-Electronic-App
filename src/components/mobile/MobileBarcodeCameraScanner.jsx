import CameraScannerModal from '../Scanner/CameraScannerModal'

/**
 * Camera barcode scanner for mobile web.
 * Props:
 * - open: boolean
 * - onScan: (code: string) => void
 * - onClose: () => void
 */
export default function MobileBarcodeCameraScanner({ open, onScan, onClose }) {
  return (
    <CameraScannerModal
      open={open}
      onClose={onClose}
      onScan={onScan}
      title="Scan Barcode / QR"
      hint="Arahkan kamera ke barcode atau QR."
    />
  )
}

