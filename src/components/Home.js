import React, { useState, useEffect } from 'react'
import { useNavigate } from "react-router-dom"
import LogoCsr from './images/logo_csr.png';

const Acceuil = ({ socket }) => {
  const navigate = useNavigate()
  const [errorMessages, setErrorMessages] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showDelayedText, setShowDelayedText] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // User Login info
  const database = [
    {
      username: "Chouaib",
      password: "SansPasse",
      service: "Administration"
    },
{
      username: "admin",
      password: "admin123",
      service: "Administration"
    },
    {
      username: "Djibrine",
      password: "SansPasse",
      service: "Administration"
    },
    {
      username: "Labo",
      password: "12345678",
      service: "Laboratoire"
    },
    {
      username: "Caisse",
      password: "12345678",
      service: "Caisse"
    },
    {
      username: "Consultation",
      password: "12345678",
      service: "Consultation"
    }
  ];

  const errors = {
    uname: "Utilisateur Inconnu",
    pass: "Erreur sur Code d'accès"
  };

  const handleSubmit = (event) => {
    //Prevent page reload
    event.preventDefault();

    var { uname, pass } = document.forms[0];

    // Find user login info
    const userData = database.find((user) => user.username === uname.value);

    // Compare user info
    if (userData) {
      if (userData.password !== pass.value) {
        // Invalid password
        setErrorMessages({ name: "pass", message: errors.pass });
      } else {
        setIsSubmitted(true);
        setLoggedInUser(userData);
        
        // Envoyer l'identification au serveur si socket est disponible
        if (socket) {
          socket.emit('user_identification', {
            service: userData.service,
            username: userData.username
          });
          console.log('Utilisateur identifié envoyé au serveur:', userData.username, userData.service);
        }
      }
    } else {
      // Username not found
      setErrorMessages({ name: "uname", message: errors.uname });
    }

    setTimeout(() => {
      setShowDelayedText(true);
    }, 5000);
  };

  // Effet pour envoyer l'identification si le socket se connecte après l'authentification
  useEffect(() => {
    if (loggedInUser && socket) {
      socket.emit('user_identification', {
        service: loggedInUser.service,
        username: loggedInUser.username
      });
      console.log('Ré-identification envoyée au serveur:', loggedInUser.username, loggedInUser.service);
    }
  }, [socket, loggedInUser]);

  const renderErrorMessage = (name) =>
    name === errorMessages.name && (
      <div className="message_erreur">{errorMessages.message}
      </div>
    );

  function GoAcceuil() {
    if (showDelayedText) {
      navigate("/PageAcceuil")
    }
  }

  const renderForm = (
    <div className="form">
      <form className='form_margin BC' onSubmit={handleSubmit}>
        <br></br>
        <br></br>

        <label className='sous_titre'>Utilisateur </label>
        <input className='username__input' minLength={4} type="text" name="uname" required />
        {renderErrorMessage("uname")}

        <label className='sous_titre'>Code d'accès</label>
        <input className='username__input' minLength={8} type="password" name="pass" required />
        {renderErrorMessage("pass")}
        <label className='message_flash'>Rappel sur la LOI N°09-PR-2015 portant sur la cybersécurité et cybercriminalité</label>

        <div className='ftt__footer BC'>
          <button className='home__cta'>Connexion</button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <div className="entete TC">
        <div className="marges_logo_5px">
          <img className='logo_clinique marges_logo_5px' src={LogoCsr} alt="Tchad" id="logo" />
        </div>
        <div className='titre_entete'>
          <h2 className='titre_entete'>CSR - N'Djamena - TCHAD</h2>
          <h3 className='sous_titre_entete'>GesCAB V1.0 (c) 2025</h3>
        </div>
      </div>

      <div className='ftt__footer BC'>
        {isSubmitted ? <div>
          <br></br>
          <label className='texte_connexion'>
            Connexion à la plate-forme Clinique Spécialisée la Référence
          </label>
          <br></br>
          <label className='message_alerte'>
            Veuillez rester vigilant quand vous manipulez des ressources à distance
          </label>
          <br></br>
          {loggedInUser && (
            <div className="user-info-confirmation">
              <label className='user-welcome'>
                Bienvenue, <strong>{loggedInUser.username}</strong> ({loggedInUser.service})
              </label>
            </div>
          )}
          <br></br>
          <br></br>
          <button className='home__cta' onClick={GoAcceuil}>Lu et approuvé</button>
          <br></br>
          <br></br>
          <label className='message_flash'>Rappel sur la LOI N°09-PR-2015 portant sur la cybersécurité et cybercriminalité</label>
        </div> : renderForm}
      </div>
    </>
  )
}

export default Acceuil
