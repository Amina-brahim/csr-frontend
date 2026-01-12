import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import LogoCsr from './images/logo_csr.png';
import io from "socket.io-client";
import "./AnalysesTable.css";

const MgLabo = () => {
  const [analyses, setAnalyses] = useState([]);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  // URL du backend selon l'environnement
  const BACKEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://csr-backend-production.onrender.com'  // Production
    : 'http://localhost:4600';                        // Développement local

  // Convertit le code numérique en texte (pour l'affichage initial)
  const mapLaboStatus = (code) => {
    if (typeof code === 'string') return code; // Déjà en texte
    
    const statusMap = {
      0: "En attente",
      1: "En cours",
      2: "Terminé",
      3: "Annulé",
    };
    return statusMap[code] || "En attente";
  };

  // Convertit le texte en code numérique (pour l'envoi au serveur)
  const mapStatusToCode = (statusText) => {
    const statusMap = {
      "En attente": 0,
      "En cours": 1,
      "Terminé": 2,
      "Annulé": 3
    };
    return statusMap[statusText] || 0;
  };

  // Fonction pour formater les examens
  const formaterExamens = (examens) => {
    if (!examens || !Array.isArray(examens)) return 'Aucun examen';
    
    // Si c'est un tableau d'objets
    if (examens.length > 0 && typeof examens[0] === 'object') {
      return examens.map(examen => examen.name || 'Examen inconnu').join(', ');
    }
    
    // Si c'est un tableau de strings
    return examens.join(', ');
  };

  // Fonction pour formater les services
  const formaterServices = (services) => {
    if (!services || !Array.isArray(services)) return 'Aucun service';
    
    // Si c'est un tableau d'objets
    if (services.length > 0 && typeof services[0] === 'object') {
      return services.map(service => service.name || service.value || 'Service inconnu').join(', ');
    }
    
    // Si c'est un tableau de strings
    return services.join(', ');
  };

  useEffect(() => {
    console.log('🔌 Tentative de connexion au backend:', BACKEND_URL);
    console.log('🌍 Environnement:', process.env.NODE_ENV);
    
    const newSocket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      path: '/socket.io/'
    });

    setSocket(newSocket);

    // Gestion des événements de connexion
    newSocket.on('connect', () => {
      console.log('✅ Connecté au serveur Socket.io');
      setConnectionStatus('connected');
      setErrorMessage('');
      
      // S'identifier comme service Laboratoire
      newSocket.emit('user_identification', {
        username: 'Labo',
        service: 'Laboratoire'
      });
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erreur de connexion:', error.message);
      setConnectionStatus('error');
      setErrorMessage(`Impossible de se connecter au serveur: ${error.message}`);
      
      // Afficher plus d'informations pour le débogage
      console.error('URL tentée:', BACKEND_URL);
      console.error('Détails de l\'erreur:', error);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Déconnecté:', reason);
      setConnectionStatus('disconnected');
      if (reason === 'io server disconnect') {
        setErrorMessage('Déconnecté par le serveur');
      }
    });

    newSocket.on('identification_confirmed', (data) => {
      console.log('✅ Identification confirmée:', data.message);
    });

    newSocket.on('identification_failed', (data) => {
      console.error('❌ Identification échouée:', data.message);
      setErrorMessage(`Identification échouée: ${data.message}`);
    });

    // Écouter les nouvelles analyses
    newSocket.on("nouveau_patient", (newData) => {
      console.log("Nouveau patient reçu:", newData);
      setAnalyses((prevAnalyses) => {
        // Vérifie si l'analyse existe déjà via numID_CSR
        const existingIndex = prevAnalyses.findIndex(
          (a) => a.numID_CSR === newData.numID_CSR
        );

        if (existingIndex >= 0) {
          // Mise à jour si le patient existe
          const updatedAnalyses = [...prevAnalyses];
          updatedAnalyses[existingIndex] = newData;
          console.log("Patient mis à jour:", updatedAnalyses[existingIndex]);
          return updatedAnalyses;
        } else {
          // Ajout cumulatif si nouveau patient
          console.log("Nouveau patient ajouté:", newData);
          return [...prevAnalyses, newData];
        }
      });
    });

    // Écouter les mises à jour de statut du serveur
    newSocket.on("Etat Analyses Mis à Jour", (data) => {
      console.log("Mise à jour reçue du serveur:", data);
      setAnalyses(prev => 
        prev.map(item => {
          if (item.numID_CSR === data.numID_CSR) {
            console.log("Item mis à jour:", data);
            return { ...item, ...data };
          }
          return item;
        })
      );
    });

    // Écouter les messages généraux du serveur
    newSocket.on('server_info', (data) => {
      console.log('📡 Infos du serveur:', data);
    });

    // Écouter les erreurs
    newSocket.on("error", (error) => {
      console.error("Erreur de socket:", error);
      setErrorMessage(`Erreur Socket.io: ${error.message}`);
    });

    // Nettoyer à la déconnexion
    return () => {
      if (newSocket && newSocket.connected) {
        newSocket.disconnect();
      }
    };
  }, []);

  // Envoie les mises à jour au serveur
  const handleStatusChange = async (numID_CSR, newStatusText) => {
    if (connectionStatus !== 'connected') {
      setErrorMessage('Non connecté au serveur. Impossible de mettre à jour le statut.');
      return;
    }
    
    const newCode = mapStatusToCode(newStatusText);
    
    console.log("Changement de statut:", { numID_CSR, newStatusText, newCode });
    
    // Mise à jour optimiste locale
    setAnalyses(prev =>
      prev.map(item =>
        item.numID_CSR === numID_CSR
          ? { ...item, isLaboratorized: newStatusText }
          : item
      )
    );
    
    // Envoi au serveur avec numID_CSR
    try {
      if (socket && socket.connected) {
        socket.emit("update_status", {
          numID_CSR: numID_CSR,
          isLaboratorized: newCode
        });
        console.log("Statut envoyé au serveur");
      } else {
        console.error("Socket non disponible ou déconnecté");
        setErrorMessage('Connexion perdue. Veuillez rafraîchir la page.');
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi au serveur:", error);
      setErrorMessage(`Erreur d'envoi: ${error.message}`);
      // Revertir en cas d'erreur
      setAnalyses(prev =>
        prev.map(item =>
          item.numID_CSR === numID_CSR
            ? { ...item, isLaboratorized: item.isLaboratorized }
            : item
        )
      );
    }
    
    if (newStatusText === "Terminé") {
      // Suppression de l'analyse lorsqu'elle est terminée après un court délai
      setTimeout(() => {
        setAnalyses(prev => prev.filter(item => item.numID_CSR !== numID_CSR));
      }, 500);
    }
  };

  // Afficher l'état de connexion
  const renderConnectionStatus = () => {
    switch(connectionStatus) {
      case 'connecting':
        return (
          <div className="connection-status connecting">
            ⏳ Connexion au serveur en cours...
          </div>
        );
      case 'connected':
        return (
          <div className="connection-status connected">
            ✅ Connecté au serveur ({analyses.length} analyses)
          </div>
        );
      case 'error':
        return (
          <div className="connection-status error">
            ❌ {errorMessage}
            <button 
              onClick={() => window.location.reload()} 
              className="retry-button"
            >
              🔄 Réessayer
            </button>
          </div>
        );
      case 'disconnected':
        return (
          <div className="connection-status disconnected">
            ⚠️ Déconnecté du serveur
            <button 
              onClick={() => window.location.reload()} 
              className="retry-button"
            >
              🔌 Reconnecter
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="entete TC">
        <div className="marges_logo_5px">
          <img className='logo_clinique marges_logo_5px' src={LogoCsr} alt="Tchad" id="logo" />
        </div>
        <div className='titre_entete'>
          <h2 className='titre_entete'>CSR - N'Djamena - TCHAD</h2>
          <h3 className='sous_titre_entete'>Laboratoire d'Analyses Médicale</h3>
          <br />
          <h2 className='sous_titre_entete'>File des travaux techniques</h2>
        </div>
      </div>

      {/* Bandeau d'état de connexion */}
      <div style={{ 
        padding: '10px', 
        margin: '10px 20px', 
        borderRadius: '5px',
        backgroundColor: connectionStatus === 'connected' ? '#d4edda' : 
                        connectionStatus === 'error' ? '#f8d7da' : 
                        connectionStatus === 'connecting' ? '#fff3cd' : '#ffeaa7',
        color: connectionStatus === 'connected' ? '#155724' : 
               connectionStatus === 'error' ? '#721c24' : 
               connectionStatus === 'connecting' ? '#856404' : '#856404',
        border: `1px solid ${
          connectionStatus === 'connected' ? '#c3e6cb' : 
          connectionStatus === 'error' ? '#f5c6cb' : 
          connectionStatus === 'connecting' ? '#ffeaa7' : '#ffeaa7'
        }`
      }}>
        {renderConnectionStatus()}
        {connectionStatus === 'error' && (
          <div style={{ marginTop: '10px', fontSize: '14px' }}>
            <strong>URL du backend:</strong> {BACKEND_URL}<br />
            <strong>Environnement:</strong> {process.env.NODE_ENV || 'development'}
          </div>
        )}
      </div>

      <div className="table-container">
        <table className="analyses-table">
          <thead>
            <tr>
              <th className="col-numero">N° Client</th>
              <th className="col-nom">Nom Patient</th>
              <th className="col-csr">CSR ID</th>
              <th className="col-examens">Examens Demandés</th>
              <th className="col-statut">Statut Laboratoire</th>
            </tr>
          </thead>
          <tbody>
            {analyses.length > 0 ? (
              analyses.map((item) => (
                <tr key={item.numID_CSR} className="patient-row">
                  <td className="col-numero">{item.numClient}</td>
                  <td className="col-nom">{item.nomClient || 'Non spécifié'}</td>
                  <td className="col-csr">{item.numID_CSR}</td>
                  
                  <td className="col-examens">
                    <div className="examens-list">
                      {formaterExamens(item.examensSelectionnes || item.examensDetails)}
                    </div>
                  </td>
                  <td className="col-statut">
                    <select
                      value={mapLaboStatus(item.isLaboratorized)}
                      onChange={(e) =>
                        handleStatusChange(item.numID_CSR, e.target.value)
                      }
                      className={`etatLabo status-${mapLaboStatus(item.isLaboratorized).toLowerCase().replace(' ', '-')}`}
                      disabled={connectionStatus !== 'connected'}
                    >
                      {["En attente", "En cours", "Terminé", "Annulé"].map(
                        (option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        )
                      )}
                    </select>
                    <div className="status-indicator">
                      {mapLaboStatus(item.isLaboratorized)}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="no-data">
                  <div className="empty-state">
                    <span className="empty-icon">🔬</span>
                    <h3>
                      {connectionStatus === 'connected' 
                        ? 'Aucune analyse en attente' 
                        : 'En attente de connexion...'}
                    </h3>
                    <p>
                      {connectionStatus === 'connected' 
                        ? 'Les nouvelles analyses apparaitront ici automatiquement' 
                        : 'Vérifiez la connexion au serveur'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ajouter du CSS pour les états de connexion */}
      <style>{`
        .connection-status {
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .connection-status.connecting {
          background-color: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        }
        .connection-status.connected {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .connection-status.error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .connection-status.disconnected {
          background-color: #ffeaa7;
          color: #856404;
          border: 1px solid #ffd166;
        }
        .retry-button {
          margin-left: 10px;
          padding: 5px 15px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 14px;
        }
        .retry-button:hover {
          background-color: #0056b3;
        }
      `}</style>
    </>
  );
};

export default MgLabo;
