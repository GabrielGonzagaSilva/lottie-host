(function (root, factory) {
  const cfg = typeof module === 'object' && module.exports ? require('./config.js') : root.ChocoConfig;
  const api = factory(cfg);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChocoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (cfg) {
  const { RECIPES, MAX_PRODUCTS, STANDARD_MINIMUM, initialInventory } = cfg;

  const now = () => Date.now();
  const uid = () => {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return 'id-' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  };
  const clone = obj => typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
  const recipe = id => RECIPES.find(r => r.id === id);
  const evt = (type, message) => ({ id: uid(), at: now(), type, message });

  function newTeam(index) {
    return {
      id: uid(),
      name: `Fábrica ${String.fromCharCode(65 + index)}`,
      players: [],
      inventory: initialInventory(),
      prepared: [],
      freezer: null,
      completed: [],
      penalties: [],
      attempts: 0
    };
  }

  function createSession(mode = 'classic', teamCount = 2, planningMinutes = 10, productionMinutes = 15) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const normalizedMode = mode === 'pressure' ? 'pressure' : 'classic';
    return {
      id: uid(),
      code,
      title: 'Chocolate com Pimenta',
      mode: normalizedMode,
      phase: 'lobby',
      entriesOpen: true,
      planningSeconds: Math.max(60, Number(planningMinutes || 10) * 60),
      productionSeconds: Math.max(60, Number(productionMinutes || 15) * 60),
      timer: { endsAt: null, pausedRemainingSeconds: null },
      freezerCapacity: 3,
      berriesPoints: 5,
      interventions: { talentShare: false, marketUpdate: false, freezerReduction: false },
      teams: Array.from({ length: Math.min(4, Math.max(2, Number(teamCount || 2))) }, (_, i) => newTeam(i)),
      events: [evt('session', `Sessão ${code} criada em modo ${normalizedMode === 'classic' ? 'Clássica' : 'Panela de Pressão'}.`)],
      createdAt: now()
    };
  }

  function joinSession(session, name, teamId, role = 'participant', targetTeamId) {
    if (!session.entriesOpen) throw new Error('As entradas estão fechadas pelo facilitador.');
    const s = clone(session);
    const team = s.teams.find(t => t.id === teamId);
    if (!team) throw new Error('Equipe inválida.');
    if (role === 'fiscal' && (!targetTeamId || targetTeamId === teamId)) throw new Error('O fiscal precisa observar outra equipe.');
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Informe seu nome.');
    const p = { id: uid(), name: cleanName, role, targetTeamId, joinedAt: now() };
    team.players.push(p);
    s.events.push(evt('join', `${p.name} entrou como ${role === 'fiscal' ? 'fiscal' : 'participante'}.`));
    return { session: s, player: p };
  }

  function renameTeam(session, teamId, name) {
    const s = clone(session);
    const t = s.teams.find(x => x.id === teamId);
    if (t) t.name = String(name || '').trim() || t.name;
    return s;
  }

  function setEntries(session, open) {
    const s = clone(session);
    s.entriesOpen = Boolean(open);
    s.events.push(evt('entries', s.entriesOpen ? 'Entradas reabertas.' : 'Entradas fechadas.'));
    return s;
  }

  function startPhase(session, phase) {
    if (!['planning', 'production', 'results'].includes(phase)) throw new Error('Fase inválida.');
    const s = clone(session);
    s.phase = phase;
    if (phase === 'results') {
      s.timer = { endsAt: null, pausedRemainingSeconds: null };
      s.events.push(evt('phase', 'Produção encerrada.'));
      return s;
    }
    const seconds = phase === 'planning' ? s.planningSeconds : s.productionSeconds;
    s.timer = { endsAt: now() + seconds * 1000, pausedRemainingSeconds: null };
    s.events.push(evt('phase', phase === 'planning' ? 'Planejamento iniciado.' : 'Produção iniciada.'));
    return s;
  }

  function pauseSession(session) {
    if (!session.timer.endsAt) return session;
    const s = clone(session);
    s.timer.pausedRemainingSeconds = Math.max(0, Math.ceil((s.timer.endsAt - now()) / 1000));
    s.timer.endsAt = null;
    s.events.push(evt('pause', 'Dinâmica pausada.'));
    return s;
  }

  function resumeSession(session) {
    if (session.timer.pausedRemainingSeconds == null) return session;
    const s = clone(session);
    s.timer.endsAt = now() + s.timer.pausedRemainingSeconds * 1000;
    s.timer.pausedRemainingSeconds = null;
    s.events.push(evt('resume', 'Dinâmica retomada.'));
    return s;
  }

  function addTime(session, seconds) {
    const s = clone(session);
    const amount = Number(seconds || 0);
    if (s.timer.endsAt) s.timer.endsAt += amount * 1000;
    else if (s.timer.pausedRemainingSeconds != null) s.timer.pausedRemainingSeconds += amount;
    s.events.push(evt('timer', `${amount} segundos adicionados.`));
    return s;
  }

  function remainingSeconds(session, at = now()) {
    if (session.timer.pausedRemainingSeconds != null) return session.timer.pausedRemainingSeconds;
    if (!session.timer.endsAt) return 0;
    return Math.max(0, Math.ceil((session.timer.endsAt - at) / 1000));
  }

  function hasResources(team, input) {
    const i = team.inventory;
    return Number.isFinite(input.baseBars) && Number.isFinite(input.ribbons) &&
      i.baseBars >= input.baseBars && input.baseBars >= 0 &&
      Object.prototype.hasOwnProperty.call(i.wrappers, input.wrapper) && i.wrappers[input.wrapper] >= 1 &&
      i.ribbons >= input.ribbons && input.ribbons >= 0 &&
      i.tags >= (input.tag ? 1 : 0) && i.tulle >= (input.tulle ? 1 : 0);
  }

  function prepareItem(session, teamId, input, playerName) {
    if (session.phase !== 'production' || remainingSeconds(session) <= 0 || session.timer.pausedRemainingSeconds != null) {
      throw new Error('A produção não está ativa.');
    }
    const s = clone(session);
    const t = s.teams.find(x => x.id === teamId);
    if (!t) throw new Error('Equipe inválida.');
    if (!recipe(input.flavorId)) throw new Error('Sabor inválido.');
    if (t.attempts >= MAX_PRODUCTS) throw new Error('Limite de 50 produtos atingido.');
    if (!hasResources(t, input)) throw new Error('Recursos insuficientes para essa montagem.');
    t.inventory.baseBars -= input.baseBars;
    t.inventory.wrappers[input.wrapper] -= 1;
    t.inventory.ribbons -= input.ribbons;
    t.inventory.tags -= input.tag ? 1 : 0;
    t.inventory.tulle -= input.tulle ? 1 : 0;
    t.prepared.push({ ...input, id: uid(), createdAt: now(), createdBy: playerName });
    t.attempts += 1;
    return s;
  }

  function penalize(team, code, label, items) {
    team.penalties.push({ id: uid(), at: now(), code, label, flavorIds: items.map(i => i.flavorId), quantity: items.length });
  }

  function startFreezer(session, teamId, itemIds) {
    if (session.phase !== 'production' || remainingSeconds(session) <= 0 || session.timer.pausedRemainingSeconds != null) throw new Error('A produção não está ativa.');
    if (!Array.isArray(itemIds) || !itemIds.length) throw new Error('Selecione pelo menos uma barra.');
    const s = clone(session);
    const t = s.teams.find(x => x.id === teamId);
    if (!t) throw new Error('Equipe inválida.');
    if (t.freezer) throw new Error('O freezer já está em uso.');
    const selected = t.prepared.filter(i => itemIds.includes(i.id));
    if (!selected.length) throw new Error('Nenhuma barra válida foi selecionada.');
    t.prepared = t.prepared.filter(i => !itemIds.includes(i.id));

    if (selected.length > s.freezerCapacity) {
      penalize(t, '02', `Mais de ${s.freezerCapacity} barras no freezer`, selected);
      return s;
    }

    const times = new Set(selected.map(i => recipe(i.flavorId).coolingSeconds));
    if (times.size > 1) {
      penalize(t, '03', 'Barras com tempos diferentes no mesmo ciclo', selected);
      return s;
    }

    const malformed = selected.filter(i => {
      const r = recipe(i.flavorId);
      return i.baseBars !== r.baseBars || i.wrapper !== r.wrapper || i.ribbons !== r.ribbons || i.tag !== r.tag || i.tulle !== r.tulle;
    });
    if (malformed.length) {
      penalize(t, '05', 'Barra colocada no freezer sem montagem correta', malformed);
      const valid = selected.filter(i => !malformed.some(m => m.id === i.id));
      t.prepared.push(...valid);
      return s;
    }

    const coolingSeconds = recipe(selected[0].flavorId).coolingSeconds;
    t.freezer = { id: uid(), items: selected, startedAt: now(), endsAt: now() + coolingSeconds * 1000, coolingSeconds };
    return s;
  }

  function pullEarly(session, teamId, itemId) {
    const s = clone(session);
    const t = s.teams.find(x => x.id === teamId);
    if (!t || !t.freezer) return s;
    const item = t.freezer.items.find(i => i.id === itemId);
    if (!item) return s;
    t.freezer.items = t.freezer.items.filter(i => i.id !== itemId);
    if (!t.freezer.items.length) t.freezer = null;
    penalize(t, '04', 'Retirada antes do tempo mínimo', [item]);
    return s;
  }

  function settleFreezers(session, at = now()) {
    const s = clone(session);
    let changed = false;
    for (const t of s.teams) {
      if (t.freezer && t.freezer.endsAt <= at) {
        t.completed.push(...t.freezer.items.map(i => ({ id: i.id, flavorId: i.flavorId, completedAt: at })));
        t.freezer = null;
        changed = true;
      }
    }
    return changed ? s : session;
  }

  function applyIntervention(session, kind) {
    if (session.mode !== 'pressure') throw new Error('Intervenções existem apenas na Panela de Pressão.');
    if (!Object.prototype.hasOwnProperty.call(session.interventions, kind)) throw new Error('Intervenção inválida.');
    if (session.interventions[kind]) return session;
    const s = clone(session);

    if (kind === 'marketUpdate') {
      s.berriesPoints = 3;
      s.interventions.marketUpdate = true;
      s.events.push(evt('intervention', 'Atualização de mercado: Frutas Vermelhas agora valem 3 pontos.'));
      return s;
    }

    if (kind === 'freezerReduction') {
      s.freezerCapacity = 2;
      s.interventions.freezerReduction = true;
      s.events.push(evt('intervention', 'Capacidade do freezer reduzida para 2 barras por ciclo.'));
      return s;
    }

    const movers = s.teams.map(t => t.players.find(p => p.role === 'participant')).filter(Boolean);
    if (movers.length < 2) throw new Error('São necessários participantes em pelo menos duas equipes.');
    const moves = [];
    s.teams.forEach((team, index) => {
      const person = team.players.find(p => p.role === 'participant');
      if (!person) return;
      team.players = team.players.filter(p => p.id !== person.id);
      const target = s.teams[(index + 1) % s.teams.length];
      target.players.push(person);
      moves.push(`${person.name}: ${team.name} → ${target.name}`);
    });
    s.interventions.talentShare = true;
    s.events.push(evt('intervention', `Compartilhamento de talentos: ${moves.join(' · ')}`));
    return s;
  }

  function scoreTeam(team, berriesPoints = 5) {
    const counts = Object.fromEntries(RECIPES.map(r => [r.id, 0]));
    team.completed.forEach(i => { if (counts[i.flavorId] != null) counts[i.flavorId] += 1; });
    const standardsOk = counts.milk >= STANDARD_MINIMUM && counts.dark >= STANDARD_MINIMUM && counts.white >= STANDARD_MINIMUM;
    const standardScore = counts.milk + counts.dark + counts.white;
    const premiumScore = standardsOk ? (counts.pistachio * 3 + counts.berries * berriesPoints + counts.caramel * 7) : 0;
    return { counts, standardsOk, standardScore, premiumScore, total: standardScore + premiumScore };
  }

  return {
    createSession, joinSession, renameTeam, setEntries, startPhase, pauseSession, resumeSession,
    addTime, remainingSeconds, prepareItem, startFreezer, pullEarly, settleFreezers,
    applyIntervention, scoreTeam
  };
});
