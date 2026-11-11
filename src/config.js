// Configurazione di pubblicazione. Sostituisci i valori "TEST"/"REPLACE" prima del rilascio.
// Gli ID AdMob qui sotto sono gli ID di TEST ufficiali di Google: non generano ricavi.
export const CONFIG = {
  // Indirizzo del server online (server/index.js), es. 'https://tuo-server.example.com'.
  // Vuoto = modalità demo: arena, alleanze e chat girano sul telefono con giocatori simulati.
  serverUrl: '',
  admob: {
    testMode: true, // metti false SOLO con i tuoi ID reali
    rewarded: {
      android: 'ca-app-pub-3940256099942544/5224354917',
      ios: 'ca-app-pub-3940256099942544/1712485313',
    },
    banner: {
      enabled: false, // banner in basso: pochi ricavi, peggiora l'esperienza
      android: 'ca-app-pub-3940256099942544/6300978111',
      ios: 'ca-app-pub-3940256099942544/2934735716',
    },
  },
  revenuecat: {
    android: 'REPLACE_WITH_REVENUECAT_GOOGLE_KEY',
    ios: 'REPLACE_WITH_REVENUECAT_APPLE_KEY',
  },
};
