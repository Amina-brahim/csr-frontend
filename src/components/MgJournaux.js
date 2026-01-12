import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import LogoCsr from './images/logo_csr.png';
import '../caisse.css';

const MgJournaux = ({ socket }) => {
  const navigate = useNavigate();
  const [donnees, setDonnees] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [donneesFiltrees, setDonneesFiltrees] = useState([]);
  const [serviceSelectionne, setServiceSelectionne] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(socket?.connected ? 'connected' : 'disconnected');

  // Surveiller l'état de la connexion socket
  useEffect(() => {
    if (!socket) {
      setErreur("Socket non disponible");
      setConnectionStatus('error');
      return;
    }

    const handleConnect = () => {
      console.log('✅ MgJournaux: Socket connecté');
      setConnectionStatus('connected');
      setErreur(null);
    };

    const handleDisconnect = () => {
      console.log('⚠️ MgJournaux: Socket déconnecté');
      setConnectionStatus('disconnected');
      setErreur('Connexion au serveur perdue');
    };

    const handleConnectError = (error) => {
      console.error('❌ MgJournaux: Erreur de connexion socket', error);
      setConnectionStatus('error');
      setErreur(`Erreur de connexion: ${error.message}`);
    };

    // Écouter les événements de connexion
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Nettoyer les écouteurs
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket]);

  // Fonction pour formater la date de manière sécurisée
  const formaterDate = (patient) => {
    const dateSource = patient.dateCreation || 
                      patient.dateModification || 
                      patient.lastUpdate || 
                      patient.journalEntryDate ||
                      patient.dateService;
    
    if (!dateSource) return 'N/A';

    try {
      const dateObj = new Date(dateSource);
      if (isNaN(dateObj.getTime())) return 'Date invalide';
      return dateObj.toLocaleDateString('fr-FR');
    } catch (error) {
      console.error("Erreur de formatage de date:", error);
      return 'Erreur date';
    }
  };

  // Fonction pour formater les services
  const formaterServices = (services) => {
    if (!services || !Array.isArray(services)) return 'Aucun service';
    
    return services.map(service => {
      if (typeof service === 'object') {
        return service.name || service.value || 'Service inconnu';
      }
      return service;
    }).join(', ');
  };

  // Fonction pour formater les examens
  const formaterExamens = (examens) => {
    if (!examens || !Array.isArray(examens)) return 'Aucun examen';
    
    return examens.map(examen => 
      typeof examen === 'object' ? examen.name || 'Examen inconnu' : examen
    ).join(', ');
  };

  // Récupérer les données depuis le serveur - CORRECTION: utiliser le bon événement
  useEffect(() => {
    if (!socket || !socket.connected) {
      setErreur("Non connecté au serveur. Veuillez rafraîchir la page.");
      setChargement(false);
      return;
    }

    setChargement(true);
    setErreur(null);
    
    console.log('📥 MgJournaux: Demande des données du journal...');
    
    // CORRECTION: Utiliser l'événement CORRECT que le serveur attend
    socket.emit('recuperer_donnees', (response) => {
      console.log('📥 MgJournaux: Réponse du serveur:', response);
      
      if (response && response.success && response.donnees) {
        const donneesRecues = response.donnees || [];
        console.log(`✅ MgJournaux: ${donneesRecues.length} patients chargés`);
        
        // Formater les données pour les journaux
        const donneesFormatees = donneesRecues.map(item => ({
          ...item,
          // Assurer que les champs critiques existent
          nomClient: item.nomClient || 'Non spécifié',
          numID_CSR: item.numID_CSR || 'N/A',
          numClient: item.numClient || 'N/A',
          dateCreation: item.dateCreation || item.dateModification || new Date().toISOString(),
          total_OP: parseFloat(item.total_OP) || 0,
          caisseUser: item.caisseUser || 'Non spécifié',
          isLaboratorized: item.isLaboratorized || 'En attente',
          servicesSelectionnes: item.servicesSelectionnes || [],
          examensSelectionnes: item.examensSelectionnes || []
        }));
        
        setDonnees(donneesFormatees);
        setErreur(null);
      } else {
        const errorMsg = response?.error || response?.message || "Erreur lors de la récupération des données";
        console.error('❌ MgJournaux:', errorMsg);
        setErreur(errorMsg);
      }
      setChargement(false);
    });

    // Écouter également les nouvelles données en temps réel
    const handleNouveauPatient = (newData) => {
      console.log('📥 MgJournaux: Nouveau patient reçu:', newData);
      setDonnees(prev => {
        // Éviter les doublons
        const existingIndex = prev.findIndex(item => item.numID_CSR === newData.numID_CSR);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...newData };
          return updated;
        }
        return [...prev, newData];
      });
    };

    socket.on('nouveau_patient_journal', handleNouveauPatient);
    socket.on('nouveau_patient', handleNouveauPatient);

    // Nettoyer l'écouteur
    return () => {
      socket.off('nouveau_patient_journal', handleNouveauPatient);
      socket.off('nouveau_patient', handleNouveauPatient);
    };
  }, [socket]);

  // Fonction pour récupérer les données d'un service spécifique
  const afficherDonneesService = (service) => {
    if (!socket || !socket.connected) {
      setErreur("Non connecté au serveur. Impossible de charger les données.");
      return;
    }

    setChargement(true);
    setErreur(null);
    
    console.log(`🔍 MgJournaux: Filtrage pour le service ${service}...`);
    
    // Filtrer localement les données pour le service sélectionné
    const donneesFiltrees = donnees.filter(item => {
      const services = item.servicesSelectionnes || [];
      // Vérifier dans différentes structures possibles
      return services.some(s => {
        if (typeof s === 'object') {
          return s.value === service || s.name?.toLowerCase().includes(service.toLowerCase());
        }
        return s === service || s.toLowerCase().includes(service.toLowerCase());
      });
    });
    
    console.log(`✅ MgJournaux: ${donneesFiltrees.length} résultats pour ${service}`);
    
    setDonneesFiltrees(donneesFiltrees);
    setServiceSelectionne(service);
    setChargement(false);
  };

  // Fonction pour créer un fichier JSON pour un service spécifique
  const creerFichierJSON = (service) => {
    const donneesService = donneesFiltrees.length > 0 ? donneesFiltrees : 
      donnees.filter(item => {
        const services = item.servicesSelectionnes || [];
        return services.some(s => {
          if (typeof s === 'object') {
            return s.value === service || s.name?.toLowerCase().includes(service.toLowerCase());
          }
          return s === service;
        });
      });
    
    if (donneesService.length === 0) {
      alert(`Aucune donnée trouvée pour le service ${service}`);
      return;
    }
    
    // Créer un objet JSON avec les données
    const jsonData = JSON.stringify(donneesService, null, 2);
    
    // Créer un blob et un lien de téléchargement
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_${service}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Informer l'utilisateur
    alert(`Journal ${service} exporté avec succès! (${donneesService.length} enregistrements)`);
  };

  // Fonction pour retourner à la page précédente
  const retour = () => {
    navigate(-1);
  };

  // Fonction pour retourner à la sélection des services
  const retourSelection = () => {
    setServiceSelectionne(null);
    setDonneesFiltrees([]);
  };

  // Afficher l'état de connexion
  const renderConnectionStatus = () => {
    switch(connectionStatus) {
      case 'connected':
        return (
          <div className="connection-status connected">
            ✅ Connecté au serveur ({donnees.length} patients)
          </div>
        );
      case 'disconnected':
        return (
          <div className="connection-status disconnected">
            ⚠️ Déconnecté du serveur
            <button onClick={() => window.location.reload()} className="retry-button">
              🔄 Reconnecter
            </button>
          </div>
        );
      case 'error':
        return (
          <div className="connection-status error">
            ❌ {erreur}
            <button onClick={() => window.location.reload()} className="retry-button">
              🔄 Réessayer
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="entete TC marges_logo_5px">
        <div className="marges_logo_5px">
          <img className='logo_clinique marges_logo_5px' src={LogoCsr} alt="Tchad" id="logo" />
        </div>
        <div className='titre_entete'>
          <div className="titre-container">
            <h2 className='titre_entete'>CSR - N'Djamena - TCHAD</h2>
          </div>
          <h3 className='sous_titre_entete'>
            {serviceSelectionne ? `Journal ${serviceSelectionne}` : 'Journaux par Service'}
          </h3>
        </div>
      </div>

      {/* Bandeau d'état de connexion */}
      {socket && (
        <div style={{ 
          padding: '10px', 
          margin: '10px 20px', 
          borderRadius: '5px',
          backgroundColor: connectionStatus === 'connected' ? '#d4edda' : 
                          connectionStatus === 'error' ? '#f8d7da' : '#ffeaa7',
          color: connectionStatus === 'connected' ? '#155724' : 
                 connectionStatus === 'error' ? '#721c24' : '#856404',
          border: `1px solid ${
            connectionStatus === 'connected' ? '#c3e6cb' : 
            connectionStatus === 'error' ? '#f5c6cb' : '#ffeaa7'
          }`
        }}>
          {renderConnectionStatus()}
          {connectionStatus === 'error' && socket && (
            <div style={{ marginTop: '10px', fontSize: '14px' }}>
              <strong>État Socket:</strong> {socket.connected ? 'Connecté' : 'Déconnecté'}<br />
              <strong>Socket ID:</strong> {socket.id ? socket.id.substring(0, 8) + '...' : 'N/A'}
            </div>
          )}
        </div>
      )}

      <div className="conteneur-journaux">
        {chargement && (
          <div className="chargement">
            <div className="spinner"></div>
            Chargement des données...
            <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
              Émission de l'événement: recuperer_donnees
            </div>
          </div>
        )}
        
        {erreur && !chargement && (
          <div className="erreur">
            <strong>Erreur:</strong> {erreur}
            <button onClick={() => window.location.reload()} className="btn-reessayer">
              🔄 Réessayer
            </button>
            <div style={{ marginTop: '10px', fontSize: '14px' }}>
              <p>Solutions possibles:</p>
              <ul style={{ textAlign: 'left', marginLeft: '20px' }}>
                <li>Vérifiez que le serveur backend est en ligne</li>
                <li>Rafraîchissez la page</li>
                <li>Vérifiez la console du navigateur pour plus de détails (F12)</li>
              </ul>
            </div>
          </div>
        )}
        
        {!chargement && !erreur && !serviceSelectionne && (
          <div className="journal-selection">
            <h3>Sélectionnez un service pour afficher son journal</h3>
            
            <div className="boutons-services">
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('consultation')}
                disabled={connectionStatus !== 'connected'}
              >
                📋 Journal Consultation
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('laboratoire')}
                disabled={connectionStatus !== 'connected'}
              >
                🔬 Journal Laboratoire
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('echographie')}
                disabled={connectionStatus !== 'connected'}
              >
                📊 Journal Échographie
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('hospitalisation')}
                disabled={connectionStatus !== 'connected'}
              >
                🏥 Journal Hospitalisation
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('chirurgie')}
                disabled={connectionStatus !== 'connected'}
              >
                🔪 Journal Chirurgie
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('kinesitherapie')}
                disabled={connectionStatus !== 'connected'}
              >
                💪 Journal Kinésithérapie
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('fibroscopie')}
                disabled={connectionStatus !== 'connected'}
              >
                📡 Journal Fibroscopie
              </button>
            </div>

            {/* Statistiques globales */}
            <div className="stats-globales">
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-number">
                    {donnees.length}
                  </span>
                  <span className="stat-label">Patients total</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {new Set(donnees.map(p => p.caisseUser)).size}
                  </span>
                  <span className="stat-label">Caissiers actifs</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {new Set(donnees.flatMap(p => p.servicesSelectionnes || [])
                      .map(s => typeof s === 'object' ? s.value : s)
                      .filter(Boolean)).length}
                  </span>
                  <span className="stat-label">Services utilisés</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {donnees.reduce((sum, p) => sum + (parseFloat(p.total_OP) || 0), 0).toLocaleString('fr-FR')} FCFA
                  </span>
                  <span className="stat-label">Total encaissé</span>
                </div>
              </div>
              
              <div style={{ marginTop: '20px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                <p>⚠️ Ces journaux concernent les travaux de la clinique. Veuillez être attentif lors de la vérification pour des raisons de sécurité.</p>
              </div>
            </div>
          </div>
        )}

        {serviceSelectionne && (
          <div className="journal-donnees">
            <div className="journal-header">
              <h3>Journal du service : {serviceSelectionne}</h3>
              <div className="journal-actions">
                <button className="btn-retour" onClick={retourSelection}>
                  ↩️ Retour aux services
                </button>
                <button 
                  className="btn-export" 
                  onClick={() => creerFichierJSON(serviceSelectionne)}
                  disabled={donneesFiltrees.length === 0}
                >
                  📥 Exporter JSON
                </button>
              </div>
            </div>
            
            {donneesFiltrees.length > 0 ? (
              <div className="tableau-journal">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f2f2f2' }}>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Date</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Nom Patient</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>ID CSR</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Num Client</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Services</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Examens</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Total</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Caissier</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donneesFiltrees.map((patient, index) => (
                        <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formaterDate(patient)}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{patient.nomClient}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{patient.numID_CSR}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{patient.numClient}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formaterServices(patient.servicesSelectionnes)}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formaterExamens(patient.examensSelectionnes)}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{(patient.total_OP || 0).toLocaleString('fr-FR')} FCFA</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{patient.caisseUser}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '3px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              backgroundColor: patient.isLaboratorized === 'Terminé' ? '#d4edda' : 
                                            patient.isLaboratorized === 'En cours' ? '#fff3cd' : 
                                            patient.isLaboratorized === 'Annulé' ? '#f8d7da' : '#e9ecef',
                              color: patient.isLaboratorized === 'Terminé' ? '#155724' : 
                                    patient.isLaboratorized === 'En cours' ? '#856404' : 
                                    patient.isLaboratorized === 'Annulé' ? '#721c24' : '#495057'
                            }}>
                              {patient.isLaboratorized || 'En attente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="stats-service" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                  <p>
                    <strong>{donneesFiltrees.length}</strong> enregistrement(s) trouvé(s) pour le service {serviceSelectionne}
                  </p>
                  <p>
                    <strong>Total encaissé:</strong> {
                      donneesFiltrees.reduce((sum, item) => sum + (parseFloat(item.total_OP) || 0), 0).toLocaleString('fr-FR')
                    } FCFA
                  </p>
                  <p>
                    <strong>Dernière mise à jour:</strong> {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="aucune-donnee" style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '18px', color: '#666' }}>ⓘ Aucune donnée trouvée pour le service {serviceSelectionne}</p>
                <button className="btn-retour" onClick={retourSelection} style={{ marginTop: '20px' }}>
                  ↩️ Retour aux services
                </button>
              </div>
            )}
          </div>
        )}

        {!serviceSelectionne && !chargement && !erreur && (
          <div className='ftt__footer BC sep'>
            <button className="glow-on-hover MenuBtn" type="button" onClick={retour}>
              Retour à la caisse
            </button>
          </div>
        )}
      </div>

      {/* CSS pour les états de connexion */}
      <style>{`
        .connection-status {
          padding: 10px;
          border-radius: 5px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: space-between;
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
        .bouton-service:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
};

export default MgJournaux;
