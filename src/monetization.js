// Pubblicità con premio (AdMob) e acquisti in-app (RevenueCat).
// Sul web / in anteprima non esiste uno store: annunci e acquisti sono simulati.
import { Capacitor } from '@capacitor/core';
import { CONFIG } from './config.js';
import { PRODUCTS } from './data.js';

const native = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

let AdMob = null, AdEvents = null, adsReady = false;
let Purchases = null, storeProducts = {};
let mock = { ad: async () => true, confirm: async () => true };

export const Monet = {
  native,
  /** L'interfaccia fornisce le finestre usate dalla simulazione web. */
  setMockUI(ui) { mock = ui; },

  async init({ noAds }) {
    if (!native) return;
    await Promise.allSettled([initAds(noAds), initStore()]);
  },

  /** Mostra un video con premio. Risolve true solo se il premio è stato guadagnato. */
  async showRewarded() {
    if (!native) return mock.ad();
    if (!adsReady) return false;
    const handles = [];
    try {
      const adId = CONFIG.admob.rewarded[platform];
      await AdMob.prepareRewardVideoAd({ adId, isTesting: CONFIG.admob.testMode });
      let earned = false;
      const closed = new Promise((resolve) => {
        handles.push(AdMob.addListener(AdEvents.Rewarded, () => { earned = true; }));
        handles.push(AdMob.addListener(AdEvents.Dismissed, () => resolve()));
        handles.push(AdMob.addListener(AdEvents.FailedToShow, () => resolve()));
      });
      AdMob.showRewardVideoAd().then(() => { earned = true; }).catch(() => {});
      await closed;
      return earned;
    } catch (err) {
      console.warn('rewarded ad failed', err);
      return false;
    } finally {
      for (const h of handles) h.then((x) => x.remove()).catch(() => {});
    }
  },

  async showPrivacyOptions() {
    if (!adsReady) return;
    try { await AdMob.showPrivacyOptionsForm(); } catch (err) { console.warn(err); }
  },

  storeAvailable() { return !native || Object.keys(storeProducts).length > 0; },
  price(id) {
    return storeProducts[id]?.priceString ?? PRODUCTS.find((p) => p.id === id).price;
  },

  /** Risolve true se il pagamento è andato a buon fine (il contenuto lo consegna il gioco). */
  async purchase(id) {
    if (!native) return mock.confirm(id);
    const product = storeProducts[id];
    if (!product) return false;
    try {
      await Purchases.purchaseStoreProduct({ product });
      return true;
    } catch (err) {
      if (!err?.userCancelled) console.warn('purchase failed', err);
      return false;
    }
  },

  /** Restituisce gli id dei prodotti permanenti già comprati con questo account store. */
  async restore() {
    if (!native || !Purchases) return [];
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const ids = new Set(customerInfo.nonSubscriptionTransactions.map((t) => t.productIdentifier));
      return PRODUCTS.filter((p) => p.perk && ids.has(p.id)).map((p) => p.id);
    } catch (err) {
      console.warn('restore failed', err);
      return [];
    }
  },
};

async function initAds(noAds) {
  const mod = await import('@capacitor-community/admob');
  AdMob = mod.AdMob; AdEvents = mod.RewardAdPluginEvents;
  // Consenso GDPR (obbligatorio in UE) e richiesta di tracciamento su iOS.
  try {
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
    if (platform === 'ios') {
      const { status } = await AdMob.trackingAuthorizationStatus();
      if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
    }
  } catch (err) { console.warn('consent flow failed', err); }
  await AdMob.initialize({ initializeForTesting: CONFIG.admob.testMode });
  adsReady = true;
  if (CONFIG.admob.banner.enabled && !noAds) {
    await AdMob.showBanner({
      adId: CONFIG.admob.banner[platform], isTesting: CONFIG.admob.testMode,
      adSize: mod.BannerAdSize.ADAPTIVE_BANNER, position: mod.BannerAdPosition.BOTTOM_CENTER,
    });
  }
}

async function initStore() {
  const apiKey = CONFIG.revenuecat[platform];
  if (!apiKey || apiKey.startsWith('REPLACE')) return;
  const mod = await import('@revenuecat/purchases-capacitor');
  await mod.Purchases.configure({ apiKey });
  Purchases = mod.Purchases;
  const { products } = await Purchases.getProducts({
    productIdentifiers: PRODUCTS.map((p) => p.id), type: 'NON_SUBSCRIPTION',
  });
  storeProducts = Object.fromEntries(products.map((p) => [p.identifier, p]));
}
