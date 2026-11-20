import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

export const ToastContainer: React.FC = () => {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const styles =
            t.type === 'success'
              ? {
                  border: 'border-emerald-500/40',
                  icon: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
                }
              : t.type === 'error'
                ? {
                    border: 'border-[#E1384B]/50',
                    icon: <XCircle className="h-4 w-4 text-[#E1384B] shrink-0" />,
                  }
                : t.type === 'warning'
                  ? {
                      border: 'border-amber-400/40',
                      icon: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />,
                    }
                  : {
                      border: 'border-[#E6B84C]/40',
                      icon: <Info className="h-4 w-4 text-[#1CD696] shrink-0" />,
                    };

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className={`pointer-events-auto glass-panel flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl ${styles.border}`}
            >
              <div className="mt-0.5">{styles.icon}</div>
              <div className="min-w-0 flex-1">
                {t.title && (
                  <p className="text-xs font-semibold tracking-wide text-[#FAF3E3]">
                    {t.title}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-[#DFD2BE]">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-lg p-1 text-[#949BB0] hover:bg-white/5 hover:text-white cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
