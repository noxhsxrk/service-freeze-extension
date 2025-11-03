(async () => {
  const { organization, apiKey } = await chrome.storage.sync.get([
    "organization",
    "apiKey",
  ]);

  if (!organization) {
    return;
  }

  if (!apiKey) {
    return;
  }

  const regex = new RegExp(`bitbucket\\.org\\/${organization}\\/([^/]+)`);
  const match = window.location.href.match(regex);
  const serviceName = match ? match[1] : null;

  if (!serviceName) {
    return;
  }

  let isFrozen = false;

  try {

    const response = await chrome.runtime.sendMessage({
      action: "checkServiceFreeze",
      serviceName: serviceName,
      apiKey: apiKey,
    });

    if (response.error) {
      return;
    }

    isFrozen = response.isFrozen;
  } catch (err) {
    return;
  }

  if (!isFrozen) {
    return;
  }

  let bypassChecked = false;

  const observer = new MutationObserver(() => {
    if (!bypassChecked) {
      const prTitle = getPRTitle();
      
      if (prTitle && prTitle.includes('changelog')) {
        observer.disconnect();
        return;
      }
      
      if (prTitle) {
        bypassChecked = true;
      }
    }

    const mergeButton =
      document.querySelector('[data-testid="mergeButton-primary"]') ||
      [...document.querySelectorAll("button")].find((btn) =>
        /merge/i.test(btn.textContent)
      );
    if (mergeButton) {
      disableMergeButton(mergeButton);
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  function getPRTitle() {
    const selectors = [
      'h1',
      '[data-testid="pull-request-title"]',
      '[data-qa="pr-header-title"]',
      'h1[class*="title"]',
      'div[class*="pull-request"] h1',
      'article h1',
      '.pull-request-title'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.toLowerCase().trim();
      }
    }

    const pageTitle = document.title.toLowerCase();
    if (pageTitle && !pageTitle.includes('bitbucket')) {
      return pageTitle;
    }

    return '';
  }

  function disableMergeButton(btn) {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    btn.style.position = "relative";

    const overlay = document.createElement("div");
    overlay.textContent = "🚫";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(255, 77, 77, 0.6)";
    overlay.style.color = "#fff";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.fontWeight = "bold";
    overlay.style.borderRadius = "6px";
    btn.style.pointerEvents = "none";
    btn.appendChild(overlay);
  }
})();
