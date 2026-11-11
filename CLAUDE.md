# Sky Squadron Idle

Idle RPG per iOS e Android a tema aviazione, da pubblicare sugli store con guadagni da pubblicità con premio e
acquisti in-app. Il proprietario scrive in italiano: rispondi in italiano.

## Com'è fatto
- Web app (Vite, JavaScript senza framework, grafica disegnata su canvas) impacchettata con Capacitor.
- Regole di gioco pure e testabili in `src/game.js`; numeri in `src/data.js` e `src/tables.js` (curve generate
  da formule proprie); schermate in `src/ui*.js`; testi IT/EN in `src/i18n.js`.
- Online (lega settimanale, alleanze, guerra, chat): regole in `shared/social.js`, server Node senza dipendenze
  in `server/index.js`. Senza `serverUrl` in `src/config.js` le stesse regole girano sul telefono in modalità
  demo con giocatori simulati.
- Pubblicità AdMob e acquisti RevenueCat in `src/monetization.js`; nel browser sono simulati.
- Dettagli completi, monetizzazione e passi di pubblicazione nel `README.md`.

## Comandi
- `npm run dev` gioco nel browser · `npm test` test · `npm run build` build in `dist/`
- `npm run server` server online in locale · `npm run simulate` ritmo di gioco su 72 ore
- `npm run preview:file` anteprima in un unico file HTML · `npm run ios` / `npm run android` progetti nativi

## Regole per chi ci lavora
- Il gioco si ispira al genere degli idle RPG "a forgia", ma nomi, grafica, testi e numeri devono restare
  originali: non copiare dati, tabelle, nomi o immagini di giochi esistenti.
- Dopo ogni modifica alle regole: `npm test`, e `npm run simulate` se cambia il bilanciamento.
- Le cartelle `ios/` e `android/` non sono nel repository: si generano con `npx cap add ios|android`.

## A che punto siamo
Fatto e provato nel browser: officina, missioni, manovre, droni, emblemi, ricerca, dungeon, Pass, negozio,
arena, alleanze, guerra e chat (demo). Da fare, in ordine:
1. Generare i progetti nativi e provare il gioco su simulatore e telefono (iOS da Xcode, Android da Android Studio).
2. Creare app e unità "con premio" su AdMob, prodotti su App Store Connect e Google Play, collegarli a
   RevenueCat, inserire ID e chiavi in `src/config.js` e provare pubblicità e acquisti sul dispositivo.
3. Mettere in rete il server e impostare `serverUrl`; prima del lancio servono strumenti di moderazione della
   chat (blocco utenti) e il recupero dell'account.
4. Icona, schermata iniziale, screenshot, informativa privacy, schede degli store.
