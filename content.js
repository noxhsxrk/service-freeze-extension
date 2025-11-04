(async () => {
  console.log("[Service Freeze] Content script loaded");
  
  let currentUrl = window.location.href;
  let checkInterval = null;
  let mergeButtonObserver = null;
  
  const { organization, apiKey } = await chrome.storage.sync.get([
    "organization",
    "apiKey",
  ]);

  console.log("[Service Freeze] Settings:", {
    organization,
    hasApiKey: !!apiKey,
  });

  if (!organization || !apiKey) {
    console.warn("[Service Freeze] Organization or API Key not set");
    return;
  }

  async function checkAndApplyFreeze() {
    const url = window.location.href;
    
    const regex = new RegExp(`bitbucket\\.org\\/${organization}\\/([^/]+)\\/pull-requests\\/(\\d+)`);
    const match = url.match(regex);
    
    if (!match) {
      console.log("[Service Freeze] Not on a PR page");
      cleanup();
      return;
    }

    const serviceName = match[1];
    const prNumber = match[2];
    
    console.log("[Service Freeze] Checking PR:", { serviceName, prNumber, url });

    try {
      const response = await chrome.runtime.sendMessage({
        action: "checkServiceFreeze",
        serviceName: serviceName,
        apiKey: apiKey,
      });

      console.log("[Service Freeze] Response:", response);

      if (response.error) {
        console.error("[Service Freeze] Error:", response.error);
        cleanup();
        return;
      }

      const { isFrozen, serviceData } = response;
      
      console.log("[Service Freeze] Is frozen:", isFrozen);

      if (!isFrozen) {
        console.log("[Service Freeze] Service not frozen");
        cleanup();
        return;
      }

      console.log("[Service Freeze] Service is frozen! Applying freeze logic...");
      applyFreezeLogic(serviceData);
      
    } catch (err) {
      console.error("[Service Freeze] Exception:", err);
      cleanup();
    }
  }

  function applyFreezeLogic(serviceData) {
    if (mergeButtonObserver) {
      mergeButtonObserver.disconnect();
    }

    let bypassChecked = false;
    let buttonDisabled = false;

    mergeButtonObserver = new MutationObserver(() => {
      if (!bypassChecked) {
        const prTitle = getPRTitle();
        console.log("[Service Freeze] PR Title:", prTitle);
        
        if (prTitle && prTitle.includes('changelog')) {
          console.log("[Service Freeze] Bypassing - PR title contains 'changelog'");
          cleanup();
          return;
        }

        if (serviceData && serviceData.changelog_url) {
          const currentPageUrl = window.location.href.toLowerCase().trim();
          const changelogUrl = serviceData.changelog_url.toLowerCase().trim();
          
          if (currentPageUrl === changelogUrl || currentPageUrl.startsWith(changelogUrl)) {
            console.log("[Service Freeze] Bypassing - URL matches changelog_url");
            cleanup();
            return;
          }
        }
        
        if (prTitle) {
          bypassChecked = true;
        }
      }

      if (!buttonDisabled) {
        const mergeButton =
          document.querySelector('[data-testid="mergeButton-primary"]') ||
          [...document.querySelectorAll("button")].find((btn) =>
            /merge/i.test(btn.textContent)
          );
        
        if (mergeButton && !mergeButton.hasAttribute('data-freeze-disabled')) {
          console.log("[Service Freeze] Merge button found! Disabling...");
          disableMergeButton(mergeButton, serviceData);
          showFreezeNotification(serviceData);
          buttonDisabled = true;
        }
      }
    });

    mergeButtonObserver.observe(document.body, { childList: true, subtree: true });
  }

  function cleanup() {
    if (mergeButtonObserver) {
      mergeButtonObserver.disconnect();
      mergeButtonObserver = null;
    }
    
    const notification = document.getElementById('service-freeze-notification');
    if (notification) {
      notification.remove();
    }
  }

  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const currentPageUrl = window.location.href;
    if (currentPageUrl !== lastUrl) {
      console.log("[Service Freeze] URL changed:", currentPageUrl);
      lastUrl = currentPageUrl;
      cleanup();
      checkAndApplyFreeze();
    }
  }).observe(document, { subtree: true, childList: true });

  window.addEventListener('popstate', () => {
    console.log("[Service Freeze] Popstate event");
    cleanup();
    setTimeout(checkAndApplyFreeze, 100);
  });

  checkInterval = setInterval(() => {
    console.log("[Service Freeze] Periodic re-check...");
    checkAndApplyFreeze();
  }, 30000);

  await checkAndApplyFreeze();

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

  function disableMergeButton(btn, serviceData) {
    btn.setAttribute('data-freeze-disabled', 'true');
    
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
    
    // Add tooltip
    if (serviceData && serviceData.frozen_by) {
      overlay.title = `Frozen by ${serviceData.frozen_by}`;
    }
    
    btn.appendChild(overlay);
  }

  function showFreezeNotification(serviceData) {
    // Check if notification already exists
    if (document.getElementById('service-freeze-notification')) {
      return;
    }

    const notification = document.createElement("div");
    notification.id = "service-freeze-notification";
    notification.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 320px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    let content = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="font-size: 32px;">🚫</div>
        <div>
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">
            Service Frozen
          </div>
          <div style="font-size: 13px; opacity: 0.95;">
            Merge is currently disabled
          </div>
        </div>
      </div>
    `;

    if (serviceData) {
      content += `<div style="border-top: 1px solid rgba(255,255,255,0.3); padding-top: 12px; font-size: 13px;">`;
      
      if (serviceData.frozen_by) {
        content += `
          <div style="margin-bottom: 8px;">
            <span style="opacity: 0.9;">🧊 Frozen by:</span>
            <div style="font-weight: 600; margin-top: 2px;">${serviceData.frozen_by}</div>
          </div>
        `;
      }

      if (serviceData.frozen_by_email) {
        content += `
          <div style="margin-bottom: 8px;">
            <span style="opacity: 0.9;">📧 Email:</span>
            <div style="margin-top: 2px;">${serviceData.frozen_by_email}</div>
          </div>
        `;
      }

      if (serviceData.changelog_url && serviceData.changelog_url.trim()) {
        content += `
          <div style="margin-top: 10px;">
            <a href="${serviceData.changelog_url.trim()}" 
               target="_blank" 
               style="color: white; 
                      text-decoration: underline; 
                      font-weight: 600;
                      display: inline-flex;
                      align-items: center;
                      gap: 4px;">
              📋 View Changelog PR
              <span style="font-size: 10px;">↗</span>
            </a>
          </div>
        `;
      }

      if (serviceData.updated_at) {
        const date = new Date(serviceData.updated_at);
        const formattedDate = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        content += `
          <div style="margin-top: 12px; font-size: 11px; opacity: 0.8;">
            Last updated: ${formattedDate}
          </div>
        `;
      }

      content += `</div>`;
    }

    content += `
      <button id="close-freeze-notification" 
              style="position: absolute; 
                     top: 8px; 
                     right: 8px; 
                     background: rgba(255,255,255,0.2); 
                     border: none; 
                     color: white; 
                     width: 24px; 
                     height: 24px; 
                     border-radius: 50%; 
                     cursor: pointer;
                     font-size: 16px;
                     line-height: 1;
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     transition: background 0.2s;">
        ×
      </button>
    `;

    notification.innerHTML = content;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      #close-freeze-notification:hover {
        background: rgba(255,255,255,0.3) !important;
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    const closeBtn = document.getElementById('close-freeze-notification');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
      });
    }
  }
})();
