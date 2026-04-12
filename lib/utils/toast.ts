import toast from 'react-hot-toast'

export const showToast = {
  success: (message: string) => toast.success(message, {
    style: {
      background: '#1a1a1a',
      color: '#ffffff',
      border: '1px solid #22c55e',
    },
    icon: '✅',
  }),
  error: (message: string) => toast.error(message, {
    style: {
      background: '#1a1a1a',
      color: '#ffffff',
      border: '1px solid #ef4444',
    },
    icon: '❌',
  }),
  loading: (message: string) => toast.loading(message, {
    style: {
      background: '#1a1a1a',
      color: '#ffffff',
      border: '1px solid #3b82f6',
    },
  }),
  info: (message: string) => toast(message, {
    style: {
      background: '#1a1a1a',
      color: '#ffffff',
      border: '1px solid #3b82f6',
    },
    icon: 'ℹ️',
  }),
  dismiss: (toastId?: string) => toast.dismiss(toastId),
}