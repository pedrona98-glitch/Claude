# Sky Squadron Idle

Idle RPG a tema aviazione per iOS e Android. Il tuo aereo e la tua squadriglia combattono da soli missione dopo
missione; tu potenzi le armi, arruoli gregari, compri aerei nuovi e ricominci la campagna per ottenere medaglie
permanenti. Testi in italiano e inglese (scelta automatica dalla lingua del telefono).

Il gioco è una web app (Vite, JavaScript senza framework, grafica su canvas) impacchettata con
[Capacitor](https://capacitorjs.com) per gli store.

## Come si gioca

- **Battaglia automatica**: 10 nemici per missione, un boss a tempo ogni 5. Toccando il cielo lanci razzi.
- **Vita della squadriglia**: i nemici sparano. La vita si ricarica a ogni missione; se finisce si arretra di
  una missione e si resta in pattuglia finché non si decide di avanzare di nuovo.
- **Aereo**: 6 potenziamenti in monete (tra cui la corazza) e 5 aerei comprati con le gemme, che moltiplicano
  danno e vita e restano per sempre. **Squadra**: 8 gregari che aggiungono danno e vita.
- **Arena PvP**: duelli contro altri giocatori dello stesso server, biglietti che si ricaricano, trofei, leghe
  e classifica. Vince chi ha più potenza (danno × vita).
- **Alleanza**: fino a 20 piloti, bonus al danno che cresce col livello, donazioni, boss da abbattere insieme,
  guerra quotidiana contro un'alleanza rivale di forza simile.
- **Chat**: canale globale del server e canale dell'alleanza, con filtro e segnalazione dei messaggi.
- **Comando**: Nuova Campagna (prestigio) dalla missione 25, talenti in medaglie, obiettivi che danno gemme.
- **Guadagni offline** fino a 2 ore (8 con i talenti), premio giornaliero, rifornimenti aerei da toccare.

## Monetizzazione

| Fonte | Dove | Cosa dà |
| --- | --- | --- |
| Video con premio | Ritorno dopo l'assenza | Raddoppia le monete offline |
| Video con premio | Cassa del rifornimento aereo | Premio in monete molto più grande |
| Video con premio | Negozio | 5 gemme ogni 15 minuti, monete ×2 per 15 minuti |
| Video con premio | Arena | Ricarica dei biglietti (3 volte al giorno) |
| Acquisto | `gems_80`, `gems_500`, `gems_1200`, `gems_3000` | Pacchetti di gemme (consumabili) |
| Acquisto | `starter_pack` | 300 gemme + 30 minuti di monete ×2, una volta sola (consumabile) |
| Acquisto | `double_coins` | Monete ×2 per sempre (non consumabile) |
| Acquisto | `remove_ads` | Tutti i premi video senza guardare annunci (non consumabile) |

Non ci sono annunci forzati: negli idle sono i video scelti dal giocatore a rendere, e non fanno disinstallare.
Un banner in basso è già previsto ma spento (`banner.enabled` in `src/config.js`).

## Sviluppo

```bash
npm install
npm run dev      # gioco nel browser su http://localhost:5173
npm test         # test della logica e del bilanciamento
npm run build    # build di produzione in dist/
```

Nel browser non esiste uno store: i video diventano un conto alla rovescia di prova e gli acquisti una finestra
di conferma che non addebita nulla. Sui telefoni si usano AdMob e gli store veri.

Struttura: `src/game.js` (regole, senza DOM), `src/data.js` (numeri e prezzi), `src/render.js` (canvas),
`src/ui.js` e `src/ui-online.js` (schede e finestre), `src/icons.js` (icone), `src/monetization.js`
(AdMob + RevenueCat), `src/i18n.js` (testi), `shared/social.js` (regole online), `server/index.js` (server).

## Gioco online

Arena, alleanze, guerre e chat hanno bisogno di un server. Le regole stanno in `shared/social.js` e girano in
due modi:

- **Demo** (predefinita, `serverUrl` vuoto in `src/config.js`): tutto gira sul telefono con giocatori
  simulati, e le schermate lo dichiarano con l'etichetta "Demo: giocatori simulati". Serve a provare il gioco,
  non va pubblicata così.
- **Server vero**: `npm run server` avvia `server/index.js` (solo Node, nessuna dipendenza) sulla porta 8787.
  Metti il suo indirizzo https in `serverUrl` e ricompila l'app.

Come funziona il server:

- **Server di gioco per data d'iscrizione**: ogni nuovo giocatore entra nell'ultimo server aperto; se ne apre
  uno nuovo ogni 7 giorni o a 3000 iscritti (`RULES` in `shared/social.js`). Arena, alleanze, guerre e chat
  globale sono separate per server, così i veterani non incontrano i nuovi arrivati.
- **Dati**: tutto in memoria, salvato su `server-data/world.json` ogni 30 secondi e alla chiusura. Va bene per
  il lancio; con molte migliaia di giocatori attivi conviene passare a un database.
- **Avversari d'addestramento**: se un server ha pochi giocatori l'arena si completa con bot, indicati come tali.
- **Hosting**: qualsiasi servizio che esegua Node 20+ con un disco persistente (variabili `PORT` e `DATA_DIR`).

Limiti da conoscere prima del lancio:

- La potenza del giocatore viene comunicata dall'app e il server si fida: un'app modificata può barare in
  arena. Per classifiche con premi veri serve ricalcolare i progressi sul server.
- Le gemme guadagnate online vengono accreditate dall'app, per lo stesso motivo.
- La chat ha filtro parole, limite di frequenza e segnalazioni (3 segnalazioni nascondono un messaggio), ma
  non ha ancora strumenti da moderatore né blocco degli utenti. Gli store li richiedono per le app con chat.
- L'account è legato all'installazione: cambiando telefono si perde. Manca il recupero account.

## Pubblicazione

Servono un Mac con Xcode per iOS e Android Studio per Android. Le cartelle `android/` e `ios/` non sono nel
repository: si generano una volta sola.

1. **Identità dell'app**: cambia `appId` e `appName` in `capacitor.config.json` (l'id non si può più cambiare
   dopo la pubblicazione). Controlla anche che il nome sia libero sugli store.
2. **Progetti nativi**: `npm run build`, poi `npx cap add android` e `npx cap add ios`.
3. **AdMob**: crea l'app su [admob.google.com](https://admob.google.com) e un'unità "Con premio" per ogni
   piattaforma. Metti gli ID in `src/config.js` e `testMode: false`. Aggiungi l'ID app AdMob in
   `android/app/src/main/AndroidManifest.xml` (`com.google.android.gms.ads.APPLICATION_ID`) e in
   `ios/App/App/Info.plist` (`GADApplicationIdentifier`, più `NSUserTrackingUsageDescription`). In AdMob,
   sezione Privacy e messaggi, attiva il messaggio di consenso GDPR: il gioco lo mostra da solo all'avvio.
4. **Acquisti**: crea i 7 prodotti con gli stessi id della tabella su App Store Connect e Google Play Console,
   collegali a un progetto [RevenueCat](https://www.revenuecat.com) e incolla le due chiavi pubbliche in
   `src/config.js`. Finché le chiavi mancano, sul telefono il negozio risponde "non disponibile".
5. **Icona e splash**: `npm i -D @capacitor/assets`, metti `assets/icon.png` (1024×1024) e
   `npx capacitor-assets generate`.
6. **Build**: `npm run android` oppure `npm run ios` aprono il progetto in Android Studio / Xcode, da cui si
   firma e si carica la build.
7. **Schede store**: servono una pagina con l'informativa privacy (AdMob raccoglie l'identificativo
   pubblicitario), le dichiarazioni sui dati raccolti, screenshot e classificazione per età.

Costi fissi: Apple Developer 99 $/anno, Google Play 25 $ una tantum. Google Play richiede ai nuovi account
personali un test chiuso con più tester prima del rilascio pubblico.

## Stato

Provato nel browser in emulazione telefono: combattimento, acquisti, video di prova, prestigio, salvataggio,
guadagni offline, arena, alleanza, guerra e chat in modalità demo. Il server è coperto dai test e provato in
locale via HTTP, non ancora messo in rete né provato con giocatori veri. L'integrazione nativa con AdMob e RevenueCat segue le API dei plugin installati ma **non è
stata ancora eseguita su un dispositivo**: va verificata con gli ID di test prima del rilascio.
