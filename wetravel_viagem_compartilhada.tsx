import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  addDoc
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
  Send, 
  Info, 
  TrendingUp, 
  TrendingDown, 
  UserPlus, 
  Lock, 
  Mail, 
  Phone, 
  User, 
  Clock,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// ==========================================
// CONFIGURAÇÃO DO FIREBASE (SISTEMA INTEGRADO)
// ==========================================
// As variáveis globais __firebase_config e __app_id são injetadas pelo ambiente de execução.
// Se você for rodar fora do ambiente, basta substituir a linha abaixo pelo seu objeto de config do Firebase:
// const firebaseConfig = { apiKey: "SUA_API_KEY", authDomain: "...", projectId: "...", ... };
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wetravel-app-shared';

export default function App() {
  // --- Estados de Autenticação e Usuário ---
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [notification, setNotification] = useState(null); // { type, message }

  // --- Campos de Formulário de Autenticação ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // --- Estados de Viagens ---
  const [myTrips, setMyTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [activeTripData, setActiveTripData] = useState(null);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'cronograma' | 'financeiro' | 'membros'
  
  // --- Estados dos Modais ---
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);

  // --- Formulários de Modais ---
  const [newTripName, setNewTripName] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Lançamento de despesa
  const [expenseValue, setExpenseValue] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');

  // Lançamento de dica de cronograma
  const [tipType, setTipType] = useState('almoco'); // 'almoco' | 'passeio' | 'cafe' | 'jantar'
  const [tipPeriod, setTipPeriod] = useState('manha'); // 'manha' | 'tarde'
  const [tipPlaceName, setTipPlaceName] = useState('');
  const [tipDesc, setTipDesc] = useState('');
  const [tipDate, setTipDate] = useState('');

  // --- Dados em tempo real da Viagem Ativa ---
  const [tripExpenses, setTripExpenses] = useState([]);
  const [tripTips, setTripTips] = useState([]);
  const [tripMembers, setTripMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);

  // ==========================================
  // AUTENTICAÇÃO INICIAL E CONTROLE DE ESTADO (REGRA 3)
  // ==========================================
  useEffect(() => {
    const initAuth = async () => {
      try {
        setAuthLoading(true);
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Erro na autenticação inicial:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Buscar dados do usuário no Firestore seguindo as regras de caminhos estritos
        const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'data');
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          const fallbackData = {
            uid: currentUser.uid,
            name: currentUser.displayName || 'Viajante',
            email: currentUser.email || 'anonimo@wetravel.com',
            phone: currentUser.phoneNumber || '',
            verified: currentUser.emailVerified || false
          };
          setUserData(fallbackData);
        }
      } else {
        setUserData(null);
        setActiveTrip(null);
        setActiveTripData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Notificações visuais elegantes substituindo alert()
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // ==========================================
  // FLUXOS DE AUTENTICAÇÃO (LOGIN/REGISTRO)
  // ==========================================
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    if (!name || !email || !password || !phone) {
      setAuthError("Por favor, preencha todos os campos.");
      setAuthLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      await updateProfile(newUser, { displayName: name });

      // Guardar perfil estendido no Firestore seguindo a REGRA 1 (Caminho Privado do Usuário)
      const userProfileData = {
        uid: newUser.uid,
        name,
        email: email.toLowerCase().trim(),
        phone,
        verified: false, // Inicia pendente de verificação por e-mail
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'artifacts', appId, 'users', newUser.uid, 'profile', 'data'), userProfileData);
      
      // Registrar e-mail publicamente para permitir buscas de convites sem expor outros dados
      await setDoc(doc(db, 'artifacts', appId, 'public', 'emails', email.toLowerCase().trim()), {
        uid: newUser.uid,
        name: name
      });

      setUserData(userProfileData);
      showNotification("Conta criada com sucesso! Verifique seu e-mail para confirmação.", "success");
    } catch (err) {
      console.error(err);
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
      showNotification("Bem-vindo de volta ao WeTravel!", "success");
    } catch (err) {
      console.error(err);
      setAuthError(translateAuthError(err.code));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showNotification("Sessão encerrada com sucesso.", "info");
    } catch (err) {
      console.error(err);
    }
  };

  const translateAuthError = (code) => {
    switch (code) {
      case 'auth/invalid-email': return 'E-mail em formato incorreto.';
      case 'auth/user-disabled': return 'Este usuário foi desativado.';
      case 'auth/user-not-found': return 'Usuário não localizado no sistema.';
      case 'auth/wrong-password': return 'Senha de acesso incorreta.';
      case 'auth/email-already-in-use': return 'Este e-mail já está sendo utilizado.';
      case 'auth/weak-password': return 'A senha deve conter ao menos 6 caracteres.';
      default: return 'Ocorreu um erro ao autenticar. Tente novamente.';
    }
  };

  // Simular confirmação via link de e-mail (fluxo PWA interativo)
  const confirmEmailSimulation = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await updateDoc(userDocRef, { verified: true });
      setUserData(prev => ({ ...prev, verified: true }));
      showNotification("Sua conta foi ativada com sucesso pelo link!", "success");
    } catch (err) {
      showNotification("Falha ao confirmar ativação da conta.", "error");
    }
  };

  // ==========================================
  // CARREGAR DADOS COLETIVOS (REGRA 1 & REGRA 2)
  // ==========================================
  useEffect(() => {
    if (!user) return;

    // Escuta em tempo real todas as viagens das quais o usuário é participante
    const tripsQuery = collection(db, 'artifacts', appId, 'public', 'data', 'trips');
    
    const unsubscribeTrips = onSnapshot(tripsQuery, (snapshot) => {
      const tripsList = [];
      snapshot.forEach((doc) => {
        const data = doc.id ? { id: doc.id, ...doc.data() } : null;
        if (data && data.members && data.members.includes(user.uid)) {
          tripsList.push(data);
        }
      });
      setMyTrips(tripsList);

      if (activeTrip) {
        const currentActive = tripsList.find(t => t.id === activeTrip);
        if (currentActive) {
          setActiveTripData(currentActive);
        }
      }
    }, (error) => {
      console.error("Erro ao sincronizar viagens:", error);
    });

    // Escuta em tempo real convites pendentes direcionados a este usuário
    const invitesQuery = collection(db, 'artifacts', appId, 'public', 'data', 'invites');
    const unsubscribeInvites = onSnapshot(invitesQuery, (snapshot) => {
      const invitesList = [];
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (data.toEmail === user.email?.toLowerCase().trim() && data.status === 'pending') {
          invitesList.push(data);
        }
      });
      setPendingInvites(invitesList);
    }, (error) => {
      console.error("Erro ao sincronizar convites:", error);
    });

    return () => {
      unsubscribeTrips();
      unsubscribeInvites();
    };
  }, [user, activeTrip]);

  // ==========================================
  // SINCRONIZAÇÃO DE DADOS DA VIAGEM ATIVA
  // ==========================================
  useEffect(() => {
    if (!user || !activeTrip) return;

    // Sincronizar despesas
    const expensesQuery = collection(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`);
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTripExpenses(list);
    }, (err) => console.error(err));

    // Sincronizar dicas e cronograma
    const tipsQuery = collection(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`);
    const unsubscribeTips = onSnapshot(tipsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTripTips(list);
    }, (err) => console.error(err));

    // Carregar dados de perfil dos integrantes da sala para exibir os nomes corretos
    const loadMembersInfo = async () => {
      if (!activeTripData) return;
      try {
        const list = [];
        for (const mId of activeTripData.members) {
          const mDoc = await getDoc(doc(db, 'artifacts', appId, 'users', mId, 'profile', 'data'));
          if (mDoc.exists()) {
            list.push(mDoc.data());
          } else {
            list.push({ uid: mId, name: 'Viajante Convidado', email: '' });
          }
        }
        setTripMembers(list);
      } catch (err) {
        console.error("Erro ao buscar perfis dos membros:", err);
      }
    };

    loadMembersInfo();

    return () => {
      unsubscribeExpenses();
      unsubscribeTips();
    };
  }, [user, activeTrip, activeTripData]);

  // ==========================================
  // GESTÃO DE VIAGENS E ENVIO DE CONVITES
  // ==========================================
  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!newTripName.trim()) return;

    try {
      const tripDocRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'trips'));
      const tripPayload = {
        id: tripDocRef.id,
        name: newTripName,
        description: newTripDesc,
        creator: user.uid,
        creatorName: userData?.name || 'Viajante',
        members: [user.uid],
        createdAt: new Date().toISOString()
      };

      await setDoc(tripDocRef, tripPayload);
      setActiveTrip(tripDocRef.id);
      setIsNewTripModalOpen(false);
      setNewTripName('');
      setNewTripDesc('');
      showNotification(`Viagem "${tripPayload.name}" iniciada com sucesso!`, "success");
    } catch (err) {
      console.error(err);
      showNotification("Erro ao criar viagem de grupo.", "error");
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.toLowerCase().trim();
    if (!cleanEmail) return;

    if (cleanEmail === user.email?.toLowerCase().trim()) {
      showNotification("Você já faz parte da viagem atual.", "error");
      return;
    }

    try {
      const emailDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'emails', cleanEmail));
      if (!emailDoc.exists()) {
        showNotification("Este e-mail ainda não está cadastrado no aplicativo.", "error");
        return;
      }

      const recipient = emailDoc.data();

      if (activeTripData.members.includes(recipient.uid)) {
        showNotification("Este viajante já está no grupo da viagem.", "info");
        return;
      }

      const inviteDocRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'invites'));
      await setDoc(inviteDocRef, {
        id: inviteDocRef.id,
        tripId: activeTrip,
        tripName: activeTripData.name,
        fromUid: user.uid,
        fromName: userData?.name || 'Membro do Grupo',
        toEmail: cleanEmail,
        toUid: recipient.uid,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      showNotification(`Convite enviado com sucesso para ${cleanEmail}!`, "success");
      setInviteEmail('');
      setIsInviteModalOpen(false);
    } catch (err) {
      console.error(err);
      showNotification("Erro ao enviar o convite.", "error");
    }
  };

  const handleRespondInvite = async (invite, accept) => {
    try {
      const inviteRef = doc(db, 'artifacts', appId, 'public', 'data', 'invites', invite.id);
      
      if (accept) {
        await updateDoc(inviteRef, { status: 'accepted' });
        
        const tripRef = doc(db, 'artifacts', appId, 'public', 'data', 'trips', invite.tripId);
        await updateDoc(tripRef, {
          members: arrayUnion(user.uid)
        });

        setActiveTrip(invite.tripId);
        showNotification(`Você entrou na sala da viagem: "${invite.tripName}"!`, "success");
      } else {
        await updateDoc(inviteRef, { status: 'declined' });
        showNotification("Convite rejeitado.", "info");
      }
    } catch (err) {
      console.error(err);
      showNotification("Erro ao responder convite.", "error");
    }
  };

  // ==========================================
  // OPERAÇÕES FINANCEIRAS & RATEIO INTELIGENTE
  // ==========================================
  const handleAddExpense = async (e) => {
    e.preventDefault();
    const value = parseFloat(expenseValue);
    if (isNaN(value) || value <= 0 || !expenseDesc.trim()) {
      showNotification("Por favor, insira uma descrição e um valor numérico válido.", "error");
      return;
    }

    try {
      const expenseDocRef = doc(collection(db, 'artifacts', appId, 'public', 'data', `expenses_${activeTrip}`));
      const expensePayload = {
        id: expenseDocRef.id,
        value: value,
        description: expenseDesc,
        uid: user.uid,
        userName: userData?.name || 'Participante',
        createdAt: new Date().toISOString()
      };

      await setDoc(expenseDocRef, expensePayload);
      setIsExpenseModalOpen(false);
      setExpenseValue('');
      setExpenseDesc('');
      showNotification("Nova despesa registrada e dividida entre o grupo!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Erro ao registrar despesa.", "error");
    }
  };

  // Processamento de Rateio por Igual entre todos os participantes da viagem ativa
  const financialSummary = useMemo(() => {
    if (!activeTripData || tripExpenses.length === 0 || tripMembers.length === 0) {
      return { total: 0, perPerson: 0, userBalances: {}, transfers: [] };
    }

    const total = tripExpenses.reduce((acc, curr) => acc + curr.value, 0);
    const memberCount = activeTripData.members.length;
    const perPerson = total / memberCount;

    // Calcular o total pago por cada membro individualmente
    const paidMap = {};
    activeTripData.members.forEach(mId => {
      paidMap[mId] = 0;
    });

    tripExpenses.forEach(exp => {
      if (paidMap[exp.uid] !== undefined) {
        paidMap[exp.uid] += exp.value;
      } else {
        paidMap[exp.uid] = exp.value;
      }
    });

    // Saldo individual: (Pago - Valor Devido)
    const balances = {};
    activeTripData.members.forEach(mId => {
      balances[mId] = paidMap[mId] - perPerson;
    });

    // Minimizar as transações necessárias para equilibrar as contas (Quem deve para quem)
    const debtors = [];
    const creditors = [];

    activeTripData.members.forEach(mId => {
      const balance = balances[mId];
      const memberObj = tripMembers.find(m => m.uid === mId) || { uid: mId, name: 'Membro' };
      if (balance < -0.01) {
        debtors.push({ uid: mId, name: memberObj.name, amount: Math.abs(balance) });
      } else if (balance > 0.01) {
        creditors.push({ uid: mId, name: memberObj.name, amount: balance });
      }
    });

    const transfers = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const minAmount = Math.min(debtor.amount, creditor.amount);
      transfers.push({
        from: debtor.name,
        fromUid: debtor.uid,
        to: creditor.name,
        toUid: creditor.uid,
        amount: minAmount
      });

      debtor.amount -= minAmount;
      creditor.amount -= minAmount;

      if (debtor.amount < 0.01) dIdx++;
      if (creditor.amount < 0.01) cIdx++;
    }

    return {
      total,
      perPerson,
      balances,
      transfers
    };
  }, [activeTripData, tripExpenses, tripMembers]);

  // ==========================================
  // OPERAÇÕES DO CRONOGRAMA & VOTAÇÃO COLABORATIVA
  // ==========================================
  const handleAddTip = async (e) => {
    e.preventDefault();
    if (!tipPlaceName.trim() || !tipDesc.trim() || !tipDate) {
      showNotification("Preencha todos os dados necessários para sugerir a atração.", "error");
      return;
    }

    // Regra estrita: não aceitar propostas que entrem em conflito direto com um cronograma já APROVADO
    const isConflict = tripTips.some(tip => {
      if (tip.status !== 'approved') return false;
      if (tip.date !== tipDate) return false;
      if (tip.type !== tipType) return false;

      if (['passeio', 'cafe'].includes(tipType)) {
        return tip.period === tipPeriod;
      }
      return true; // Almoço ou Jantar impedem outros do mesmo tipo no mesmo dia
    });

    if (isConflict) {
      showNotification(`Já existe uma sugestão aprovada de ${tipType.toUpperCase()} para este dia e período.`, "error");
      return;
    }

    try {
      const tipDocRef = doc(collection(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`));
      const tipPayload = {
        id: tipDocRef.id,
        type: tipType,
        period: ['passeio', 'cafe'].includes(tipType) ? tipPeriod : null,
        placeName: tipPlaceName,
        description: tipDesc,
        date: tipDate,
        createdBy: user.uid,
        creatorName: userData?.name || 'Participante',
        status: 'pending',
        votesUp: [user.uid], // O autor vota sim automaticamente
        votesDown: [],
        createdAt: new Date().toISOString()
      };

      await setDoc(tipDocRef, tipPayload);
      setIsTipModalOpen(false);
      setTipPlaceName('');
      setTipDesc('');
      setTipDate('');
      showNotification("Dica sugerida! Aguardando aprovação dos outros membros.", "success");
    } catch (err) {
      console.error(err);
      showNotification("Falha ao sugerir atividade.", "error");
    }
  };

  const handleVote = async (tipId, isApprove) => {
    try {
      const tipRef = doc(db, 'artifacts', appId, 'public', 'data', `tips_${activeTrip}`, tipId);
      const tipObj = tripTips.find(t => t.id === tipId);
      if (!tipObj) return;

      let newVotesUp = [...(tipObj.votesUp || [])];
      let newVotesDown = [...(tipObj.votesDown || [])];

      if (isApprove) {
        newVotesDown = newVotesDown.filter(uid => uid !== user.uid);
        if (!newVotesUp.includes(user.uid)) {
          newVotesUp.push(user.uid);
        }
      } else {
        newVotesUp = newVotesUp.filter(uid => uid !== user.uid);
        if (!newVotesDown.includes(user.uid)) {
          newVotesDown.push(user.uid);
        }
      }

      // Regra de Aprovação: Se aprovações > reprovações e a maioria do grupo total votou
      const totalMembers = activeTripData.members.length;
      const approvalsCount = newVotesUp.length;
      const rejectionsCount = newVotesDown.length;

      let newStatus = 'pending';
      
      if (approvalsCount > rejectionsCount && (approvalsCount + rejectionsCount >= Math.ceil(totalMembers / 2))) {
        // Verificar novamente se não houve conflito enquanto a votação ocorria
        const isConflict = tripTips.some(t => {
          if (t.id === tipId || t.status !== 'approved') return false;
          if (t.date !== tipObj.date) return false;
          if (t.type !== tipObj.type) return false;
          if (['passeio', 'cafe'].includes(tipObj.type)) {
            return t.period === tipObj.period;
          }
          return true;
        });

        if (!isConflict) {
          newStatus = 'approved';
        } else {
          newStatus = 'declined';
        }
      } else if (rejectionsCount >= approvalsCount && (approvalsCount + rejectionsCount >= Math.ceil(totalMembers / 2))) {
        newStatus = 'declined';
      }

      await updateDoc(tipRef, {
        votesUp: newVotesUp,
        votesDown: newVotesDown,
        status: newStatus
      });

      if (newStatus === 'approved') {
        showNotification("Sugestão aprovada! Ela foi incluída oficialmente no cronograma.", "success");
      }
    } catch (err) {
      console.error(err);
      showNotification("Erro ao salvar o voto.", "error");
    }
  };

  // Agrupamento do Cronograma Oficial Aprovado
  const approvedTimeline = useMemo(() => {
    const approvedList = tripTips.filter(t => t.status === 'approved');
    const grouped = {};
    
    approvedList.forEach(item => {
      if (!grouped[item.date]) {
        grouped[item.date] = [];
      }
      grouped[item.date].push(item);
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
    
    return sortedDates.map(date => {
      const items = grouped[date].sort((a, b) => {
        const order = {
          'cafe_manha': 1,
          'passeio_manha': 2,
          'almoco': 3,
          'passeio_tarde': 4,
          'cafe_tarde': 5,
          'jantar': 6
        };

        const keyA = a.type + (a.period ? `_${a.period}` : '');
        const keyB = b.type + (b.period ? `_${b.period}` : '');

        return (order[keyA] || 99) - (order[keyB] || 99);
      });

      return {
        date,
        items
      };
    });
  }, [tripTips]);

  const formatDateFriendly = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getTipTypeName = (type, period) => {
    const names = {
      'almoco': 'Almoço',
      'jantar': 'Jantar',
      'passeio': `Passeio (${period === 'manha' ? 'Manhã' : 'Tarde'})`,
      'cafe': `Café (${period === 'manha' ? 'Manhã' : 'Tarde'})`
    };
    return names[type] || type;
  };

  const getTipBadgeStyle = (type) => {
    switch (type) {
      case 'almoco': return 'bg-amber-100 text-amber-800';
      case 'jantar': return 'bg-indigo-100 text-indigo-800';
      case 'passeio': return 'bg-sky-100 text-sky-800';
      case 'cafe': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-100">
      
      {/* TOPO DE NAVEGAÇÃO PRINCIPAL */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shadow-blue-200">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">WeTravel</h1>
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
                title="Sair da Conta"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* NOTIFICAÇÃO DO SISTEMA */}
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

      {/* PAINEL CENTRAL */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col gap-6">
        
        {/* LOGIN E CADASTRO */}
        {!user && !authLoading && (
          <div className="max-w-md w-full mx-auto my-auto py-10">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
              <div className="text-center mb-8">
                <div className="bg-blue-50 text-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Compass className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Planeje viagens juntos</h2>
                <p className="text-slate-500 mt-2 text-sm">Organize cronogramas, divida contas e compartilhe momentos sem complicações.</p>
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
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: João Silva"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Número de Telefone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Ex: (11) 99999-9999"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Endereço de E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex: joao@provedor.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Senha de Acesso</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="No mínimo 6 caracteres"
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
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-semibold">ou escolha</span>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setAuthError(null);
                  }}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOADING STATE DE LOGIN */}
        {authLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 text-sm font-medium">Sincronizando com o WeTravel Cloud...</p>
          </div>
        )}

        {/* FLUXO INTERATIVO DA PLATAFORMA */}
        {user && !authLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* BARRA LATERAL: SELETOR DE SALAS E CONVITES */}
            <aside className="lg:col-span-1 flex flex-col gap-6">
              
              {/* STATUS DE CONFIRMAÇÃO DO E-MAIL (SIMULADO) */}
              {!userData?.verified && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex flex-col gap-3">
                  <div className="flex gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Conta pendente de ativação</span>
                  </div>
                  <p>Enviamos um link de confirmação para o seu e-mail cadastrado para liberar todas as funções de compartilhamento.</p>
                  <button 
                    onClick={confirmEmailSimulation}
                    className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Confirmar Conta via E-mail
                  </button>
                </div>
              )}

              {/* CONVITES RECEBIDOS */}
              {pendingInvites.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Convites Recebidos ({pendingInvites.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm flex flex-col gap-2">
                        <p className="text-xs text-slate-600 font-medium">
                          <strong className="text-slate-950">{invite.fromName}</strong> te convidou para a viagem:
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
                            className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-lg text-xs"
                            title="Recusar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SELEÇÃO DE SALAS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Minhas Viagens</h3>
                  <button
                    onClick={() => setIsNewTripModalOpen(true)}
                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                    title="Nova Viagem"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {myTrips.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                    <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 px-3">Você não possui viagens cadastradas.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myTrips.map((trip) => (
                      <button
                        key={trip.id}
                        onClick={() => {
                          setActiveTrip(trip.id);
                          setActiveTab('feed');
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                          activeTrip === trip.id
                            ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <p className="text-sm truncate">{trip.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal truncate">Criada por {trip.creatorName}</p>
                        </div>
                        <Users className={`w-4 h-4 flex-shrink-0 ${activeTrip === trip.id ? 'text-blue-600' : 'text-slate-400'}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {/* SEÇÃO PRINCIPAL DA SALA ATIVA */}
            <section className="lg:col-span-3 flex flex-col gap-6">
              
              {!activeTrip ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                  <div className="bg-slate-50 text-slate-400 p-4 rounded-full mb-4">
                    <Compass className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Selecione ou crie uma viagem</h3>
                  <p className="text-slate-500 text-sm max-w-sm mt-2">
                    Abra uma das suas viagens ou inicie um novo planejamento para compartilhar cronogramas e rateios com seus amigos.
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
                  
                  {/* HERO BANNER DA SALA */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full uppercase tracking-wider">Viagem Oficial</span>
                        <span className="text-xs text-slate-400 font-mono">ID: {activeTrip}</span>
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 mt-2">{activeTripData?.name}</h2>
                      <p className="text-sm text-slate-500 mt-1">{activeTripData?.description || 'Planejamento compartilhado do grupo.'}</p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
                      >
                        <UserPlus className="w-4 h-4" /> Convidar Amigos
                      </button>
                    </div>
                  </div>

                  {/* NAVEGAÇÃO DE ABAS */}
                  <div className="bg-slate-200/60 p-1.5 rounded-2xl flex gap-1">
                    <button
                      onClick={() => setActiveTab('feed')}
                      className={`flex-1 py-2.5 text-center text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'feed'
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      <Users className="w-4 h-4" /> Mural & Membros
                    </button>
                    <button
                      onClick={() => setActiveTab('cronograma')}
                      className={`flex-1 py-2.5 text-center text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'cronograma'
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      <Calendar className="w-4 h-4" /> Cronograma Oficial
                    </button>
                    <button
                      onClick={() => setActiveTab('financeiro')}
                      className={`flex-1 py-2.5 text-center text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'financeiro'
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" /> Rateio Financeiro
                    </button>
                  </div>

                  {/* ABA: MURAL & MEMBROS */}
                  {activeTab === 'feed' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* CARD: LISTA DE INTEGRANTES */}
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:col-span-1 flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-600" /> Membros na Sala ({tripMembers.length})
                        </h3>
                        <p className="text-xs text-slate-500">As despesas adicionadas serão divididas de forma igualitária entre todos os integrantes cadastrados abaixo.</p>
                        
                        <div className="space-y-3 mt-2">
                          {tripMembers.map((member) => (
                            <div key={member.uid} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="w-9 h-9 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center font-bold text-sm">
                                {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
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

                      {/* CARD: RESUMO DA SALA */}
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:col-span-2 flex flex-col gap-6">
                        <div>
                          <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide mb-2">Visão Geral</h3>
                          <p className="text-xs text-slate-500 font-medium">Situação geral dos lançamentos e atividades sugeridas.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total Lançado</span>
                            <span className="text-xl font-black text-emerald-950 mt-1 block">R$ {financialSummary.total.toFixed(2)}</span>
                            <span className="text-[10px] text-emerald-700 mt-1 block">R$ {financialSummary.perPerson.toFixed(2)} por pessoa</span>
                          </div>

                          <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl">
                            <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Cronograma Fixado</span>
                            <span className="text-xl font-black text-purple-950 mt-1 block">
                              {tripTips.filter(t => t.status === 'approved').length} itens
                            </span>
                            <span className="text-[10px] text-purple-700 mt-1 block">
                              {tripTips.filter(t => t.status === 'pending').length} sugestões pendentes
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Orientações de Uso</h4>
                          <ul className="text-xs text-slate-600 space-y-2">
                            <li className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></span>
                              <span><strong>Rateio Direto:</strong> Ao registrar qualquer pagamento na aba Financeiro, o sistema divide automaticamente o valor de forma integral.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></span>
                              <span><strong>Decisão do Grupo:</strong> Sugira atrações e restaurantes e mobilize o grupo para votarem nas propostas. O cronograma atualiza-se dinamicamente apenas após aprovação.</span>
                            </li>
                          </ul>
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
                          <p className="text-xs text-slate-500 mt-1">Sugerido e votado pelos integrantes. Almoços, jantares, cafés e passeios fixados.</p>
                        </div>
                        <button
                          onClick={() => setIsTipModalOpen(true)}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5 transition-all w-full md:w-auto justify-center"
                        >
                          <Plus className="w-4 h-4" /> Sugerir Dica / Atividade
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* CRONOGRAMA OFICIAL (APROVADOS) */}
                        <div className="lg:col-span-2 space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Atividades Confirmadas</h4>
                          
                          {approvedTimeline.length === 0 ? (
                            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                              <p className="text-sm font-semibold text-slate-900">Cronograma livre</p>
                              <p className="text-xs text-slate-500 mt-1">Nenhuma atração foi aprovada pelo grupo ainda. Crie sua sugestão para abrir a votação!</p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {approvedTimeline.map((dayGroup) => (
                                <div key={dayGroup.date} className="relative pl-6 border-l-2 border-blue-100">
                                  <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm"></div>
                                  
                                  <h5 className="text-sm font-black text-blue-900 capitalize mb-4">
                                    {formatDateFriendly(dayGroup.date)}
                                  </h5>

                                  <div className="space-y-3">
                                    {dayGroup.items.map((item) => (
                                      <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getTipBadgeStyle(item.type)}`}>
                                            {getTipTypeName(item.type, item.period)}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-medium">Aprovado pelo Grupo</span>
                                        </div>
                                        <h6 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                          {item.placeName}
                                        </h6>
                                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">{item.description}</p>
                                        <p className="text-[9px] text-slate-400 text-right">Recomendado por {item.creatorName}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* ATIVIDADES EM VOTAÇÃO */}
                        <div className="lg:col-span-1 space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Painel de Votação</h4>
                          
                          {tripTips.filter(t => t.status === 'pending').length === 0 ? (
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center text-xs text-slate-400">
                              Não existem propostas aguardando aprovação no momento.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {tripTips.filter(t => t.status === 'pending').map((tip) => {
                                const hasVotedUp = tip.votesUp?.includes(user.uid);
                                const hasVotedDown = tip.votesDown?.includes(user.uid);
                                const currentTotalMembers = activeTripData.members.length;
                                const votesRequired = Math.ceil(currentTotalMembers / 2);

                                return (
                                  <div key={tip.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${getTipBadgeStyle(tip.type)}`}>
                                        {getTipTypeName(tip.type, tip.period)}
                                      </span>
                                      <span className="text-[10px] font-medium text-slate-400">
                                        Data: {tip.date.split('-').reverse().slice(0, 2).join('/')}
                                      </span>
                                    </div>

                                    <div>
                                      <h6 className="text-xs font-bold text-slate-900 leading-tight">{tip.placeName}</h6>
                                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{tip.description}</p>
                                    </div>

                                    {/* Progresso de Votos */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                                        <span>Sim: {(tip.votesUp?.length || 0)} / {votesRequired} para aprovar</span>
                                        <span>Não: {(tip.votesDown?.length || 0)}</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                        <div 
                                          className="bg-emerald-500 h-full transition-all" 
                                          style={{ width: `${((tip.votesUp?.length || 0) / currentTotalMembers) * 100}%` }}
                                        ></div>
                                        <div 
                                          className="bg-rose-400 h-full transition-all" 
                                          style={{ width: `${((tip.votesDown?.length || 0) / currentTotalMembers) * 100}%` }}
                                        ></div>
                                      </div>
                                    </div>

                                    {/* Botões para Votar */}
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleVote(tip.id, true)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                                          hasVotedUp 
                                            ? 'bg-emerald-100 text-emerald-800' 
                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                        }`}
                                      >
                                        <ThumbsUp className="w-3.5 h-3.5" /> Aprovar
                                      </button>
                                      <button
                                        onClick={() => handleVote(tip.id, false)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                                          hasVotedDown 
                                            ? 'bg-rose-100 text-rose-800' 
                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                        }`}
                                      >
                                        <ThumbsDown className="w-3.5 h-3.5" /> Rejeitar
                                      </button>
                                    </div>
                                    <span className="text-[9px] text-slate-400 text-right">Iniciado por {tip.creatorName}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}

                  {/* ABA: FINANCEIRO & AJUSTE DE CONTAS */}
                  {activeTab === 'financeiro' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* CARTÃO DE AJUSTES E SALDOS */}
                      <div className="lg:col-span-1 flex flex-col gap-6">
                        
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4">
                          <div>
                            <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Acerto de Contas</h3>
                            <p className="text-xs text-slate-500 mt-1">Consolidação automática dos pagamentos para equilibrar os saldos.</p>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Gasto Total do Grupo</span>
                            <span className="text-2xl font-black text-slate-900 mt-1 block">R$ {financialSummary.total.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 mt-2 block">Custo individual equilibrado: <strong>R$ {financialSummary.perPerson.toFixed(2)}</strong></span>
                          </div>

                          {/* TRANSAÇÕES SUGERIDAS */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Como ajustar o saldo:</h4>
                            {financialSummary.transfers.length === 0 ? (
                              <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-xl">Nenhuma transação é necessária no momento.</p>
                            ) : (
                              <div className="space-y-2">
                                {financialSummary.transfers.map((t, idx) => (
                                  <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs flex flex-col gap-1">
                                    <div className="flex items-center justify-between font-medium">
                                      <span className="text-slate-600 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-rose-500" /> {t.from}</span>
                                      <span className="text-slate-400">precisa pagar para</span>
                                    </div>
                                    <div className="flex items-center justify-between font-bold text-slate-950">
                                      <span className="text-slate-800 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> {t.to}</span>
                                      <span className="text-blue-600">R$ {t.amount.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* HISTÓRICO DE LANÇAMENTOS */}
                      <div className="lg:col-span-2 flex flex-col gap-6">
                        
                        <div className="bg-white rounded-3xl border border-slate-200 p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Lançamentos Realizados</h3>
                              <p className="text-xs text-slate-500 mt-1">Registros das contribuições individuais compartilhadas na viagem.</p>
                            </div>
                            <button
                              onClick={() => setIsExpenseModalOpen(true)}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-100 flex items-center gap-1.5 justify-center transition-all"
                            >
                              <Plus className="w-4 h-4" /> Registrar Lançamento
                            </button>
                          </div>

                          {tripExpenses.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                              <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-slate-800">Sem lançamentos</p>
                              <p className="text-xs text-slate-400 mt-1">Nenhum valor foi lançado nesta viagem.</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                              {tripExpenses.map((exp) => {
                                const isSelf = exp.uid === user.uid;

                                return (
                                  <div 
                                    key={exp.id} 
                                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                                      isSelf ? 'bg-blue-50/40 border-blue-100' : 'bg-white border-slate-100 hover:border-slate-200'
                                    }`}
                                  >
                                    <div className="truncate pr-3">
                                      <p className="text-xs font-bold text-slate-900 truncate">{exp.description}</p>
                                      <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                        <span>Por: <strong>{isSelf ? 'Você' : exp.userName}</strong></span>
                                        <span>•</span>
                                        <span>{new Date(exp.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <span className="text-sm font-black text-slate-950 block">R$ {exp.value.toFixed(2)}</span>
                                      <span className="text-[9px] text-slate-400 block mt-0.5">Rateio individual: R$ {(exp.value / activeTripData.members.length).toFixed(2)}</span>
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

      {/* RODAPÉ */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs">
          <p>© 2026 WeTravel Sincronizado - Ambiente PWA.</p>
          <div className="flex gap-4">
            <span>Integração Cloud Firebase Firestore</span>
            <span>Sem Cookies de Rastreamento</span>
          </div>
        </div>
      </footer>

      {/* ==========================================
          MODAL: CRIAR GRUPO DE VIAGEM
          ========================================== */}
      {isNewTripModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">Novo Planejamento</h3>
              <button 
                onClick={() => setIsNewTripModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nome do Destino / Grupo</label>
                <input
                  type="text"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  placeholder="Ex: Viagem de Férias 2026, Natal em Família"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Informações Adicionais</label>
                <textarea
                  value={newTripDesc}
                  onChange={(e) => setNewTripDesc(e.target.value)}
                  placeholder="Ex: Definindo cronograma de passeios e rateando custos da hospedagem."
                  rows="3"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewTripModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-blue-100"
                >
                  Criar Sala
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CONVIDAR INTEGRANTE VIA E-MAIL
          ========================================== */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">Convidar via E-mail</h3>
              <button 
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">O e-mail deve corresponder ao endereço de um viajante já cadastrado na plataforma WeTravel.</p>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">E-mail do Viajante</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Ex: amigo@provedor.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-100"
                >
                  Enviar Convite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: LANÇAR VALOR DE CONTRIBUIÇÃO
          ========================================== */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">Novo Lançamento</h3>
              <button 
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">Este valor total será lançado em seu nome e rateado integralmente entre todos os membros da viagem.</p>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Valor do Pagamento (R$)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-slate-400 text-xs font-bold">R$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={expenseValue}
                    onChange={(e) => setExpenseValue(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Descrição</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Jantar restaurante centro, Compra de mantimentos"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-100"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: SUGERIR DICA (CRONOGRAMA)
          ========================================== */}
      {isTipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950">Sugerir Dica para Votação</h3>
              <button 
                onClick={() => setIsTipModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTip} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tipo</label>
                  <select
                    value={tipType}
                    onChange={(e) => setTipType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs"
                  >
                    <option value="almoco">Almoço</option>
                    <option value="jantar">Jantar</option>
                    <option value="passeio">Passeio</option>
                    <option value="cafe">Café</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Data Proposta</label>
                  <input
                    type="date"
                    value={tipDate}
                    onChange={(e) => setTipDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs"
                    required
                  />
                </div>
              </div>

              {['passeio', 'cafe'].includes(tipType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Período</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTipPeriod('manha')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        tipPeriod === 'manha' 
                          ? 'bg-blue-50 border-blue-400 text-blue-900' 
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Manhã
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipPeriod('tarde')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        tipPeriod === 'tarde' 
                          ? 'bg-blue-50 border-blue-400 text-blue-900' 
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Tarde
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Local / Nome</label>
                <input
                  type="text"
                  value={tipPlaceName}
                  onChange={(e) => setTipPlaceName(e.target.value)}
                  placeholder="Ex: Passeio de Barco, Pizzaria Central"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Breve Descrição</label>
                <textarea
                  value={tipDesc}
                  onChange={(e) => setTipDesc(e.target.value)}
                  placeholder="Descreva detalhes como horário sugerido, custo provável ou o porquê de visitar este lugar."
                  rows="3"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTipModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-100"
                >
                  Enviar para Votação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}