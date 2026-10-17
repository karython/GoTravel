import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, CheckCheck, Trash2 } from 'lucide-react';

const formatWhen = (iso) => {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export default function NotificationBell({
  notifications,
  onOpen,
  onMarkAllRead,
  onClearRead,
  devicePermission,
  onEnableDevice,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
        title="Notificações"
        aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`}
      >
        {unread > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Notificações</h3>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.some((n) => n.read) && (
                <button
                  onClick={onClearRead}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                  title="Limpar lidas"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {devicePermission === 'default' && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-3">
              <p className="text-[11px] text-blue-900">Receba alertas no dispositivo mesmo com o app em segundo plano.</p>
              <button
                onClick={onEnableDevice}
                className="flex-shrink-0 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg"
              >
                Ativar
              </button>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Nenhuma notificação por aqui.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { onOpen(n); setOpen(false); }}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 flex gap-3 ${n.read ? '' : 'bg-blue-50/50'}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-blue-600'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">{n.title}</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{formatWhen(n.createdAt)}</span>
                    </span>
                    <span className="block text-[11px] text-slate-600 mt-0.5 whitespace-pre-line">{n.message}</span>
                    <span className="block text-[10px] text-slate-400 mt-1 truncate">{n.tripName}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
