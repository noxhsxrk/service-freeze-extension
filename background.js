chrome.runtime.onInstalled.addListener(() => {
  console.log("Service Freeze Merge Guard installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Service Freeze BG] Received message:", request);

  if (request.action === "checkServiceFreeze") {
    checkServiceFreeze(request.serviceName, request.apiKey)
      .then((isFrozen) => {
        console.log("[Service Freeze BG] Sending response:", { isFrozen });
        sendResponse({ isFrozen });
      })
      .catch((error) => {
        console.error("[Service Freeze BG] Error:", error);
        sendResponse({ error: error.message });
      });
    return true;
  }
});

async function checkServiceFreeze(serviceName, apiKey) {
  const apiUrl = "https://noxhsxrk.com/api/dev/jira/services";

  console.log("[Service Freeze BG] Checking service:", serviceName);
  console.log("[Service Freeze BG] API URL:", apiUrl);

  try {
    console.log("[Service Freeze BG] Fetching API...");

    const res = await fetch(apiUrl, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    console.log("[Service Freeze BG] Response status:", res.status);

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error(
          `API Key is invalid or unauthorized (403). Please check your API key in extension settings.`
        );
      }
      throw new Error(`API returned ${res.status}`);
    }

    const data = await res.json();
    console.log("[Service Freeze BG] API data:", data);

    const service = data.services.find((s) => s.service_name === serviceName);
    console.log("[Service Freeze BG] Found service:", service);

    const isFrozen = !!(service && service.status === true);
    console.log("[Service Freeze BG] Is frozen:", isFrozen);

    return isFrozen;
  } catch (err) {
    console.error(
      "[Service Freeze BG] Error fetching service freeze status:",
      err
    );
    throw err;
  }
}
