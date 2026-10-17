import { useEffect, useState } from 'react';

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

export function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

// Executa uma escrita no Firestore.
// Online: aguarda a confirmação do servidor (erros sobem para o chamador).
// Offline: a escrita já foi aplicada no cache local e fica na fila; não espera
// o servidor (a promise só resolve ao reconectar) e avisa se a sincronização falhar.
// Retorna true quando a escrita ficou pendente para sincronizar depois.
export async function runWrite(writePromise, onSyncError) {
  if (isOnline()) {
    await writePromise;
    return false;
  }
  writePromise.catch((err) => {
    console.error('Falha ao sincronizar escrita offline:', err);
    onSyncError?.(err);
  });
  return true;
}
