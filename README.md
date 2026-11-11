# Sky Squadron Idle

Idle RPG a tema aviazione per iOS e Android. Il tuo aereo e la tua squadriglia combattono da soli missione dopo
missione; tu potenzi le armi, arruoli gregari, compri aerei nuovi e ricominci la campagna per ottenere medaglie
permanenti. Testi in italiano e inglese (scelta automatica dalla lingua del telefono).

Il gioco è una web app (Vite, JavaScript senza framework, grafica su canvas) impacchettata con
[Capacitor](https://capacitorjs.com) per gli store.

## Come si gioca

I meccanismi seguono quelli di **Forge Master: Idle RPG**, ricostruiti dalle guide e dalle tabelle pubblicate
dalla community (ForgeMaster Helper, aggiornamento 31/12/2025): probabilità della forgia per livello, costi e
tempi dei potenziamenti, rarità di casse, manovre ed emblemi, tempi della ricerca, leghe e guerra tra clan.
Nomi, grafica e tema sono nostri (aviazione); le corrispondenze sono indicate tra parentesi.

- **Officina** (forgia): ogni chiave inglese (martello) costruisce un pezzo a caso per uno degli 8 posti
  dell'aereo: 4 danno, 4 vita. Il pezzo ha un livello e un'epoca tra 10 (Pionieri … Mitica, come Primitive …
  Divine); dall'epoca 1 ha statistiche secondarie (cadenza, critico, danno critico, doppio colpo, assorbimento,
  rigenerazione, parata, danno e ricarica delle manovre). Si monta o si vende per monete; la vendita è la fonte
  principale di monete, come nell'originale.
- **Livello dell'officina**: 35 livelli con le probabilità delle epoche dell'originale. Si paga a rate (fino a
  10) e poi richiede tempo reale: 5 minuti per il livello 2, 7 ore e mezza per il 7, giorni più avanti. Video per
  -30 minuti, gemme per finire subito.
- **Costruzione automatica** dalla missione 2-10, si ferma quando esce un pezzo da un'epoca scelta. Costruzione
  doppia e tripla alle missioni 5-15 e 7-15.
- **Missioni** a capitoli di 20 (1-1 … 1-20), tre ondate per missione, boss a tempo all'ultima. La vita della
  squadriglia si ricarica a ogni missione; se finisce si arretra di una missione.
- **Manovre** (abilità), dalla 2-15: 12 abilità attive in 6 rarità, reclutate con i piani di volo. Fino a 4 posti,
  lancio automatico o manuale, livello di reclutamento che migliora le rarità (tabella dell'originale).
- **Droni di scorta** (animali), dalla 3-1: escono dalle casse con tempi di consegna da 30 minuti a 32 ore. I
  doppioni si fondono e salgono di livello. Fino a 3 posti.
- **Emblemi** (cavalcature), dalla 4-15: +10% … +400% a danno e vita per rarità, dipinti con la vernice.
- **Ricerca** (albero tecnologico): 24 nodi in tre rami (officina, potenza, squadra), 25 livelli ciascuno in 5
  gradi sbloccati dalle missioni, con i tempi e i costi in progetti dell'originale.
- **Dungeon**: Assalto al deposito (chiavi inglesi e monete, 2-10), Base fantasma (piani di volo, 2-15),
  Invasione (casse, 3-1), Sciame (progetti, 4-1). Due chiavi al giorno, usate solo se si vince, livelli 1-1 …
  10-10 e combattimento rapido sull'ultimo livello superato.
- **Arena** dalla 3-10: lega settimanale con gironi da 100 piloti dello stesso server, da Senza lega a Diamante,
  promozioni e retrocessioni e premi con le soglie dell'originale. Stagione martedì-domenica, lunedì di pausa,
  biglietti giornalieri che non si accumulano.
- **Alleanze** dalla 4-15, fino a 50 piloti, 24 ore di attesa dopo l'uscita. **Guerra settimanale** contro
  un'alleanza rivale: ogni giorno conta un tipo di azione (martedì forgia e ricerca, mercoledì monete spese,
  dungeon e casse, …, domenica attacchi ai piloti rivali) e vale da 1 a 5 punti. Le fasce S/A/B/C decidono i premi.
- **Chat** globale del server e dell'alleanza; **server** assegnati per data d'iscrizione.
- **Guadagni offline** fino a 4 ore, premio giornaliero, obiettivi, **Pass di volo** di 30 gradi con fila Premium.

## Monetizzazione

| Fonte | Dove | Cosa dà |
| --- | --- | --- |
| Video con premio | Officina, Ricerca, Casse | 30 minuti in meno sul timer |
| Video con premio | Negozio | 60 chiavi inglesi ogni 10 minuti, 5 gemme ogni 15 |
| Video con premio | Ritorno dopo l'assenza | Raddoppia monete e chiavi inglesi offline |
| Gemme | Ovunque ci sia un timer | Completare subito (1 gemma ogni 2 minuti rimasti) |
| Gemme | Negozio | Chiavi inglesi, chiavi dei dungeon, vernice, piani di volo; fondare un'alleanza |
| Acquisto | \`premium_pass\` | Seconda fila di premi del Pass per la stagione (30 giorni) |
| Acquisto | \`gems_80\`, \`gems_500\`, \`gems_1200\`, \`gems_3000\` | Pacchetti di gemme (consumabili) |
| Acquisto | \`starter_pack\` | 300 gemme + 500 chiavi inglesi, una volta sola |
| Acquisto | \`remove_ads\` | Tutti i premi video senza guardare annunci (non consumabile) |

Come nell'originale, la leva principale sono i **timer** (officina, ricerca, casse) e il **Pass Premium**.
Non ci sono annunci forzati; un banner è previsto ma spento (\`banner.enabled\` in \`src/config.js\`).
Il Pass Premium va creato sugli store come prodotto consumabile e venduto una volta per stagione.

## Sviluppo

```bash
npm install
npm run dev      # gioco nel browser su http://localhost:5173
npm test         # test della logica e del bilanciamento
npm run build    # build di produzione in dist/
```

Nel browser non esiste uno store: i video diventano un conto alla rovescia di prova e gli acquisti una finestra
di conferma che non addebita nulla. Sui telefoni si usano AdMob e gli store veri.

Struttura: `src/game.js` (regole, senza DOM), `src/data.js` e `src/tables.js` (numeri, tabelle e prezzi),
`src/render.js` (canvas), `src/ui.js`, `src/ui-squad.js`, `src/ui-progress.js`, `src/ui-online.js` (schermate),
`src/icons.js` (icone), `src/monetization.js` (AdMob + RevenueCat), `src/i18n.js` (testi),
`shared/social.js` (regole online), `server/index.js` (server).

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
- **Avversari d'addestramento**: se un girone ha pochi giocatori l'arena si completa con bot, indicati come tali.
- **Settimana di gioco**: lega e guerra partono il martedì alle 00:00 UTC; il lunedì si chiudono stagione e
  guerra, e i premi arrivano al primo accesso successivo.
- **Hosting**: qualsiasi servizio che esegua Node 20+ con un disco persistente (variabili `PORT` e `DATA_DIR`).

Limiti da conoscere prima del lancio:

- La potenza del giocatore viene comunicata dall'app e il server si fida: un'app modificata può barare in
  arena. Per classifiche con premi veri serve ricalcolare i progressi sul server.
- I premi online (lega e guerra) e i punti di guerra vengono accreditati o comunicati dall'app, per lo stesso
  motivo: un'app modificata può gonfiarli.
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

Provato nel browser in emulazione telefono: officina con rate e probabilità, costruzione automatica, missioni e
ondate, manovre, droni e casse, emblemi, ricerca, dungeon, Pass, negozio, salvataggio, arena, alleanza, guerra
e chat in modalità demo. Le regole sono coperte da test automatici (`npm test`) e il ritmo è stato verificato
con una simulazione di 72 ore di gioco: missione 4-9 dopo 24 ore e 5-16 dopo 48, vicino al riferimento
dell'originale ("4-15 in un giorno con una buona configurazione").

Non ancora fatto: server messo in rete e provato con giocatori veri; integrazione nativa con AdMob e RevenueCat
eseguita su un dispositivo (segue le API dei plugin installati, va verificata con gli ID di test). I numeri di
stage, danni dei nemici e premi delle nostre risorse sono nostri: le guide pubbliche non li riportano.
