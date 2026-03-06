(() => {
  if (window.PopupSystem && window.PopupSystem.__initialized) return;

  const FOCUSABLE_SELECTORS = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const SESSION_START_KEY = 'popup_session_start';
  let scrollLockCount = 0;

  const parseBool = (value, fallback = false) => {
    if (value === '' || value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    return value === 'true';
  };

  const parseNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const getStorage = (type) => {
    try {
      if (type === 'local') return window.localStorage;
      if (type === 'session') return window.sessionStorage;
      return null;
    } catch (error) {
      return null;
    }
  };

  const readStorage = (type, key) => {
    const storage = getStorage(type);
    if (!storage || !key) return null;
    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  };

  const writeStorage = (type, key, value) => {
    const storage = getStorage(type);
    if (!storage || !key) return false;
    try {
      storage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  };

  const getSessionStart = () => {
    const stored = readStorage('session', SESSION_START_KEY);
    if (stored) return parseNumber(stored, Date.now());
    const now = Date.now();
    writeStorage('session', SESSION_START_KEY, String(now));
    return now;
  };

  const ensureSessionStart = () => {
    getSessionStart();
  };

  const lockBodyScroll = () => {
    scrollLockCount += 1;
    if (scrollLockCount > 1) return;
    const body = document.body;
    if (!body) return;

    body.dataset.popupOverflow = body.style.overflow || '';
    body.style.overflow = 'hidden';

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      body.dataset.popupPaddingRight = body.style.paddingRight || '';
      const currentPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
  };

  const unlockBodyScroll = () => {
    if (scrollLockCount === 0) return;
    scrollLockCount -= 1;
    if (scrollLockCount > 0) return;

    const body = document.body;
    if (!body) return;

    if (body.dataset.popupOverflow !== undefined) {
      body.style.overflow = body.dataset.popupOverflow;
      delete body.dataset.popupOverflow;
    }

    if (body.dataset.popupPaddingRight !== undefined) {
      body.style.paddingRight = body.dataset.popupPaddingRight;
      delete body.dataset.popupPaddingRight;
    }
  };

  const getConfigFromDataset = (element) => ({
    id: element.dataset.popupId,
    type: element.dataset.popupType,
    lockScroll: parseBool(element.dataset.lockScroll, false),
    overlayClose: parseBool(element.dataset.overlayClose, true),
    delayMs: parseNumber(element.dataset.delay, 0) * 1000,
    autoCloseMs: parseNumber(element.dataset.autoClose, 0) * 1000,
    storageType: element.dataset.storageType,
    storageKey: element.dataset.storageKey,
    awarenessKey: element.dataset.awarenessKey,
    disabled: parseBool(element.dataset.disabled, false)
  });

  const getFocusableElements = (container) => {
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter((el) => {
      if (el.hasAttribute('disabled')) return false;
      return el.getClientRects().length > 0;
    });
  };

  const copyToClipboard = async (value) => {
    if (!value) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {
      return false;
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (error) {
      return false;
    }
  };

  class PopupSystemElement extends HTMLElement {
    constructor() {
      super();
      this._open = false;
      this._autoCloseTimer = null;
      this._openAbort = null;
      this._staticAbort = new AbortController();
      this._handleKeydown = this._handleKeydown.bind(this);
    }

    connectedCallback() {
      if (this._initialized) return;
      this._initialized = true;

      this._overlay = this.querySelector('[data-popup-overlay]');
      this._dialog = this.querySelector('[data-popup-dialog]');
      this._closeButton = this.querySelector('[data-popup-close]');
      this._promoButton = this.querySelector('[data-promo-copy]');
      this._promoHint = this.querySelector('[data-promo-hint]');

      if (this._closeButton) {
        this._closeButton.addEventListener('click', () => this.close(), {
          signal: this._staticAbort.signal
        });
      }

      if (this._overlay) {
        this._overlay.addEventListener(
          'click',
          (event) => {
            if (event.target !== this._overlay) return;
            const config = getConfigFromDataset(this);
            if (config.overlayClose) this.close();
          },
          { signal: this._staticAbort.signal }
        );
      }

      if (this._promoButton) {
        this._promoButton.addEventListener(
          'click',
          async () => {
            const value = this._promoButton.dataset.promoValue;
            const success = await copyToClipboard(value);
            if (!this._promoHint) return;
            const original = this._promoHint.textContent;
            this._promoHint.textContent = success ? 'Copied!' : 'Copy failed';
            window.setTimeout(() => {
              if (this._promoHint) this._promoHint.textContent = original;
            }, 2000);
          },
          { signal: this._staticAbort.signal }
        );
      }
    }

    disconnectedCallback() {
      if (this._openAbort) this._openAbort.abort();
      if (this._staticAbort) this._staticAbort.abort();
      this._initialized = false;
    }

    open() {
      if (this._open) return;
      const config = getConfigFromDataset(this);
      if (config.disabled) return;

      this._open = true;
      this._lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      this.hidden = false;
      this.setAttribute('aria-hidden', 'false');
      this.setAttribute('data-open', '');

      if (config.lockScroll) lockBodyScroll();

      this._openAbort = new AbortController();
      document.addEventListener('keydown', this._handleKeydown, { signal: this._openAbort.signal });

      const focusTarget = this._closeButton || getFocusableElements(this._dialog)[0] || this._dialog;
      if (focusTarget) {
        window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      }

      if (config.autoCloseMs > 0) {
        this._autoCloseTimer = window.setTimeout(() => this.close(), config.autoCloseMs);
      }

      this.dispatchEvent(
        new CustomEvent('popup:shown', {
          bubbles: true,
          detail: {
            id: config.id,
            type: config.type,
            storageKey: config.storageKey
          }
        })
      );
    }

    close() {
      if (!this._open) return;
      const config = getConfigFromDataset(this);

      this._open = false;
      this.removeAttribute('data-open');
      this.setAttribute('aria-hidden', 'true');
      this.hidden = true;

      if (this._openAbort) {
        this._openAbort.abort();
        this._openAbort = null;
      }

      if (this._autoCloseTimer) {
        window.clearTimeout(this._autoCloseTimer);
        this._autoCloseTimer = null;
      }

      if (config.lockScroll) unlockBodyScroll();

      if (this._lastFocused && typeof this._lastFocused.focus === 'function') {
        this._lastFocused.focus({ preventScroll: true });
      }
    }

    hasBeenShown() {
      const config = getConfigFromDataset(this);
      if (!config.storageType || !config.storageKey) return this._open;
      return readStorage(config.storageType, config.storageKey) === '1';
    }

    _handleKeydown(event) {
      if (!this._open) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(this._dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  if (!customElements.get('popup-system')) {
    customElements.define('popup-system', PopupSystemElement);
  }

  const initAwarenessTrigger = (popup) => {
    const config = getConfigFromDataset(popup);
    if (config.disabled) return;
    if (readStorage('session', config.storageKey) === '1') return;

    const delayMs = Math.min(Math.max(config.delayMs, 0), 2000);
    window.setTimeout(() => {
      if (!popup.isConnected) return;
      if (readStorage('session', config.storageKey) === '1') return;
      popup.open();
      writeStorage('session', config.storageKey, '1');
    }, delayMs);
  };

  const initConversionTrigger = (popup) => {
    const config = getConfigFromDataset(popup);
    if (config.disabled) return;
    if (readStorage('local', config.storageKey) === '1') return;

    const scheduleOpen = () => {
      const awarenessShown = config.awarenessKey
        ? readStorage('session', config.awarenessKey) === '1'
        : false;

      if (!awarenessShown) return;
      if (readStorage('local', config.storageKey) === '1') return;

      const sessionStart = getSessionStart();
      const elapsed = Date.now() - sessionStart;
      const delayRemaining = Math.max(config.delayMs - elapsed, 0);

      if (delayRemaining === 0) {
        if (!popup.isConnected) return;
        popup.open();
        writeStorage('local', config.storageKey, '1');
        return;
      }

      window.setTimeout(() => {
        const awarenessStillShown = config.awarenessKey
          ? readStorage('session', config.awarenessKey) === '1'
          : false;
        if (!awarenessStillShown) return;
        if (readStorage('local', config.storageKey) === '1') return;
        if (!popup.isConnected) return;

        popup.open();
        writeStorage('local', config.storageKey, '1');
      }, delayRemaining);
    };

    ensureSessionStart();

    if (config.awarenessKey && readStorage('session', config.awarenessKey) !== '1') {
      const controller = new AbortController();
      document.addEventListener(
        'popup:shown',
        (event) => {
          if (!event.detail || event.detail.storageKey !== config.awarenessKey) return;
          controller.abort();
          scheduleOpen();
        },
        { signal: controller.signal }
      );
      return;
    }

    scheduleOpen();
  };

  const init = () => {
    const popups = Array.from(document.querySelectorAll('popup-system'));
    if (popups.some((popup) => popup.dataset.popupType === 'conversion')) {
      ensureSessionStart();
    }
    popups.forEach((popup) => {
      const config = getConfigFromDataset(popup);
      if (config.type === 'awareness') {
        initAwarenessTrigger(popup);
      }

      if (config.type === 'conversion') {
        initConversionTrigger(popup);
      }
    });
  };

  window.PopupSystem = {
    __initialized: true,
    init
  };

  init();
})();
