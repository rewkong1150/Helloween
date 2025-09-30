
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Info, TriangleAlert } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

let toastCount = 0;
const toastListeners = new Set<(toast: ToastMessage) => void>();

const addToast = (message: string, type: ToastType) => {
  toastCount += 1;
  const newToast = { id: toastCount, message, type };
  toastListeners.forEach(listener => listener(newToast));
};

export const toast = {
  success: (message: string) => addToast(message, 'success'),
  error: (message: string) => addToast(message, 'error'),
  info: (message: string) => addToast(message, 'info'),
  warning: (message: string) => addToast(message, 'warning'),
};

const Toast: React.FC<{ message: ToastMessage; onDismiss: (id: number) => void }> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(message.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  const icons = {
    success: <CheckCircle className="text-green-300" />,
    error: <XCircle className="text-red-300" />,
    info: <Info className="text-blue-300" />,
    warning: <TriangleAlert className="text-yellow-300" />,
  };

  const bgColors = {
    success: 'bg-green-800/80 border-green-500/50',
    error: 'bg-red-800/80 border-red-500/50',
    info: 'bg-blue-800/80 border-blue-500/50',
    warning: 'bg-yellow-800/80 border-yellow-500/50',
  };

  return (
    <div
      className={`flex items-center w-full max-w-xs p-4 mb-4 text-white rounded-lg shadow-lg backdrop-blur-sm ${bgColors[message.type]} border`}
      role="alert"
    >
      <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg">
        {icons[message.type]}
      </div>
      <div className="ml-3 text-sm font-normal">{message.message}</div>
      <button
        type="button"
        className="ml-auto -mx-1.5 -my-1.5 p-1.5 inline-flex h-8 w-8 rounded-lg hover:bg-white/10"
        onClick={() => onDismiss(message.id)}
      >
        <span className="sr-only">Dismiss</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
      </button>
    </div>
  );
};


export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (newToast: ToastMessage) => {
      setToasts(currentToasts => [newToast, ...currentToasts]);
    };
    
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  const handleDismiss = useCallback((id: number) => {
    setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
  }, []);

  return (
    <div className="fixed top-20 right-5 z-50">
      {toasts.map(t => (
        <Toast key={t.id} message={t} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};
