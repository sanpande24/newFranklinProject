// add delayed functionality here
// eslint-disable-next-line import/no-cycle
import {
    sampleRUM, buildForm, isForm, loadFormDelayed, getFormMeetingConfig, loadScript,
  } from './aem.js';
  
  // Core Web Vitals RUM collection
  sampleRUM('cwv');
  
  // google tag manager -start
  function loadGTM() {
    const scriptTag = document.createElement('script');
    scriptTag.innerHTML = `
          let gtmId = 'GTM-MLWV3QQ';
          // googleTagManager
          (function (w, d, s, l, i) {
              w[l] = w[l] || [];
              w[l].push({
                  'gtm.start':
                      new Date().getTime(), event: 'gtm.js'
              });
              var f = d.getElementsByTagName(s)[0],
                  j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : '';
              j.async = true;
              j.src =
                  'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
              f.parentNode.insertBefore(j, f);
          })(window, document, 'script', 'dataLayer', gtmId);
          `;
    document.head.prepend(scriptTag);
    const noScriptTag = document.createElement('noscript');
    noScriptTag.innerHTML = `
    <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MLWV3QQ"
    height="0" width="0" style="display:none;visibility:hidden"></iframe>
    `;
    document.body.prepend(noScriptTag);
  }
  // google tag manager -end
  
  if (
    !window.location.hostname.includes('localhost')
      && !document.location.hostname.includes('.hlx')
  ) {
    loadGTM();
  }
  
  // Fathom Analytics Code
  const attrsFa = JSON.parse('{"data-site": "TSVSBXOE"}');
  loadScript('https://cdn.usefathom.com/script.js', attrsFa);
  
  // HubSpot Tracking Code
  function loadHsScript() {
    const hsScriptEl = document.createElement('script');
    hsScriptEl.type = 'text/javascript';
    hsScriptEl.async = true;
    hsScriptEl.defer = true;
    hsScriptEl.setAttribute('id', 'hs-script-loader');
    hsScriptEl.src = '//js.hs-scripts.com/1769030.js';
    document.querySelector('head').append(hsScriptEl);
  }
  loadHsScript();
  
  // HubSpot Form Code
  function loadHubSpot() {
    const hsScriptEl = document.createElement('script');
    hsScriptEl.type = 'text/javascript';
    hsScriptEl.async = true;
    hsScriptEl.setAttribute('id', 'hs-script-loader');
    hsScriptEl.src = '//js.hsforms.net/forms/v2.js';
    document.querySelector('head').append(hsScriptEl);
    hsScriptEl.addEventListener('load', () => {
      buildForm(hbspt); // eslint-disable-line
    });
  }
  
  // only load this if there is a form block
  if (isForm()) {
    loadHubSpot();
  }
  
  if (getFormMeetingConfig()) {
    loadFormDelayed();
  }
  
  // coveo analytics - start
  /* eslint-disable */
  (function (c, o, v, e, O, u, a) {
    a = 'coveoua';
    c[a] = c[a]
    || function () {
      (c[a].q = c[a].q || []).push(arguments);
    };
    c[a].t = Date.now();
  
    u = o.createElement(v);
    u.async = 1;
    u.src = e;
    O = o.getElementsByTagName(v)[0];
    O.parentNode.insertBefore(u, O);
  }(
    window,
    document,
    'script',
    'https://static.cloud.coveo.com/coveo.analytics.js/2/coveoua.js',
  ));
  /* eslint-enable */
  function sendCoveoEventPage() {
    const organizationId = window.aldevronConfig?.searchOrg;
    const accessToken = window.aldevronConfig?.searchKey;
  
    coveoua(// eslint-disable-line
      'init',
      accessToken,
      `https://${organizationId}.analytics.org.coveo.com`,
    );
  
    coveoua('send', 'view', {// eslint-disable-line
      contentIdKey: 'permanentid',
      contentIdValue: window.location.origin + window.location.pathname,
      language: 'en',
      username: 'anonymous',
      title: document.title,
      location: document.location.href,
      originLevel1: 'AldevronMainSearch',
    });
  }
  
  if (!window.location.hostname.includes('localhost')) {
    sendCoveoEventPage();
  }
  