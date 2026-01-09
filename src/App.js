import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import io from 'socket.io-client';
import Home from "./components/Home";
import PageAcceuil from "./components/PageAcceuil";
import Ulterieure from "./components/Ulterieure";
import MgLabo from "./components/MGLabo";
import MgCaisse from "./components/MGCaisse";
import MgPrint from "./components/MGPrint";
import Filtre from "./components/Filtre";
import Administration from "./components/Administration";
import MgApercuConsult from "./components/MGApercuConsult";
import MgConsult from "./components/MGConsult";
import MgSpecialities from "./components/MGSpecialities";
import MgJournaux from './components/MgJournaux';
import FloatingList from './components/FloatingList';
import FloatingDoc from './components/FloatingDoc';

function App() {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    console.log('🔄 Initialisation de la connexion Socket.io...');
    
    // Déterminer l'URL du serveur en fonction de l'environnement
    const serverUrl = window.location.origin.includes('localhost') 
      ? 'http://localhost:4600' 
      : window.location.origin;

    console.log('🔗 Tentative de connexion à:', serverUrl);

    const socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Gestion des événements de connexion
    socketInstance.on('connect', () => {
      console.log('✅ Connecté au serveur Socket.io');
      console.log('📡 Socket ID:', socketInstance.id);
      setConnectionStatus('connected');
      setConnectionError(null);
      
      // Tester la connexion immédiatement
      socketInstance.emit('test_connection', (response) => {
        if (response && response.success) {
          console.log('🧪 Test de connexion réussi:', response.message);
        }
      });
    });

    socketInstance.on('connected', (data) => {
      console.log('📡 Message de bienvenue du serveur:', data.message);
    });

    socketInstance.on('server_info', (data) => {
      console.log('🏠 Informations du serveur:', data);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ Erreur de connexion Socket.io:', error.message);
      console.error('📋 Détails de l\'erreur:', error);
      setConnectionStatus('error');
      setConnectionError({
        message: 'Impossible de se connecter au serveur.',
        details: error.message,
        serverUrl: serverUrl
      });
      
      // Essayer de se reconnecter après un délai
      setTimeout(() => {
        console.log('🔄 Tentative de reconnexion...');
        socketInstance.connect();
      }, 3000);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('⚠️ Déconnecté:', reason);
      setConnectionStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        setConnectionError('Déconnecté par le serveur. Essayez de vous reconnecter.');
      } else if (reason === 'io client disconnect') {
        console.log('🔌 Déconnexion volontaire');
      } else {
        setConnectionError('Connexion perdue. Reconnexion en cours...');
      }
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnexion réussie après', attemptNumber, 'tentatives');
      setConnectionStatus('connected');
      setConnectionError(null);
    });

    socketInstance.on('reconnecting', (attemptNumber) => {
      console.log('🔄 Tentative de reconnexion', attemptNumber);
      setConnectionStatus('reconnecting');
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('❌ Échec de reconnexion');
      setConnectionStatus('error');
      setConnectionError('Échec de reconnexion au serveur. Veuillez rafraîchir la page.');
    });

    // Écouter les événements généraux
    socketInstance.on('identification_confirmed', (data) => {
      console.log('👤 Identification confirmée:', data.user.username);
    });

    socketInstance.on('examens_config_updated', () => {
      console.log('📋 Configuration des examens mise à jour');
    });

    // Stocker l'instance de socket
    setSocket(socketInstance);

    // Nettoyage
    return () => {
      console.log('🧹 Nettoyage de la connexion Socket.io');
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  // Afficher un écran de chargement ou d'erreur
  if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        color: '#007bff',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <h1>Connexion au serveur en cours...</h1>
        <p>Veuillez patienter pendant que nous établissons la connexion.</p>
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#6c757d' }}>
          {connectionStatus === 'reconnecting' && 'Tentative de reconnexion...'}
        </div>
      </div>
    );
  }

  if (connectionStatus === 'error' && connectionError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        color: '#dc3545',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
        <h1>Erreur de Connexion</h1>
        <p style={{ marginBottom: '10px' }}>{connectionError.message}</p>
        {connectionError.details && (
          <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '20px' }}>
            Détails: {connectionError.details}
          </p>
        )}
        
        <div style={{ marginTop: '20px', textAlign: 'left', maxWidth: '600px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0 }}>🔧 Solutions possibles :</h3>
          <ol style={{ textAlign: 'left' }}>
            <li>Vérifiez que le serveur backend est démarré</li>
            <li>Ouvrez un terminal et exécutez : <code>node server.js</code></li>
            <li>Vérifiez que le serveur écoute sur le port 4600</li>
            <li>Assurez-vous que le serveur est accessible depuis : {connectionError.serverUrl}</li>
            <li>Vérifiez votre connexion internet</li>
            <li>Essayez d'actualiser la page</li>
          </ol>
        </div>
        
        <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            🔄 Rafraîchir la page
          </button>
          
          <button 
            onClick={() => {
              if (socket) socket.connect();
              setConnectionStatus('connecting');
              setConnectionError(null);
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            🔌 Réessayer la connexion
          </button>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#fff3cd',
        color: '#856404',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h1>Connexion perdue</h1>
        <p>La connexion au serveur a été interrompue.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#856404',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Reconnecter
        </button>
      </div>
    );
  }

  // Afficher l'application normale lorsque connecté
  return (
    <BrowserRouter>
      <div>
        {/* Bandeau de statut de connexion */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: connectionStatus === 'connected' ? '#28a745' : '#ffc107',
          color: 'white',
          padding: '8px',
          textAlign: 'center',
          fontSize: '12px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>
            {connectionStatus === 'connected' ? '✅ Connecté' : '⚠️ Connexion instable'}
          </span>
          {socket && (
            <span style={{ fontSize: '10px', opacity: 0.8 }}>
              ID: {socket.id ? socket.id.substring(0, 8) + '...' : 'N/A'}
            </span>
          )}
        </div>

        <div style={{ paddingTop: '30px' }}>
          <Routes>
            <Route path="/" element={<Home socket={socket} />} />
            <Route path="/PageAcceuil" element={<PageAcceuil socket={socket} />} />
            <Route path="/Ulterieure" element={<Ulterieure socket={socket} />} />
            <Route path="/Administration" element={<Administration socket={socket} />} />
            <Route path="/MgLabo" element={<MgLabo socket={socket} />} />
            <Route path="/MgCaisse" element={<MgCaisse socket={socket} />} />
            <Route path="/MgPrint" element={<MgPrint socket={socket} />} />
            <Route path="/MgApercuConsult" element={<MgApercuConsult socket={socket} />} />
            <Route path="/MgJournaux" element={<MgJournaux socket={socket} />} />
            <Route path="/MgConsult" element={<MgConsult socket={socket} />} />
            <Route path="/MgSpecialities" element={<MgSpecialities socket={socket} />} />
            <Route path="/Filtre" element={<Filtre socket={socket} />} />
            <Route path="/FloatingList" element={<FloatingList socket={socket} />} />
            <Route path="/FloatingDoc" element={<FloatingDoc socket={socket} />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
