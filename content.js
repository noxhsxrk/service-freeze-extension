(async () => {
  console.log("[Service Freeze] Content script loaded");

  const { organization, apiKey } = await chrome.storage.sync.get([
    "organization",
    "apiKey",
  ]);

  console.log("[Service Freeze] Settings:", {
    organization,
    hasApiKey: !!apiKey,
  });

  if (!organization) {
    console.warn(
      "Organization not set. Please configure in extension options."
    );
    return;
  }

  if (!apiKey) {
    console.warn("API Key not set. Please configure in extension options.");
    return;
  }

  const regex = new RegExp(`bitbucket\\.org\\/${organization}\\/([^/]+)`);
  const match = window.location.href.match(regex);
  const serviceName = match ? match[1] : null;

  console.log("[Service Freeze] URL:", window.location.href);
  console.log("[Service Freeze] Service name:", serviceName);

  if (!serviceName) {
    console.log("[Service Freeze] No service name found, exiting");
    return;
  }

  let isFrozen = false;

  try {
    console.log("[Service Freeze] Sending message to background script...");

    const response = await chrome.runtime.sendMessage({
      action: "checkServiceFreeze",
      serviceName: serviceName,
      apiKey: apiKey,
    });

    console.log("[Service Freeze] Response from background:", response);

    if (response.error) {
      console.error("❌ Error fetching service freeze status:", response.error);

      // Show notification to user
      if (response.error.includes("403")) {
        alert("⚠️ Service Freeze Extension Error:\n\n" + response.error);
      }
      return;
    }

    isFrozen = response.isFrozen;
    console.log("[Service Freeze] Is frozen:", isFrozen);
  } catch (err) {
    console.error("Error communicating with background script:", err);
    return;
  }

  if (!isFrozen) {
    console.log("[Service Freeze] Service not frozen, exiting");
    return;
  }

  console.log(
    "[Service Freeze] Service is frozen! Looking for merge button..."
  );

  const observer = new MutationObserver(() => {
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
