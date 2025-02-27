import {
  buildBlock,
  capitalizeWords,
  decorateBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateTemplateAndTheme,
  getMetadata,
  loadBlocks,
  loadCSS,
  loadFooter,
  loadHeader,
  sampleRUM,
  toClassName,
  waitForLCP,
} from './aem.js';

const LCP_BLOCKS = ['hero-carousel', 'forms']; // add your LCP blocks to the list

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/Typo.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

const TEMPLATE_LIST = [
  'default',
  'blog',
  'news',
  'anniversary',
  'landing-page',
  'event',
];

const CATEGORY_LIST = [
  'plasmids',
  'proteins',
  'mrna',
];

/**
 * Run template specific decoration code.
 * @param {Element} main The container element
 */
async function decorateTemplates(main) {
  try {
    const template = toClassName(getMetadata('template'));
    if (TEMPLATE_LIST.includes(template)) {
      const templateName = capitalizeWords(template);
      const mod = await import(`../templates/${templateName}/${templateName}.js`);
      loadCSS(`${window.hlx.codeBasePath}/templates/${templateName}/${templateName}.css`);
      if (mod.default) {
        await mod.default(main);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Run template specific decoration code.
 * @param {Element} main The container element
 */
async function decorateCategory(main) {
  try {
    const category = toClassName(getMetadata('category'));
    if (CATEGORY_LIST.includes(category)) {
      const categoryName = capitalizeWords(category);
      const mod = await import(`../category/${categoryName}/${categoryName}.js`);
      loadCSS(`${window.hlx.codeBasePath}/category/${categoryName}/${categoryName}.css`);
      if (mod.default) {
        await mod.default(main);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

function findParentListItem(content, url) {
  const matchingChild = Array.from(content.children).find((child) => !!child.querySelector(`a[href="${url}"]`));
  if (matchingChild) {
    const element = matchingChild.querySelector(`a[href="${url}"]`);
    const elementParent = element.closest('li');
    if (elementParent) {
      elementParent.classList.add('active');
      Array.from(elementParent.parentNode.children).forEach((sibling) => {
        sibling.style.display = 'block';
      });
    }
    return matchingChild.querySelector('ul') || null;
  }
  return null;
}

async function getSubNavigation(pathname) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta).pathname : '/nav';
  const resp = await fetch(`${navPath}.plain.html`);

  if (resp.ok) {
    const html = await resp.text();
    const headerElement = document.createElement('div');
    headerElement.innerHTML = html;
    const lastUlElement = headerElement.querySelector('div > div > ul:last-child');
    return findParentListItem(lastUlElement, pathname);
  }
  return '';
}

async function decorateNavigation(main) {
  if (getMetadata('navigation')) {
    const sidebarElement = main.querySelector('#sidebar');
    const navigation = await getSubNavigation(window.location.pathname);
    if (navigation) {
      const links = navigation.querySelectorAll('a');
      links.forEach((link) => {
        if (link.parentElement.tagName === 'STRONG') {
          link.setAttribute('target', '_blank');
        }
      });
      const block = await buildBlock('sidebar-navigation', navigation);
      sidebarElement.prepend(block);
      if (document.body.classList.contains('full-width')) {
        document.body.classList.remove('full-width');
      }
    }
  }
}

/**
 * Builds embed block for inline links to known social platforms.
 * @param {Element} main The container element
 */
function buildEmbedBlocks(main) {
  const HOSTNAMES = [
    'youtube',
    'youtu',
  ];
  [...main.querySelectorAll(':is(p, div) > a[href]:only-child')]
    .filter((a) => HOSTNAMES.includes(new URL(a.href).hostname.split('.').slice(-2, -1).pop()))
    .forEach((a) => {
      const parent = a.parentElement;
      const block = buildBlock('embed', { elems: [a] });
      parent.replaceWith(block);
      decorateBlock(block);
    });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildEmbedBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

function initATJS(path, config) {
  window.targetGlobalSettings = config;
  window.targetPageParams = function getTargetPageParams() {
    return {
      at_property: '08436c44-3085-b335-a1c4-03f14ae5226a',
    };
  };
  return new Promise((resolve) => {
    import(path).then(resolve);
  });
}

function onDecoratedElement(fn) {
  // Apply propositions to all already decorated blocks/sections
  if (document.querySelector('[data-block-status="loaded"],[data-section-status="loaded"]')) {
    fn();
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.target.tagName === 'BODY'
      || m.target.dataset.sectionStatus === 'loaded'
      || m.target.dataset.blockStatus === 'loaded')) {
      fn();
    }
  });
  // Watch sections and blocks being decorated async
  observer.observe(document.querySelector('main'), {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-block-status', 'data-section-status'],
  });
  // Watch anything else added to the body
  observer.observe(document.querySelector('body'), { childList: true });
}

function toCssSelector(selector) {
  return selector.replace(/(\.\S+)?:eq\((\d+)\)/g, (_, clss, i) => `:nth-child(${Number(i) + 1}${clss ? ` of ${clss})` : ''}`);
}

async function getElementForOffer(offer) {
  const selector = offer.cssSelector || toCssSelector(offer.selector);
  return document.querySelector(selector);
}

async function getElementForMetric(metric) {
  const selector = toCssSelector(metric.selector);
  return document.querySelector(selector);
}

async function getAndApplyOffers() {
  const response = await window.adobe.target.getOffers({ request: { execute: { pageLoad: {} } } });
  const { options = [], metrics = [] } = response.execute.pageLoad;
  onDecoratedElement(() => {
    window.adobe.target.applyOffers({ response });
    // keeping track of offers that were already applied
    // eslint-disable-next-line no-return-assign
    options.forEach((o) => o.content = o.content.filter((c) => !getElementForOffer(c)));
    // keeping track of metrics that were already applied
    // eslint-disable-next-line no-confusing-arrow
    metrics.map((m, i) => getElementForMetric(m) ? i : -1)
      .filter((i) => i >= 0)
      .reverse()
      .map((i) => metrics.splice(i, 1));
  });
}

let atjsPromise = Promise.resolve();
atjsPromise = initATJS('./at.js', {
  clientCode: 'danaher',
  serverDomain: 'danaher.tt.omtrdc.net',
  imsOrgId: '08333E7B636A2D4D0A495C34@AdobeOrg',
  bodyHidingEnabled: false,
  cookieDomain: window.location.hostname,
  pageLoadEnabled: false,
  secureOnly: true,
  viewsEnabled: false,
  withWebGLRenderer: false,
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Error loading at.js', e);
});
document.addEventListener('at-library-loaded', () => getAndApplyOffers());

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    await decorateTemplates(main);
    await decorateCategory(main);
    await decorateNavigation(main);
    await atjsPromise;

    await new Promise((resolve) => {
      window.requestAnimationFrame(async () => {
        document.body.classList.add('appear');
        await waitForLCP(LCP_BLOCKS);
        resolve();
      });
    });
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  await loadHeader(doc.querySelector('header'));
  await loadFooter(doc.querySelector('footer'));

  await loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  await loadFonts();

  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

/*
To Continue Smoother flow of UTMs across the pages user visits in same session.
*/

// check if UTM parameters exist in the URL
function checkUTMParametersExist() {
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source');
  const utmMedium = urlParams.get('utm_medium');
  const utmCampaign = urlParams.get('utm_campaign');
  const utmTerm = urlParams.get('utm_term');
  const utmContent = urlParams.get('utm_content');

  // Check if any of the UTM parameters exist
  if (utmSource || utmMedium || utmCampaign || utmTerm || utmContent) {
    return true; // UTM parameters exist
  }
  return false; // UTM parameters do not exist
}

// Get UTM parameters from the URL
function getUTMParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  // Define UTM parameter names
  const utmSource = urlParams.get('utm_source');
  const utmMedium = urlParams.get('utm_medium');
  const utmCampaign = urlParams.get('utm_campaign');
  const utmTerm = urlParams.get('utm_term');
  const utmContent = urlParams.get('utm_content');

  // Create an object to store UTM parameters
  const utmData = {
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_term: utmTerm,
    utm_content: utmContent,
  };

  return utmData;
}

// To store UTM parameters in local storage
function storeUTMParameters() {
  const utmData = getUTMParameters();

  // Check if UTM parameters exist
  if (Object.values(utmData).some((param) => param !== null && param !== undefined)) {
    // Convert the object to a JSON string and store it in local storage
    sessionStorage.setItem('utm_data', JSON.stringify(utmData));
  }
}

function checkUTMParametersInLocalStorage() {
  const utmDataString = sessionStorage.getItem('utm_data');
  return utmDataString !== null && utmDataString !== undefined;
}

// Retrive UTM parameters from storage.
function getUTMDataFromLocalStorage() {
  const utmDataString = sessionStorage.getItem('utm_data');
  if (utmDataString) {
    return JSON.parse(utmDataString);
  }
  return null;
}

// To add UTM parameters to the browser's URL
function addUTMParametersToURL() {
  const utmData = getUTMDataFromLocalStorage();
  if (utmData) {
    const urlParams = new URLSearchParams(window.location.search);
    Object.keys(utmData).forEach((key) => {
      if (!urlParams.has(key) && utmData[key]) {
        urlParams.append(key, utmData[key]);
      }
    });
    const newURL = `${window.location.origin}${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, document.title, newURL);
  }
}

function correctUTMFlow() {
  if (checkUTMParametersExist()) {
    /* console.log('UTM parameters exist in the URL.');
    Call the function to store UTM parameters when the page loads */
    storeUTMParameters();
  } else if (checkUTMParametersInLocalStorage()) {
    // console.log('UTM parameters do not exist in the URL but present in Local storage');
    addUTMParametersToURL();
  } else {
    // console.log('No UTMs Found!');
  }
}

function getCookie(e) {
  let t = decodeURIComponent(
    document.cookie.replace(
      new RegExp(
        `(?:(?:^|.*;)\\s*${
          encodeURIComponent(e).replace(/[\\-\\.\\+\\*]/g, '\\$&')
        }\\s*\\=\\s*([^;]*).*$)|^.*$`,
      ),
      '$1',
    ),
  ) || null;
  if (
    t
    && ((t.substring(0, 1) === '{'
      && t.substring(t.length - 1, t.length) === '}')
      || (t.substring(0, 1) === '['
        && t.substring(t.length - 1, t.length) === ']'))
  ) {
    try {
      t = JSON.parse(t);
    } catch (error) { /* eslint-disable no-console */ console.log('Error', error); }
  }
  return t;
}

if (window.location.host === 'www.aldevron.com') {
  window.aldevronConfig = {
    searchOrg: 'danaherproductionrfl96bkr',
    searchKey: 'xxf0b61992-52f5-41c5-8b5d-e4770521e916',
    origin: '.org.coveo.com',
    path: '/rest/search/v2/querySuggest',
  };
} else {
  window.aldevronConfig = {
    searchOrg: 'danahernonproduction1892f3fhz',
    searchKey: 'xx36c41356-a0e5-4071-bcae-d27539d778e2',
    origin: '.org.coveo.com',
    path: '/rest/search/v2/querySuggest',
  };
}

export function formatDateRange(startdate, enddate) {
  const options = {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  };
  const startDate = new Date(Number(startdate - 25569) * 24 * 60 * 60 * 1000).toUTCString();
  const endDate = new Date(Number(enddate - 25569) * 24 * 60 * 60 * 1000).toUTCString();
  const formattedStartDate = new Date(startDate).toLocaleDateString('en-us', options);
  const formattedEndDate = new Date(endDate).toLocaleDateString('en-us', options);
  const startYear = new Date(formattedStartDate).getFullYear();
  const endYear = new Date(formattedEndDate).getFullYear();
  const differentYear = startYear !== endYear;
  let dateRangeString;
  if (differentYear) {
    dateRangeString = `${formattedStartDate} - ${formattedEndDate}`;
  } else {
    dateRangeString = `${(formattedStartDate).split(',')[0]} - ${formattedEndDate}`;
  }
  return dateRangeString;
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
  correctUTMFlow();
}

loadPage();
export { getCookie };
