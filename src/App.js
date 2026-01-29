import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { io } from 'socket.io-client';
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
  const [isConnected, setIsConnected] = useState(false);
  const connectionAttempts = useRef(0);
  const maxReconnectionAttempts = 10;

  useEffect(() => {
    console.log('🔄 Initialisation silencieuse de la connexion Socket.io...');
    
    // URL du backend
    const backendUrl = process.env.NODE_ENV === 'production'
      ? 'https://csr-backend-production.onrender.com'
      : 'http://localhost:4600';
    
    const socketInstance = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectionAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: false,
      autoConnect: true, // Connexion automatique
      extraHeaders: {
        "Access-Control-Allow-Origin": "*"
      }
    });

    // Connexion réussie
    socketInstance.on('connect', () => {
      console.log('✅ Connecté au serveur Socket.io');
      setIsConnected(true);
      connectionAttempts.current = 0; // Réinitialiser le compteur
      
      // Test silencieux de connexion
      socketInstance.emit('test_connection', (response) => {
        if (response && response.success) {
          console.log('🧪 Test de connexion réussi');
        }
      });
    });

    // Messages du serveur (silencieux dans la console seulement)
    socketInstance.on('connected', (data) => {
      console.log('📡 Serveur:', data?.message || 'Connecté');
    });

    socketInstance.on('server_info', (data) => {
      console.log('🏠 Informations serveur:', data);
    });

    // Erreur de connexion - gérée silencieusement
    socketInstance.on('connect_error', (error) => {
      connectionAttempts.current++;
      console.log(`❌ Tentative de connexion ${connectionAttempts.current}/${maxReconnectionAttempts} échouée`);
      
      if (connectionAttempts.current >= maxReconnectionAttempts) {
        console.error('🚫 Échec de connexion après toutes les tentatives');
        // On continue sans socket - l'application fonctionnera en mode hors ligne
      }
    });

    // Déconnexion - gérée silencieusement
    socketInstance.on('disconnect', (reason) => {
      console.log('⚠️ Déconnecté:', reason);
      setIsConnected(false);
      
      // Tentative de reconnexion automatique
      if (reason !== 'io client disconnect') {
        setTimeout(() => {
          if (socketInstance && !socketInstance.connected) {
            console.log('🔄 Reconnexion automatique...');
            socketInstance.connect();
          }
        }, 3000);
      }
    });

    // Reconnexion réussie
    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnexion réussie après ${attemptNumber} tentatives`);
      setIsConnected(true);
    });

    // En cours de reconnexion
    socketInstance.on('reconnecting', (attemptNumber) => {
      console.log(`🔄 Tentative de reconnexion n°${attemptNumber}`);
    });

    // Échec de reconnexion
    socketInstance.on('reconnect_failed', () => {
      console.error('🚫 Échec de reconnexion');
      // L'application continue en mode hors ligne
    });

    // Événements applicatifs
    socketInstance.on('identification_confirmed', (data) => {
      console.log('👤 Identification confirmée');
    });

    socketInstance.on('examens_config_updated', () => {
      console.log('📋 Configuration mise à jour');
    });

    // Stocker l'instance de socket
    setSocket(socketInstance);

    // Nettoyage
    return () => {
      console.log('🧹 Nettoyage connexion Socket.io');
      if (socketInstance && socketInstance.connected) {
        socketInstance.disconnect();
      }
    };
  }, []);

  // Toujours afficher l'application, même sans connexion
  return (
    <BrowserRouter>
      <div>
        {/* Indicateur discret de connexion (optionnel, peut être retiré) */}
        {isConnected && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            backgroundColor: '#28a745',
            zIndex: 1000,
            opacity: 0.7
          }} />
        )}

        {/* Indicateur discret de déconnexion (optionnel) */}
        {!isConnected && socket && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            backgroundColor: '#ff6b6b',
            zIndex: 1000,
            opacity: 0.7
          }} />
        )}

        <Routes>
          <Route path="/" element={<Home socket={socket} isConnected={isConnected} />} />
          <Route path="/PageAcceuil" element={<PageAcceuil socket={socket} isConnected={isConnected} />} />
          <Route path="/Ulterieure" element={<Ulterieure socket={socket} isConnected={isConnected} />} />
          <Route path="/Administration" element={<Administration socket={socket} isConnected={isConnected} />} />
          <Route path="/MgLabo" element={<MgLabo socket={socket} isConnected={isConnected} />} />
          <Route path="/MgCaisse" element={<MgCaisse socket={socket} isConnected={isConnected} />} />
          <Route path="/MgPrint" element={<MgPrint socket={socket} isConnected={isConnected} />} />
          <Route path="/MgApercuConsult" element={<MgApercuConsult socket={socket} isConnected={isConnected} />} />
          <Route path="/MgJournaux" element={<MgJournaux socket={socket} isConnected={isConnected} />} />
          <Route path="/MgConsult" element={<MgConsult socket={socket} isConnected={isConnected} />} />
          <Route path="/MgSpecialities" element={<MgSpecialities socket={socket} isConnected={isConnected} />} />
          <Route path="/Filtre" element={<Filtre socket={socket} isConnected={isConnected} />} />
          <Route path="/FloatingList" element={<FloatingList socket={socket} isConnected={isConnected} />} />
          <Route path="/FloatingDoc" element={<FloatingDoc socket={socket} isConnected={isConnected} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
