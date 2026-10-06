import { useMemo, useState, useSyncExternalStore } from 'react';
import { hashString } from '@dc-chatbot/core';
import { createDemoStore, toMember } from './sandbox.js';
import { CHANNELS, ROLES } from './seed.js';

const AVATAR_COLORS = ['#E67E22', '#1ABC9C', '#9B59B6', '#E91E63', '#3498DB', '#2ECC71', '#F1C40F'];

/** Conecta React con el store del sandbox y prepara búsquedas para el renderizado. */
export function useDemo(options) {
  const [store] = useState(() => createDemoStore(options));
  const state = useSyncExternalStore(store.subscribe, store.getState);

  const lookup = useMemo(() => {
    const members = new Map(
      state.members.map((m) => [
        m.id,
        { ...m, color: m.bot ? '#F2F3F5' : toMember(m).color, avatarColor: AVATAR_COLORS[hashString(m.id) % AVATAR_COLORS.length] },
      ]),
    );
    for (const b of state.bans) if (!members.has(b.id)) members.set(b.id, { id: b.id, name: b.name, banned: true });
    return {
      member: (id) => members.get(id) ?? (id === 'system' ? { id, name: 'Sistema' } : null),
      channel: (id) => CHANNELS.find((c) => c.id === id),
      role: (id) => ROLES.find((r) => r.id === id),
      message: (channelId, id) => state.messages[channelId]?.find((m) => m.id === id),
    };
  }, [state]);

  return { store, state, lookup };
}
