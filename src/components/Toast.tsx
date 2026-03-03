interface ToastProps {
  message: string
  variant: 'success' | 'error' | 'info'
  onDismiss: () => void
}

const variantStyles = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white',
}

export function Toast({ message, variant, onDismiss }: ToastProps) {
  return (
    <div
      data-variant={variant}
      onClick={onDismiss}
      className={`${variantStyles[variant]} px-5 py-2.5 rounded-full shadow-lg text-sm font-medium pointer-events-auto cursor-pointer`}
    >
      {message}
    </div>
  )
}
