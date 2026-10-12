// DARKNOTE web — router + guards

import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api';
import { useApp } from './store';
import { useSocket } from './socket';
import { AuthEntry } from './screens/AuthEntry';
import { Verify } from './screens/Verify';
import { ProfileSetup } from './screens/ProfileSetup';
import { Welcome } from './screens/Welcome';
import { Shell } from './screens/Shell';
import { Home } from './screens/Home';
import { Updates } from './screens/Updates';
import { Chats } from './screens/Chats';
import { Conversation } from './screens/Conversation';
import { Calls } from './screens/Calls';
import { Contacts } from './screens/Contacts';
import { Settings } from './screens/Settings';
import { GamesHub } from './screens/GamesHub';
import { LudoMenu } from './screens/LudoMenu';
import { LudoGame } from './screens/LudoGame';
import { LudoRoomFlow } from './screens/LudoRoomFlow';

export function App() {
  const { user, onboarded, refreshMe } = useApp();
  const { connected } = useSocket();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    refreshMe().finally(() => setReady(true));
  }, [refreshMe]);

  if (!ready) {
    return <div className="auth-wrap"><div className="auth-logo">DARKNOTE</div></div>;
  }

  const authed = !!getToken();

  if (!authed) {
    return (
      <Routes>
        <Route path="/verify" element={<Verify />} />
        <Route path="*" element={<AuthEntry />} />
      </Routes>
    );
  }

  // authenticated routes
  return (
    <>
      <Routes>
        <Route path="/setup" element={user && !onboarded ? <ProfileSetup /> : <Navigate to="/" replace />} />
        <Route path="/welcome" element={user && onboarded ? <Welcome /> : <Navigate to="/" replace />} />
        <Route
          path="/app/*"
          element={
            !onboarded ? (
              <Navigate to="/setup" replace />
            ) : (
              <Shell>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/updates" element={<Updates />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/chats/:chatId" element={<Conversation />} />
                  <Route path="/calls" element={<Calls />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/settings/*" element={<Settings />} />
                  <Route path="/games" element={<GamesHub />} />
                  <Route path="/games/ludo" element={<LudoMenu />} />
                  <Route path="/games/ludo/play" element={<LudoGame mode="local" />} />
                  <Route path="/games/ludo/room" element={<LudoRoomFlow />} />
                  <Route path="/games/ludo/room/:code" element={<LudoRoomFlow />} />
                </Routes>
              </Shell>
            )
          }
        />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      {!connected && <div className="pill warn" style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 70 }}>Connecting…</div>}
    </>
  );
}
