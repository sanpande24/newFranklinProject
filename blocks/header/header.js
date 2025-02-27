import { debounce, getMetadata } from '../../scripts/aem.js';
import {
  input, div, ul, li, span, a,
} from '../../scripts/dom-builder.js';
import { getCookie } from '../../scripts/scripts.js';

const windowWidth = document.body.offsetWidth;

let coveoSearchValue = '';

function addClassesToMenuItems(element, depth) {
  const childItems = element.children;
  for (let i = 0; i < childItems.length; i += 1) {
    const item = childItems[i];
    // Add class to the immediate child element
    item.classList.add('hs-menu-item', `hs-menu-depth-${depth}`);
    const link = item.querySelector('a');
    const { parentElement } = link;
    if (parentElement.tagName.toLowerCase() === 'strong') {
      link.setAttribute('target', '_blank');
    }
    if (link && link.pathname === window.location.pathname) {
      item.classList.add('active');
    }
    const childElement = item.querySelector('ul');

    if (childElement?.children?.length > 0) {
      if (windowWidth < 961) {
        const spanElement = span({ class: 'arrow' });
        childElement.style.display = 'none';
        spanElement.addEventListener('click', () => {
          if (
            childElement.style.display === 'block'
            || childElement.style.display === ''
          ) {
            childElement.style.display = 'none';
            item.classList.remove('open');
          } else {
            childElement.style.display = 'block';
            item.classList.add('open');
          }
        });
        item.prepend(spanElement);
      }
      item.appendChild(link);
      item.appendChild(childElement);
      const nextDepth = depth + 1;
      addClassesToMenuItems(childElement, nextDepth);
    }
  }
}

function getRecentSearches() {
  const recentSearchesString = localStorage.getItem('coveo-recent-queries');
  const recentSearches = recentSearchesString ? JSON.parse(recentSearchesString) : [];
  return recentSearches.slice(0, 3);
}

function setRecentSearches(value) {
  const recentSearches = getRecentSearches();
  const searchValueIndex = recentSearches.findIndex((search) => (
    search.toLowerCase() === value.toLowerCase()
  ));
  if (searchValueIndex > -1) recentSearches.splice(searchValueIndex, 1);
  recentSearches.unshift(value);
  localStorage.setItem('coveo-recent-queries', JSON.stringify(recentSearches.slice(0, 3)));
}

function submitSearchPage() {
  const inputValue = document.querySelector('.mobile-search .coveo-search')?.value?.trim();
  if (inputValue && inputValue !== '') {
    document.querySelectorAll('.coveo-search').forEach((searchInputEl) => {
      searchInputEl.blur();
    });
    window.location = `${window.location.origin}/search#q=${inputValue}`;
  }
}

function onClickOfitems(value) {
  setRecentSearches(value);
  document.querySelectorAll('.coveo-search').forEach((inpEl) => {
    inpEl.value = value;
    inpEl.focus();
    inpEl.click();
    submitSearchPage();
  });
}

function toggleSearchDropdown(event, mode) {
  if (mode === 'focus') {
    event.target.parentElement.nextSibling.classList.add('show');
  } else if (mode === 'blur') {
    setTimeout(() => {
      event.target.parentElement.nextSibling.classList.remove('show');
    }, 500);
  }
}

async function addRecentSearch() {
  let recentSearches = getRecentSearches();
  if (recentSearches.length > 0) {
    recentSearches = recentSearches.reverse();
    const parentEls = document.querySelectorAll('div.coveo-search-dropdown-menu .all-recent-searches ul');
    parentEls.forEach((parentEl) => {
      parentEl.innerHTML = '';
      recentSearches.forEach((el) => {
        const item = li({ class: 'recent-search-item', onclick: () => onClickOfitems(el) });
        item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0"/></svg> ${el}`;
        parentEl.prepend(item);
      });
    });
  }
}

async function buildSearchSuggestions(response) {
  const parentEls = document.querySelectorAll('div.coveo-search-dropdown-menu ul.suggestions');
  if (parentEls.length > 0) {
    parentEls.forEach((parentEl) => {
      parentEl.innerHTML = '';
      if (response && response.completions && response.completions.length > 0) {
        response?.completions?.forEach((el) => {
          if (el && el.expression) {
            const item = li({ onclick: () => onClickOfitems(el.expression) });
            item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/></svg> ${el.expression}`;
            parentEl.append(item);
          }
        });
      }
    });
  }
}

function getCoveoPayload(values) {
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userTimestamp = new Date().toISOString();
  const clientId = getCookie('coveo_visitorId');
  const searchHistoryString = localStorage.getItem('__coveo.analytics.history');
  const searchHistory = searchHistoryString ? JSON.parse(searchHistoryString) : [];
  const payload = {
    analytics: {
      clientId,
      clientTimestamp: userTimestamp,
      documentLocation: window.location.href,
      documentReferrer: document.referrer,
      originContext: 'Search',
    },
    locale: 'en',
    pipeline: 'Aldevron Marketplace',
    searchHub: 'AldevronMainSearch',
    actionsHistory: searchHistory.map(({ time, value, name }) => ({ time, value, name })),
    timezone: userTimeZone,
    q: values,
    count: 8,
    referrer: document.referrer,
    visitorId: clientId,
  };
  return payload;
}

async function fetchSuggestions(value) {
  try {
    const payload = getCoveoPayload(value);
    const organizationId = window.aldevronConfig?.searchOrg;
    const accessToken = window.aldevronConfig?.searchKey;
    const domain = window.aldevronConfig?.origin;
    const path = window.aldevronConfig?.path;
    const apiURL = `https://${organizationId}${domain}${path}`;
    const resp = await fetch(
      apiURL,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    const response = await resp.json();
    buildSearchSuggestions(response);
    coveoSearchValue = value;
  } catch (error) {
    /* eslint-disable no-console */
    console.log('Error', error);
  }
}

function customCoveoSearch() {
  const searchIcon = div({
    onclick: () => {
      const mobileValue = document.querySelector('.mobile-search .coveo-search')?.value;
      if (mobileValue && mobileValue !== '') {
        setRecentSearches(mobileValue);
        submitSearchPage();
      }
    },
  });
  searchIcon.innerHTML = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z" /><span class="sr-only">Search</span>';
  const customSearchDiv = div(
    { class: 'coveo-search-dropdown custom-search', onclick: (event) => event.stopPropagation() },
    div(
      { class: 'coveo-searchbox' },
      input({
        type: 'text',
        class: 'coveo-search',
        value: '',
        autocomplete: 'off',
        placeholder: 'Search here...',
        onfocus: (event) => toggleSearchDropdown(event, 'focus'),
        onblur: (event) => toggleSearchDropdown(event, 'blur'),
        onkeyup: debounce((event) => {
          const { value } = event.target;
          if (event.keyCode === 13) {
            submitSearchPage();
            if (value !== '') setRecentSearches(value);
          } else {
            document.querySelector('.mobile-search .coveo-search').value = value;
            if (value === '') {
              addRecentSearch();
              if (coveoSearchValue !== value) fetchSuggestions(value);
            } else {
              fetchSuggestions(value);
              document.querySelectorAll('.all-recent-searches ul').forEach((recentEl) => {
                recentEl.innerHTML = '';
              });
              document.querySelectorAll('.recent-search-item').forEach((recentItemEl) => {
                recentItemEl.remove();
              });
            }
          }
        }, 100),
      }),
      searchIcon,
    ),
    div(
      { class: 'coveo-search-dropdown-menu' },
      div(
        { class: 'all-recent-searches' },
        ul(),
        span({ class: 'recent-searches' }, 'Recent Searches'),
        span({
          class: 'clear-recent-searches',
          onclick: () => {
            localStorage.removeItem('coveo-recent-queries');
            document.querySelectorAll('.recent-search-item').forEach((event) => event.parentNode.removeChild(event));
          },
        }, 'Clear'),
      ),
      ul({ 'aria-labelledby': 'coveo-searchbox', class: 'suggestions' }),
    ),
  );
  return customSearchDiv;
}

/**
 * decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // fetch nav content
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta).pathname : '/nav';
  const resp = await fetch(`${navPath}.plain.html`);

  if (resp.ok) {
    const html = await resp.text();

    const htmlElements = div();
    htmlElements.innerHTML = html;
    const childElements = htmlElements.querySelector('div');
    // decorate nav DOM
    const nav = document.createElement('header');
    nav.id = 'header';

    const outer = div({ class: 'outer' });
    nav.appendChild(outer);

    const logo = a({ id: 'logo', href: '/', 'aria-label': 'Aldevron Logo' });
    logo.innerHTML = childElements.children[0].innerHTML;
    outer.appendChild(logo);

    const headerNav = div({ id: 'header-nav' });

    const mobileNav = div(
      {
        id: 'mobile-nav',
        onclick: () => headerNav.classList.toggle('hover'),
      },
      span({ class: 'icon-menu' }),
    );

    const headerNavIn = div({ id: 'header-nav-in' });
    const headerInfo = div({ id: 'header-info' });

    // Desktop Coveo Search
    const coveoSearch = customCoveoSearch();
    // Mobile Coveo Search
    const clonedCustomSearchDiv = customCoveoSearch();
    clonedCustomSearchDiv.classList.add('mobile-search');
    coveoSearch.classList.add('desktop-search');

    if (!window.location.pathname.includes('/search')) {
      headerInfo.appendChild(coveoSearch);
      // Append the custom search div to the document body or any other parent element
      outer.appendChild(clonedCustomSearchDiv);
    }
    const listElements = div();

    listElements.innerHTML = childElements.children[1].innerHTML;

    const elements = listElements.querySelectorAll('li');
    elements.forEach((liEl) => {
      const anchor = liEl.querySelector('a');
      if (anchor) {
        if (anchor.parentElement.tagName === 'STRONG') {
          anchor.setAttribute('target', '_blank');
        }
        // Get the first word of the anchor's inner text
        const firstWord = anchor.innerText.split(' ')[0].toLocaleLowerCase();
        // Set the first word as a class name
        anchor.classList.add(firstWord);
        // Append the modified anchor to headerInfo
        headerInfo.appendChild(anchor.cloneNode(true));
      }
    });
    // document.body.appendChild(headerInfo);
    const headerMenu = document.createElement('nav');
    headerMenu.id = 'menu';

    const menuWrapper = document.createElement('div');
    menuWrapper.id = 'hs_menu_wrapper_mainmenu';
    menuWrapper.classList.add(...'hs-menu-wrapper active-branch no-flyouts hs-menu-flow-horizontal'.split(' '));
    const menuList = childElements.children[2].innerHTML;

    // Create a temporary div element
    const tempDiv = document.createElement('ul');

    // Set the innerHTML of the temporary div
    tempDiv.innerHTML = menuList;

    // Find the ul element within the temporary div
    const menuListWrapper = tempDiv;

    // Append menuListWrapper to headerMenu
    menuWrapper.appendChild(menuListWrapper);
    headerMenu.appendChild(menuWrapper);

    // Add classes to menu items
    addClassesToMenuItems(menuListWrapper, 1);

    headerNavIn.appendChild(headerInfo);
    headerNavIn.appendChild(headerMenu);

    headerNav.appendChild(headerNavIn);
    headerNav.appendChild(mobileNav);
    outer.appendChild(headerNav);

    block.append(nav);
    addRecentSearch();
    fetchSuggestions('');
  }
}
