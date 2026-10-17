import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  arrayUnion,
  deleteField,
  writeBatch,
  waitForPendingWrites,
} from 'firebase/firestore';
import {
  Compass,
  DollarSign,
  Calendar,
  Users,
  Plus,
  Check,
  X,
  LogOut,
  Info,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Lock,
  Mail,
  Phone,
  User,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  CheckCircle,
  AlertCircle,
  Pencil,
  Trash2,
  Flag,
  RotateCcw,
  Filter,
  WifiOff,
  RefreshCw,
  Clock,
} from 'lucide-react';

import { auth, db, appId } from './firebase/config.js';
import { EXPENSE_CATEGORIES, DEFAULT_CATEGORY, getCategory } from './lib/categories.js';
import { computeTripSummary, formatBRL } from './lib/finance.js';
import { notificationsCol, notifyTripMembers, showDeviceNotification } from './lib/notifications.js';
import { useOnlineStatus, runWrite, isOnline } from './lib/offline.js';
import NotificationBell from './components/NotificationBell.jsx';
import TripSummary from './components/TripSummary.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [notification, setNotification] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [myTrips, setMyTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [activeTripData, setActiveTripData] = useState(null);
  const [activeTab, setActiveTab] = useState('feed');

  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingTipId, setEditingTipId] = useState(null);

  const [newTripName, setNewTripName] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const [expenseValue, setExpenseValue] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(DEFAULT_CATEGORY);
  const [expenseFilterUser, setExpenseFilterUser] = useState('all');
  const [expenseFilterCategory, setExpenseFilterCategory] = useState('all');

  const [notifications, setNotifications] = useState([]);
  const [devicePermission, setDevicePermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const [tipType, setTipType] = useState('almoco');
  const [tipPeriod, setTipPeriod] = useState('manha');
  const [tipPlaceName, setTipPlaceName] = useState('');
  const [tipDesc, setTipDesc] = useState('');
  const [tipDate, setTipDate] = useState('');

  const [tripExpenses, setTripExpenses] = useState([]);
  const [tripTips, setTripTips] = useState([]);
  const [tripMembers, setTripMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);

  // Viagem finalizada não aceita novos lançamentos, atividades ou convites
  const isTripFinished = activeTripData?.status === 'finished';

  // Modo offline: escritas ficam no cache local até a conexão voltar
  const online = useOnlineStatus();
  const [syncState, setSyncState] = useState('idle'); // idle | syncing | synced

  // ──────────────────────────────────────────────
  // AUTENTICAÇÃO
  // ──────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        const fallbackProfile = {
          uid: currentUser.uid,
          name: currentUser.displayName || 'Viajante',
          email: currentUser.email || '',
          phone: '',
          verified: currentUser.emailVerified || false,
        };

        // Offline o getDoc lê do cache local; se o perfil nunca foi baixado, ele falha
        let userDoc = null;
        try {
          userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'data'));
          setUserData(userDoc.exists() ? userDoc.data() : fallbackProfile);
        } catch (err) {
          console.error('Perfil indisponível (offline?):', err);
          setUserData(fallbackProfile);
        }

        if (currentUser.email && isOnline()) {
          try {
            const emailIndexRef = doc(db, 'artifacts', appId, 'public', 'data', 'emails', currentUser.email.toLowerCase().trim());
            const emailIndexDoc = await getDoc(emailIndexRef);
            if (!emailIndexDoc.exists()) {
              await setDoc(emailIndexRef, {
                uid: currentUser.uid,
                name: currentUser.displayName || userDoc?.data()?.name || 'Viajante',
              });
            }
          } catch (err) {
            console.error('Falha ao atualizar índice de e-mail:', err);
          }
        }
      } else {
        setUserData(null);
        setActiveTrip(null);
        setActiveTripData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // ──────────────────────────────────────────────
  // REGISTRO / LOGIN / LOGOUT
  // ──────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    if (!name || !email || !password || !phone) {
      setAuthError('Por favor, preencha todos os campos.');
      setAuthLoading(false);
      return;
    }

    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(newUser, { displayName: name });
      await sendEmailVerification(newUser);

      const profileData = {
        uid: newUser.uid,
        name,
        email: email.toLowerCase().trim(),
        phone,
        verified: false,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'artifacts', appId, 'users', newUser.uid, 'profile', 'data'), profileData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'emails', email.toLowerCase().trim()), {
        uid: newUser.uid,
        name,
      });

      setUserData(profileData);
      showNotification('Conta criada! Verifique seu e-mail para ativar a conta.', 'success');
    } catch (err) {
      setAuthError(translateAuthError(err.code));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showNotification('Bem-vindo de volta ao GoTravel!', 'success');
    } catch (err) {
      setAuthError(translateAuthError(err.code));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    showNotification('Sessão encerrada.', 'info');
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    if (!email) {
      setAuthError('Informe seu e-mail para recuperar a senha.');
      setAuthLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.toLowerCase().trim());
      showNotification('Enviamos um e-mail com instruções para redefinir sua senha.', 'success');
      setAuthMode('login');
    } catch (err) {
      setAuthError(translateAuthError(err.code));
    } finally {
      setAuthLoading(false);
    }
  };

  const translateAuthError = (code) => {
    const messages = {
      'auth/invalid-email': 'E-mail em formato incorreto.',
      'auth/user-disabled': 'Este usuário foi desativado.',
      'auth/user-not-found': 'Usuário não localizado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha inválidos.',
      'auth/email-already-in-use': 'Este e-mail já está em uso.',
      'auth/weak-password': 'A senha deve ter ao menos 6 caracteres.',
      'auth/missing-email': 'Informe um e-mail válido.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    };
    return messages[code] ?? 'Ocorreu um erro ao autenticar. Tente novamente.';
  };

  const handleResendVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      showNotification('E-mail de confirmação reenviado!', 'success');
    } catch (err) {
      if (err.code === 'auth/too-many-requests') {
        showNotification('Aguarde um pouco antes de reenviar novamente.', 'error');
      } else {
        showNotification('Falha ao reenviar o e-mail.', 'error');
      }
    }
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    try {
      await user.reload();
      if (!user.emailVerified) {
        showNotification('Ainda não verificado. Confira seu e-mail (e a caixa de spam).', 'error');
        return;
      }
      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await updateDoc(ref, { verified: true });
      setUserData((prev) => ({ ...prev, verified: true }));
      showNotification('Conta ativada com sucesso!', 'success');
    } catch (err) {
      console.error('Falha ao confirmar ativação:', err);
      showNotification('Falha ao confirmar ativação.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // VIAGENS & CONVITES EM TEMPO REAL
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const tripsCol = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    const unsubTrips = onSnapshot(tripsCol, (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (data.members?.includes(user.uid)) list.push(data);
      });
      setMyTrips(list);

      if (activeTrip) {
        const found = list.find((t) => t.id === activeTrip);
        if (found) setActiveTripData(found);
      }
    });

    const invitesCol = collection(db, 'artifacts', appId, 'public', 'data', 'invites');
    const unsubInvites = onSnapshot(invitesCol, (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (data.toEmail === user.email?.toLowerCase().trim() && data.status === 'pending') {
          list.push(data);
        }
      });
      setPendingInvites(list);
    });

    return () => {
      unsubTrips();
      unsubInvites();
    };
  }, [user, activeTrip]);

  // ──────────────────────────────────────────────
  // NOTIFICAÇÕES EM TEMPO REAL
  // ──────────────────────────────────────────────
  const notificationsLoaded = useRef(false);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    notificationsLoaded.current = false;
    const q = query(notificationsCol(), where('toUid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(list.slice(0, 50));

      // Alerta apenas as notificações que chegaram depois da carga inicial
      if (notificationsLoaded.current) {
        snap.docChanges()
          .filter((c) => c.type === 'added' && !c.doc.data().read)
          .forEach((c) => {
            const n = c.doc.data();
            if (document.visibilityState === 'visible') {
              showNotification(`${n.title}: ${n.message.split('\n')[0]}`, 'info');
            } else {
              showDeviceNotification(n.title, n.message, c.doc.id);
            }
          });
      }
      notificationsLoaded.current = true;
    }, (err) => console.error('Erro ao carregar notificações:', err));

    return () => unsub();
  }, [user]);

  const notifyActiveTrip = (type, title, message, options = {}) =>
    notifyTripMembers({
      trip: options.trip || activeTripData,
      fromUid: user.uid,
      fromName: userData?.name,
      type,
      title,
      message,
      includeSelf: options.includeSelf,
    });

  const handleOpenNotification = async (n) => {
    if (!n.read) {
      try {
        await updateDoc(doc(notificationsCol(), n.id), { read: true });
      } catch (err) {
        console.error('Erro ao marcar notificação:', err);
      }
    }
    const trip = myTrips.find((t) => t.id === n.tripId);
    if (trip) {
      setActiveTrip(trip.id);
      setActiveTripData(trip);
      if (n.type?.startsWith('expense') || n.type?.startsWith('trip_')) setActiveTab('financeiro');
      else if (n.type?.startsWith('tip')) setActiveTab('cronograma');
      else setActiveTab('feed');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(notificationsCol(), n.id), { read: true }));
    try {
      await batch.commit();
    } catch (err) {
      console.error('Erro ao marcar notificações:', err);
    }
  };

  const handleClearReadNotifications = async () => {
    const read = notifications.filter((n) => n.read);
    if (read.length === 0) return;
    const batch = writeBatch(db);
    read.forEach((n) => batch.delete(doc(notificationsCol(), n.id)));
    try {
      await batch.commit();
    } catch (err) {
      console.error('Erro ao limpar notificações:', err);
    }
  };

  const handleEnableDeviceNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setDevicePermission(result);
    if (result === 'granted') {
      showNotification('Notificações do dispositivo ativadas!', 'success');
    } else if (result === 'denied') {
      showNotification('Permissão negada. Ative nas configurações do navegador.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // DADOS DA VIAGEM ATIVA EM TEMPO REAL
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeTrip) return;

    const expensesCol = collection(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`);
    const unsubExpenses = onSnapshot(expensesCol, { includeMetadataChanges: true }, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data(), _pending: d.metadata.hasPendingWrites }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTripExpenses(list);
    });

    const tipsCol = collection(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`);
    const unsubTips = onSnapshot(tipsCol, { includeMetadataChanges: true }, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data(), _pending: d.metadata.hasPendingWrites }));
      setTripTips(list);
    });

    const loadMembers = async () => {
      if (!activeTripData) return;
      const list = [];
      for (const mId of activeTripData.members) {
        try {
          const mDoc = await getDoc(doc(db, 'artifacts', appId, 'users', mId, 'profile', 'data'));
          list.push(mDoc.exists() ? mDoc.data() : { uid: mId, name: 'Viajante Convidado', email: '' });
        } catch (err) {
          console.error('Erro ao carregar membro:', mId, err);
          list.push({ uid: mId, name: 'Viajante Convidado', email: '' });
        }
      }
      setTripMembers(list);
    };

    loadMembers();

    return () => {
      unsubExpenses();
      unsubTips();
    };
  }, [user, activeTrip, activeTripData]);

  useEffect(() => {
    setExpenseFilterUser('all');
    setExpenseFilterCategory('all');
  }, [activeTrip]);

  // Ao reconectar, aguarda a fila local ser enviada ao servidor
  const wasOffline = useRef(!isOnline());

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setSyncState('idle');
      return;
    }
    if (!wasOffline.current || !user) return;
    wasOffline.current = false;

    let cancelled = false;
    let hideTimer;
    setSyncState('syncing');
    waitForPendingWrites(db)
      .then(() => {
        if (cancelled) return;
        setSyncState('synced');
        hideTimer = setTimeout(() => setSyncState('idle'), 4000);
      })
      .catch((err) => {
        console.error('Erro ao sincronizar:', err);
        if (!cancelled) setSyncState('idle');
      });

    return () => {
      cancelled = true;
      clearTimeout(hideTimer);
    };
  }, [online, user]);

  const pendingSyncCount =
    tripExpenses.filter((e) => e._pending).length + tripTips.filter((t) => t._pending).length;

  // Ações que dependem de resposta do servidor não funcionam offline
  const requireOnline = (action) => {
    if (isOnline()) return true;
    showNotification(`Sem conexão: conecte-se à internet para ${action}.`, 'error');
    return false;
  };

  const notifySyncError = (what) => () =>
    showNotification(`Não foi possível sincronizar ${what} feito offline. Ele foi descartado pelo servidor.`, 'error');

  // ──────────────────────────────────────────────
  // CRIAR VIAGEM
  // ──────────────────────────────────────────────
  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!newTripName.trim()) return;

    try {
      const tripRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'trips'));
      const payload = {
        id: tripRef.id,
        name: newTripName,
        description: newTripDesc,
        creator: user.uid,
        creatorName: userData?.name || 'Viajante',
        members: [user.uid],
        createdAt: new Date().toISOString(),
      };

      const queued = await runWrite(setDoc(tripRef, payload), notifySyncError('a viagem criada'));
      setActiveTrip(tripRef.id);
      setActiveTripData(payload);
      setIsNewTripModalOpen(false);
      setNewTripName('');
      setNewTripDesc('');
      showNotification(
        queued ? `Viagem "${payload.name}" salva offline. Será sincronizada ao reconectar.` : `Viagem "${payload.name}" criada com sucesso!`,
        queued ? 'info' : 'success'
      );
    } catch (err) {
      console.error('Erro ao criar viagem:', err);
      showNotification('Erro ao criar viagem.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // APAGAR VIAGEM (somente o criador)
  // ──────────────────────────────────────────────
  const handleDeleteTrip = async () => {
    if (!activeTripData || activeTripData.creator !== user.uid) return;
    if (!requireOnline('apagar a viagem')) return;
    if (!window.confirm(`Apagar a viagem "${activeTripData.name}"? Essa ação é permanente e vai remover todos os gastos, o cronograma e os convites dela.`)) return;

    try {
      // Notifica antes de apagar: a regra de criação exige que a viagem exista
      await notifyActiveTrip('trip_deleted', 'Viagem apagada', `${userData?.name || 'O criador'} apagou a viagem "${activeTripData.name}".`);

      const expensesSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`));
      await Promise.all(expensesSnap.docs.map((d) => deleteDoc(d.ref)));

      const tipsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`));
      await Promise.all(tipsSnap.docs.map((d) => deleteDoc(d.ref)));

      const invitesSnap = await getDocs(
        query(collection(db, 'artifacts', appId, 'public', 'data', 'invites'), where('tripId', '==', activeTrip))
      );
      await Promise.all(invitesSnap.docs.map((d) => deleteDoc(d.ref)));

      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', activeTrip));

      setActiveTrip(null);
      setActiveTripData(null);
      showNotification('Viagem apagada com sucesso.', 'info');
    } catch (err) {
      console.error('Erro ao apagar viagem:', err);
      showNotification('Erro ao apagar a viagem.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // ENVIAR CONVITE
  // ──────────────────────────────────────────────
  const handleSendInvite = async (e) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.toLowerCase().trim();
    if (!cleanEmail) return;

    if (isTripFinished) {
      showNotification('Esta viagem já foi finalizada.', 'error');
      return;
    }
    if (!requireOnline('enviar convites')) return;

    if (cleanEmail === user.email?.toLowerCase().trim()) {
      showNotification('Você já faz parte desta viagem.', 'error');
      return;
    }

    try {
      const emailDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'emails', cleanEmail));
      if (!emailDoc.exists()) {
        showNotification('E-mail não cadastrado no aplicativo.', 'error');
        return;
      }

      const recipient = emailDoc.data();

      if (activeTripData.members.includes(recipient.uid)) {
        showNotification('Este viajante já está no grupo.', 'info');
        return;
      }

      const inviteRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'invites'));
      await setDoc(inviteRef, {
        id: inviteRef.id,
        tripId: activeTrip,
        tripName: activeTripData.name,
        fromUid: user.uid,
        fromName: userData?.name || 'Membro',
        toEmail: cleanEmail,
        toUid: recipient.uid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      showNotification(`Convite enviado para ${cleanEmail}!`, 'success');
      setInviteEmail('');
      setIsInviteModalOpen(false);
    } catch (err) {
      console.error('Erro ao enviar convite:', err);
      showNotification('Erro ao enviar convite.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // RESPONDER CONVITE
  // ──────────────────────────────────────────────
  const handleRespondInvite = async (invite, accept) => {
    if (!requireOnline('responder ao convite')) return;
    try {
      const inviteRef = doc(db, 'artifacts', appId, 'public', 'data', 'invites', invite.id);

      if (accept) {
        await updateDoc(inviteRef, { status: 'accepted' });
        const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', invite.tripId);
        await updateDoc(tripRef, { members: arrayUnion(user.uid) });
        setActiveTrip(invite.tripId);

        const tripSnap = await getDoc(tripRef);
        if (tripSnap.exists()) {
          await notifyActiveTrip('member_joined', 'Novo membro na viagem', `${userData?.name || 'Um viajante'} entrou na viagem.`, {
            trip: { id: tripSnap.id, ...tripSnap.data() },
          });
        }
        showNotification(`Você entrou na viagem: "${invite.tripName}"!`, 'success');
      } else {
        await updateDoc(inviteRef, { status: 'declined' });
        showNotification('Convite recusado.', 'info');
      }
    } catch (err) {
      console.error('Erro ao responder convite:', err);
      showNotification('Erro ao responder convite.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // DESPESAS
  // ──────────────────────────────────────────────
  const closeExpenseModal = () => {
    setIsExpenseModalOpen(false);
    setEditingExpenseId(null);
    setExpenseValue('');
    setExpenseDesc('');
    setExpenseCategory(DEFAULT_CATEGORY);
  };

  const openNewExpenseModal = () => {
    if (isTripFinished) return;
    setIsExpenseModalOpen(true);
  };

  const handleEditExpenseClick = (exp) => {
    if (isTripFinished) return;
    setEditingExpenseId(exp.id);
    setExpenseValue(String(exp.value));
    setExpenseDesc(exp.description);
    setExpenseCategory(exp.category || DEFAULT_CATEGORY);
    setIsExpenseModalOpen(true);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (isTripFinished) {
      showNotification('Viagem finalizada: não é possível lançar despesas.', 'error');
      return;
    }
    const value = parseFloat(expenseValue);
    if (isNaN(value) || value <= 0 || !expenseDesc.trim()) {
      showNotification('Insira descrição e valor válido.', 'error');
      return;
    }

    const categoryLabel = getCategory(expenseCategory).label;
    const author = userData?.name || 'Participante';

    try {
      if (editingExpenseId) {
        const expRef = doc(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`, editingExpenseId);
        const queued = await runWrite(
          updateDoc(expRef, { value, description: expenseDesc, category: expenseCategory }),
          notifySyncError('o lançamento editado')
        );
        showNotification(queued ? 'Edição salva offline. Será sincronizada ao reconectar.' : 'Despesa atualizada!', queued ? 'info' : 'success');
        notifyActiveTrip('expense_updated', 'Lançamento editado', `${author} editou "${expenseDesc}" (${categoryLabel}): ${formatBRL(value)}.`);
      } else {
        const expRef = doc(collection(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`));
        const queued = await runWrite(
          setDoc(expRef, {
            id: expRef.id,
            value,
            description: expenseDesc,
            category: expenseCategory,
            uid: user.uid,
            userName: author,
            createdAt: new Date().toISOString(),
          }),
          notifySyncError('o lançamento')
        );
        showNotification(
          queued ? 'Lançamento salvo offline. Será sincronizado ao reconectar.' : 'Despesa registrada e rateada entre o grupo!',
          queued ? 'info' : 'success'
        );
        notifyActiveTrip(
          'expense_created',
          'Novo lançamento',
          `${author} lançou "${expenseDesc}" (${categoryLabel}): ${formatBRL(value)} — ${formatBRL(value / activeTripData.members.length)} por pessoa.`
        );
      }

      closeExpenseModal();
    } catch (err) {
      console.error('Erro ao registrar despesa:', err);
      showNotification('Erro ao registrar despesa.', 'error');
    }
  };

  const handleDeleteExpense = async (exp) => {
    if (isTripFinished) return;
    if (!window.confirm('Excluir este lançamento?')) return;
    try {
      await runWrite(
        deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`, exp.id)),
        notifySyncError('a exclusão')
      );
      showNotification(isOnline() ? 'Despesa excluída.' : 'Exclusão salva offline. Será sincronizada ao reconectar.', 'info');
      notifyActiveTrip('expense_deleted', 'Lançamento excluído', `${userData?.name || 'Um membro'} excluiu "${exp.description}" (${formatBRL(exp.value)}).`);
    } catch (err) {
      console.error('Erro ao excluir despesa:', err);
      showNotification('Erro ao excluir despesa.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // RATEIO FINANCEIRO
  // ──────────────────────────────────────────────
  const financialSummary = useMemo(() => {
    if (!activeTripData) {
      return computeTripSummary([], [], []);
    }
    return computeTripSummary(activeTripData.members, tripMembers, tripExpenses);
  }, [activeTripData, tripExpenses, tripMembers]);

  // Lançamentos filtrados por quem lançou e por categoria
  const filteredExpenses = useMemo(() => {
    return tripExpenses.filter((exp) => {
      if (expenseFilterUser !== 'all' && exp.uid !== expenseFilterUser) return false;
      if (expenseFilterCategory !== 'all' && (exp.category || DEFAULT_CATEGORY) !== expenseFilterCategory) return false;
      return true;
    });
  }, [tripExpenses, expenseFilterUser, expenseFilterCategory]);

  const filteredTotal = filteredExpenses.reduce((acc, e) => acc + e.value, 0);
  const hasExpenseFilter = expenseFilterUser !== 'all' || expenseFilterCategory !== 'all';

  // ──────────────────────────────────────────────
  // FINALIZAR / REABRIR VIAGEM (somente o criador)
  // ──────────────────────────────────────────────
  const handleFinishTrip = async () => {
    if (!activeTripData || activeTripData.creator !== user.uid || isTripFinished) return;
    if (!requireOnline('finalizar a viagem')) return;
    if (!window.confirm(`Finalizar a viagem "${activeTripData.name}"? Depois disso ninguém poderá lançar ou alterar despesas e atividades. Todos os membros receberão o resumo do rateio.`)) return;

    try {
      // Recarrega os perfis para garantir nomes atualizados no resumo congelado
      const profiles = await Promise.all(
        activeTripData.members.map(async (mId) => {
          const mDoc = await getDoc(doc(db, 'artifacts', appId, 'users', mId, 'profile', 'data'));
          return mDoc.exists() ? mDoc.data() : { uid: mId };
        })
      );
      const summary = computeTripSummary(activeTripData.members, profiles, tripExpenses);
      const finishedAt = new Date().toISOString();

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', activeTrip), {
        status: 'finished',
        finishedAt,
        finishedBy: user.uid,
        finalSummary: summary,
      });

      await notifyActiveTrip(
        'trip_finished',
        'Viagem finalizada',
        (uid) => {
          const me = summary.perMember.find((m) => m.uid === uid);
          const lines = [
            `Total da viagem: ${formatBRL(summary.total)}`,
            `Sua parte no rateio: ${formatBRL(summary.perPerson)}`,
          ];
          if (me) {
            lines.push(`Você pagou: ${formatBRL(me.paid)}`);
            if (me.balance > 0.01) lines.push(`Você deve receber: ${formatBRL(me.balance)}`);
            else if (me.balance < -0.01) lines.push(`Você deve pagar: ${formatBRL(Math.abs(me.balance))}`);
            else lines.push('Você está quitado.');
          }
          summary.transfers
            .filter((t) => t.fromUid === uid)
            .forEach((t) => lines.push(`→ Pagar ${formatBRL(t.amount)} para ${t.to}`));
          return lines.join('\n');
        },
        { includeSelf: true }
      );

      setActiveTab('financeiro');
      showNotification('Viagem finalizada! O resumo foi enviado a todos os membros.', 'success');
    } catch (err) {
      console.error('Erro ao finalizar viagem:', err);
      showNotification('Erro ao finalizar a viagem.', 'error');
    }
  };

  const handleReopenTrip = async () => {
    if (!activeTripData || activeTripData.creator !== user.uid || !isTripFinished) return;
    if (!requireOnline('reabrir a viagem')) return;
    if (!window.confirm('Reabrir esta viagem para novos lançamentos? O resumo final será descartado.')) return;

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', activeTrip), {
        status: 'open',
        finishedAt: deleteField(),
        finishedBy: deleteField(),
        finalSummary: deleteField(),
      });
      notifyActiveTrip('trip_reopened', 'Viagem reaberta', `${userData?.name || 'O criador'} reabriu a viagem para novos lançamentos.`);
      showNotification('Viagem reaberta.', 'info');
    } catch (err) {
      console.error('Erro ao reabrir viagem:', err);
      showNotification('Erro ao reabrir a viagem.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // DICAS / CRONOGRAMA
  // ──────────────────────────────────────────────
  const closeTipModal = () => {
    setIsTipModalOpen(false);
    setEditingTipId(null);
    setTipType('almoco');
    setTipPeriod('manha');
    setTipPlaceName('');
    setTipDesc('');
    setTipDate('');
  };

  const openNewTipModal = () => {
    if (isTripFinished) return;
    setIsTipModalOpen(true);
  };

  const handleEditTipClick = (tip) => {
    if (isTripFinished) return;
    setEditingTipId(tip.id);
    setTipType(tip.type);
    setTipPeriod(tip.period || 'manha');
    setTipPlaceName(tip.placeName);
    setTipDesc(tip.description);
    setTipDate(tip.date);
    setIsTipModalOpen(true);
  };

  const handleAddTip = async (e) => {
    e.preventDefault();
    if (isTripFinished) {
      showNotification('Viagem finalizada: o cronograma está fechado.', 'error');
      return;
    }
    if (!tipPlaceName.trim() || !tipDesc.trim() || !tipDate) {
      showNotification('Preencha todos os campos da sugestão.', 'error');
      return;
    }

    const isConflict = tripTips.some((tip) => {
      if (tip.id === editingTipId) return false;
      if (tip.status !== 'approved' || tip.date !== tipDate || tip.type !== tipType) return false;
      return ['passeio', 'cafe'].includes(tipType) ? tip.period === tipPeriod : true;
    });

    if (isConflict) {
      showNotification(`Já existe uma sugestão aprovada de ${tipType} para este dia/período.`, 'error');
      return;
    }

    try {
      if (editingTipId) {
        const tipRef = doc(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`, editingTipId);
        await runWrite(updateDoc(tipRef, {
          type: tipType,
          period: ['passeio', 'cafe'].includes(tipType) ? tipPeriod : null,
          placeName: tipPlaceName,
          description: tipDesc,
          date: tipDate,
        }), notifySyncError('a atividade editada'));
        showNotification('Sugestão atualizada!', 'success');
        notifyActiveTrip('tip_updated', 'Atividade editada', `${userData?.name || 'Um membro'} editou "${tipPlaceName}" (${getTipTypeName(tipType, tipPeriod)}).`);
      } else {
        const tipRef = doc(collection(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`));
        await runWrite(setDoc(tipRef, {
          id: tipRef.id,
          type: tipType,
          period: ['passeio', 'cafe'].includes(tipType) ? tipPeriod : null,
          placeName: tipPlaceName,
          description: tipDesc,
          date: tipDate,
          createdBy: user.uid,
          creatorName: userData?.name || 'Participante',
          status: 'pending',
          votesUp: [user.uid],
          votesDown: [],
          createdAt: new Date().toISOString(),
        }), notifySyncError('a atividade sugerida'));
        showNotification(isOnline() ? 'Dica enviada para votação!' : 'Sugestão salva offline. Será sincronizada ao reconectar.', isOnline() ? 'success' : 'info');
        notifyActiveTrip(
          'tip_created',
          'Nova atividade para votar',
          `${userData?.name || 'Um membro'} sugeriu "${tipPlaceName}" (${getTipTypeName(tipType, tipPeriod)}) em ${tipDate.split('-').reverse().join('/')}.`
        );
      }

      closeTipModal();
    } catch (err) {
      console.error('Erro ao sugerir atividade:', err);
      showNotification('Falha ao sugerir atividade.', 'error');
    }
  };

  const handleDeleteTip = async (tip) => {
    if (isTripFinished) return;
    if (!window.confirm('Excluir esta sugestão do cronograma?')) return;
    try {
      await runWrite(
        deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`, tip.id)),
        notifySyncError('a exclusão da atividade')
      );
      showNotification('Sugestão excluída.', 'info');
      notifyActiveTrip('tip_deleted', 'Atividade excluída', `${userData?.name || 'Um membro'} excluiu "${tip.placeName}" do cronograma.`);
    } catch (err) {
      console.error('Erro ao excluir sugestão:', err);
      showNotification('Erro ao excluir sugestão.', 'error');
    }
  };

  const handleVote = async (tipId, isApprove) => {
    if (isTripFinished) return;
    try {
      const tipRef = doc(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`, tipId);
      const tipObj = tripTips.find((t) => t.id === tipId);
      if (!tipObj) return;

      let votesUp = [...(tipObj.votesUp || [])];
      let votesDown = [...(tipObj.votesDown || [])];

      if (isApprove) {
        votesDown = votesDown.filter((id) => id !== user.uid);
        if (!votesUp.includes(user.uid)) votesUp.push(user.uid);
      } else {
        votesUp = votesUp.filter((id) => id !== user.uid);
        if (!votesDown.includes(user.uid)) votesDown.push(user.uid);
      }

      const total = activeTripData.members.length;
      const totalVotes = votesUp.length + votesDown.length;
      let status = 'pending';

      // Só decide depois que TODOS os membros votaram
      if (totalVotes >= total) {
        if (votesUp.length > votesDown.length) {
          const conflict = tripTips.some((t) => {
            if (t.id === tipId || t.status !== 'approved' || t.date !== tipObj.date || t.type !== tipObj.type) return false;
            return ['passeio', 'cafe'].includes(tipObj.type) ? t.period === tipObj.period : true;
          });
          status = conflict ? 'declined' : 'approved';
        } else {
          status = 'declined';
        }
      }

      await runWrite(updateDoc(tipRef, { votesUp, votesDown, status }), notifySyncError('o voto'));

      if (status === 'approved') {
        showNotification('Sugestão aprovada pelo grupo!', 'success');
      }

      if (status !== 'pending' && tipObj.status !== status) {
        notifyActiveTrip(
          status === 'approved' ? 'tip_approved' : 'tip_declined',
          status === 'approved' ? 'Atividade aprovada' : 'Atividade rejeitada',
          `"${tipObj.placeName}" foi ${status === 'approved' ? 'aprovada e entrou no cronograma' : 'rejeitada pelo grupo'} (${votesUp.length} sim × ${votesDown.length} não).`
        );
      }
    } catch (err) {
      console.error('Erro ao salvar voto:', err);
      showNotification('Erro ao salvar voto.', 'error');
    }
  };

  const approvedTimeline = useMemo(() => {
    const grouped = {};
    tripTips.filter((t) => t.status === 'approved').forEach((item) => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    const order = { cafe_manha: 1, passeio_manha: 2, almoco: 3, passeio_tarde: 4, cafe_tarde: 5, jantar: 6 };

    return Object.keys(grouped)
      .sort()
      .map((date) => ({
        date,
        items: grouped[date].sort((a, b) => {
          const ka = a.type + (a.period ? `_${a.period}` : '');
          const kb = b.type + (b.period ? `_${b.period}` : '');
          return (order[ka] || 99) - (order[kb] || 99);
        }),
      }));
  }, [tripTips]);

  const declinedTips = useMemo(() => {
    return tripTips
      .filter((t) => t.status === 'declined')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [tripTips]);

  const formatDateFriendly = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const getTipTypeName = (type, period) => {
    const names = {
      almoco: 'Almoço',
      jantar: 'Jantar',
      passeio: `Passeio (${period === 'manha' ? 'Manhã' : 'Tarde'})`,
      cafe: `Café (${period === 'manha' ? 'Manhã' : 'Tarde'})`,
    };
    return names[type] || type;
  };

  const getTipBadgeStyle = (type) => {
    const styles = {
      almoco: 'bg-amber-100 text-amber-800',
      jantar: 'bg-indigo-100 text-indigo-800',
      passeio: 'bg-sky-100 text-sky-800',
      cafe: 'bg-emerald-100 text-emerald-800',
    };
    return styles[type] || 'bg-gray-100 text-gray-800';
  };

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-100">

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/logo-mark.png" alt="GoTravel" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">GoTravel</h1>
              <p className="text-xs text-slate-500 font-medium">Viagens Compartilhadas</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-900">{userData?.name || 'Viajante'}</span>
                <span className="text-xs text-slate-500">{userData?.email}</span>
              </div>
              <NotificationBell
                notifications={notifications}
                onOpen={handleOpenNotification}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onClearRead={handleClearReadNotifications}
                devicePermission={devicePermission}
                onEnableDevice={handleEnableDeviceNotifications}
              />
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* NOTIFICAÇÃO */}
      {notification && (
        <div className="fixed top-20 right-4 z-50">
          <div className={`p-4 rounded-xl shadow-lg border flex items-center gap-3 min-w-[300px] ${
            notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" /> :
             notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" /> :
             <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* STATUS DE CONEXÃO / SINCRONIZAÇÃO */}
      {user && !online && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 text-xs font-medium">
            <WifiOff className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>
              Você está offline. Lançamentos e atividades ficam salvos no aparelho e serão sincronizados ao reconectar
              {pendingSyncCount > 0 && <> — <strong>{pendingSyncCount} pendente(s)</strong> nesta viagem</>}.
            </span>
          </div>
        </div>
      )}
      {user && online && syncState !== 'idle' && (
        <div className={`border-b ${syncState === 'syncing' ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 text-xs font-medium">
            {syncState === 'syncing' ? (
              <><RefreshCw className="w-4 h-4 flex-shrink-0 text-blue-600 animate-spin" /> Conexão restabelecida. Sincronizando alterações feitas offline...</>
            ) : (
              <><CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" /> Tudo sincronizado.</>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col gap-6">

        {/* TELA DE LOGIN / CADASTRO */}
        {!user && !authLoading && (
          <div className="max-w-md w-full mx-auto my-auto py-10">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <img src="/icons/logo-mark.png" alt="GoTravel" className="w-full h-full object-contain" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {authMode === 'forgot' ? 'Recuperar senha' : 'Planeje viagens juntos'}
                </h2>
                <p className="text-slate-500 mt-2 text-sm">
                  {authMode === 'forgot'
                    ? 'Informe seu e-mail e enviaremos um link para redefinir sua senha.'
                    : 'Organize cronogramas, divida contas e compartilhe momentos.'}
                </p>
              </div>

              {authError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form
                onSubmit={authMode === 'login' ? handleLogin : authMode === 'forgot' ? handleForgotPassword : handleRegister}
                className="space-y-4"
              >
                {authMode === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Nome Completo</label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input
                          type="text" value={name} onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: João Silva"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Telefone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input
                          type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="joao@provedor.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                {authMode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Senha</label>
                      {authMode === 'login' && (
                        <button
                          type="button"
                          onClick={() => { setAuthMode('forgot'); setAuthError(null); }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Esqueceu a senha?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                        required
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-100 transition-all duration-200 mt-2 text-sm"
                >
                  {authMode === 'login' ? 'Entrar na Plataforma' : authMode === 'forgot' ? 'Enviar link de recuperação' : 'Criar Minha Conta'}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold">ou</span>
                </div>
              </div>

              <div className="text-center">
                {authMode === 'forgot' ? (
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(null); }}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Voltar para o Login
                  </button>
                ) : (
                  <button
                    onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(null); }}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOADING */}
        {authLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 text-sm font-medium">Conectando ao GoTravel...</p>
          </div>
        )}

        {/* APP PRINCIPAL */}
        {user && !authLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* SIDEBAR */}
            <aside className="lg:col-span-1 flex flex-col gap-6">

              {!userData?.verified && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex flex-col gap-3">
                  <div className="flex gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Conta pendente de ativação</span>
                  </div>
                  <p>Enviamos um link de confirmação para o seu e-mail.</p>
                  <button
                    onClick={handleCheckVerification}
                    className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Já confirmei, verificar
                  </button>
                  <button
                    onClick={handleResendVerification}
                    className="w-full py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg transition-colors"
                  >
                    Reenviar e-mail
                  </button>
                </div>
              )}

              {pendingInvites.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Convites ({pendingInvites.length})
                  </h3>
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm flex flex-col gap-2">
                      <p className="text-xs text-slate-600">
                        <strong>{invite.fromName}</strong> te convidou para:
                      </p>
                      <h4 className="text-sm font-bold text-slate-900">{invite.tripName}</h4>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleRespondInvite(invite, true)}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Aceitar
                        </button>
                        <button
                          onClick={() => handleRespondInvite(invite, false)}
                          className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Minhas Viagens</h3>
                  <button
                    onClick={() => setIsNewTripModalOpen(true)}
                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {myTrips.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                    <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 px-3">Nenhuma viagem cadastrada.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myTrips.map((trip) => (
                      <button
                        key={trip.id}
                        onClick={() => { setActiveTrip(trip.id); setActiveTripData(trip); setActiveTab('feed'); }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                          activeTrip === trip.id
                            ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="text-sm truncate">{trip.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal truncate">por {trip.creatorName}</p>
                        </div>
                        <Users className={`w-4 h-4 flex-shrink-0 ${activeTrip === trip.id ? 'text-blue-600' : 'text-slate-400'}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {/* CONTEÚDO PRINCIPAL */}
            <section className="lg:col-span-3 flex flex-col gap-6">

              {!activeTrip ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <div className="bg-slate-50 text-slate-400 p-4 rounded-full mb-4">
                    <Compass className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Selecione ou crie uma viagem</h3>
                  <p className="text-slate-500 text-sm max-w-sm mt-2">
                    Abra uma viagem ou inicie um novo planejamento para compartilhar com seus amigos.
                  </p>
                  <button
                    onClick={() => setIsNewTripModalOpen(true)}
                    className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-100 transition-all"
                  >
                    Criar Nova Viagem
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-6">

                  {/* HERO */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {isTripFinished ? (
                          <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Viagem Finalizada
                          </span>
                        ) : (
                          <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full uppercase tracking-wider">Viagem em Andamento</span>
                        )}
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 mt-2">{activeTripData?.name}</h2>
                      <p className="text-sm text-slate-500 mt-1">{activeTripData?.description || 'Planejamento compartilhado.'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      {!isTripFinished && (
                        <button
                          onClick={() => setIsInviteModalOpen(true)}
                          className="flex-1 md:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
                        >
                          <UserPlus className="w-4 h-4" /> Convidar Amigos
                        </button>
                      )}
                      {activeTripData?.creator === user.uid && !isTripFinished && (
                        <button
                          onClick={handleFinishTrip}
                          className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
                        >
                          <Flag className="w-4 h-4" /> Finalizar Viagem
                        </button>
                      )}
                      {activeTripData?.creator === user.uid && isTripFinished && (
                        <button
                          onClick={handleReopenTrip}
                          className="flex-1 md:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                          <RotateCcw className="w-4 h-4" /> Reabrir
                        </button>
                      )}
                      {activeTripData?.creator === user.uid && (
                        <button
                          onClick={handleDeleteTrip}
                          title="Apagar viagem"
                          className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border border-rose-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ABAS */}
                  <div className="bg-slate-200/60 p-1.5 rounded-2xl flex gap-1">
                    {[
                      { key: 'feed', label: 'Mural & Membros', icon: <Users className="w-4 h-4" /> },
                      { key: 'cronograma', label: 'Cronograma', icon: <Calendar className="w-4 h-4" /> },
                      { key: 'financeiro', label: 'Rateio', icon: <DollarSign className="w-4 h-4" /> },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-2.5 text-center text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                          activeTab === tab.key
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ABA: MURAL */}
                  {activeTab === 'feed' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:col-span-1 flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" /> Membros ({tripMembers.length})
                        </h3>
                        <p className="text-xs text-slate-500">Despesas são divididas igualmente entre todos abaixo.</p>
                        <div className="space-y-3 mt-2">
                          {tripMembers.map((member) => (
                            <div key={member.uid} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="w-9 h-9 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center font-bold text-sm">
                                {member.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div className="truncate flex-1">
                                <p className="text-xs font-semibold text-slate-900 truncate">
                                  {member.name} {member.uid === user.uid ? '(Você)' : ''}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{member.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:col-span-2 flex flex-col gap-6">
                        <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Visão Geral</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total Lançado</span>
                            <span className="text-xl font-black text-emerald-950 mt-1 block">R$ {financialSummary.total.toFixed(2)}</span>
                            <span className="text-[10px] text-emerald-700 mt-1 block">R$ {financialSummary.perPerson.toFixed(2)} por pessoa</span>
                          </div>
                          <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl">
                            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Cronograma</span>
                            <span className="text-xl font-black text-purple-950 mt-1 block">
                              {tripTips.filter((t) => t.status === 'approved').length} itens
                            </span>
                            <span className="text-[10px] text-purple-700 mt-1 block">
                              {tripTips.filter((t) => t.status === 'pending').length} pendentes
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ABA: CRONOGRAMA */}
                  {activeTab === 'cronograma' && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Cronograma Consolidado</h3>
                          <p className="text-xs text-slate-500 mt-1">Votado pelos integrantes. Almoços, jantares, cafés e passeios.</p>
                        </div>
                        {isTripFinished ? (
                          <span className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl flex items-center gap-1.5 w-full md:w-auto justify-center">
                            <Lock className="w-4 h-4" /> Cronograma fechado
                          </span>
                        ) : (
                          <button
                            onClick={openNewTipModal}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5 transition-all w-full md:w-auto justify-center"
                          >
                            <Plus className="w-4 h-4" /> Sugerir Atividade
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-8">
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confirmadas</h4>
                            {approvedTimeline.length === 0 ? (
                              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm font-semibold text-slate-900">Cronograma livre</p>
                                <p className="text-xs text-slate-500 mt-1">Nenhuma atração aprovada ainda.</p>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {approvedTimeline.map((dayGroup) => (
                                  <div key={dayGroup.date} className="relative pl-6 border-l-2 border-blue-100">
                                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm" />
                                    <h5 className="text-sm font-black text-blue-900 capitalize mb-4">{formatDateFriendly(dayGroup.date)}</h5>
                                    <div className="space-y-3">
                                      {dayGroup.items.map((item) => {
                                        const isCreator = item.createdBy === user.uid;
                                        return (
                                          <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getTipBadgeStyle(item.type)}`}>
                                                {getTipTypeName(item.type, item.period)}
                                              </span>
                                              <span className="text-[10px] font-bold text-emerald-600">Aprovado</span>
                                            </div>
                                            <h6 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                                              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" /> {item.placeName}
                                            </h6>
                                            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">{item.description}</p>
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] text-slate-500">
                                                <ThumbsUp className="w-3 h-3 inline mr-0.5 text-emerald-500" />{item.votesUp?.length || 0}{' '}
                                                <ThumbsDown className="w-3 h-3 inline ml-1.5 mr-0.5 text-rose-500" />{item.votesDown?.length || 0}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                {isCreator && !isTripFinished && (
                                                  <>
                                                    <button onClick={() => handleEditTipClick(item)} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                                                      <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDeleteTip(item)} className="p-1 text-slate-400 hover:text-rose-600 rounded">
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                  </>
                                                )}
                                                <span className="text-[9px] text-slate-400">por {item.creatorName}</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rejeitadas</h4>
                            {declinedTips.length === 0 ? (
                              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-xs text-slate-400">
                                Nenhuma sugestão rejeitada.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {declinedTips.map((tip) => {
                                  const isCreator = tip.createdBy === user.uid;
                                  return (
                                    <div key={tip.id} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col gap-2 opacity-80">
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getTipBadgeStyle(tip.type)}`}>
                                          {getTipTypeName(tip.type, tip.period)}
                                        </span>
                                        <span className="text-[10px] font-bold text-rose-500">Rejeitado</span>
                                      </div>
                                      <h6 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" /> {tip.placeName}
                                      </h6>
                                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">{tip.description}</p>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-slate-500">
                                          <ThumbsUp className="w-3 h-3 inline mr-0.5 text-emerald-500" />{tip.votesUp?.length || 0}{' '}
                                          <ThumbsDown className="w-3 h-3 inline ml-1.5 mr-0.5 text-rose-500" />{tip.votesDown?.length || 0}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {isCreator && !isTripFinished && (
                                            <>
                                              <button onClick={() => handleEditTipClick(tip)} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                                                <Pencil className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => handleDeleteTip(tip)} className="p-1 text-slate-400 hover:text-rose-600 rounded">
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          )}
                                          <span className="text-[9px] text-slate-400">por {tip.creatorName}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="lg:col-span-1 space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Em Votação</h4>
                          {tripTips.filter((t) => t.status === 'pending').length === 0 ? (
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center text-xs text-slate-400">
                              Nenhuma proposta aguardando votação.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {tripTips.filter((t) => t.status === 'pending').map((tip) => {
                                const hasVotedUp = tip.votesUp?.includes(user.uid);
                                const hasVotedDown = tip.votesDown?.includes(user.uid);
                                const total = activeTripData.members.length;
                                const votesCount = (tip.votesUp?.length || 0) + (tip.votesDown?.length || 0);
                                const isCreator = tip.createdBy === user.uid;

                                return (
                                  <div key={tip.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${getTipBadgeStyle(tip.type)}`}>
                                        {getTipTypeName(tip.type, tip.period)}
                                      </span>
                                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                        {tip._pending && <Clock className="w-3 h-3 text-amber-600" aria-label="Aguardando sincronização" />}
                                        {tip.date.split('-').reverse().slice(0, 2).join('/')}
                                      </span>
                                    </div>
                                    <div>
                                      <h6 className="text-xs font-bold text-slate-900">{tip.placeName}</h6>
                                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{tip.description}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[10px] text-slate-500">
                                        <span>Sim: {tip.votesUp?.length || 0} • Não: {tip.votesDown?.length || 0}</span>
                                        <span>{votesCount} / {total} votaram</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${((tip.votesUp?.length || 0) / total) * 100}%` }} />
                                        <div className="bg-rose-400 h-full transition-all" style={{ width: `${((tip.votesDown?.length || 0) / total) * 100}%` }} />
                                      </div>
                                      <p className="text-[9px] text-slate-400">
                                        Aguardando {Math.max(total - votesCount, 0)} voto(s) para decidir
                                      </p>
                                    </div>
                                    {!isTripFinished && <div className="flex gap-2">
                                      <button
                                        onClick={() => handleVote(tip.id, true)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${hasVotedUp ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'}`}
                                      >
                                        <ThumbsUp className="w-3.5 h-3.5" /> Aprovar
                                      </button>
                                      <button
                                        onClick={() => handleVote(tip.id, false)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${hasVotedDown ? 'bg-rose-100 text-rose-800' : 'bg-rose-50 hover:bg-rose-100 text-rose-700'}`}
                                      >
                                        <ThumbsDown className="w-3.5 h-3.5" /> Rejeitar
                                      </button>
                                    </div>}
                                    <div className="flex items-center justify-between">
                                      {isCreator && !isTripFinished ? (
                                        <div className="flex items-center gap-2">
                                          <button onClick={() => handleEditTipClick(tip)} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => handleDeleteTip(tip)} className="p-1 text-slate-400 hover:text-rose-600 rounded">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : <span />}
                                      <span className="text-[9px] text-slate-400 text-right">por {tip.creatorName}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ABA: FINANCEIRO */}
                  {activeTab === 'financeiro' && isTripFinished && (
                    <TripSummary
                      summary={activeTripData.finalSummary}
                      finishedAt={activeTripData.finishedAt}
                      currentUid={user.uid}
                    />
                  )}

                  {activeTab === 'financeiro' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4">
                          <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Acerto de Contas</h3>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total do Grupo</span>
                            <span className="text-2xl font-black text-slate-900 mt-1 block">R$ {financialSummary.total.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 mt-2 block">Por pessoa: <strong>R$ {financialSummary.perPerson.toFixed(2)}</strong></span>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Transferências:</h4>
                            {financialSummary.transfers.length === 0 ? (
                              <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-xl">
                                Nenhuma transação necessária.
                              </p>
                            ) : (
                              financialSummary.transfers.map((t, i) => (
                                <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs flex flex-col gap-1">
                                  <div className="flex items-center justify-between font-medium">
                                    <span className="text-slate-600 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-rose-500" /> {t.from}</span>
                                    <span className="text-slate-400">→</span>
                                  </div>
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="text-slate-800 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> {t.to}</span>
                                    <span className="text-blue-600">R$ {t.amount.toFixed(2)}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-2 flex flex-col gap-6">
                        <div className="bg-white rounded-3xl border border-slate-200 p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Lançamentos</h3>
                              <p className="text-xs text-slate-500 mt-1">Contribuições individuais da viagem.</p>
                            </div>
                            {isTripFinished ? (
                              <span className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl flex items-center gap-1.5 justify-center">
                                <Lock className="w-4 h-4" /> Lançamentos encerrados
                              </span>
                            ) : (
                              <button
                                onClick={openNewExpenseModal}
                                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5 justify-center transition-all"
                              >
                                <Plus className="w-4 h-4" /> Registrar
                              </button>
                            )}
                          </div>

                          {tripExpenses.length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider sm:pb-2.5">
                                <Filter className="w-3.5 h-3.5" /> Filtros
                              </div>
                              <label className="flex-1 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Lançado por</span>
                                <select
                                  value={expenseFilterUser}
                                  onChange={(e) => setExpenseFilterUser(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                >
                                  <option value="all">Todos os membros</option>
                                  {financialSummary.perMember.map((m) => (
                                    <option key={m.uid} value={m.uid}>{m.uid === user.uid ? `${m.name} (Você)` : m.name}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex-1 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Categoria</span>
                                <select
                                  value={expenseFilterCategory}
                                  onChange={(e) => setExpenseFilterCategory(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                >
                                  <option value="all">Todas as categorias</option>
                                  {EXPENSE_CATEGORIES.map((c) => (
                                    <option key={c.key} value={c.key}>{c.label}</option>
                                  ))}
                                </select>
                              </label>
                              {hasExpenseFilter && (
                                <button
                                  onClick={() => { setExpenseFilterUser('all'); setExpenseFilterCategory('all'); }}
                                  className="px-3 py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl"
                                >
                                  Limpar
                                </button>
                              )}
                            </div>
                          )}

                          {hasExpenseFilter && (
                            <p className="text-xs text-slate-600 mb-3">
                              <strong>{filteredExpenses.length}</strong> lançamento(s) filtrado(s) somando <strong>{formatBRL(filteredTotal)}</strong>
                              {financialSummary.total > 0 && ` (${((filteredTotal / financialSummary.total) * 100).toFixed(0)}% do total)`}
                            </p>
                          )}

                          {tripExpenses.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                              <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-slate-800">Sem lançamentos</p>
                            </div>
                          ) : filteredExpenses.length === 0 ? (
                            <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
                              <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-slate-800">Nenhum lançamento com esses filtros</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                              {filteredExpenses.map((exp) => {
                                const isSelf = exp.uid === user.uid;
                                const category = getCategory(exp.category);
                                return (
                                  <div
                                    key={exp.id}
                                    className={`p-4 rounded-2xl border flex items-center justify-between ${isSelf ? 'bg-blue-50/40 border-blue-100' : 'bg-white border-slate-100'}`}
                                  >
                                    <div className="truncate pr-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${category.badge}`}>
                                          {category.label}
                                        </span>
                                        <p className="text-xs font-bold text-slate-900 truncate">{exp.description}</p>
                                      </div>
                                      <p className="text-[10px] text-slate-500 mt-1">
                                        Por: <strong>{isSelf ? 'Você' : exp.userName}</strong> •{' '}
                                        {new Date(exp.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        {exp._pending && (
                                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-700 font-semibold">
                                            <Clock className="w-3 h-3" /> aguardando sincronização
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                                      <div>
                                        <span className="text-sm font-black text-slate-950 block">R$ {exp.value.toFixed(2)}</span>
                                        <span className="text-[9px] text-slate-400 block mt-0.5">
                                          R$ {(exp.value / activeTripData.members.length).toFixed(2)} / pessoa
                                        </span>
                                      </div>
                                      {isSelf && !isTripFinished && (
                                        <div className="flex flex-col gap-1">
                                          <button onClick={() => handleEditExpenseClick(exp)} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => handleDeleteExpense(exp)} className="p-1 text-slate-400 hover:text-rose-600 rounded">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs">
          <p>© 2026 GoTravel — Viagens Compartilhadas</p>
          <div className="flex gap-4 items-center">
            <a href="/privacidade.html" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
              Privacidade
            </a>
            <span>Firebase Firestore</span>
            <span>PWA</span>
          </div>
        </div>
      </footer>

      {/* MODAL: NOVA VIAGEM */}
      {isNewTripModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">Novo Planejamento</h3>
              <button onClick={() => setIsNewTripModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nome</label>
                <input
                  type="text" value={newTripName} onChange={(e) => setNewTripName(e.target.value)}
                  placeholder="Ex: Viagem de Férias 2026"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Descrição (opcional)</label>
                <textarea
                  value={newTripDesc} onChange={(e) => setNewTripDesc(e.target.value)}
                  placeholder="Detalhes sobre a viagem..."
                  rows="3"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsNewTripModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-100">Criar Sala</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONVIDAR */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">Convidar via E-mail</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">O e-mail deve pertencer a um usuário cadastrado no GoTravel.</p>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="amigo@provedor.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-100">Enviar Convite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DESPESA */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">{editingExpenseId ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
              <button onClick={closeExpenseModal} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">O valor será rateado entre todos os membros da viagem.</p>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-xs font-bold pointer-events-none">R$</span>
                  <input
                    type="number" step="0.01" min="0.01" value={expenseValue} onChange={(e) => setExpenseValue(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Categoria</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <button
                      key={c.key} type="button" onClick={() => setExpenseCategory(c.key)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${expenseCategory === c.key ? 'bg-blue-50 border-blue-400 text-blue-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Descrição</label>
                <input
                  type="text" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Jantar restaurante, Hospedagem..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeExpenseModal} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-100">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUGERIR DICA */}
      {isTipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">{editingTipId ? 'Editar Atividade' : 'Sugerir Atividade'}</h3>
              <button onClick={closeTipModal} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTip} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tipo</label>
                  <select
                    value={tipType} onChange={(e) => setTipType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    <option value="almoco">Almoço</option>
                    <option value="jantar">Jantar</option>
                    <option value="passeio">Passeio</option>
                    <option value="cafe">Café</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Data</label>
                  <input
                    type="date" value={tipDate} onChange={(e) => setTipDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    required
                  />
                </div>
              </div>

              {['passeio', 'cafe'].includes(tipType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Período</label>
                  <div className="flex gap-2">
                    {['manha', 'tarde'].map((p) => (
                      <button
                        key={p} type="button" onClick={() => setTipPeriod(p)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${tipPeriod === p ? 'bg-blue-50 border-blue-400 text-blue-900' : 'bg-white border-slate-200 text-slate-600'}`}
                      >
                        {p === 'manha' ? 'Manhã' : 'Tarde'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Local / Nome</label>
                <input
                  type="text" value={tipPlaceName} onChange={(e) => setTipPlaceName(e.target.value)}
                  placeholder="Ex: Passeio de Barco, Pizzaria Central"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Descrição</label>
                <textarea
                  value={tipDesc} onChange={(e) => setTipDesc(e.target.value)}
                  placeholder="Horário, custo estimado, por que visitar..."
                  rows="3"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeTipModal} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-100">{editingTipId ? 'Salvar Alterações' : 'Enviar para Votação'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
