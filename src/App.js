import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { io } from 'socket.io-client';  // CORRECTION: import nommé
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
    
    // CORRECTION IMPORTANTE: URL du backend en production
    // Utilisez l'URL de votre backend Render
    const backendUrl = process.env.NODE_ENV === 'production'
      ? 'https://csr-backend-production.onrender.com'  // Votre backend Render
      : 'http://localhost:4600';  // Local
    
    console.log('🔗 Tentative de connexion à:', backendUrl);
    console.log('🌍 Environnement:', process.env.NODE_ENV);
    console.log('🔧 Variable d\'environnement API URL:', process.env.REACT_APP_API_URL);

    const socketInstance = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // Important pour CORS en production
      withCredentials: false,
      extraHeaders: {
        "Access-Control-Allow-Origin": "*"
      }
    });

    // Gestion des événements de connexion
    socketInstance.on('connect', () => {
      console.log('✅ Connecté au serveur Socket.io');
      console.log('📡 Socket ID:', socketInstance.id);
      console.log('🔌 URL du serveur:', backendUrl);
      setConnectionStatus('connected');
      setConnectionError(null);
      
      // Tester la connexion immédiatement
      socketInstance.emit('test_connection', (response) => {
        if (response && response.success) {
          console.log('🧪 Test de connexion réussi:', response.message);
        } else {
          console.warn('⚠️ Pas de réponse au test de connexion');
        }
      });
    });

    socketInstance.on('connected', (data) => {
      console.log('📡 Message de bienvenue du serveur:', data?.message || 'Bienvenue');
    });

    socketInstance.on('server_info', (data) => {
      console.log('🏠 Informations du serveur:', data);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ Erreur de connexion Socket.io:', error.message);
      console.error('📋 Type d\'erreur:', error.type);
      console.error('🌍 URL tentée:', backendUrl);
      setConnectionStatus('error');
      setConnectionError({
        message: 'Impossible de se connecter au serveur backend.',
        details: error.message,
        serverUrl: backendUrl,
        suggestion: 'Vérifiez que le serveur backend est en ligne et accessible.'
      });
      
      // Essayer de se reconnecter après un délai
      setTimeout(() => {
        console.log('🔄 Tentative de reconnexion dans 3 secondes...');
        if (socketInstance && !socketInstance.connected) {
          socketInstance.connect();
        }
      }, 3000);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('⚠️ Déconnecté. Raison:', reason);
      setConnectionStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        setConnectionError({
          message: 'Déconnecté par le serveur.',
          details: 'Le serveur a fermé la connexion.'
        });
      } else if (reason === 'io client disconnect') {
        console.log('🔌 Déconnexion volontaire');
      } else {
        setConnectionError({
          message: 'Connexion perdue.',
          details: `Raison: ${reason}`
        });
      }
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnexion réussie après', attemptNumber, 'tentative(s)');
      setConnectionStatus('connected');
      setConnectionError(null);
    });

    socketInstance.on('reconnecting', (attemptNumber) => {
      console.log('🔄 Tentative de reconnexion n°', attemptNumber);
      setConnectionStatus('reconnecting');
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('❌ Échec de reconnexion après toutes les tentatives');
      setConnectionStatus('error');
      setConnectionError({
        message: 'Échec de reconnexion au serveur.',
        details: 'Veuillez rafraîchir la page.'
      });
    });

    // Écouter les événements généraux
    socketInstance.on('identification_confirmed', (data) => {
      console.log('👤 Identification confirmée:', data?.user?.username || 'Utilisateur');
    });

    socketInstance.on('examens_config_updated', () => {
      console.log('📋 Configuration des examens mise à jour');
    });

    // Stocker l'instance de socket dans l'état
    setSocket(socketInstance);

    // Nettoyage
    return () => {
      console.log('🧹 Nettoyage de la connexion Socket.io');
      if (socketInstance && socketInstance.connected) {
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
        <div style={{ 
          marginTop: '30px', 
          padding: '15px',
          backgroundColor: '#e9ecef',
          borderRadius: '8px',
          maxWidth: '500px',
          textAlign: 'left'
        }}>
          <p><strong>Informations de connexion:</strong></p>
          <ul style={{ textAlign: 'left', paddingLeft: '20px' }}>
            <li>Environnement: {process.env.NODE_ENV}</li>
            <li>Backend URL: {process.env.NODE_ENV === 'production' 
              ? 'https://csr-backend-production.onrender.com' 
              : 'http://localhost:4600'}</li>
          </ul>
        </div>
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
        <p style={{ marginBottom: '10px', fontSize: '18px' }}>
          {connectionError.message}
        </p>
        {connectionError.details && (
          <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '20px' }}>
            Détails: {connectionError.details}
          </p>
        )}
        
        <div style={{ 
          marginTop: '20px', 
          textAlign: 'left', 
          maxWidth: '600px', 
          backgroundColor: '#fff', 
          padding: '20px', 
          borderRadius: '8px', 
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginTop: 0, color: '#343a40' }}>🔧 Solutions possibles :</h3>
          <ol style={{ textAlign: 'left', color: '#495057' }}>
            <li><strong>Vérifiez que le serveur backend est démarré</strong></li>
            <li>URL du backend: <code>{connectionError.serverUrl}</code></li>
            <li>Ouvrez un terminal et exécutez : <code>node server.js</code></li>
            <li>Assurez-vous que le serveur écoute sur le bon port (4600 en local)</li>
            <li>Vérifiez votre connexion internet</li>
            <li>En production, vérifiez que votre backend Render est en ligne</li>
          </ol>
          
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            backgroundColor: '#fff3cd', 
            borderRadius: '4px',
            border: '1px solid #ffeaa7'
          }}>
            <strong>💡 Pour le déploiement Render:</strong>
            <p style={{ margin: '5px 0', fontSize: '14px' }}>
              Votre backend doit être accessible à: <br/>
              <code>https://csr-backend-production.onrender.com</code>
            </p>
          </div>
        </div>
        
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            🔄 Rafraîchir la page
          </button>
          
          <button 
            onClick={() => {
              if (socket) {
                socket.connect();
                setConnectionStatus('connecting');
                setConnectionError(null);
              } else {
                window.location.reload();
              }
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            🔌 Réessayer la connexion
          </button>
          
          <button 
            onClick={() => {
              // Ouvrir l'URL du backend dans un nouvel onglet
              window.open(connectionError.serverUrl + '/health', '_blank');
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            🌐 Tester le backend
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
          onClick={() => {
            if (socket) {
              socket.connect();
              setConnectionStatus('connecting');
            } else {
              window.location.reload();
            }
          }}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: '#856404',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          🔌 Reconnecter
        </button>
      </div>
    );
  }

  // Afficher l'application normale lorsque connecté
  return (
    <BrowserRouter>
      <div>
        {/* Bandeau de statut de connexion */}
        {connectionStatus === 'connected' && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: '#28a745',
            color: 'white',
            padding: '8px',
            textAlign: 'center',
            fontSize: '12px',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '14px' }}>✅</span>
              <span>Connecté au serveur</span>
            </span>
            {socket && socket.id && (
              <span style={{ 
                fontSize: '10px', 
                opacity: 0.8,
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '2px 6px',
                borderRadius: '10px'
              }}>
                ID: {socket.id.substring(0, 8)}...
              </span>
            )}
          </div>
        )}

        <div style={{ paddingTop: connectionStatus === 'connected' ? '30px' : '0' }}>
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
