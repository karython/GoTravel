import { collection, doc, writeBatch } from 'firebase/firestore';
import { db, appId } from '../firebase/config.js';

export const notificationsCol = () => collection(db, 'artifacts', appId, 'public', 'data', 'notifications');

// Cria uma notificação para cada membro da viagem (exceto o autor, por padrão).
// `message` pode ser uma string ou uma função (uid) => string para mensagens individuais.
export async function notifyTripMembers({ trip, fromUid, fromName, type, title, message, includeSelf = false }) {
  if (!trip?.members?.length) return;
  const recipients = trip.members.filter((uid) => includeSelf || uid !== fromUid);
  if (recipients.length === 0) return;

  const batch = writeBatch(db);
  const createdAt = new Date().toISOString();
  recipients.forEach((toUid) => {
    const ref = doc(notificationsCol());
    batch.set(ref, {
      id: ref.id,
      toUid,
      fromUid,
      fromName: fromName || 'Membro',
      tripId: trip.id,
      tripName: trip.name || '',
      type,
      title,
      message: typeof message === 'function' ? message(toUid) : message,
      read: false,
      createdAt,
    });
  });

  try {
    await batch.commit();
  } catch (err) {
    // Notificação é secundária: não deve quebrar a ação principal.
    console.error('Falha ao enviar notificações:', err);
  }
}

// Notificação do sistema (aparece fora do app quando a aba está em segundo plano)
export async function showDeviceNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' });
    } else {
      new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
    }
  } catch (err) {
    console.error('Falha ao exibir notificação do dispositivo:', err);
  }
}
