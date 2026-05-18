/* ========================================================
   NEXUSS AI — Service Worker Registration
   Statically extractable script for PWA Builder analyzer
   ======================================================== */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js')
      .then(function (reg) {
        console.log('✅ Service Worker registered successfully:', reg.scope);
      })
      .catch(function (err) {
        console.warn('❌ Service Worker registration failed:', err);
      });
  });
}
