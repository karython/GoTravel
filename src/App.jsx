import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  arrayUnion,
  addDoc,
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
} from 'lucide-react';

import { auth, db, appId } from './firebase/config.js';

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

  const [newTripName, setNewTripName] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const [expenseValue, setExpenseValue] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');

  const [tipType, setTipType] = useState('almoco');
  const [tipPeriod, setTipPeriod] = useState('manha');
  const [tipPlaceName, setTipPlaceName] = useState('');
  const [tipDesc, setTipDesc] = useState('');
  const [tipDate, setTipDate] = useState('');

  const [tripExpenses, setTripExpenses] = useState([]);
  const [tripTips, setTripTips] = useState([]);
  const [tripMembers, setTripMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);

  // ──────────────────────────────────────────────
  // AUTENTICAÇÃO
  // ──────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'data');
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          setUserData({
            uid: currentUser.uid,
            name: currentUser.displayName || 'Viajante',
            email: currentUser.email || '',
            phone: '',
            verified: currentUser.emailVerified || false,
          });
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
      await setDoc(doc(db, 'artifacts', appId, 'public', 'emails', email.toLowerCase().trim()), {
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

  const translateAuthError = (code) => {
    const messages = {
      'auth/invalid-email': 'E-mail em formato incorreto.',
      'auth/user-disabled': 'Este usuário foi desativado.',
      'auth/user-not-found': 'Usuário não localizado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha inválidos.',
      'auth/email-already-in-use': 'Este e-mail já está em uso.',
      'auth/weak-password': 'A senha deve ter ao menos 6 caracteres.',
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
    } catch {
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
  // DADOS DA VIAGEM ATIVA EM TEMPO REAL
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeTrip) return;

    const expensesCol = collection(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`);
    const unsubExpenses = onSnapshot(expensesCol, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTripExpenses(list);
    });

    const tipsCol = collection(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`);
    const unsubTips = onSnapshot(tipsCol, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setTripTips(list);
    });

    const loadMembers = async () => {
      if (!activeTripData) return;
      const list = [];
      for (const mId of activeTripData.members) {
        const mDoc = await getDoc(doc(db, 'artifacts', appId, 'users', mId, 'profile', 'data'));
        list.push(mDoc.exists() ? mDoc.data() : { uid: mId, name: 'Viajante Convidado', email: '' });
      }
      setTripMembers(list);
    };

    loadMembers();

    return () => {
      unsubExpenses();
      unsubTips();
    };
  }, [user, activeTrip, activeTripData]);

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

      await setDoc(tripRef, payload);
      setActiveTrip(tripRef.id);
      setActiveTripData(payload);
      setIsNewTripModalOpen(false);
      setNewTripName('');
      setNewTripDesc('');
      showNotification(`Viagem "${payload.name}" criada com sucesso!`, 'success');
    } catch {
      showNotification('Erro ao criar viagem.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // ENVIAR CONVITE
  // ──────────────────────────────────────────────
  const handleSendInvite = async (e) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.toLowerCase().trim();
    if (!cleanEmail) return;

    if (cleanEmail === user.email?.toLowerCase().trim()) {
      showNotification('Você já faz parte desta viagem.', 'error');
      return;
    }

    try {
      const emailDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'emails', cleanEmail));
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
    } catch {
      showNotification('Erro ao enviar convite.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // RESPONDER CONVITE
  // ──────────────────────────────────────────────
  const handleRespondInvite = async (invite, accept) => {
    try {
      const inviteRef = doc(db, 'artifacts', appId, 'public', 'data', 'invites', invite.id);

      if (accept) {
        await updateDoc(inviteRef, { status: 'accepted' });
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trips', invite.tripId), {
          members: arrayUnion(user.uid),
        });
        setActiveTrip(invite.tripId);
        showNotification(`Você entrou na viagem: "${invite.tripName}"!`, 'success');
      } else {
        await updateDoc(inviteRef, { status: 'declined' });
        showNotification('Convite recusado.', 'info');
      }
    } catch {
      showNotification('Erro ao responder convite.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // DESPESAS
  // ──────────────────────────────────────────────
  const handleAddExpense = async (e) => {
    e.preventDefault();
    const value = parseFloat(expenseValue);
    if (isNaN(value) || value <= 0 || !expenseDesc.trim()) {
      showNotification('Insira descrição e valor válido.', 'error');
      return;
    }

    try {
      const expRef = doc(collection(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`));
      await setDoc(expRef, {
        id: expRef.id,
        value,
        description: expenseDesc,
        uid: user.uid,
        userName: userData?.name || 'Participante',
        createdAt: new Date().toISOString(),
      });

      setIsExpenseModalOpen(false);
      setExpenseValue('');
      setExpenseDesc('');
      showNotification('Despesa registrada e rateada entre o grupo!', 'success');
    } catch {
      showNotification('Erro ao registrar despesa.', 'error');
    }
  };

  // ──────────────────────────────────────────────
  // RATEIO FINANCEIRO
  // ──────────────────────────────────────────────
  const financialSummary = useMemo(() => {
    if (!activeTripData || tripExpenses.length === 0 || tripMembers.length === 0) {
      return { total: 0, perPerson: 0, transfers: [] };
    }

    const total = tripExpenses.reduce((acc, e) => acc + e.value, 0);
    const memberCount = activeTripData.members.length;
    const perPerson = total / memberCount;

    const paidMap = {};
    activeTripData.members.forEach((id) => { paidMap[id] = 0; });
    tripExpenses.forEach((exp) => { paidMap[exp.uid] = (paidMap[exp.uid] ?? 0) + exp.value; });

    const debtors = [];
    const creditors = [];

    activeTripData.members.forEach((id) => {
      const balance = (paidMap[id] ?? 0) - perPerson;
      const member = tripMembers.find((m) => m.uid === id) || { uid: id, name: 'Membro' };
      if (balance < -0.01) debtors.push({ ...member, amount: Math.abs(balance) });
      else if (balance > 0.01) creditors.push({ ...member, amount: balance });
    });

    const transfers = [];
    let di = 0;
    let ci = 0;

    while (di < debtors.length && ci < creditors.length) {
      const min = Math.min(debtors[di].amount, creditors[ci].amount);
      transfers.push({ from: debtors[di].name, to: creditors[ci].name, amount: min });
      debtors[di].amount -= min;
      creditors[ci].amount -= min;
      if (debtors[di].amount < 0.01) di++;
      if (creditors[ci].amount < 0.01) ci++;
    }

    return { total, perPerson, transfers };
  }, [activeTripData, tripExpenses, tripMembers]);

  // ──────────────────────────────────────────────
  // DICAS / CRONOGRAMA
  // ──────────────────────────────────────────────
  const handleAddTip = async (e) => {
    e.preventDefault();
    if (!tipPlaceName.trim() || !tipDesc.trim() || !tipDate) {
      showNotification('Preencha todos os campos da sugestão.', 'error');
      return;
    }

    const isConflict = tripTips.some((tip) => {
      if (tip.status !== 'approved' || tip.date !== tipDate || tip.type !== tipType) return false;
      return ['passeio', 'cafe'].includes(tipType) ? tip.period === tipPeriod : true;
    });

    if (isConflict) {
      showNotification(`Já existe uma sugestão aprovada de ${tipType} para este dia/período.`, 'error');
      return;
    }

    try {
      const tipRef = doc(collection(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`));
      await setDoc(tipRef, {
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
      });

      setIsTipModalOpen(false);
      setTipPlaceName('');
      setTipDesc('');
      setTipDate('');
      showNotification('Dica enviada para votação!', 'success');
    } catch {
      showNotification('Falha ao sugerir atividade.', 'error');
    }
  };

  const handleVote = async (tipId, isApprove) => {
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
      const half = Math.ceil(total / 2);
      let status = 'pending';

      if (votesUp.length > votesDown.length && votesUp.length + votesDown.length >= half) {
        const conflict = tripTips.some((t) => {
          if (t.id === tipId || t.status !== 'approved' || t.date !== tipObj.date || t.type !== tipObj.type) return false;
          return ['passeio', 'cafe'].includes(tipObj.type) ? t.period === tipObj.period : true;
        });
        status = conflict ? 'declined' : 'approved';
      } else if (votesDown.length >= votesUp.length && votesUp.length + votesDown.length >= half) {
        status = 'declined';
      }

      await updateDoc(tipRef, { votesUp, votesDown, status });

      if (status === 'approved') {
        showNotification('Sugestão aprovada pelo grupo!', 'success');
      }
    } catch {
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
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shadow-blue-200">
              <Compass className="w-6 h-6" />
            </div>
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

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col gap-6">

        {/* TELA DE LOGIN / CADASTRO */}
        {!user && !authLoading && (
          <div className="max-w-md w-full mx-auto my-auto py-10">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
              <div className="text-center mb-8">
                <div className="bg-blue-50 text-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Compass className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Planeje viagens juntos</h2>
                <p className="text-slate-500 mt-2 text-sm">Organize cronogramas, divida contas e compartilhe momentos.</p>
              </div>

              {authError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
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

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Senha</label>
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

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-100 transition-all duration-200 mt-2 text-sm"
                >
                  {authMode === 'login' ? 'Entrar na Plataforma' : 'Criar Minha Conta'}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold">ou</span>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(null); }}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
                </button>
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
                        <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full uppercase tracking-wider">Viagem Oficial</span>
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 mt-2">{activeTripData?.name}</h2>
                      <p className="text-sm text-slate-500 mt-1">{activeTripData?.description || 'Planejamento compartilhado.'}</p>
                    </div>
                    <button
                      onClick={() => setIsInviteModalOpen(true)}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md transition-all w-full md:w-auto"
                    >
                      <UserPlus className="w-4 h-4" /> Convidar Amigos
                    </button>
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
                        <button
                          onClick={() => setIsTipModalOpen(true)}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5 transition-all w-full md:w-auto justify-center"
                        >
                          <Plus className="w-4 h-4" /> Sugerir Atividade
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
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
                                    {dayGroup.items.map((item) => (
                                      <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getTipBadgeStyle(item.type)}`}>
                                            {getTipTypeName(item.type, item.period)}
                                          </span>
                                          <span className="text-[10px] text-slate-400">Aprovado</span>
                                        </div>
                                        <h6 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" /> {item.placeName}
                                        </h6>
                                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">{item.description}</p>
                                        <p className="text-[9px] text-slate-400 text-right">por {item.creatorName}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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
                                const required = Math.ceil(total / 2);

                                return (
                                  <div key={tip.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${getTipBadgeStyle(tip.type)}`}>
                                        {getTipTypeName(tip.type, tip.period)}
                                      </span>
                                      <span className="text-[10px] text-slate-400">{tip.date.split('-').reverse().slice(0, 2).join('/')}</span>
                                    </div>
                                    <div>
                                      <h6 className="text-xs font-bold text-slate-900">{tip.placeName}</h6>
                                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{tip.description}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[10px] text-slate-500">
                                        <span>Sim: {tip.votesUp?.length || 0} / {required}</span>
                                        <span>Não: {tip.votesDown?.length || 0}</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${((tip.votesUp?.length || 0) / total) * 100}%` }} />
                                        <div className="bg-rose-400 h-full transition-all" style={{ width: `${((tip.votesDown?.length || 0) / total) * 100}%` }} />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
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
                                    </div>
                                    <span className="text-[9px] text-slate-400 text-right">por {tip.creatorName}</span>
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
                            <button
                              onClick={() => setIsExpenseModalOpen(true)}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5 justify-center transition-all"
                            >
                              <Plus className="w-4 h-4" /> Registrar
                            </button>
                          </div>

                          {tripExpenses.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                              <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-slate-800">Sem lançamentos</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                              {tripExpenses.map((exp) => {
                                const isSelf = exp.uid === user.uid;
                                return (
                                  <div
                                    key={exp.id}
                                    className={`p-4 rounded-2xl border flex items-center justify-between ${isSelf ? 'bg-blue-50/40 border-blue-100' : 'bg-white border-slate-100'}`}
                                  >
                                    <div className="truncate pr-3">
                                      <p className="text-xs font-bold text-slate-900 truncate">{exp.description}</p>
                                      <p className="text-[10px] text-slate-500 mt-1">
                                        Por: <strong>{isSelf ? 'Você' : exp.userName}</strong> •{' '}
                                        {new Date(exp.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <span className="text-sm font-black text-slate-950 block">R$ {exp.value.toFixed(2)}</span>
                                      <span className="text-[9px] text-slate-400 block mt-0.5">
                                        R$ {(exp.value / activeTripData.members.length).toFixed(2)} / pessoa
                                      </span>
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
          <div className="flex gap-4">
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
              <h3 className="text-base font-bold text-slate-950">Novo Lançamento</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Descrição</label>
                <input
                  type="text" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Jantar restaurante, Hospedagem..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
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
              <h3 className="text-base font-bold text-slate-950">Sugerir Atividade</h3>
              <button onClick={() => setIsTipModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
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
                <button type="button" onClick={() => setIsTipModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-100">Enviar para Votação</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
