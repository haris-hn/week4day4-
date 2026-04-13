import React, { useState } from 'react';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';
import { SocketProvider } from './hooks/useSocket';

function App() {
  const [user, setUser] = useState(null);

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={setUser} />
      ) : (
        <SocketProvider>
          <ChatRoom user={user} onLogout={() => setUser(null)} onUpdateUser={setUser} />
        </SocketProvider>
      )}
    </div>
  );
}

export default App;
