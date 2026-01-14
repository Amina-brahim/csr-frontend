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
  const [lastUpdate, setLastUpdate] = useState(null);

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
      chargerDonneesDuServeur(); // Charger les données après connexion
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

  // Système de réessai automatique
  useEffect(() => {
    let retryInterval;
    
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      // Réessayer automatiquement toutes les 10 secondes
      retryInterval = setInterval(() => {
        if (socket && !socket.connected) {
          console.log('🔄 Tentative de reconnexion automatique...');
          socket.connect();
        }
      }, 10000);
    }
    
    return () => {
      if (retryInterval) {
        clearInterval(retryInterval);
      }
    };
  }, [connectionStatus, socket]);

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

  // Fonction pour charger les données du serveur
  const chargerDonneesDuServeur = () => {
    if (!socket || !socket.connected) {
      setErreur("Non connecté au serveur. Veuillez rafraîchir la page.");
      setChargement(false);
      
      // ESSAYER DE CHARGER DEPUIS LE LOCALSTORAGE EN MODE HORS LIGNE
      try {
        const savedData = localStorage.getItem('journalDataBackup');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          setDonnees(parsedData);
          console.log(`📂 Données chargées depuis backup: ${parsedData.length} patients`);
          setErreur('Mode hors ligne - Données locales');
        }
      } catch (e) {
        console.error('Erreur chargement backup:', e);
      }
      
      return;
    }

    setChargement(true);
    setErreur(null);
    
    console.log('📥 MgJournaux: Demande des données du journal...');
    
    // Ajouter un timeout pour éviter les blocages
    const timeoutId = setTimeout(() => {
      if (chargement) {
        setErreur("Délai d'attente dépassé. Vérifiez la connexion au serveur.");
        setChargement(false);
      }
    }, 15000);
    
    socket.emit('recuperer_donnees_journal', (response) => {
      clearTimeout(timeoutId);
      
      console.log('📥 MgJournaux: Réponse du serveur:', response);
      
      if (response && response.success && response.donnees) {
        const donneesRecues = response.donnees || [];
        console.log(`✅ MgJournaux: ${donneesRecues.length} patients chargés`);
        
        // Formater les données pour les journaux
        const donneesFormatees = donneesRecues.map(item => ({
          ...item,
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
        setLastUpdate(new Date().toISOString());
        
        // SAUVEGARDER EN LOCAL POUR MODE HORS LIGNE
        try {
          localStorage.setItem('journalDataBackup', JSON.stringify(donneesFormatees));
          localStorage.setItem('journalLastUpdate', new Date().toISOString());
        } catch (e) {
          console.error('Erreur sauvegarde backup:', e);
        }
        
        // Re-filtrer si un service est sélectionné
        if (serviceSelectionne) {
          filtrerDonneesParService(serviceSelectionne, donneesFormatees);
        }
      } else {
        const errorMsg = response?.error || response?.message || "Erreur lors de la récupération des données";
        console.error('❌ MgJournaux:', errorMsg);
        setErreur(errorMsg);
        
        // ESSAYER LE BACKUP
        try {
          const savedData = localStorage.getItem('journalDataBackup');
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            setDonnees(parsedData);
            const lastUpdate = localStorage.getItem('journalLastUpdate');
            setErreur(`Mode hors ligne. Données du ${new Date(lastUpdate).toLocaleDateString('fr-FR')}`);
          }
        } catch (e) {
          console.error('Erreur chargement backup:', e);
        }
      }
      setChargement(false);
    });
  };

  // Fonction pour filtrer les données par service
  const filtrerDonneesParService = (service, donneesAFiltrer = donnees) => {
    const donneesFiltrees = donneesAFiltrer.filter(item => {
      const services = item.servicesSelectionnes || [];
      return services.some(s => {
        if (typeof s === 'object') {
          return s.value === service || s.name?.toLowerCase().includes(service.toLowerCase());
        }
        return s === service || s.toLowerCase().includes(service.toLowerCase());
      });
    });
    
    console.log(`✅ MgJournaux: ${donneesFiltrees.length} résultats pour ${service}`);
    
    setDonneesFiltrees(donneesFiltrees);
  };

  // Récupérer les données depuis le serveur
  useEffect(() => {
    if (!socket || !socket.connected) {
      setErreur("Non connecté au serveur. Veuillez rafraîchir la page.");
      setChargement(false);
      return;
    }

    // Charger initialement les données
    chargerDonneesDuServeur();

    // Écouter les nouvelles données en temps réel
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
      
      setLastUpdate(new Date().toISOString());
      
      // Re-filtrer si un service est sélectionné
      if (serviceSelectionne) {
        filtrerDonneesParService(serviceSelectionne);
      }
    };

    // CORRECTION CRITIQUE : Écouter les mises à jour de statut depuis le labo
    const handleJournalStatusUpdate = (updateData) => {
      console.log('📊 MgJournaux: Mise à jour de statut reçue:', updateData);
      
      setDonnees(prev => prev.map(item => {
        if (item.numID_CSR === updateData.patientId) {
          console.log(`✅ MgJournaux: Mise à jour du patient ${updateData.patientName} (${updateData.newStatus})`);
          return {
            ...item,
            isLaboratorized: updateData.newStatus,
            lastUpdate: updateData.updatedAt
          };
        }
        return item;
      }));
      
      setLastUpdate(new Date().toISOString());
      
      // Re-filtrer si un service est sélectionné
      if (serviceSelectionne) {
        filtrerDonneesParService(serviceSelectionne);
      }
    };

    // CORRECTION : Écouter les mises à jour complètes des données patient
    const handlePatientDataUpdated = (updatedPatient) => {
      console.log('📊 MgJournaux: Données patient mises à jour:', updatedPatient);
      
      setDonnees(prev => {
        const existingIndex = prev.findIndex(item => item.numID_CSR === updatedPatient.numID_CSR);
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...updatedPatient,
            isLaboratorized: updatedPatient.isLaboratorized || 'En attente'
          };
          return updated;
        }
        return prev;
      });
      
      setLastUpdate(new Date().toISOString());
      
      // Re-filtrer si un service est sélectionné
      if (serviceSelectionne) {
        filtrerDonneesParService(serviceSelectionne);
      }
    };

    // CORRECTION : Écouter les événements de statut du labo
    const handleEtatAnalysesMisAJour = (data) => {
      console.log('📊 MgJournaux: État analyses mis à jour reçu:', data);
      
      setDonnees(prev => {
        const existingIndex = prev.findIndex(item => item.numID_CSR === data.numID_CSR);
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            isLaboratorized: data.isLaboratorized || 'En attente',
            updatedAt: data.updatedAt || new Date().toISOString()
          };
          return updated;
        }
        return prev;
      });
      
      setLastUpdate(new Date().toISOString());
      
      // Re-filtrer si un service est sélectionné
      if (serviceSelectionne) {
        filtrerDonneesParService(serviceSelectionne);
      }
    };

    socket.on('nouveau_patient_journal', handleNouveauPatient);
    socket.on('nouveau_patient', handleNouveauPatient);
    socket.on('journal_status_update', handleJournalStatusUpdate);
    socket.on('patient_data_updated', handlePatientDataUpdated);
    socket.on('Etat Analyses Mis à Jour', handleEtatAnalysesMisAJour);

    // Nettoyer les écouteurs
    return () => {
      socket.off('nouveau_patient_journal', handleNouveauPatient);
      socket.off('nouveau_patient', handleNouveauPatient);
      socket.off('journal_status_update', handleJournalStatusUpdate);
      socket.off('patient_data_updated', handlePatientDataUpdated);
      socket.off('Etat Analyses Mis à Jour', handleEtatAnalysesMisAJour);
    };
  }, [socket, serviceSelectionne]);

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                ✅ Connecté au serveur ({donnees.length} patients)
                {lastUpdate && (
                  <div style={{ fontSize: '12px', marginTop: '3px' }}>
                    Dernière mise à jour: {new Date(lastUpdate).toLocaleTimeString('fr-FR')}
                  </div>
                )}
              </div>
              <button onClick={() => window.location.reload()} className="retry-button">
                🔄 Rafraîchir
              </button>
            </div>
          </div>
        );
      case 'disconnected':
        return (
          <div className="connection-status disconnected">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                ⚠️ Déconnecté du serveur
                <div style={{ fontSize: '12px', marginTop: '3px' }}>
                  Reconnexion automatique dans 10 secondes...
                </div>
              </div>
              <button onClick={() => window.location.reload()} className="retry-button">
                🔄 Reconnecter
              </button>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="connection-status error">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                ❌ {erreur}
                <div style={{ fontSize: '12px', marginTop: '3px' }}>
                  Utilisation des données locales sauvegardées
                </div>
              </div>
              <button onClick={() => window.location.reload()} className="retry-button">
                🔄 Réessayer
              </button>
            </div>
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
        </div>
      )}

      <div className="conteneur-journaux">
        {chargement && (
          <div className="chargement">
            <div className="spinner"></div>
            Chargement des données...
            <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
              Écoute des mises à jour en temps réel...
            </div>
          </div>
        )}
        
        {erreur && !chargement && !serviceSelectionne && (
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
                disabled={connectionStatus !== 'connected' && donnees.length === 0}
              >
                📋 Journal Consultation
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('laboratoire')}
                disabled={connectionStatus !== 'connected' && donnees.length === 0}
              >
                🔬 Journal Laboratoire
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('echographie')}
                disabled={connectionStatus !== 'connected' && donnees.length === 0}
              >
                📊 Journal Échographie
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('hospitalisation')}
                disabled={connectionStatus !== 'connected' && donnees.length === 0}
              >
                🏥 Journal Hospitalisation
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('chirurgie')}
                disabled={connectionStatus !== 'connected' && donnees.length === 0}
              >
                🔪 Journal Chirurgie
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('kinesitherapie')}
                disabled={connectionStatus !== 'connected' && donnees.length === 0}
              >
                💪 Journal Kinésithérapie
              </button>
              <button 
                className="bouton-service" 
                onClick={() => afficherDonneesService('fibroscopie')}
                disabled={connectionStatus !== 'connected' && donnees.length === 0}
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
                <p>🔄 Les mises à jour du laboratoire sont reçues en temps réel.</p>
                {connectionStatus !== 'connected' && (
                  <p style={{ color: '#dc3545' }}>
                    ⚠️ Mode hors ligne - Affichage des dernières données sauvegardées
                  </p>
                )}
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
                <button 
                  className="btn-refresh" 
                  onClick={chargerDonneesDuServeur}
                  style={{ marginLeft: '10px' }}
                >
                  🔄 Rafraîchir
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
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Statut Laboratoire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donneesFiltrees.map((patient, index) => (
                        <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formaterDate(patient)}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{patient.nomClient}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: '12px' }}>
                            {patient.numID_CSR}
                            {patient.numID_CSR && patient.numID_CSR.startsWith('CSR') && 
                              <span style={{ fontSize: '10px', color: '#28a745', marginLeft: '5px' }}>✓</span>}
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                            {patient.numClient}
                          </td>
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
                    <strong>Dernière mise à jour:</strong> {lastUpdate ? new Date(lastUpdate).toLocaleString('fr-FR') : 'N/A'}
                  </p>
                  <p style={{ color: connectionStatus === 'connected' ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                    {connectionStatus === 'connected' ? '🔄 Mises à jour en temps réel activées' : '⚠️ Mode hors ligne'}
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
        .btn-refresh {
          padding: 8px 15px;
          background-color: #17a2b8;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-refresh:hover {
          background-color: #138496;
        }
        .btn-reessayer {
          margin-left: 10px;
          padding: 5px 15px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }
        .btn-reessayer:hover {
          background-color: #5a6268;
        }
      `}</style>
    </>
  );
};

export default MgJournaux;
