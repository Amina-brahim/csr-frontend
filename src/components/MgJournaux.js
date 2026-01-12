import React, { useState, useEffect, useCallback } from 'react';
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
  const [derniereMiseAJour, setDerniereMiseAJour] = useState(null);
  const [updatesCount, setUpdatesCount] = useState(0);

  // ==========================================================================
  // GESTION DE LA CONNEXION SOCKET
  // ==========================================================================

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

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket]);

  // ==========================================================================
  // FONCTIONS UTILITAIRES
  // ==========================================================================

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

  const formaterServices = (services) => {
    if (!services || !Array.isArray(services)) return 'Aucun service';
    
    return services.map(service => {
      if (typeof service === 'object') {
        return service.name || service.value || 'Service inconnu';
      }
      return service;
    }).join(', ');
  };

  const formaterExamens = (examens) => {
    if (!examens || !Array.isArray(examens)) return 'Aucun examen';
    
    return examens.map(examen => 
      typeof examen === 'object' ? examen.name || 'Examen inconnu' : examen
    ).join(', ');
  };

  // ==========================================================================
  // ÉCOUTEURS POUR LES MISES À JOUR EN TEMPS RÉEL
  // ==========================================================================

  const setupRealtimeListeners = useCallback((socketInstance) => {
    if (!socketInstance) return;

    console.log('👂 MgJournaux: Configuration des écouteurs temps réel');

    // 1. ÉCOUTEUR PRINCIPAL POUR LES MISES À JOUR DE STATUT
    const handleStatutMisAJour = (updateData) => {
      console.log('📢 MgJournaux: Mise à jour de statut reçue:', updateData);
      setUpdatesCount(prev => prev + 1);
      setDerniereMiseAJour(new Date().toISOString());

      setDonnees(prev => {
        const updated = prev.map(item => {
          // Vérifier par numID_CSR ou numClient
          const matchByCSR = item.numID_CSR && updateData.numID_CSR && 
                           item.numID_CSR === updateData.numID_CSR;
          const matchByClient = item.numClient && updateData.patientId && 
                              item.numClient == updateData.patientId;
          
          if (matchByCSR || matchByClient) {
            console.log(`✅ MgJournaux: Mise à jour du patient "${item.nomClient}"`, 
                       `Ancien: "${item.isLaboratorized}" → Nouveau: "${updateData.nouveauStatut}"`);
            
            return {
              ...item,
              isLaboratorized: updateData.nouveauStatut,
              lastUpdate: updateData.timestamp,
              ...(updateData.patientData || {})
            };
          }
          return item;
        });
        
        return updated;
      });

      // Mettre à jour aussi les données filtrées si actives
      if (serviceSelectionne && donneesFiltrees.length > 0) {
        setDonneesFiltrees(prev => prev.map(item => {
          const matchByCSR = item.numID_CSR && updateData.numID_CSR && 
                           item.numID_CSR === updateData.numID_CSR;
          const matchByClient = item.numClient && updateData.patientId && 
                              item.numClient == updateData.patientId;
          
          if (matchByCSR || matchByClient) {
            return {
              ...item,
              isLaboratorized: updateData.nouveauStatut,
              lastUpdate: updateData.timestamp
            };
          }
          return item;
        }));
      }
    };

    // 2. ÉCOUTEUR POUR LES MISES À JOUR GÉNÉRALES DU LABORATOIRE
    const handleEtatAnalysesMisAJour = (patientData) => {
      console.log('🔬 MgJournaux: Mise à jour du labo reçue:', patientData);
      
      setDonnees(prev => {
        const updated = prev.map(item => {
          if (item.numID_CSR === patientData.numID_CSR || 
              item.numClient == patientData.numClient) {
            console.log(`🔄 MgJournaux: Synchronisation avec labo pour "${item.nomClient}"`);
            return { ...item, ...patientData };
          }
          return item;
        });
        
        // Si nouveau patient, l'ajouter
        const exists = prev.some(item => 
          item.numID_CSR === patientData.numID_CSR || 
          item.numClient == patientData.numClient
        );
        
        if (!exists && patientData.nomClient) {
          console.log(`➕ MgJournaux: Nouveau patient ajouté depuis labo: "${patientData.nomClient}"`);
          return [...prev, patientData];
        }
        
        return updated;
      });
    };

    // 3. ÉCOUTEUR POUR LES NOUVEAUX PATIENTS
    const handleNouveauPatient = (newPatient) => {
      console.log('📥 MgJournaux: Nouveau patient reçu:', newPatient);
      setDerniereMiseAJour(new Date().toISOString());
      
      setDonnees(prev => {
        // Éviter les doublons
        const exists = prev.some(item => item.numID_CSR === newPatient.numID_CSR);
        if (!exists) {
          return [...prev, newPatient];
        }
        return prev;
      });
    };

    // 4. ÉCOUTEUR POUR LES SUPPRESSIONS
    const handlePatientDeleted = (data) => {
      console.log('🗑️ MgJournaux: Patient supprimé:', data.patientId);
      
      setDonnees(prev => prev.filter(item => item.numID_CSR !== data.patientId));
      setDonneesFiltrees(prev => prev.filter(item => item.numID_CSR !== data.patientId));
    };

    // 5. ÉCOUTEUR POUR LES MISES À JOUR GÉNÉRALES
    const handlePatientDataUpdated = (data) => {
      console.log('🔄 MgJournaux: Données patient mises à jour:', data);
      if (data.data && data.data.numID_CSR) {
        setDonnees(prev => prev.map(item => 
          item.numID_CSR === data.data.numID_CSR ? { ...item, ...data.data } : item
        ));
      }
    };

    // Enregistrer tous les écouteurs
    socketInstance.on('statut_patient_mis_a_jour', handleStatutMisAJour);
    socketInstance.on('Etat Analyses Mis à Jour', handleEtatAnalysesMisAJour);
    socketInstance.on('nouveau_patient_journal', handleNouveauPatient);
    socketInstance.on('nouveau_patient', handleNouveauPatient);
    socketInstance.on('patient_deleted', handlePatientDeleted);
    socketInstance.on('patient_data_updated', handlePatientDataUpdated);

    // Écouteurs spécifiques par service
    const services = ['laboratoire', 'consultation', 'echographie', 'hospitalisation', 
                      'chirurgie', 'kinesitherapie', 'fibroscopie'];
    
    services.forEach(service => {
      socketInstance.on(`journal_update_${service}`, (data) => {
        if (serviceSelectionne === service) {
          console.log(`📋 Journal ${service}: Mise à jour spécifique reçue`, data);
          handleStatutMisAJour(data);
        }
      });
    });

    // Nettoyage des écouteurs
    return () => {
      socketInstance.off('statut_patient_mis_a_jour', handleStatutMisAJour);
      socketInstance.off('Etat Analyses Mis à Jour', handleEtatAnalysesMisAJour);
      socketInstance.off('nouveau_patient_journal', handleNouveauPatient);
      socketInstance.off('nouveau_patient', handleNouveauPatient);
      socketInstance.off('patient_deleted', handlePatientDeleted);
      socketInstance.off('patient_data_updated', handlePatientDataUpdated);
      
      services.forEach(service => {
        socketInstance.off(`journal_update_${service}`);
      });
    };
  }, [serviceSelectionne, donneesFiltrees]);

  // ==========================================================================
  // CHARGEMENT INITIAL DES DONNÉES
  // ==========================================================================

  useEffect(() => {
    if (!socket || !socket.connected) {
      setErreur("Non connecté au serveur. Veuillez rafraîchir la page.");
      setChargement(false);
      return;
    }

    setChargement(true);
    setErreur(null);
    
    console.log('📥 MgJournaux: Demande des données du journal...');
    
    // Charger les données initiales
    socket.emit('recuperer_donnees', (response) => {
      console.log('📥 MgJournaux: Réponse du serveur:', response);
      
      if (response && response.success && response.donnees) {
        const donneesRecues = response.donnees || [];
        console.log(`✅ MgJournaux: ${donneesRecues.length} patients chargés`);
        
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
        
        // Configurer les écouteurs temps réel
        const cleanup = setupRealtimeListeners(socket);
        
        // S'abonner aux mises à jour des journaux
        socket.emit('get_journal_updates', 'all', (response) => {
          if (response && response.success) {
            console.log('✅ MgJournaux: Abonné aux mises à jour des journaux');
          }
        });
        
        // Nettoyage
        return () => {
          if (cleanup) cleanup();
        };
        
      } else {
        const errorMsg = response?.error || response?.message || "Erreur lors de la récupération des données";
        console.error('❌ MgJournaux:', errorMsg);
        setErreur(errorMsg);
      }
      setChargement(false);
    });
  }, [socket, setupRealtimeListeners]);

  // ==========================================================================
  // FONCTIONS D'INTERACTION
  // ==========================================================================

  const afficherDonneesService = (service) => {
    if (!socket || !socket.connected) {
      setErreur("Non connecté au serveur. Impossible de charger les données.");
      return;
    }

    setChargement(true);
    setErreur(null);
    
    console.log(`🔍 MgJournaux: Filtrage pour le service ${service}...`);
    
    // Filtrer localement les données
    const donneesFiltrees = donnees.filter(item => {
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
    setServiceSelectionne(service);
    setChargement(false);
  };

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
    
    const jsonData = JSON.stringify(donneesService, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_${service}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`Journal ${service} exporté avec succès! (${donneesService.length} enregistrements)`);
  };

  const retour = () => navigate(-1);
  const retourSelection = () => {
    setServiceSelectionne(null);
    setDonneesFiltrees([]);
  };

  // ==========================================================================
  // RENDU
  // ==========================================================================

  const renderConnectionStatus = () => {
    switch(connectionStatus) {
      case 'connected':
        return (
          <div className="connection-status connected">
            ✅ Connecté au serveur 
            <span style={{ marginLeft: '10px', fontSize: '12px' }}>
              ({donnees.length} patients • {updatesCount} mise{updatesCount !== 1 ? 's' : ''} à jour)
            </span>
            {derniereMiseAJour && (
              <span style={{ marginLeft: '10px', fontSize: '12px', opacity: 0.7 }}>
                Dernière: {new Date(derniereMiseAJour).toLocaleTimeString('fr-FR')}
              </span>
            )}
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

      {/* Bandeau d'état */}
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
              Synchronisation temps réel: {updatesCount > 0 ? 'ACTIVE' : 'EN ATTENTE'}
            </div>
          </div>
        )}
        
        {erreur && !chargement && (
          <div className="erreur">
            <strong>Erreur:</strong> {erreur}
            <button onClick={() => window.location.reload()} className="btn-reessayer">
              🔄 Réessayer
            </button>
          </div>
        )}
        
        {!chargement && !erreur && !serviceSelectionne && (
          <div className="journal-selection">
            <h3>Sélectionnez un service pour afficher son journal</h3>
            
            <div className="boutons-services">
              {['consultation', 'laboratoire', 'echographie', 'hospitalisation', 
                'chirurgie', 'kinesitherapie', 'fibroscopie'].map(service => (
                <button 
                  key={service}
                  className="bouton-service" 
                  onClick={() => afficherDonneesService(service)}
                  disabled={connectionStatus !== 'connected'}
                >
                  {service === 'laboratoire' ? '🔬' : 
                   service === 'consultation' ? '📋' :
                   service === 'echographie' ? '📊' :
                   service === 'hospitalisation' ? '🏥' :
                   service === 'chirurgie' ? '🔪' :
                   service === 'kinesitherapie' ? '💪' : '📡'}
                  Journal {service.charAt(0).toUpperCase() + service.slice(1)}
                </button>
              ))}
            </div>

            <div className="stats-globales">
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-number">{donnees.length}</span>
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
              
              <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#0d47a1' }}>
                  🔄 <strong>Synchronisation active:</strong> Les changements du laboratoire apparaissent en temps réel dans les journaux
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#1565c0' }}>
                  Dernière mise à jour: {derniereMiseAJour ? 
                    new Date(derniereMiseAJour).toLocaleTimeString('fr-FR') : 'En attente...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {serviceSelectionne && (
          <div className="journal-donnees">
            <div className="journal-header">
              <h3>
                Journal du service : {serviceSelectionne}
                <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
                  ({donneesFiltrees.length} enregistrement{donneesFiltrees.length !== 1 ? 's' : ''})
                </span>
              </h3>
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
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Statut Labo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donneesFiltrees.map((patient, index) => (
                        <tr key={index} style={{ 
                          backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9',
                          transition: 'background-color 0.3s ease'
                        }}>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formaterDate(patient)}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                            {patient.nomClient}
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #ddd', fontFamily: 'monospace' }}>
                            {patient.numID_CSR}
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{patient.numClient}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formaterServices(patient.servicesSelectionnes)}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{formaterExamens(patient.examensSelectionnes)}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                            {(patient.total_OP || 0).toLocaleString('fr-FR')} FCFA
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>{patient.caisseUser}</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                            <span style={{
                              padding: '5px 10px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              display: 'inline-block',
                              minWidth: '80px',
                              textAlign: 'center',
                              backgroundColor: patient.isLaboratorized === 'Terminé' ? '#d4edda' : 
                                            patient.isLaboratorized === 'En cours' ? '#fff3cd' : 
                                            patient.isLaboratorized === 'Annulé' ? '#f8d7da' : 
                                            patient.isLaboratorized === 'En attente' ? '#e9ecef' : '#f8f9fa',
                              color: patient.isLaboratorized === 'Terminé' ? '#155724' : 
                                    patient.isLaboratorized === 'En cours' ? '#856404' : 
                                    patient.isLaboratorized === 'Annulé' ? '#721c24' : 
                                    patient.isLaboratorized === 'En attente' ? '#495057' : '#6c757d',
                              border: `1px solid ${
                                patient.isLaboratorized === 'Terminé' ? '#c3e6cb' : 
                                patient.isLaboratorized === 'En cours' ? '#ffeaa7' : 
                                patient.isLaboratorized === 'Annulé' ? '#f5c6cb' : '#dee2e6'
                              }`,
                              transition: 'all 0.3s ease'
                            }}>
                              {patient.isLaboratorized || 'En attente'}
                              {patient.lastUpdate && (
                                <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                                  {new Date(patient.lastUpdate).toLocaleTimeString('fr-FR', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="stats-service" style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '5px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: 0 }}>
                        <strong>{donneesFiltrees.length}</strong> enregistrement{donneesFiltrees.length !== 1 ? 's' : ''} 
                      </p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
                        <strong>Total encaissé:</strong> {
                          donneesFiltrees.reduce((sum, item) => sum + (parseFloat(item.total_OP) || 0), 0)
                            .toLocaleString('fr-FR')
                        } FCFA
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '14px' }}>
                        <strong>Statuts:</strong>
                        <span style={{ marginLeft: '10px', color: '#28a745' }}>
                          Terminé: {donneesFiltrees.filter(p => p.isLaboratorized === 'Terminé').length}
                        </span>
                        <span style={{ marginLeft: '10px', color: '#ffc107' }}>
                          En cours: {donneesFiltrees.filter(p => p.isLaboratorized === 'En cours').length}
                        </span>
                        <span style={{ marginLeft: '10px', color: '#6c757d' }}>
                          En attente: {donneesFiltrees.filter(p => p.isLaboratorized === 'En attente').length}
                        </span>
                      </p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                        <strong>Dernière synchro:</strong> {new Date().toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aucune-donnee" style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '18px', color: '#666' }}>
                  ⓘ Aucune donnée trouvée pour le service {serviceSelectionne}
                </p>
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
    </>
  );
};

export default MgJournaux;
